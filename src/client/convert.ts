import type { JSONContent } from "@tiptap/core";
import type { Mark, Node as PMNode } from "@tiptap/pm/model";
import type { PhrasingContent, RootContent } from "mdast";
import type { MdxJsxTextElement } from "mdast-util-mdx-jsx";
import {
  blockType,
  curl,
  type MarkdownStyle,
  parseMdx,
  type Smartypants,
  straighten,
  stringifyBlock,
} from "../shared/markdown";

export interface Original {
  fingerprint: string;
  gapBefore: string;
  previousId: string | null;
  source: string;
}

export interface ParsedRun {
  doc: JSONContent;
  originals: Map<string, Original>;
}

export function parseRun(
  slice: string,
  smartypants: Smartypants = false
): ParsedRun {
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
      fingerprint: "",
      gapBefore: previous ? slice.slice(previous.end, start) : "",
      previousId: previous?.id ?? null,
      source: slice.slice(start, end),
    });
    previous = { end, id };
  }

  if (content.length === 0) {
    content.push({ type: "paragraph" });
  }
  return { doc: { content, type: "doc" }, originals };
}

function blockToJson(node: RootContent, source: string): JSONContent {
  const raw = () => sliceOf(node, source);
  switch (blockType(node)) {
    case "paragraph":
      return {
        content: inlineToJson(
          (node as { children: PhrasingContent[] }).children,
          source,
          []
        ),
        type: "paragraph",
      };
    case "heading":
      return {
        attrs: { level: (node as { depth: number }).depth },
        content: inlineToJson(
          (node as { children: PhrasingContent[] }).children,
          source,
          []
        ),
        type: "heading",
      };
    case "code": {
      const code = node as {
        lang?: string | null;
        meta?: string | null;
        value: string;
      };
      return {
        attrs: { language: code.lang ?? null, meta: code.meta ?? null },
        content: code.value ? [{ text: code.value, type: "text" }] : undefined,
        type: "codeBlock",
      };
    }
    case "spacer":
      return { attrs: { raw: raw() }, type: "spacer" };
    default:
      return { attrs: { raw: raw() }, type: "jsxBlock" };
  }
}

type JsonMark = NonNullable<JSONContent["marks"]>[number];

function inlineToJson(
  nodes: PhrasingContent[],
  source: string,
  marks: JsonMark[]
): JSONContent[] {
  const out: JSONContent[] = [];
  const text = (value: string, extra: JsonMark[] = []) => {
    if (value) {
      out.push({
        marks: marks.concat(extra).length ? marks.concat(extra) : undefined,
        text: value,
        type: "text",
      });
    }
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
        out.push(
          ...inlineToJson(node.children, source, [...marks, { type: "bold" }])
        );
        break;
      case "emphasis":
        out.push(
          ...inlineToJson(node.children, source, [...marks, { type: "italic" }])
        );
        break;
      case "link":
        out.push(
          ...inlineToJson(node.children, source, [
            ...marks,
            {
              attrs: { href: node.url, title: node.title ?? null },
              type: "link",
            },
          ])
        );
        break;
      case "mdxJsxTextElement": {
        const element = node as MdxJsxTextElement;
        const first = element.children[0]?.position?.start.offset;
        const last = element.children.at(-1)?.position?.end.offset;
        const start = element.position?.start.offset;
        const end = element.position?.end.offset;
        if (
          first === undefined ||
          last === undefined ||
          start === undefined ||
          end === undefined
        ) {
          out.push({
            attrs: { raw: sliceOf(node, source) },
            marks: marks.length ? marks : undefined,
            type: "jsxInline",
          });
          break;
        }
        const mark: JsonMark = {
          attrs: {
            close: source.slice(last, end),
            name: element.name ?? "",
            open: source.slice(start, first),
          },
          type: "jsx",
        };
        out.push(
          ...inlineToJson(element.children as PhrasingContent[], source, [
            ...marks,
            mark,
          ])
        );
        break;
      }
      default:
        out.push({
          attrs: { raw: sliceOf(node, source) },
          marks: marks.length ? marks : undefined,
          type: "jsxInline",
        });
    }
  }
  return out;
}

function sliceOf(
  node: { position?: { start: { offset?: number }; end: { offset?: number } } },
  source: string
) {
  return source.slice(
    node.position?.start.offset ?? 0,
    node.position?.end.offset ?? 0
  );
}

export function fingerprint(node: PMNode): string {
  const json = node.toJSON() as JSONContent;
  const { id: _id, ...attrs } = json.attrs ?? {};
  return JSON.stringify({ ...json, attrs });
}

export function serializeBlock(node: PMNode, style: MarkdownStyle): string {
  switch (node.type.name) {
    case "paragraph":
      return stringifyBlock(
        { children: inlineToMdast(node, style), type: "paragraph" },
        style
      );
    case "heading":
      return stringifyBlock(
        {
          children: inlineToMdast(node, style),
          depth: node.attrs.level,
          type: "heading",
        },
        style
      );
    case "codeBlock":
      return stringifyBlock(
        {
          lang: node.attrs.language || null,
          meta: node.attrs.meta || null,
          type: "code",
          value: node.textContent,
        },
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
      .sort(
        (a, b) =>
          MARK_ORDER.indexOf(a.type.name) - MARK_ORDER.indexOf(b.type.name)
      );

    let keep = 0;
    while (
      keep < stack.length &&
      keep < marks.length &&
      stack[keep]?.mark.eq(marks[keep] as Mark)
    ) {
      keep++;
    }
    stack.length = keep;

    for (const mark of marks.slice(keep)) {
      const container = markToMdast(mark);
      (stack.at(-1)?.children ?? root).push(container);
      stack.push({
        children: (container as { children: PhrasingContent[] }).children,
        mark,
      });
    }

    const parent = stack.at(-1)?.children ?? root;
    if (child.isText) {
      const isCode = child.marks.some((mark) => mark.type.name === "code");
      parent.push(
        isCode
          ? { type: "inlineCode", value: child.text ?? "" }
          : {
              type: "text",
              value: straighten(child.text ?? "", style.smartypants),
            }
      );
    } else {
      parent.push({ type: "raw", value: child.attrs.raw ?? "" });
    }
  });

  return hoistWhitespace(root);
}

function trimEdges(children: PhrasingContent[]): {
  lead: string;
  trail: string;
} {
  const first = children[0];
  const last = children.at(-1);
  let lead = "";
  let trail = "";
  if (first?.type === "text") {
    lead = /^\s+/.exec(first.value)?.[0] ?? "";
    first.value = first.value.slice(lead.length);
  }
  if (last?.type === "text") {
    trail = /\s+$/.exec(last.value)?.[0] ?? "";
    last.value = last.value.slice(0, last.value.length - trail.length);
  }
  return { lead, trail };
}

function hoistWhitespace(nodes: PhrasingContent[]): PhrasingContent[] {
  return nodes.flatMap((node): PhrasingContent[] => {
    if (!("children" in node)) {
      return [node];
    }
    node.children = hoistWhitespace(
      node.children as PhrasingContent[]
    ) as never;
    if (node.type !== "strong" && node.type !== "emphasis") {
      return [node];
    }

    const { lead, trail } = trimEdges(node.children as PhrasingContent[]);
    node.children = node.children.filter(
      (child) => child.type !== "text" || child.value !== ""
    );

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
      return { children: [], type: "strong" };
    case "italic":
      return { children: [], type: "emphasis" };
    case "link":
      return {
        children: [],
        title: mark.attrs.title || null,
        type: "link",
        url: mark.attrs.href,
      };
    default:
      return {
        children: [],
        close: mark.attrs.close,
        open: mark.attrs.open,
        type: "jsxWrap",
      };
  }
}

export function writtenBlocks(doc: PMNode): { node: PMNode; offset: number }[] {
  const children: { node: PMNode; offset: number }[] = [];
  doc.forEach((node, offset) => children.push({ node, offset }));
  const isParagraph = (entry: { node: PMNode } | undefined) =>
    entry?.node.type.name === "paragraph" && entry.node.content.size > 0;

  return children.filter(({ node }, index) => {
    if (node.isTextblock && node.content.size === 0) {
      return false;
    }
    if (node.type.name !== "spacer" || node.attrs.id || !node.attrs.auto) {
      return true;
    }
    if (children[index - 1]?.node.type.name === "spacer") {
      return false;
    }
    let next = index + 1;
    while (children[next]?.node.type.name === "spacer") {
      next++;
    }
    return isParagraph(children[index - 1]) && isParagraph(children[next]);
  });
}

export function serializeRun(
  doc: PMNode,
  originals: Map<string, Original>,
  style: MarkdownStyle
): string {
  const parts: string[] = [];
  const used = new Set<string>();
  let previousId: string | null = null;

  for (const { node } of writtenBlocks(doc)) {
    const id: string | null = node.attrs.id ?? null;
    const original = id && !used.has(id) ? originals.get(id) : undefined;
    if (id) {
      used.add(id);
    }

    const text =
      original && original.fingerprint === fingerprint(node)
        ? original.source
        : serializeBlock(node, style);
    let gap = "\n\n";
    if (parts.length === 0) {
      gap = "";
    } else if (original && original.previousId === previousId) {
      gap = original.gapBefore;
    }
    parts.push(gap + text);
    previousId = id;
  }

  return parts.join("");
}
