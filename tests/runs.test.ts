import { describe, expect, it } from "vitest";
import type { BlockType } from "../src/shared/markdown";
import { type BlockRange, type Op, Path } from "../src/shared/ops";
import { blockAhead, runAhead, runAround, splitRuns } from "../src/shared/runs";
import { sourceBlocks } from "../src/shared/wrapper";

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

describe("a run opened ahead of the page", () => {
  const before = "# Title\n\nFirst.\n\n<Demo />\n\nSecond.\n\nThird.\n";
  const rendered = sourceBlocks(before, "a.mdx", "v1");
  const edit = (text: string): Op => ({
    end: 15,
    expected: "First.",
    start: 9,
    text,
  });
  const through = (...writes: Op[][]) =>
    new Path(
      "v1",
      writes.map((ops, index) => ({ ops, version: `v${index + 2}` }))
    );
  const written = (text: string) => before.replace("First.", text);
  const after = (text: string) => sourceBlocks(written(text), "a.mdx", "v2");
  const below = rendered.slice(3, 5);
  const textOf = (source: string, range: BlockRange | null) =>
    range && source.slice(range.start, range.end);

  it("follows the text written above it", () => {
    const text = "First, longer.";
    const range = runAhead(through([edit(text)]), below, after(text), true);
    expect(textOf(written(text), range)).toBe("Second.\n\nThird.");
  });

  it("follows several writes in turn", () => {
    const path = through(
      [edit("Firs")],
      [{ end: 13, expected: "Firs", start: 9, text: "F" }]
    );
    const range = runAhead(path, below, after("F"), true);
    expect(textOf(written("F"), range)).toBe("Second.\n\nThird.");
  });

  it("follows a block added above it", () => {
    const text = "First.\n\nNew.";
    const range = runAhead(through([edit(text)]), below, after(text), true);
    expect(textOf(written(text), range)).toBe("Second.\n\nThird.");
  });

  it("follows the block it adds after when its place moved", () => {
    const text = "First.\n\nNew.";
    const range = runAhead(
      through([edit(text)]),
      rendered.slice(2, 3),
      after(text),
      false
    );
    expect(textOf(written(text), range)).toBe("<Demo />");
  });

  it("waits when the write made its run longer", () => {
    const source = "First.\n\n<Demo />\n\nSecond.\n";
    const insert: Op = { end: 16, expected: "", start: 16, text: "\n\nNew." };
    expect(
      runAhead(
        through([insert]),
        sourceBlocks(source, "a.mdx", "v1").slice(2),
        sourceBlocks("First.\n\n<Demo />\n\nNew.\n\nSecond.\n", "a.mdx", "v2"),
        true
      )
    ).toBeNull();
  });

  it("waits when the write touched the run itself", () => {
    expect(
      runAhead(
        through([edit("Firs")]),
        rendered.slice(0, 2),
        after("Firs"),
        true
      )
    ).toBeNull();
  });

  it("finds a clicked block where the page now shows it", () => {
    const text = "First.\n\nNew.";
    const second = rendered[3];
    const found =
      second && blockAhead(through([edit(text)]), second, after(text));
    expect(textOf(written(text), found ?? null)).toBe("Second.");
  });

  it("loses a clicked block the write rewrote", () => {
    const first = rendered[1];
    expect(
      first && blockAhead(through([edit("Firs")]), first, after("Firs"))
    ).toBeNull();
  });
});
