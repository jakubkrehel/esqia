import type { JSONContent } from "@tiptap/core";
import type { Mark, Node as PMNode } from "@tiptap/pm/model";
import type { PhrasingContent } from "mdast";
import {
  LINE_BREAK,
  type MarkdownStyle,
  straighten,
  stringifyBlock,
} from "../shared/markdown";

export interface Original {
  fingerprint: string;
  gapBefore: string;
  previousId: string | null;
  source: string;
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
      return node.attrs.raw || LINE_BREAK;
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

  const children = hoistWhitespace(root);
  trimEdges(children);
  return children.filter(
    (child) => child.type !== "text" || child.value !== ""
  );
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
