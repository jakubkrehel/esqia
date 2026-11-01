import type { Op } from "../shared/ops";
import { BLOCK_SELECTOR, WRAPPER } from "../shared/wrapper";
import {
  type Backend,
  type ClientConfig,
  ConflictError,
  errorText,
} from "./api";
import { type Block, readBlock, runAround } from "./blocks";
import { blockRect, textOffsetAt } from "./geometry";
import { type Placement, Run } from "./run";
import { Store } from "./store";

export type OpenTarget =
  | { at: "run"; block: Block; caret?: { x: number; y: number } }
  | { at: "after"; block: Block };

export type Notify = (text: string, tone?: "info" | "error") => void;

export type BuildOps = (source: string, block: Block) => Op[];

export interface SessionSnapshot {
  changed: number;
  config: ClientConfig | null;
  run: Run | null;
  writing: boolean;
}

export const INITIAL_SESSION: SessionSnapshot = {
  changed: 0,
  config: null,
  run: null,
  writing: false,
};

function firstVisibleBlock(): Block | null {
  for (const el of document.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)) {
    const rect = blockRect(el);
    if (rect && rect.bottom > 0) {
      return readBlock(el);
    }
  }
  return null;
}

function lineAt(source: string, offset: number) {
  return source.slice(0, offset).split("\n").length;
}

function files(count: number) {
  return `${count} ${count === 1 ? "file" : "files"}`;
}

function placement(target: OpenTarget, block: Block): Placement | null {
  if (target.at === "after") {
    return {
      at: "after",
      blocks: [],
      mount: (root) => block.el.after(root),
      range: { end: block.end, start: block.end },
    };
  }
  const blocks = runAround(block);
  const first = blocks[0];
  const last = blocks.at(-1);
  if (!(first && last)) {
    return null;
  }
  return {
    at: "run",
    blocks,
    mount: (root) => first.el.before(root),
    range: { end: last.end, start: first.start },
  };
}

export class Session extends Store<SessionSnapshot> {
  private readonly runs = new Set<Run>();
  private closing: Promise<void> | null = null;
  private lastFile: string | null = null;
  private noticed = false;
  private readonly backend: Backend;
  private readonly notify: Notify;

  constructor(backend: Backend, notify: Notify) {
    super(INITIAL_SESSION);
    this.backend = backend;
    this.notify = notify;
  }

  get canUndo() {
    return this.backend.undo !== undefined;
  }

  get canOpen() {
    return this.backend.open !== undefined;
  }

  load() {
    this.backend
      .config()
      .then((config) => this.update({ config }))
      .catch(() =>
        this.notify(
          "Can't reach the esqia sidecar. Restart `next dev`.",
          "error"
        )
      );
    this.refreshChanges();
  }

  private refreshChanges = () => {
    this.backend
      .changes()
      .then((changes) =>
        this.update({ changed: changes.edits ?? changes.files.length })
      )
      .catch(() => this.update({ changed: 0 }));
  };

  private async freshSource(block: Block) {
    const fetched = await this.backend.source(block.file);
    if (fetched.hash !== block.version) {
      throw new ConflictError(
        "The page is behind the file. Wait for it to refresh, then try again."
      );
    }
    return fetched;
  }

  setEditable(editable: boolean) {
    if (!editable) {
      void this.close();
    }
    for (const parked of this.runs) {
      if (parked.editor.isDestroyed) {
        this.runs.delete(parked);
      } else {
        parked.setEditable(editable);
      }
    }
  }

  close(): Promise<void> {
    const { run } = this.snapshot;
    if (!run) {
      return this.closing ?? Promise.resolve();
    }
    this.closing = run.close().finally(() => {
      this.closing = null;
    });
    return this.closing;
  }

  async open(target: OpenTarget) {
    const { config } = this.snapshot;
    if (!config) {
      return;
    }
    const { el } = target.block;
    const offset =
      target.at === "run" && target.caret
        ? textOffsetAt(el, target.caret.x, target.caret.y)
        : null;
    await this.close();
    if (!el.isConnected) {
      return;
    }
    const fresh = readBlock(el);
    const place = placement(target, fresh);
    if (!place) {
      return;
    }
    const index = place.blocks.findIndex((b) => b.el === el);

    try {
      const { source, hash } = await this.freshSource(fresh);
      const next = new Run({
        backend: this.backend,
        caret: index >= 0 ? { index, offset: offset ?? 0 } : undefined,
        config,
        file: fresh.file,
        hash,
        onClose: () => {
          if (this.snapshot.run === next) {
            this.update({ run: null });
          }
        },
        onError: (message) => this.notify(message, "error"),
        onFocus: (focused) => this.update({ run: focused }),
        onSaved: this.refreshChanges,
        placement: place,
        source,
      });
      this.runs.add(next);
      this.lastFile = fresh.file;
      this.update({ run: next });
      if (this.backend.notice && !this.noticed) {
        this.noticed = true;
        this.notify(this.backend.notice);
      }
    } catch (error) {
      this.notify(errorText(error), "error");
    }
  }

  async write(el: HTMLElement, build: BuildOps) {
    this.update({ writing: true });
    try {
      await this.close();
      const block = readBlock(el);
      const { source, hash } = await this.freshSource(block);
      const ops = build(source, block);
      if (ops.length > 0) {
        await this.backend.ops(block.file, hash, ops);
      }
      this.lastFile = block.file;
      this.refreshChanges();
    } catch (error) {
      this.notify(errorText(error), "error");
    } finally {
      this.update({ writing: false });
    }
  }

  async undo() {
    const { undo } = this.backend;
    const file =
      this.lastFile ??
      document.querySelector(BLOCK_SELECTOR)?.getAttribute(WRAPPER.file);
    if (!(undo && file)) {
      return;
    }
    try {
      await undo(file);
      this.refreshChanges();
      this.notify("Undone");
    } catch (error) {
      this.notify(errorText(error), "error");
    }
  }

  async openInEditor() {
    const { open } = this.backend;
    const block = firstVisibleBlock();
    if (!(open && block)) {
      return;
    }
    try {
      const { source } = await this.backend.source(block.file);
      await open(block.file, lineAt(source, block.start));
    } catch (error) {
      this.notify(errorText(error), "error");
    }
  }

  async revert(): Promise<boolean> {
    await this.close();
    try {
      const { reverted, skipped } = await this.backend.revert();
      this.update({ changed: 0 });
      if (skipped.length === 0) {
        return true;
      }
      this.notify(
        `Reverted ${files(reverted.length)}. Skipped ${skipped.join(", ")}, changed in your editor since.`,
        "error"
      );
    } catch (error) {
      this.notify(errorText(error), "error");
    }
    return false;
  }
}
