import { describe, expect, it } from "vitest";
import { blockType, parseMdx } from "../src/shared/markdown";
import { applyOps, deleteOps, moveOps } from "../src/shared/ops";

const source = "# Title\n\nFirst.\n\n<br />\n\nSecond.\n\n<Demo />\n";
const blocks = parseMdx(source).children.map((node) => ({
  end: node.position?.end.offset ?? 0,
  start: node.position?.start.offset ?? 0,
  type: blockType(node),
}));

const apply = (ops: Parameters<typeof applyOps>[1]) => {
  const result = applyOps(source, ops);
  if (!result.ok) {
    throw new Error(result.reason);
  }
  return result.source;
};

describe("ops", () => {
  it("classifies blocks", () => {
    expect(blocks.map((b) => b.type)).toEqual([
      "heading",
      "paragraph",
      "spacer",
      "paragraph",
      "block",
    ]);
  });

  it("replaces a range", () => {
    const [, first] = blocks;
    expect(
      apply([
        {
          end: first.end,
          expected: "First.",
          start: first.start,
          text: "**First.**",
        },
      ])
    ).toBe("# Title\n\n**First.**\n\n<br />\n\nSecond.\n\n<Demo />\n");
  });

  it("rejects a stale expectation", () => {
    const result = applyOps(source, [
      { end: 15, expected: "Other.", start: 9, text: "" },
    ]);
    expect(result.ok).toBe(false);
  });

  it("rejects overlapping ops", () => {
    const result = applyOps(source, [
      { end: 10, expected: source.slice(0, 10), start: 0, text: "" },
      { end: 12, expected: source.slice(5, 12), start: 5, text: "" },
    ]);
    expect(result.ok).toBe(false);
  });

  it("moves a block up", () => {
    expect(apply(moveOps(source, blocks, blocks[4], blocks[1]))).toBe(
      "# Title\n\n<Demo />\n\nFirst.\n\n<br />\n\nSecond.\n"
    );
  });

  it("moves a block to the end", () => {
    expect(apply(moveOps(source, blocks, blocks[1], null))).toBe(
      "# Title\n\n<br />\n\nSecond.\n\n<Demo />\n\nFirst.\n"
    );
  });

  it("moving onto itself is a no-op", () => {
    expect(moveOps(source, blocks, blocks[1], blocks[2])).toEqual([]);
  });

  it("deletes a block and one gap", () => {
    expect(apply(deleteOps(source, blocks, blocks[2]))).toBe(
      "# Title\n\nFirst.\n\nSecond.\n\n<Demo />\n"
    );
    expect(apply(deleteOps(source, blocks, blocks[4]))).toBe(
      "# Title\n\nFirst.\n\n<br />\n\nSecond.\n"
    );
  });
});
