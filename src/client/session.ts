import type { Editor } from "@tiptap/core";
import type { ClientConfig } from "../shared/config";
import type { Intent } from "../shared/ops";
import { type Backend, errorText } from "./api";
import {
  type Block,
  firstFile,
  moveIntent,
  readBlock,
  removeIntent,
  runAround,
} from "./blocks";
import { type Caret, textRangeIn } from "./caret";
import { FileEdits } from "./file-edits";
import { firstVisibleBlock } from "./geometry";
import type { EditingHost } from "./page";
import { type Placement, Run } from "./run";
import { Store } from "./store";

export type OpenTarget =
  | { at: "run"; block: Block; caret?: { x: number; y: number } }
  | { at: "after"; block: Block };

export type Notify = (text: string, tone?: "info" | "error") => void;

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
  private closing: Promise<void> | null = null;
  private lastFile: string | null = null;
  private noticed = false;
  private readonly backend: Backend;
  private readonly edits: FileEdits;
  private readonly notify: Notify;

  constructor({ backend, sync }: EditingHost, notify: Notify) {
    super(INITIAL_SESSION);
    this.backend = backend;
    this.edits = new FileEdits(backend, sync);
    this.notify = notify;
  }

  get canUndo() {
    return this.backend.undo !== undefined;
  }

  get canRedo() {
    return this.backend.redo !== undefined;
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
        this.update({ changed: changes.edits, redoable: changes.redos })
      )
      .catch(() => this.update({ changed: 0, redoable: 0 }));
  };

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

  async open(target: OpenTarget): Promise<Run | undefined> {
    const { config } = this.snapshot;
    if (!config) {
      return;
    }
    const selected =
      target.at === "run" ? textRangeIn(target.block.el, target.caret) : null;
    await this.close();
    const opening = resolveOpening(target, selected);
    if (!opening) {
      return;
    }
    const { caret, file, placement, version } = opening;

    try {
      const { source, hash } = await this.edits.read(file, version);
      const next = new Run({
        caret,
        config,
        edits: this.edits,
        file,
        hash,
        onClose: () => {
          if (this.snapshot.run === next) {
            this.update({ run: null });
          }
        },
        onError: (message) => this.notify(message, "error"),
        onFocus: (focused) => this.update({ run: focused }),
        onSaved: this.refreshChanges,
        placement,
        source,
      });
      this.runs.add(next);
      this.lastFile = file;
      this.update({ run: next });
      if (this.backend.notice && !this.noticed) {
        this.noticed = true;
        this.notify(this.backend.notice);
      }
      return next;
    } catch (error) {
      this.notify(errorText(error), "error");
    }
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

  private async edit(el: HTMLElement, intent: (block: Block) => Intent) {
    this.update({ writing: true });
    try {
      await this.close();
      const block = readBlock(el);
      await this.edits.apply(block.file, block.version, intent(block));
      this.lastFile = block.file;
      this.refreshChanges();
    } catch (error) {
      this.notify(errorText(error), "error");
    } finally {
      this.update({ writing: false });
    }
  }

  undo() {
    return this.step(this.backend.undo, "Undone");
  }

  redo() {
    return this.step(this.backend.redo, "Redone");
  }

  private async step(
    apply: ((file: string) => Promise<unknown>) | undefined,
    done: string
  ) {
    if (!apply) {
      return;
    }
    await this.close();
    const file = this.lastFile ?? firstFile();
    if (!file) {
      return;
    }
    try {
      await apply(file);
      this.refreshChanges();
      this.notify(done);
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
      this.update({ changed: 0, redoable: 0 });
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
