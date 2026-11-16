import { Editor, getSchema } from "@tiptap/core";
import { NodeSelection, Selection } from "@tiptap/pm/state";
import type { ClientConfig } from "../shared/config";
import { detectStyle } from "../shared/markdown";
import type { BlockRange, Path } from "../shared/ops";
import type { Block } from "./blocks";
import { type Caret, placeCaret } from "./caret";
import { createExtensions } from "./editor";
import type { Closing, FileEdits, RunEdits } from "./file-edits";
import type { PageSync } from "./page";
import { parseRun } from "./parse-run";
import { serializeRun } from "./serialize-run";
import { SlashMenuStore } from "./slash-menu";
import { Store } from "./store";
import { matchLayout, sampleTemplates } from "./templates";

const ARROWS: Record<string, -1 | 1 | undefined> = {
  ArrowDown: 1,
  ArrowUp: -1,
};

export interface RunSnapshot {
  revision: number;
  saving: boolean;
}

export const IDLE_RUN: RunSnapshot = {
  revision: 0,
  saving: false,
};

export interface Placement {
  at: "run" | "after";
  blocks: Block[];
  mount: (root: HTMLElement) => void;
  range: BlockRange;
}

export interface RunOptions {
  caret?: Caret;
  config: ClientConfig;
  edits: FileEdits;
  file: string;
  hash: string;
  onClose: () => void;
  onError: (message: string) => void;
  onFocus: (run: Run) => void;
  onLeave: (direction: -1 | 1, x: number) => boolean;
  onSaved: () => void;
  path: Path;
  placement: Placement;
  range: BlockRange;
  source: string;
  sync: PageSync;
}

let opened = 0;

export class Run extends Store<RunSnapshot> {
  readonly id = ++opened;
  readonly file: string;
  readonly root: HTMLElement;
  readonly editor: Editor;
  readonly slash: SlashMenuStore;

  private readonly saves: RunEdits;
  private readonly onClose: () => void;
  private readonly onLeave: RunOptions["onLeave"];
  private closing: Closing<void> | null = null;
  private refused = false;

  constructor(options: RunOptions) {
    super(IDLE_RUN);
    const { at, blocks, mount, range: rendered } = options.placement;
    const { config, edits, file, hash, path, range, source, sync } = options;
    this.file = file;
    this.onClose = options.onClose;
    this.onLeave = options.onLeave;
    const style = { ...detectStyle(source), smartypants: config.smartypants };

    this.root = document.createElement("div");
    this.root.className = "esqia-editor";
    mount(this.root);

    this.slash = new SlashMenuStore(config, () => this.editor);
    const extensions = createExtensions({
      config,
      slash: { onChange: this.slash.show, onKeyDown: this.slash.key },
      spacers: style.spacers,
      templates: sampleTemplates(file, source, path),
    });
    const { doc, originals } = parseRun(
      source.slice(range.start, range.end),
      getSchema(extensions),
      config.smartypants
    );
    this.editor = new Editor({
      content: doc.toJSON(),
      editorProps: {
        handleKeyDown: (_view, event) => this.handleKeyDown(event),
      },
      element: this.root,
      extensions,
    });

    this.saves = edits.openRun({
      at,
      body: () => serializeRun(this.editor.state.doc, originals, style),
      file,
      onFailed: (message) => {
        options.onError(message);
        this.refused = true;
        this.setEditable(false);
      },
      onSaved: options.onSaved,
      onSaving: (saving) => this.update({ saving }),
      page: sync.open({
        blocks,
        editor: this.editor,
        file,
        onBehind: () => queueMicrotask(() => this.saves.follow()),
        path,
        range,
        rendered,
        root: this.root,
        version: hash,
      }),
      range,
      source,
      version: hash,
    });

    this.editor.on("update", () => this.saves.schedule());
    this.editor.on("focus", () => options.onFocus(this));
    this.editor.on("transaction", () =>
      this.update({ revision: this.snapshot.revision + 1 })
    );
    matchLayout(this.editor.view.dom, this.root);
    placeCaret(this.editor, options.caret);
  }

  setEditable(editable: boolean) {
    if (!(this.editor.isDestroyed || this.closing)) {
      this.editor.setEditable(editable && !this.refused);
    }
  }

  close(): Closing<void> {
    this.closing ??= this.end();
    return this.closing;
  }

  private end(): Closing<void> {
    this.editor.setEditable(false, false);
    const { closed, saved } = this.saves.close();
    return { closed: this.finish(closed), saved };
  }

  private async finish(pageLeft: Promise<boolean>) {
    if (await pageLeft) {
      this.editor.destroy();
      this.root.remove();
    }
    this.onClose();
  }

  private handleKeyDown(event: KeyboardEvent): boolean {
    if (this.slash.open) {
      return false;
    }
    if (event.key === "Escape") {
      this.close();
      return true;
    }
    const direction = ARROWS[event.key];
    if (
      !direction ||
      event.shiftKey ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      !this.atEdge(direction)
    ) {
      return false;
    }
    const { view } = this.editor;
    return this.onLeave(
      direction,
      view.coordsAtPos(view.state.selection.head).left
    );
  }

  private atEdge(direction: -1 | 1): boolean {
    const { doc, selection } = this.editor.state;
    const edge = direction < 0 ? Selection.atStart(doc) : Selection.atEnd(doc);
    if (selection instanceof NodeSelection) {
      return selection.eq(edge);
    }
    return (
      selection.empty &&
      selection.$head.sameParent(edge.$head) &&
      this.editor.view.endOfTextblock(direction < 0 ? "up" : "down")
    );
  }
}
