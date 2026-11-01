import { describe, expect, it } from "vitest";
import type { BlockType } from "../src/shared/markdown";
import { runAround, splitRuns } from "../src/shared/runs";

const blocks = (
  [
    "paragraph",
    "code",
    "paragraph",
    "spacer",
    "heading",
    "media",
    "paragraph",
    "block",
  ] satisfies BlockType[]
).map((type, index) => ({ index, type }));

const indexes = (run: { index: number }[]) => run.map((b) => b.index);

describe("runs", () => {
  it("keeps a code block in a run of its own", () => {
    expect(indexes(runAround(blocks, 1))).toEqual([1]);
    expect(indexes(runAround(blocks, 0))).toEqual([0]);
  });

  it("joins text and line breaks until media or JSX", () => {
    expect(indexes(runAround(blocks, 3))).toEqual([2, 3, 4]);
  });

  it("has no run around a block that isn't editable", () => {
    expect(runAround(blocks, 5)).toEqual([]);
  });

  it("splits a file into runs", () => {
    expect(splitRuns(blocks).map(indexes)).toEqual([[0], [1], [2, 3, 4], [6]]);
  });
});
