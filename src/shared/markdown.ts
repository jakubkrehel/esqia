import type { Literal, Nodes, Parent, Root, RootContent } from "mdast";
import { mdxToMarkdown } from "mdast-util-mdx";
import { type Handle, toMarkdown } from "mdast-util-to-markdown";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import remarkSmartypants from "remark-smartypants";
import { unified } from "unified";

export type BlockType =
  | "paragraph"
  | "heading"
  | "code"
  | "spacer"
  | "media"
  | "block";

export const EDITABLE: ReadonlySet<BlockType> = new Set([
  "paragraph",
  "heading",
  "code",
  "spacer",
]);

const parser = unified().use(remarkParse).use(remarkMdx);

export function parseMdx(source: string): Root {
  return parser.parse(source);
}

export function blockType(node: RootContent): BlockType {
  switch (node.type) {
    case "heading":
      return "heading";
    case "code":
      return "code";
    case "paragraph": {
      const visible = node.children.filter(
        (child) => !(child.type === "text" && child.value.trim() === "")
      );
      return visible.length > 0 && visible.every((child) => child.type === "image")
        ? "media"
        : "paragraph";
    }
    case "mdxJsxFlowElement":
      return node.name === "br" && node.children.length === 0 ? "spacer" : "block";
    default:
      return "block";
  }
}

/** The options the site passes to `remark-smartypants`, or false when it doesn't use it. */
export type Smartypants =
  | false
  | {
      dashes?: boolean | "oldschool" | "inverted";
      ellipses?: boolean;
      quotes?: boolean;
      backticks?: boolean | "all";
    };

export interface MarkdownStyle {
  emphasis: "*" | "_";
  strong: "*" | "_";
  spacers: boolean;
  smartypants: Smartypants;
}

/** Typographic punctuation, exactly as the site's build renders it. */
export function curl(tree: Root, smartypants: Smartypants): Root {
  if (smartypants === false) return tree;
  return unified().use(remarkSmartypants, smartypants).runSync(tree) as Root;
}

/** Undo `curl` on text the editor produced, so the source keeps plain ASCII punctuation. */
export function straighten(text: string, smartypants: Smartypants): string {
  if (smartypants === false) return text;
  let value = text;
  if (smartypants.quotes !== false) value = value.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  if (smartypants.ellipses !== false) value = value.replaceAll("…", "...");
  const dashes = smartypants.dashes ?? true;
  if (dashes === true) value = value.replaceAll("—", "--");
  if (dashes === "oldschool") value = value.replaceAll("—", "---").replaceAll("–", "--");
  if (dashes === "inverted") value = value.replaceAll("–", "---").replaceAll("—", "--");
  return value;
}

export function detectStyle(source: string, tree: Root = parseMdx(source)): MarkdownStyle {
  const counts = { emphasis: { "*": 0, _: 0 }, strong: { "*": 0, _: 0 } };
  const visit = (node: Nodes) => {
    if ((node.type === "emphasis" || node.type === "strong") && node.position) {
      const marker = source[node.position.start.offset ?? 0];
      if (marker === "*" || marker === "_") counts[node.type][marker]++;
    }
    if ("children" in node) for (const child of node.children) visit(child);
  };
  visit(tree);
  return {
    emphasis: counts.emphasis._ > counts.emphasis["*"] ? "_" : "*",
    strong: counts.strong._ > counts.strong["*"] ? "_" : "*",
    spacers: tree.children.some((node) => blockType(node) === "spacer"),
    smartypants: false,
  };
}

/** Verbatim source, emitted as-is. Used for JSX the editor never parses. */
export interface RawNode extends Literal {
  type: "raw";
}

/** Inline JSX whose children stay editable; the tags are kept verbatim. */
export interface JsxWrapNode extends Parent {
  type: "jsxWrap";
  open: string;
  close: string;
}

declare module "mdast" {
  interface RootContentMap {
    raw: RawNode;
    jsxWrap: JsxWrapNode;
  }
  interface PhrasingContentMap {
    raw: RawNode;
    jsxWrap: JsxWrapNode;
  }
}

const raw: Handle = (node: RawNode) => node.value;

const jsxWrap: Handle = (node: JsxWrapNode, _parent, state, info) => {
  const tracker = state.createTracker(info);
  let value = tracker.move(node.open);
  value += tracker.move(
    state.containerPhrasing(node as never, { ...tracker.current(), before: value.slice(-1), after: node.close.charAt(0) })
  );
  value += tracker.move(node.close);
  return value;
};

export function stringifyBlock(node: RootContent, style: MarkdownStyle): string {
  if (node.type === "raw") return node.value;
  return toMarkdown({ type: "root", children: [node] } as Root, {
    emphasis: style.emphasis,
    strong: style.strong,
    fence: "`",
    fences: true,
    rule: "-",
    extensions: [mdxToMarkdown()],
    handlers: { raw, jsxWrap } as never,
  })
    .replace(/\n$/, "")
    // An ampersand only needs escaping when it would start a character reference.
    .replace(/\\&(?![#a-zA-Z0-9]+;)/g, "&");
}
