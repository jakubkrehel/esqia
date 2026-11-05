import { getSchema } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { describe, expect, it } from "vitest";
import { createExtensions } from "../src/client/editor";
import { parseRun } from "../src/client/parse-run";
import { serializeBlock, serializeRun } from "../src/client/serialize-run";
import type { Templates } from "../src/client/templates";
import { blockType, detectStyle, parseMdx } from "../src/shared/markdown";

const schema = getSchema(
  createExtensions({
    config: { marks: [], smartypants: false, snippets: [] },
    slash: { onChange: () => undefined, onKeyDown: () => false },
    spacers: true,
    templates: {} as Templates,
  })
);

const typeOf = (source: string) => {
  const [node] = parseMdx(source).children;
  return node ? blockType(node) : null;
};

const reserialized = (source: string) => {
  const style = { ...detectStyle(source), smartypants: false as const };
  const block = parseRun(source, schema).doc.firstChild as PMNode;
  return serializeBlock(block, style);
};

describe("lists", () => {
  it("edits flat lists and leaves the rest as blocks", () => {
    expect(typeOf("- one\n- two")).toBe("list");
    expect(typeOf("1. one\n2. two")).toBe("list");
    expect(typeOf("- one\n  - nested")).toBe("block");
    expect(typeOf("- one\n\n  second paragraph")).toBe("block");
    expect(typeOf("- [ ] task\n- [x] done")).toBe("block");
  });

  it("writes an untouched list back byte for byte", () => {
    const source = "Intro\n\n*   odd spacing\n*   kept\n\nOutro";
    const style = { ...detectStyle(source), smartypants: false as const };
    const { doc, originals } = parseRun(source, schema);
    expect(serializeRun(doc, originals, style)).toBe(source);
  });

  it.each([
    "- one\n- two",
    "* one\n* two",
    "+ one\n+ two",
    "1. one\n2. two",
    "3) three\n4) four",
    "1. one\n1. two\n1. three",
    "- one\n\n- two",
    "- **bold**, *italic* and `code`\n- a [link](https://example.com)",
  ])("keeps the source format of %j when re-serialized", (source) => {
    expect(reserialized(source)).toBe(source);
  });

  it("drops empty items and a list left with none", () => {
    const style = { ...detectStyle(""), smartypants: false as const };
    const doc = schema.nodeFromJSON({
      content: [
        {
          content: [
            { content: [{ text: "kept", type: "text" }], type: "listItem" },
            { type: "listItem" },
          ],
          type: "list",
        },
        { content: [{ type: "listItem" }], type: "list" },
      ],
      type: "doc",
    });
    expect(serializeRun(doc, new Map(), style)).toBe("- kept");
  });
});
