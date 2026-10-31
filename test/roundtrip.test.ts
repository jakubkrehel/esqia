import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { getSchema } from "@tiptap/core";
import { Node as PMNode } from "@tiptap/pm/model";
import { describe, expect, test } from "vitest";
import { fingerprint, parseRun, serializeBlock, serializeRun } from "../src/client/convert";
import { createExtensions, type Templates } from "../src/client/editor";
import { blockType, detectStyle, EDITABLE, parseMdx } from "../src/shared/markdown";

const REPOS = ["../jakub.kr/src/app", "../interfaces/src/app"].map((dir) => path.resolve(import.meta.dirname, "..", dir));

function contentFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (name === "node_modules" || name.startsWith(".")) return [];
    if (statSync(full).isDirectory()) return contentFiles(full);
    return name.endsWith(".mdx") ? [full] : [];
  });
}

const SMARTYPANTS = { dashes: false } as const;

const schema = getSchema(
  createExtensions({
    templates: {} as Templates,
    config: { smartypants: SMARTYPANTS, marks: [], snippets: [], media: { image: "", video: "" } },
    spacers: true,
  })
);

function runs(source: string): string[] {
  const tree = parseMdx(source);
  const slices: string[] = [];
  let current: { start: number; end: number } | null = null;
  for (const node of tree.children) {
    const start = node.position?.start.offset ?? 0;
    const end = node.position?.end.offset ?? 0;
    if (EDITABLE.has(blockType(node))) {
      current = current ? { start: current.start, end } : { start, end };
    } else {
      if (current) slices.push(source.slice(current.start, current.end));
      current = null;
    }
  }
  if (current) slices.push(source.slice(current.start, current.end));
  return slices;
}

function strip(node: PMNode) {
  return fingerprint(node);
}

const files = REPOS.flatMap((dir) => {
  try {
    return contentFiles(dir);
  } catch {
    return [];
  }
});

describe("round trip over real content", () => {
  test("finds content", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  for (const file of files) {
    const name = path.relative(path.resolve(import.meta.dirname, "../.."), file);
    const source = readFileSync(file, "utf8");
    const style = { ...detectStyle(source), smartypants: SMARTYPANTS };

    test(`${name}: untouched runs are written back byte for byte`, () => {
      for (const slice of runs(source)) {
        const { doc, originals } = parseRun(slice, SMARTYPANTS);
        const node = PMNode.fromJSON(schema, doc);
        node.forEach((child) => {
          const original = originals.get(child.attrs.id);
          if (original) original.fingerprint = fingerprint(child);
        });
        expect(serializeRun(node, originals, style)).toBe(slice);
      }
    });

    test(`${name}: every block survives serialize → parse`, () => {
      for (const slice of runs(source)) {
        const node = PMNode.fromJSON(schema, parseRun(slice, SMARTYPANTS).doc);
        node.forEach((block) => {
          const text = serializeBlock(block, style);
          const reparsed = PMNode.fromJSON(schema, parseRun(text, SMARTYPANTS).doc).firstChild;
          expect({ text, block: reparsed && strip(reparsed) }).toEqual({ text, block: strip(block) });
        });
      }
    });
  }

  test("most blocks serialize to their exact source", () => {
    let same = 0;
    let total = 0;
    const differing: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const style = { ...detectStyle(source), smartypants: SMARTYPANTS };
      for (const slice of runs(source)) {
        const tree = parseMdx(slice);
        const node = PMNode.fromJSON(schema, parseRun(slice, SMARTYPANTS).doc);
        node.forEach((block, _offset, index) => {
          const original = tree.children[index];
          const text = slice.slice(original?.position?.start.offset ?? 0, original?.position?.end.offset ?? 0);
          total++;
          if (serializeBlock(block, style) === text) same++;
          else if (differing.length < 15) differing.push(`- ${JSON.stringify(text)}\n+ ${JSON.stringify(serializeBlock(block, style))}`);
        });
      }
    }
    console.log(`${same}/${total} blocks byte-identical when re-serialized\n${differing.join("\n")}`);
    expect(same / total).toBeGreaterThan(0.9);
  });
});

describe("smartypants", () => {
  test("shows curled quotes and saves straight ones", () => {
    const style = { ...detectStyle(""), smartypants: SMARTYPANTS };
    const node = PMNode.fromJSON(schema, parseRun(`I don't think "so"... -- maybe`, SMARTYPANTS).doc);
    expect(node.textContent).toBe("I don’t think “so”… -- maybe");
    expect(serializeBlock(node.firstChild as PMNode, style)).toBe(`I don't think "so"... -- maybe`);
  });
});
