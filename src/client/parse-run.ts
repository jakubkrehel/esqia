import type { JSONContent } from "@tiptap/core";
import type { Node as PMNode, Schema } from "@tiptap/pm/model";
import type { PhrasingContent, RootContent } from "mdast";
import type { MdxJsxTextElement } from "mdast-util-mdx-jsx";
import {
  blockType,
  curl,
  type FlatList,
  parseMdx,
  type Smartypants,
} from "../shared/markdown";
import type { BulletMarker, ListAttrs, OrderedMarker } from "./lists";
import { fingerprint, type Original } from "./serialize-run";

export interface ParsedRun {
  doc: PMNode;
  originals: Map<string, Original>;
}

export function parseRun(
  slice: string,
  schema: Schema,
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
  const doc = schema.nodeFromJSON({ content, type: "doc" });
  doc.forEach((node) => {
    const original = originals.get(node.attrs.id);
    if (original) {
      original.fingerprint = fingerprint(node);
    }
  });
  return { doc, originals };
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
    case "list":
      return listToJson(node as FlatList, source);
    case "spacer":
      return { attrs: { raw: raw() }, type: "spacer" };
    default:
      return { attrs: { raw: raw() }, type: "jsxBlock" };
  }
}

const ORDERED_NUMBER = /^\d+/;

function listToJson(list: FlatList, source: string): JSONContent {
  return {
    attrs: listAttrs(list, source),
    content: list.children.map((item) => ({
      content: inlineToJson(item.children[0].children, source, []),
      type: "listItem",
    })),
    type: "list",
  };
}

function listAttrs(list: FlatList, source: string): ListAttrs {
  const [first, second] = list.children.map((item) => sliceOf(item, source));
  const spread = Boolean(list.spread);
  if (!list.ordered) {
    return { marker: first.charAt(0) as BulletMarker, ordered: false, spread };
  }
  const number = (marker: string) => ORDERED_NUMBER.exec(marker)?.[0];
  return {
    increment: second === undefined || number(second) !== number(first),
    marker: first.replace(ORDERED_NUMBER, "").charAt(0) as OrderedMarker,
    ordered: true,
    spread,
    start: list.start ?? 1,
  };
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

export function sliceOf(
  node: { position?: { start: { offset?: number }; end: { offset?: number } } },
  source: string
) {
  return source.slice(
    node.position?.start.offset ?? 0,
    node.position?.end.offset ?? 0
  );
}
