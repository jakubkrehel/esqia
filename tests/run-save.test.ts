import { afterEach, describe, expect, it, vi } from "vitest";
import { memoryBackend } from "../src/client/demo-page";
import { FileEdits } from "../src/client/file-edits";
import type { PageSync, RunPage } from "../src/client/page";
import { RunSave } from "../src/client/run-save";
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
  const page: RunPage = {
    close: () => Promise.resolve(true),
    track: () => undefined,
  };
  const sync: PageSync = { applied: () => undefined, open: () => page };
  const failures: string[] = [];
  let body = source.slice(range.start, range.end);
  const saves = new RunSave({
    at,
    body: () => body,
    edits: new FileEdits(backend, sync),
    file: "a.mdx",
    hash,
    onFailed: (message) => failures.push(message),
    onSaved: () => undefined,
    onSaving: () => undefined,
    page,
    range,
    source,
  });
  return {
    failures,
    file: async () => (await backend.source("a.mdx")).source,
    saves,
    type: (text: string) => {
      body = text;
      saves.schedule();
    },
  };
};

afterEach(() => {
  vi.useRealTimers();
});

describe("run save", () => {
  it("skips a write when the text is unchanged", async () => {
    const { file, saves } = setup();
    await expect(saves.finish()).resolves.toBe(true);
    expect(saves.wrote).toBe(false);
    await expect(file()).resolves.toBe(source);
  });

  it("replaces its range and follows the new length", async () => {
    const { file, saves, type } = setup();
    type("Longer first.");
    await saves.finish();
    type("Short.");
    await saves.finish();
    await expect(file()).resolves.toBe("# Title\n\nShort.\n\nSecond.\n");
    expect(saves.wrote).toBe(true);
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
    await closing.saves.finish();
    await expect(closing.file()).resolves.toBe("# Title\n\nSecond.\n");
  });

  it("separates a new block from the one it follows", async () => {
    const { file, saves, type } = setup({
      at: "after",
      range: { end: 15, start: 15 },
    });
    await saves.finish();
    expect(saves.wrote).toBe(false);
    type("Inserted.");
    await saves.finish();
    await expect(file()).resolves.toBe(
      "# Title\n\nFirst.\n\nInserted.\n\nSecond.\n"
    );
  });

  it("asks to discard after a conflict and stops writing", async () => {
    const { failures, file, saves, type } = setup({ hash: "stale" });
    type("Changed.");
    await expect(saves.finish()).resolves.toBe(false);
    type("Changed again.");
    await expect(saves.finish()).resolves.toBe(false);
    expect(failures).toHaveLength(1);
    await expect(file()).resolves.toBe(source);
  });
});
