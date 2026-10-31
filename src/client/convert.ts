import type { JSONContent } from "@tiptap/core";
import type { Mark, Node as PMNode } from "@tiptap/pm/model";
import type { PhrasingContent, RootContent } from "mdast";
import type { MdxJsxTextElement } from "mdast-util-mdx-jsx";
import { blockType, curl, type MarkdownStyle, parseMdx, type Smartypants, straighten, stringifyBlock } from "../shared/markdown";

/** What a block looked like when the run opened, so untouched blocks are written back byte for byte. */
export interface Original {
  source: string;
  gapBefore: string;
  previousId: string | null;
  fingerprint: string;
}

export interface ParsedRun {
  doc: JSONContent;
  originals: Map<string, Original>;
}

export function parseRun(slice: string, smartypants: Smartypants = false): ParsedRun {
  const tree = curl(parseMdx(slice), smartypants);
  const originals = new Map<string, Original>();
  const content: JSONContent[] = [];
  let previous: { id: string; end: number } | null = null;

  for (const [index, node] of tree.children.entries()) {
    const start = node.position?.start.offset ?? 0;
    const end = node.position?.end.offset ?? slice.length;
    const id = `b${index}`;
    const json = blockToJson(node, slice);
    content.push({ ...json, attrs: { ...json.attrs, id } });
    originals.set(id, {
      source: slice.slice(start, end),
      gapBefore: previous ? slice.slice(previous.end, start) : "",
      previousId: previous?.id ?? null,
      fingerprint: "",
    });
    previous = { id, end };
  }

  if (content.length === 0) content.push({ type: "paragraph" });
  return { doc: { type: "doc", content }, originals };
}

function blockToJson(node: RootContent, source: string): JSONContent {
  const raw = () => sliceOf(node, source);
  switch (blockType(node)) {
    case "paragraph":
      return { type: "paragraph", content: inlineToJson((node as { children: PhrasingContent[] }).children, source, []) };
    case "heading":
      return {
        type: "heading",
        attrs: { level: (node as { depth: number }).depth },
        content: inlineToJson((node as { children: PhrasingContent[] }).children, source, []),
      };
    case "code": {
      const code = node as { lang?: string | null; meta?: string | null; value: string };
      return {
        type: "codeBlock",
        attrs: { language: code.lang ?? null, meta: code.meta ?? null },
        content: code.value ? [{ type: "text", text: code.value }] : undefined,
      };
    }
    case "spacer":
      return { type: "spacer", attrs: { raw: raw() } };
    default:
      return { type: "jsxBlock", attrs: { raw: raw() } };
  }
}

type JsonMark = NonNullable<JSONContent["marks"]>[number];

function inlineToJson(nodes: PhrasingContent[], source: string, marks: JsonMark[]): JSONContent[] {
  const out: JSONContent[] = [];
  const text = (value: string, extra: JsonMark[] = []) => {
    if (value) out.push({ type: "text", text: value, marks: marks.concat(extra).length ? marks.concat(extra) : undefined });
  };

  for (const node of nodes) {
    switch (node.type) {
      case "text":
        text(node.value);
        break;
      case "inlineCode":
        text(node.value, [{ type: "code" }]);
        break;
      case "strong":
        out.push(...inlineToJson(node.children, source, [...marks, { type: "bold" }]));
        break;
      case "emphasis":
        out.push(...inlineToJson(node.children, source, [...marks, { type: "italic" }]));
        break;
      case "link":
        out.push(
          ...inlineToJson(node.children, source, [
            ...marks,
            { type: "link", attrs: { href: node.url, title: node.title ?? null } },
          ])
        );
        break;
      case "mdxJsxTextElement": {
        const element = node as MdxJsxTextElement;
        const first = element.children[0]?.position?.start.offset;
        const last = element.children.at(-1)?.position?.end.offset;
        const start = element.position?.start.offset;
        const end = element.position?.end.offset;
        if (first === undefined || last === undefined || start === undefined || end === undefined) {
          out.push({ type: "jsxInline", attrs: { raw: sliceOf(node, source) }, marks: marks.length ? marks : undefined });
          break;
        }
        const mark: JsonMark = {
          type: "jsx",
          attrs: { open: source.slice(start, first), close: source.slice(last, end), name: element.name ?? "" },
        };
        out.push(...inlineToJson(element.children as PhrasingContent[], source, [...marks, mark]));
        break;
      }
      default:
        out.push({ type: "jsxInline", attrs: { raw: sliceOf(node, source) }, marks: marks.length ? marks : undefined });
    }
  }
  return out;
}

function sliceOf(node: { position?: { start: { offset?: number }; end: { offset?: number } } }, source: string) {
  return source.slice(node.position?.start.offset ?? 0, node.position?.end.offset ?? 0);
}

export function fingerprint(node: PMNode): string {
  const json = node.toJSON() as JSONContent;
  const { id: _id, ...attrs } = json.attrs ?? {};
  return JSON.stringify({ ...json, attrs });
}

export function serializeBlock(node: PMNode, style: MarkdownStyle): string {
  switch (node.type.name) {
    case "paragraph":
      return stringifyBlock({ type: "paragraph", children: inlineToMdast(node, style) }, style);
    case "heading":
      return stringifyBlock({ type: "heading", depth: node.attrs.level, children: inlineToMdast(node, style) }, style);
    case "codeBlock":
      return stringifyBlock(
        { type: "code", lang: node.attrs.language || null, meta: node.attrs.meta || null, value: node.textContent },
        style
      );
    case "spacer":
      return node.attrs.raw || "<br />";
    default:
      return node.attrs.raw;
  }
}

const MARK_ORDER = ["link", "jsx", "bold", "italic"];

function inlineToMdast(block: PMNode, style: MarkdownStyle): PhrasingContent[] {
  const root: PhrasingContent[] = [];
  const stack: { mark: Mark; children: PhrasingContent[] }[] = [];

  block.forEach((child) => {
    const marks = child.marks
      .filter((mark) => mark.type.name !== "code")
      .sort((a, b) => MARK_ORDER.indexOf(a.type.name) - MARK_ORDER.indexOf(b.type.name));

    let keep = 0;
    while (keep < stack.length && keep < marks.length && stack[keep]?.mark.eq(marks[keep] as Mark)) keep++;
    stack.length = keep;

    for (const mark of marks.slice(keep)) {
      const container = markToMdast(mark);
      (stack.at(-1)?.children ?? root).push(container);
      stack.push({ mark, children: (container as { children: PhrasingContent[] }).children });
    }

    const parent = stack.at(-1)?.children ?? root;
    if (child.isText) {
      const isCode = child.marks.some((mark) => mark.type.name === "code");
      parent.push(isCode ? { type: "inlineCode", value: child.text ?? "" } : { type: "text", value: straighten(child.text ?? "", style.smartypants) });
    } else {
      parent.push({ type: "raw", value: child.attrs.raw ?? "" });
    }
  });

  return hoistWhitespace(root);
}

/** `**word **` doesn't close in markdown, so spaces at the edges of emphasis move outside it. */
function hoistWhitespace(nodes: PhrasingContent[]): PhrasingContent[] {
  return nodes.flatMap((node): PhrasingContent[] => {
    if (!("children" in node)) return [node];
    node.children = hoistWhitespace(node.children as PhrasingContent[]) as never;
    if (node.type !== "strong" && node.type !== "emphasis") return [node];

    const first = node.children[0];
    const last = node.children.at(-1);
    const lead = first?.type === "text" ? (/^\s+/.exec(first.value)?.[0] ?? "") : "";
    const trail = last?.type === "text" ? (/\s+$/.exec(last.value)?.[0] ?? "") : "";
    if (first?.type === "text" && lead) first.value = first.value.slice(lead.length);
    if (last?.type === "text" && trail) last.value = last.value.slice(0, last.value.length - trail.length);
    node.children = node.children.filter((child) => child.type !== "text" || child.value !== "");

    return [
      ...(lead ? [{ type: "text" as const, value: lead }] : []),
      ...(node.children.length ? [node] : []),
      ...(trail ? [{ type: "text" as const, value: trail }] : []),
    ];
  });
}

function markToMdast(mark: Mark): PhrasingContent {
  switch (mark.type.name) {
    case "bold":
      return { type: "strong", children: [] };
    case "italic":
      return { type: "emphasis", children: [] };
    case "link":
      return { type: "link", url: mark.attrs.href, title: mark.attrs.title || null, children: [] };
    default:
      return { type: "jsxWrap", open: mark.attrs.open, close: mark.attrs.close, children: [] };
  }
}

/**
 * The run's new source. Blocks that still match what was parsed keep their exact
 * text and the gap before them; everything else is serialized fresh.
 */
export function serializeRun(doc: PMNode, originals: Map<string, Original>, style: MarkdownStyle): string {
  const parts: string[] = [];
  const used = new Set<string>();
  let previousId: string | null = null;

  const children: PMNode[] = [];
  doc.forEach((node) => children.push(node));
  const isParagraph = (node: PMNode | undefined) => node?.type.name === "paragraph" && node.content.size > 0;

  children.forEach((node, index) => {
    // A spacer only separates paragraphs. One the editor added next to a heading or a block is noise.
    if (node.type.name === "spacer" && !node.attrs.id && !(isParagraph(children[index - 1]) && isParagraph(children[index + 1]))) {
      return;
    }
    const id: string | null = node.attrs.id ?? null;
    const original = id && !used.has(id) ? originals.get(id) : undefined;
    if (id) used.add(id);

    const empty = node.isTextblock && node.content.size === 0;
    if (empty) return;

    const text = original && original.fingerprint === fingerprint(node) ? original.source : serializeBlock(node, style);
    const gap = parts.length === 0 ? "" : original && original.previousId === previousId ? original.gapBefore : "\n\n";
    parts.push(gap + text);
    previousId = id;
  });

  return parts.join("");
}
