import type { Editor } from "@tiptap/core";
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
    open: () => page,
  };
  const failures: string[] = [];
  let body = source.slice(range.start, range.end);
  const run = new FileEdits(backend, sync).openRun({
    at,
    blocks: [],
    body: () => body,
    editor: {} as Editor,
    file: "a.mdx",
    onFailed: (message) => failures.push(message),
    onSaved: () => undefined,
    onSaving: () => undefined,
    range,
    root: {} as HTMLElement,
    source,
    version: hash,
  });
  return {
    applied,
    close: () => run.close(false),
    closed,
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

  it("asks to discard after a conflict and stops writing", async () => {
    vi.useFakeTimers();
    const { close, closed, failures, file, type } = setup({ hash: "stale" });
    type("Changed.");
    await vi.advanceTimersByTimeAsync(800);
    type("Changed again.");
    await close();
    expect(failures).toHaveLength(1);
    expect(closed[0]).toMatchObject({ discard: true, wrote: false });
    await expect(file()).resolves.toBe(source);
  });
});
