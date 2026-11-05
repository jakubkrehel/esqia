import { describe, expect, it } from "vitest";
import { EditHistory, memoryStore } from "../src/shared/history";

const setup = (source = "# Hello\n\nFirst.\n") => {
  const history = new EditHistory(
    memoryStore(() => ({ hash: "initial", source }))
  );
  const read = async () => (await history.source("a.mdx")).source;
  const replace = async (text: string, group?: string) => {
    const { hash, source: current } = await history.source("a.mdx");
    const start = current.indexOf("\n\n") + 2;
    const end = current.length - 1;
    return history.edit(
      "a.mdx",
      hash,
      {
        kind: "replace",
        op: { end, expected: current.slice(start, end), start, text },
      },
      group
    );
  };
  return { history, read, replace };
};

describe("edit history", () => {
  it("rejects a stale hash and a mismatched expected text", async () => {
    const { history } = setup();
    const op = { end: 15, expected: "First.", start: 9, text: "x" };
    await expect(
      history.edit("a.mdx", "stale", { kind: "replace", op })
    ).resolves.toMatchObject({
      ok: false,
      reason: "conflict",
    });
    await expect(
      history.edit("a.mdx", "initial", {
        kind: "replace",
        op: { ...op, expected: "Other." },
      })
    ).resolves.toMatchObject({ ok: false, reason: "conflict" });
  });

  it("undoes and redoes, and clears redo on a new edit", async () => {
    const { history, read, replace } = setup();
    await replace("Second.");
    await expect(read()).resolves.toBe("# Hello\n\nSecond.\n");
    await expect(history.undo("a.mdx")).resolves.toMatchObject({ ok: true });
    await expect(read()).resolves.toBe("# Hello\n\nFirst.\n");
    expect(history.changes().redos).toBe(1);
    await expect(history.redo("a.mdx")).resolves.toMatchObject({ ok: true });
    await expect(read()).resolves.toBe("# Hello\n\nSecond.\n");
    await history.undo("a.mdx");
    await replace("Third.");
    await expect(history.redo("a.mdx")).resolves.toMatchObject({
      ok: false,
      reason: "nothing",
    });
  });

  it("coalesces edits that share a group into one undo step", async () => {
    const { history, read, replace } = setup();
    await replace("One.", "run");
    await replace("Two.", "run");
    expect(history.changes().edits).toBe(1);
    await history.undo("a.mdx");
    await expect(read()).resolves.toBe("# Hello\n\nFirst.\n");
  });

  it("skips a no-op edit without recording it", async () => {
    const { history, replace } = setup();
    await expect(replace("First.")).resolves.toMatchObject({
      hash: "initial",
      ok: true,
    });
    expect(history.changes()).toEqual({ edits: 0, files: [], redos: 0 });
  });

  it("builds removes and moves from the file as it is now", async () => {
    const { history, read } = setup("# Hello\n\nFirst.\n\nSecond.\n");
    const first = { end: 15, start: 9 };
    const second = { end: 24, start: 17 };
    const moved = await history.edit("a.mdx", "initial", {
      blocks: [{ end: 7, start: 0 }, first, second],
      kind: "move",
      range: second,
      target: first,
    });
    expect(moved.ok).toBe(true);
    await expect(read()).resolves.toBe("# Hello\n\nSecond.\n\nFirst.\n");

    const { hash } = await history.source("a.mdx");
    await history.edit("a.mdx", hash, {
      kind: "remove",
      range: { end: 16, start: 9 },
    });
    await expect(read()).resolves.toBe("# Hello\n\nFirst.\n");
  });

  it("reverts every touched file to before its first edit", async () => {
    const { history, read, replace } = setup();
    await replace("One.");
    await replace("Two.");
    await expect(history.revertAll()).resolves.toEqual({
      reverted: ["a.mdx"],
      skipped: [],
    });
    await expect(read()).resolves.toBe("# Hello\n\nFirst.\n");
    expect(history.changes().files).toEqual([]);
  });
});
