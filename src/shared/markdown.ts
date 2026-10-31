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
      return visible.length > 0 &&
        visible.every((child) => child.type === "image")
        ? "media"
        : "paragraph";
    }
    case "mdxJsxFlowElement":
      return node.name === "br" && node.children.length === 0
        ? "spacer"
        : "block";
    default:
      return "block";
  }
}

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
  smartypants: Smartypants;
  spacers: boolean;
  strong: "*" | "_";
}

export function curl(tree: Root, smartypants: Smartypants): Root {
  if (smartypants === false) {
    return tree;
  }
  return unified().use(remarkSmartypants, smartypants).runSync(tree) as Root;
}

export function straighten(text: string, smartypants: Smartypants): string {
  if (smartypants === false) {
    return text;
  }
  let value = text;
  if (smartypants.quotes !== false) {
    value = value.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  }
  if (smartypants.ellipses !== false) {
    value = value.replaceAll("…", "...");
  }
  const dashes = smartypants.dashes ?? true;
  if (dashes === true) {
    value = value.replaceAll("—", "--");
  }
  if (dashes === "oldschool") {
    value = value.replaceAll("—", "---").replaceAll("–", "--");
  }
  if (dashes === "inverted") {
    value = value.replaceAll("–", "---").replaceAll("—", "--");
  }
  return value;
}

export function detectStyle(
  source: string,
  tree: Root = parseMdx(source)
): MarkdownStyle {
  const counts = { emphasis: { _: 0, "*": 0 }, strong: { _: 0, "*": 0 } };
  const visit = (node: Nodes) => {
    if ((node.type === "emphasis" || node.type === "strong") && node.position) {
      const marker = source[node.position.start.offset ?? 0];
      if (marker === "*" || marker === "_") {
        counts[node.type][marker]++;
      }
    }
    if ("children" in node) {
      for (const child of node.children) {
        visit(child);
      }
    }
  };
  visit(tree);
  return {
    emphasis: counts.emphasis._ > counts.emphasis["*"] ? "_" : "*",
    smartypants: false,
    spacers: tree.children.some((node) => blockType(node) === "spacer"),
    strong: counts.strong._ > counts.strong["*"] ? "_" : "*",
  };
}

export interface RawNode extends Literal {
  type: "raw";
}

export interface JsxWrapNode extends Parent {
  close: string;
  open: string;
  type: "jsxWrap";
}

declare module "mdast" {
  interface RootContentMap {
    jsxWrap: JsxWrapNode;
    raw: RawNode;
  }
  interface PhrasingContentMap {
    jsxWrap: JsxWrapNode;
    raw: RawNode;
  }
}

const raw: Handle = (node: RawNode) => node.value;

const jsxWrap: Handle = (node: JsxWrapNode, _parent, state, info) => {
  const tracker = state.createTracker(info);
  let value = tracker.move(node.open);
  value += tracker.move(
    state.containerPhrasing(node as never, {
      ...tracker.current(),
      after: node.close.charAt(0),
      before: value.slice(-1),
    })
  );
  value += tracker.move(node.close);
  return value;
};

export function stringifyBlock(
  node: RootContent,
  style: MarkdownStyle
): string {
  if (node.type === "raw") {
    return node.value;
  }
  return toMarkdown({ children: [node], type: "root" } as Root, {
    emphasis: style.emphasis,
    extensions: [mdxToMarkdown()],
    fence: "`",
    fences: true,
    handlers: { jsxWrap, raw } as never,
    rule: "-",
    strong: style.strong,
  })
    .replace(/\n$/, "")

    .replace(/\\&(?![#a-zA-Z0-9]+;)/g, "&");
}
