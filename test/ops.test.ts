import { describe, expect, test } from "vitest";
import { blockType, parseMdx } from "../src/shared/markdown";
import { applyOps, deleteOps, moveOps } from "../src/shared/ops";

const source = "# Title\n\nFirst.\n\n<br />\n\nSecond.\n\n<Demo />\n";
const blocks = parseMdx(source).children.map((node) => ({
  start: node.position?.start.offset ?? 0,
  end: node.position?.end.offset ?? 0,
  type: blockType(node),
}));

const apply = (ops: Parameters<typeof applyOps>[1]) => {
  const result = applyOps(source, ops);
  if (!result.ok) throw new Error(result.reason);
  return result.source;
};

describe("ops", () => {
  test("classifies blocks", () => {
    expect(blocks.map((b) => b.type)).toEqual(["heading", "paragraph", "spacer", "paragraph", "block"]);
  });

  test("replaces a range", () => {
    const [, first] = blocks;
    expect(apply([{ start: first.start, end: first.end, expected: "First.", text: "**First.**" }])).toBe(
      "# Title\n\n**First.**\n\n<br />\n\nSecond.\n\n<Demo />\n"
    );
  });

  test("rejects a stale expectation", () => {
    const result = applyOps(source, [{ start: 9, end: 15, expected: "Other.", text: "" }]);
    expect(result.ok).toBe(false);
  });

  test("rejects overlapping ops", () => {
    const result = applyOps(source, [
      { start: 0, end: 10, expected: source.slice(0, 10), text: "" },
      { start: 5, end: 12, expected: source.slice(5, 12), text: "" },
    ]);
    expect(result.ok).toBe(false);
  });

  test("moves a block up", () => {
    expect(apply(moveOps(source, blocks, blocks[4], blocks[1]))).toBe(
      "# Title\n\n<Demo />\n\nFirst.\n\n<br />\n\nSecond.\n"
    );
  });

  test("moves a block to the end", () => {
    expect(apply(moveOps(source, blocks, blocks[1], null))).toBe(
      "# Title\n\n<br />\n\nSecond.\n\n<Demo />\n\nFirst.\n"
    );
  });

  test("moving onto itself is a no-op", () => {
    expect(moveOps(source, blocks, blocks[1], blocks[2])).toEqual([]);
  });

  test("deletes a block and one gap", () => {
    expect(apply(deleteOps(source, blocks, blocks[2]))).toBe("# Title\n\nFirst.\n\nSecond.\n\n<Demo />\n");
    expect(apply(deleteOps(source, blocks, blocks[4]))).toBe("# Title\n\nFirst.\n\n<br />\n\nSecond.\n");
  });
});
