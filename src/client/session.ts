import type { Editor } from "@tiptap/core";
import type { ClientConfig } from "../shared/config";
import type { Intent } from "../shared/ops";
import { type Backend, errorText } from "./api";
import {
  type Block,
  editableBeside,
  firstFile,
  moveIntent,
  readBlock,
  removeIntent,
  runAround,
} from "./blocks";
import { type Caret, textRangeIn } from "./caret";
import { EditSequence, type Newest, type Settle } from "./edit-sequence";
import { FileEdits } from "./file-edits";
import { edgePoint, firstVisibleBlock } from "./geometry";
import type { EditingHost, PageSync } from "./page";
import { type Placement, Run } from "./run";
import { SourceDraft } from "./source-draft";
import { Store } from "./store";

export type OpenTarget =
  | { at: "run"; block: Block; caret?: { x: number; y: number } }
  | { at: "after"; block: Block };

function logError(text: string) {
  console.error(`esqia: ${text}`);
}

export interface SessionSnapshot {
  changed: number;
  config: ClientConfig | null;
  redoable: number;
  run: Run | null;
  source: SourceDraft | null;
  writing: boolean;
}

export const INITIAL_SESSION: SessionSnapshot = {
  changed: 0,
  config: null,
  redoable: 0,
  run: null,
  source: null,
  writing: false,
};

function lineAt(source: string, offset: number) {
  return source.slice(0, offset).split("\n").length;
}

function files(count: number) {
  return `${count} ${count === 1 ? "file" : "files"}`;
}

export class Session extends Store<SessionSnapshot> {
  private readonly runs = new Set<Run>();
  private readonly sequence = new EditSequence((writing) =>
    this.update({ writing })
  );
  private editable = false;
  private lastFile: string | null = null;
  private readonly backend: Backend;
  private readonly edits: FileEdits;
  private readonly sync: PageSync;

  constructor({ backend, sync }: EditingHost) {
    super(INITIAL_SESSION);
    this.backend = backend;
    this.sync = sync;
    this.edits = new FileEdits(backend, sync);
  }

  get canUndo() {
    return this.sync.refreshes;
  }

  get canRedo() {
    return this.sync.refreshes;
  }

  get canOpen() {
    return this.backend.open !== undefined;
  }

  get canEditSource() {
    return this.sync.refreshes;
  }

  load() {
    this.backend
      .config()
      .then((config) => this.update({ config }))
      .catch(() =>
        logError("Can't reach the esqia sidecar. Restart `next dev`.")
      );
    this.refreshChanges();
  }

  private refreshChanges = () => {
    this.backend
      .changes()
      .then((changes) =>
        this.update({ changed: changes.edits, redoable: changes.redos })
      )
      .catch(() => this.update({ changed: 0, redoable: 0 }));
  };

  setEditable(editable: boolean) {
    this.editable = editable;
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
    this.sequence.supersede();
    this.snapshot.source?.cancel();
    return this.snapshot.run?.close() ?? Promise.resolve();
  }

  private readonly runClosed: Settle = async () => {
    await this.snapshot.run?.close();
    return true;
  };

  private readonly settled: Settle = async () => {
    const committed = this.snapshot.source?.commit();
    if (committed && !(await committed)) {
      return false;
    }
    return this.runClosed();
  };

  async open(target: OpenTarget): Promise<Run | undefined> {
    const { config } = this.snapshot;
    if (!(config && this.editable)) {
      return;
    }
    const selected =
      target.at === "run" ? textRangeIn(target.block.el, target.caret) : null;
    const newest = await this.sequence.open(this.settled);
    if (!(newest && this.editable)) {
      return;
    }
    const opening = resolveOpening(target, selected);
    if (!opening) {
      return;
    }
    const { caret, file, placement, version } = opening;

    try {
      const { source, hash } = await this.edits.read(file, version);
      if (!this.isCurrent(newest, target.block, version)) {
        return;
      }
      const next = new Run({
        caret,
        config,
        edits: this.edits,
        file,
        hash,
        onClose: () => {
          if (next.editor.isDestroyed) {
            this.runs.delete(next);
          }
          if (this.snapshot.run === next) {
            this.update({ run: null });
          }
        },
        onError: logError,
        onFocus: (focused) => {
          if (this.editable) {
            this.update({ run: focused });
          }
        },
        onLeave: (direction, x) => this.leave(next, direction, x),
        onSaved: this.refreshChanges,
        placement,
        source,
        sync: this.sync,
      });
      this.runs.add(next);
      this.lastFile = file;
      this.update({ run: next });
      return next;
    } catch (error) {
      if (newest()) {
        logError(errorText(error));
      }
    }
  }

  private leave(run: Run, direction: -1 | 1, x: number): boolean {
    const block = editableBeside(run.root, run.file, direction);
    if (!block) {
      return false;
    }
    (block.el.firstElementChild ?? block.el).scrollIntoView({
      block: "nearest",
    });
    void this.open({
      at: "run",
      block,
      caret: edgePoint(block.el, direction, x),
    });
    return true;
  }

  private isCurrent(newest: Newest, block: Block, version: string) {
    return (
      this.editable &&
      newest() &&
      block.el.isConnected &&
      readBlock(block.el).version === version
    );
  }

  async insertAfter(block: Block, apply: (editor: Editor) => void) {
    const run = await this.open({ at: "after", block });
    if (run) {
      apply(run.editor);
    }
  }

  removeBlock(block: Block) {
    return this.edit(block.el, removeIntent);
  }

  moveBlock(block: Block, target: Block | null) {
    return this.edit(block.el, (fresh) => moveIntent(fresh, target));
  }

  async openSource(block: Block): Promise<void> {
    if (!(this.editable && this.canEditSource)) {
      return;
    }
    const newest = await this.sequence.open(this.settled);
    if (!(newest && this.editable && block.el.isConnected)) {
      return;
    }
    try {
      const fresh = readBlock(block.el);
      const { source } = await this.edits.read(fresh.file, fresh.version);
      if (!this.isCurrent(newest, fresh, fresh.version)) {
        return;
      }
      const draft = new SourceDraft(
        fresh,
        source,
        (intent) => this.edit(fresh.el, intent),
        () => {
          if (this.snapshot.source === draft) {
            this.update({ source: null });
          }
        }
      );
      this.update({ source: draft });
    } catch (error) {
      if (newest()) {
        logError(errorText(error));
      }
    }
  }

  private async edit(
    el: HTMLElement,
    intent: (block: Block) => Intent
  ): Promise<boolean> {
    try {
      const written = await this.sequence.write(async () => {
        if (!el.isConnected) {
          throw new Error("The block left the page. Reopen it to keep going.");
        }
        const block = readBlock(el);
        await this.edits.apply(block.file, block.version, intent(block));
        this.lastFile = block.file;
        this.refreshChanges();
        return true;
      }, this.runClosed);
      return written ?? false;
    } catch (error) {
      logError(errorText(error));
      return false;
    }
  }

  undo() {
    return this.step(this.backend.undo);
  }

  redo() {
    return this.step(this.backend.redo);
  }

  private async step(apply: (file: string) => Promise<unknown>) {
    if (!this.sync.refreshes) {
      return;
    }
    try {
      await this.sequence.write(async () => {
        const file = this.lastFile ?? firstFile();
        if (file) {
          await apply(file);
          this.refreshChanges();
        }
      }, this.settled);
    } catch (error) {
      logError(errorText(error));
    }
  }

  readonly lineOf = async (block: Pick<Block, "file" | "start">) => {
    const { source } = await this.backend.source(block.file);
    return lineAt(source, block.start);
  };

  async openInEditor(block = firstVisibleBlock()) {
    const { open } = this.backend;
    if (!(open && block)) {
      return;
    }
    try {
      await open(block.file, await this.lineOf(block));
    } catch (error) {
      logError(errorText(error));
    }
  }

  async revert(): Promise<boolean> {
    try {
      const done = await this.sequence.write(async () => {
        const { reverted, skipped } = await this.backend.revert();
        this.sync.reverted();
        this.update({ changed: 0, redoable: 0 });
        if (skipped.length === 0) {
          return true;
        }
        logError(
          `Reverted ${files(reverted.length)}. Skipped ${skipped.join(", ")}, changed in your editor since.`
        );
        return false;
      }, this.settled);
      return done ?? false;
    } catch (error) {
      logError(errorText(error));
      return false;
    }
  }
}

function resolveOpening(
  target: OpenTarget,
  selected: Pick<Caret, "anchor" | "head"> | null
): {
  caret?: Caret;
  file: string;
  placement: Placement;
  version: string;
} | null {
  const { el } = target.block;
  if (!el.isConnected) {
    return null;
  }
  const block = readBlock(el);
  const placement = place(target.at, block);
  if (!placement) {
    return null;
  }
  const index = placement.blocks.findIndex((b) => b.el === el);
  return {
    caret: index >= 0 ? { anchor: 0, head: 0, ...selected, index } : undefined,
    file: block.file,
    placement,
    version: block.version,
  };
}

function place(at: OpenTarget["at"], block: Block): Placement | null {
  if (at === "after") {
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
