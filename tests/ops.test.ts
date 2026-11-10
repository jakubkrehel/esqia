import { describe, expect, it } from "vitest";
import { blockType, parseMdx } from "../src/shared/markdown";
import {
  applyOps,
  mapRange,
  mapSpan,
  moveOps,
  removeOps,
} from "../src/shared/ops";

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
    expect(apply(removeOps(source, blocks[2]))).toBe(
      "# Title\n\nFirst.\n\nSecond.\n\n<Demo />\n"
    );
    expect(apply(removeOps(source, blocks[4]))).toBe(
      "# Title\n\nFirst.\n\n<br />\n\nSecond.\n"
    );
  });

  it("refuses to delete a block whose text is not the one expected", () => {
    const [first, second] = [blocks[1], blocks[3]];
    expect(apply(removeOps(source, first, "First."))).toBe(
      "# Title\n\n<br />\n\nSecond.\n\n<Demo />\n"
    );
    expect(applyOps(source, removeOps(source, second, "Changed."))).toEqual({
      ok: false,
      reason: "The file changed on disk.",
    });
  });

  it("removes a span with the gap around it", () => {
    const remove = (text: string, start: number, end = start) => {
      const result = applyOps(text, removeOps(text, { end, start }));
      return result.ok ? result.source : result.reason;
    };
    expect(remove("A\n\n\n\nB", 3)).toBe("A\n\nB");
    expect(remove("\n\nB", 0)).toBe("B");
    expect(remove("A\n\n\n", 3)).toBe("A\n");
    expect(removeOps("A\n\nB", { end: 3, start: 3 })).toEqual([]);
    expect(remove("A\n\nMiddle.\n\nB", 3, 10)).toBe("A\n\nB");
    expect(remove("Only.\n", 0, 5)).toBe("\n");
  });
});

describe("mapping ranges through ops", () => {
  it("follows blocks around a move and drops the moved one", () => {
    const ops = moveOps(source, blocks, blocks[4], blocks[1]);
    const moved = apply(ops);
    const text = (from: string, range: { start: number; end: number } | null) =>
      range && from.slice(range.start, range.end);
    expect(mapRange(ops, blocks[4])).toBeNull();
    for (const block of blocks.slice(0, 4)) {
      expect(text(moved, mapRange(ops, block))).toBe(text(source, block));
    }
  });

  it("grows an open run with its own edits", () => {
    const run = { end: blocks[1].end, start: blocks[1].start };
    const ops = [
      {
        end: run.end,
        expected: "First.",
        start: run.start,
        text: "First line.",
      },
    ];
    expect(mapSpan(ops, run)).toEqual({ end: run.end + 5, start: run.start });
    const empty = { end: blocks[1].end, start: blocks[1].end };
    expect(
      mapSpan(
        [
          {
            end: empty.start,
            expected: "",
            start: empty.start,
            text: "\n\nNew.",
          },
        ],
        empty
      )
    ).toEqual({ end: empty.start + 6, start: empty.start });
  });
});
