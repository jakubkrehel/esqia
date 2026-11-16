import { afterEach, describe, expect, it, vi } from "vitest";
import { FileEdits } from "../src/client/file-edits";
import { memoryBackend } from "../src/client/memory-backend";
import type {
  AppliedEdit,
  PageClosing,
  PageSync,
  RunPage,
} from "../src/client/page";
import { clientConfig } from "../src/shared/config";
import { memoryStore } from "../src/shared/history";
import type { BlockRange } from "../src/shared/ops";

const source = "# Title\n\nFirst.\n\nSecond.\n";

const setup = ({
  at = "run",
  hash = "initial",
  range = { end: 15, start: 9 },
}: {
  at?: "run" | "after";
  hash?: string;
  range?: BlockRange;
} = {}) => {
  const backend = memoryBackend(
    memoryStore(() => ({ hash: "initial", source })),
    clientConfig({})
  );
  const applied: AppliedEdit[] = [];
  const closed: PageClosing[] = [];
  const page: RunPage = {
    close: (closing) => {
      closed.push(closing);
      return Promise.resolve(true);
    },
    track: () => undefined,
  };
  const sync: PageSync = {
    applied: (edit) => applied.push(edit),
    moving: () => () => undefined,
    open: () => page,
    refreshes: true,
    removing: () => () => undefined,
    reverted: () => undefined,
  };
  const failures: string[] = [];
  let body = source.slice(range.start, range.end);
  const edits = new FileEdits(backend, sync);
  const run = edits.openRun({
    at,
    body: () => body,
    file: "a.mdx",
    onFailed: (message) => failures.push(message),
    onSaved: () => undefined,
    onSaving: () => undefined,
    page,
    range,
    source,
    version: hash,
  });
  return {
    applied,
    backend,
    close: () => run.close().closed,
    closed,
    edits,
    failures,
    file: async () => (await backend.source("a.mdx")).source,
    page,
    type: (text: string) => {
      body = text;
      run.schedule();
    },
  };
};

afterEach(() => {
  vi.useRealTimers();
});

describe("run edits", () => {
  it("skips a write when the text is unchanged", async () => {
    const { applied, close, closed, file } = setup();
    await expect(close()).resolves.toBe(true);
    expect(applied).toHaveLength(0);
    expect(closed).toEqual([
      { discard: false, version: "initial", wrote: false },
    ]);
    await expect(file()).resolves.toBe(source);
  });

  it("replaces its range and follows the new length", async () => {
    vi.useFakeTimers();
    const { applied, close, closed, file, page, type } = setup();
    type("Longer first.");
    await vi.advanceTimersByTimeAsync(800);
    type("Short.");
    await close();
    await expect(file()).resolves.toBe("# Title\n\nShort.\n\nSecond.\n");
    expect(applied.map((edit) => edit.run)).toEqual([
      { page, range: { end: 22, start: 9 } },
      { page, range: { end: 15, start: 9 } },
    ]);
    expect(closed[0]).toMatchObject({ discard: false, wrote: true });
    expect(closed[0]?.version).toBe(applied.at(-1)?.hash);
  });

  it("writes once the typing pauses", async () => {
    vi.useFakeTimers();
    const { file, type } = setup();
    type("Fir");
    type("Firm.");
    await vi.advanceTimersByTimeAsync(800);
    await expect(file()).resolves.toBe("# Title\n\nFirm.\n\nSecond.\n");
  });

  it("removes the run when it is emptied on close, not while typing", async () => {
    vi.useFakeTimers();
    const typing = setup();
    typing.type("");
    await vi.advanceTimersByTimeAsync(800);
    await expect(typing.file()).resolves.toBe("# Title\n\n\n\nSecond.\n");

    const closing = setup();
    closing.type("");
    await closing.close();
    await expect(closing.file()).resolves.toBe("# Title\n\nSecond.\n");
    expect(closing.applied[0]?.run?.range).toEqual({ end: 9, start: 9 });
  });

  it("separates a new block from the one it follows", async () => {
    const { close, file, type } = setup({
      at: "after",
      range: { end: 15, start: 15 },
    });
    type("Inserted.");
    await close();
    await expect(file()).resolves.toBe(
      "# Title\n\nFirst.\n\nInserted.\n\nSecond.\n"
    );
  });

  it("follows its text when the file changed somewhere else", async () => {
    vi.useFakeTimers();
    const { backend, close, closed, failures, file, type } = setup();
    await backend.edit("a.mdx", "initial", {
      kind: "replace",
      op: { end: 7, expected: "# Title", start: 0, text: "# A longer title" },
    });
    type("Changed.");
    await close();
    expect(failures).toEqual([]);
    expect(closed[0]).toMatchObject({ discard: false, wrote: true });
    await expect(file()).resolves.toBe(
      "# A longer title\n\nChanged.\n\nSecond.\n"
    );
  });

  it("stops writing when its own text changed in the file", async () => {
    vi.useFakeTimers();
    const { backend, close, closed, failures, file, type } = setup();
    await backend.edit("a.mdx", "initial", {
      kind: "replace",
      op: { end: 15, expected: "First.", start: 9, text: "Rewritten." },
    });
    type("Changed.");
    await vi.advanceTimersByTimeAsync(800);
    type("Changed again.");
    await close();
    expect(failures).toHaveLength(1);
    expect(closed[0]).toMatchObject({ discard: true, wrote: false });
    await expect(file()).resolves.toBe("# Title\n\nRewritten.\n\nSecond.\n");
  });
});

const second = { end: 24, start: 17 };

describe("reading a file the page is behind", () => {
  it("is not ahead when the page is current", async () => {
    const { edits } = setup();
    const { path } = await edits.read("a.mdx", "initial");
    expect(path?.ahead).toBe(false);
    expect(path?.map(second)).toEqual(second);
  });

  it("passes every version written since the one the page shows", async () => {
    vi.useFakeTimers();
    const { applied, close, edits, type } = setup();
    type("Longer first.");
    await vi.advanceTimersByTimeAsync(800);
    const middle = applied[0]?.hash ?? "";
    type("Short.");
    await close();
    const last = applied[1]?.hash ?? "";
    const { path } = await edits.read("a.mdx", "initial");
    expect(path?.along(second)).toEqual([
      { range: second, version: "initial" },
      { range: { end: 31, start: 24 }, version: middle },
      { range: second, version: last },
    ]);
    const later = await edits.read("a.mdx", middle);
    expect(later.path?.along({ end: 31, start: 24 })).toEqual([
      { range: { end: 31, start: 24 }, version: middle },
      { range: second, version: last },
    ]);
  });

  it("has no path from a version it never wrote", async () => {
    const { close, edits, type } = setup();
    type("Changed.");
    await close();
    await expect(edits.read("a.mdx", "elsewhere")).resolves.toMatchObject({
      path: null,
    });
  });
});

describe("a path after the file went back to an earlier version", () => {
  it("starts from the latest write, not the first", async () => {
    let text = source;
    const backend = memoryBackend(
      {
        read: () => Promise.resolve({ hash: text, source: text }),
        write: (_file, written) => {
          text = written;
          return Promise.resolve(written);
        },
      },
      clientConfig({})
    );
    const edits = new FileEdits(backend, {
      applied: () => undefined,
      moving: () => () => undefined,
      open: () => {
        throw new Error("No run opens here.");
      },
      refreshes: true,
      removing: () => () => undefined,
      reverted: () => undefined,
    });
    const first = (replacement: string) =>
      edits.apply("a.mdx", source, {
        kind: "replace",
        op: { end: 15, expected: "First.", start: 9, text: replacement },
      });
    await first("Longer first.");
    await backend.undo("a.mdx");
    await first("Again.");
    const { path } = await edits.read("a.mdx", source);
    expect(path?.along(second)).toHaveLength(2);
    expect(path?.map(second)).toEqual(second);
  });
});
