import { afterEach, describe, expect, it, vi } from "vitest";
import type { Block } from "../src/client/blocks";
import { FileEdits } from "../src/client/file-edits";
import { memoryBackend } from "../src/client/memory-backend";
import type {
  AppliedEdit,
  PageClosing,
  PageSync,
  RunPage,
} from "../src/client/page";
import { SourceDraft } from "../src/client/source-draft";
import { clientConfig } from "../src/shared/config";
import { memoryStore } from "../src/shared/history";
import type { BlockRange, Intent } from "../src/shared/ops";

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
    refreshes: true,
    reverted: () => undefined,
  };
  const failures: string[] = [];
  let body = source.slice(range.start, range.end);
  const run = new FileEdits(backend, sync).openRun({
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
    close: () => run.close(),
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

const sourceDraft = (text = "<Demo />") => {
  const backend = memoryBackend(
    memoryStore(() => ({ hash: "initial", source: text })),
    clientConfig({})
  );
  const block: Block = {
    el: {} as HTMLElement,
    end: text.length,
    file: "a.mdx",
    start: 0,
    type: "block",
    version: "initial",
  };
  const closed = vi.fn<() => void>();
  const write = vi.fn<(intent: (block: Block) => Intent) => Promise<boolean>>(
    async (intent) => {
      const { hash } = await backend.source(block.file);
      try {
        await backend.edit(block.file, hash, intent(block));
        return true;
      } catch {
        return false;
      }
    }
  );
  const draft = new SourceDraft(block, text, write, closed);
  return { backend, block, closed, draft, write };
};

describe("source drafts", () => {
  it("validates MDX before writing and keeps an invalid draft open", async () => {
    const { draft, closed, write } = sourceDraft();
    draft.change("<Demo");
    expect(draft.getSnapshot().problem).toBeTruthy();
    await expect(draft.commit()).resolves.toBe(false);
    expect(write).not.toHaveBeenCalled();
    expect(closed).not.toHaveBeenCalled();
    draft.change("<Other />");
    expect(draft.getSnapshot().problem).toBeNull();
    await expect(draft.commit()).resolves.toBe(true);
    expect(closed).toHaveBeenCalledOnce();
  });

  it("closes unchanged drafts without recording a write", async () => {
    const { draft, closed, write } = sourceDraft();
    draft.change("  <Demo />  ");
    await expect(draft.commit()).resolves.toBe(true);
    expect(write).not.toHaveBeenCalled();
    expect(closed).toHaveBeenCalledOnce();
  });

  it("cannot save a cancelled draft", async () => {
    const { draft, closed, write } = sourceDraft();
    draft.change("<Other />");
    draft.cancel();
    await expect(draft.commit()).resolves.toBe(false);
    expect(write).not.toHaveBeenCalled();
    expect(closed).toHaveBeenCalledOnce();
  });

  it.each(["<Next />", ""])(
    "retains the original expectation when saving %j after an external edit",
    async (text) => {
      const { backend, draft, closed } = sourceDraft();
      await backend.edit("a.mdx", "initial", {
        kind: "replace",
        op: { end: 8, expected: "<Demo />", start: 0, text: "<Else />" },
      });
      draft.change(text);
      await expect(draft.commit()).resolves.toBe(false);
      expect(closed).not.toHaveBeenCalled();
      expect(draft.getSnapshot()).toMatchObject({ saving: false, text });
      expect((await backend.source("a.mdx")).source).toBe("<Else />");
    }
  );

  it("coalesces commits while a save is pending and permits retry after failure", async () => {
    const { block } = sourceDraft();
    const pending = (() => {
      let resolve!: (saved: boolean) => void;
      const promise = new Promise<boolean>((done) => {
        resolve = done;
      });
      return { promise, resolve };
    })();
    const write = vi
      .fn<(intent: (block: Block) => Intent) => Promise<boolean>>()
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValue(true);
    const closed = vi.fn<() => void>();
    const draft = new SourceDraft(block, "<Demo />", write, closed);
    draft.change("<Next />");
    const first = draft.commit();
    expect(draft.commit()).toBe(first);
    expect(draft.getSnapshot().saving).toBe(true);
    draft.change("<Ignored />");
    expect(draft.getSnapshot().text).toBe("<Next />");
    pending.resolve(false);
    await expect(first).resolves.toBe(false);
    expect(closed).not.toHaveBeenCalled();
    expect(draft.getSnapshot().saving).toBe(false);
    await expect(draft.commit()).resolves.toBe(true);
    expect(write).toHaveBeenCalledTimes(2);
    expect(closed).toHaveBeenCalledOnce();
  });

  it("removes an unchanged block when its draft is emptied", async () => {
    const { backend, draft } = sourceDraft();
    draft.change("");
    await expect(draft.commit()).resolves.toBe(true);
    expect((await backend.source("a.mdx")).source).toBe("\n");
  });
});
