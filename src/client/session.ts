import type { Editor } from "@tiptap/core";
import type { ClientConfig } from "../shared/config";
import type { Intent } from "../shared/ops";
import { type Backend, errorText } from "./api";
import {
  type Block,
  editableBeside,
  editableBlockAt,
  firstFile,
  moveIntent,
  readBlock,
  removeIntent,
} from "./blocks";
import { textRangeIn } from "./caret";
import { EditSequence, type Settle } from "./edit-sequence";
import { FileEdits } from "./file-edits";
import { edgePoint, firstVisibleBlock } from "./geometry";
import {
  type Located,
  locateOpening,
  type OpenTarget,
  type Selected,
} from "./opening";
import type { EditingHost, PageSync, Preview } from "./page";
import { Run } from "./run";
import { Store } from "./store";

export type { OpenTarget } from "./opening";

const PAGE_BEHIND =
  "The page is behind the file. Wait for it to refresh, then try again.";

function logError(text: string) {
  console.error(`esqia: ${text}`);
}

export interface SessionSnapshot {
  changed: number;
  config: ClientConfig | null;
  redoable: number;
  run: Run | null;
  writing: boolean;
}

export const INITIAL_SESSION: SessionSnapshot = {
  changed: 0,
  config: null,
  redoable: 0,
  run: null,
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
    return this.snapshot.run?.close().closed ?? Promise.resolve();
  }

  private readonly runClosed: Settle = async () => {
    await Promise.all([...this.runs].map((run) => run.close().closed));
    return true;
  };

  private readonly runSaved: Settle = async () => {
    await this.snapshot.run?.close().saved;
    return true;
  };

  open(target: OpenTarget): Promise<Run | undefined> {
    const selected =
      target.at === "run" ? textRangeIn(target.block.el, target.caret) : null;
    return this.openWhen(this.runSaved, () => ({ selected, target }));
  }

  openAt(x: number, y: number): Promise<Run | undefined> {
    return this.openWhen(this.runClosed, () => {
      const under = document.elementFromPoint(x, y);
      const block = under && editableBlockAt(under);
      const caret = { x, y };
      return (
        block && {
          selected: textRangeIn(block.el, caret),
          target: { at: "run", block, caret },
        }
      );
    });
  }

  private async openWhen(
    settle: Settle,
    resolve: () => { selected: Selected; target: OpenTarget } | null
  ): Promise<Run | undefined> {
    const { config } = this.snapshot;
    if (!(config && this.editable)) {
      return;
    }
    const newest = await this.sequence.open(settle);
    if (!(newest && this.editable)) {
      return;
    }
    const asked = resolve();
    if (!asked) {
      return;
    }

    try {
      const located = await this.locate(asked.target, asked.selected);
      if (!(this.editable && newest()) || located.state === "gone") {
        return;
      }
      if (located.state === "behind") {
        logError(PAGE_BEHIND);
        return;
      }
      const { caret, file, hash, path, placement, range, source } =
        located.opening;
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
        path,
        placement,
        range,
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

  private async locate(
    target: OpenTarget,
    selected: Selected
  ): Promise<Located> {
    const located = await locateOpening(this.edits, target, selected);
    if (located.state !== "behind") {
      return located;
    }
    await this.runClosed();
    return locateOpening(this.edits, target, selected);
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

  async insertAfter(block: Block, apply: (editor: Editor) => void) {
    const run = await this.open({ at: "after", block });
    if (run) {
      apply(run.editor);
    }
  }

  removeBlock(block: Block) {
    return this.editShown(block, removeIntent, this.sync.removing(block));
  }

  moveBlock(block: Block, target: Block | null) {
    return this.editShown(
      block,
      (fresh) => moveIntent(fresh, target),
      this.sync.moving(block, target)
    );
  }

  private async editShown(
    block: Block,
    intent: (block: Block) => Intent,
    shown: Preview
  ): Promise<boolean> {
    const version = await this.edit(block.el, intent);
    shown(version);
    return version !== null;
  }

  private async edit(
    el: HTMLElement,
    intent: (block: Block) => Intent
  ): Promise<string | null> {
    try {
      const written = await this.sequence.write(async () => {
        if (!el.isConnected) {
          throw new Error("The block left the page. Reopen it to keep going.");
        }
        const block = readBlock(el);
        const changed = await this.edits.apply(
          block.file,
          block.version,
          intent(block)
        );
        this.lastFile = block.file;
        this.refreshChanges();
        return changed ? block.version : null;
      }, this.runClosed);
      return written ?? null;
    } catch (error) {
      logError(errorText(error));
      return null;
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
      }, this.runClosed);
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
      }, this.runClosed);
      return done ?? false;
    } catch (error) {
      logError(errorText(error));
      return false;
    }
  }
}
