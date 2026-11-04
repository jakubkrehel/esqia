import { Editor, getSchema } from "@tiptap/core";
import type { ClientConfig } from "../shared/config";
import { detectStyle } from "../shared/markdown";
import { type Caret, placeCaret } from "./caret";
import { createExtensions } from "./editor";
import type { FileEdits } from "./file-edits";
import type { Placement } from "./opening";
import type { RunPage } from "./page";
import { parseRun } from "./parse-run";
import { RunSave } from "./run-save";
import { serializeRun } from "./serialize-run";
import { SlashMenuStore } from "./slash-menu";
import { Store } from "./store";
import { matchLayout, sampleTemplates } from "./templates";

export interface RunSnapshot {
  revision: number;
  saving: boolean;
}

export const IDLE_RUN: RunSnapshot = {
  revision: 0,
  saving: false,
};

export interface RunOptions {
  caret?: Caret;
  config: ClientConfig;
  edits: FileEdits;
  file: string;
  hash: string;
  onClose: () => void;
  onError: (message: string) => void;
  onFocus: (run: Run) => void;
  onSaved: () => void;
  placement: Placement;
  source: string;
}

export class Run extends Store<RunSnapshot> {
  readonly file: string;
  readonly root: HTMLElement;
  readonly editor: Editor;
  readonly slash: SlashMenuStore;

  private readonly page: RunPage;
  private readonly saves: RunSave;
  private readonly onClose: () => void;
  private closing: Promise<void> | null = null;

  constructor(options: RunOptions) {
    super(IDLE_RUN);
    const { at, blocks, mount, range } = options.placement;
    const { config, edits, file, hash, source } = options;
    this.file = file;
    this.onClose = options.onClose;
    const style = { ...detectStyle(source), smartypants: config.smartypants };

    this.root = document.createElement("div");
    this.root.className = "esqia-editor";
    mount(this.root);

    this.slash = new SlashMenuStore(config, () => this.editor);
    const extensions = createExtensions({
      config,
      slash: { onChange: this.slash.show, onKeyDown: this.slash.key },
      spacers: style.spacers,
      templates: sampleTemplates(file, source),
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

    this.page = edits.open({
      blocks,
      editor: this.editor,
      file,
      range,
      root: this.root,
      version: hash,
    });
    this.saves = new RunSave({
      at,
      body: () => serializeRun(this.editor.state.doc, originals, style),
      edits,
      file,
      hash,
      onFailed: (message) => {
        options.onError(message);
        void this.close(true);
      },
      onSaved: options.onSaved,
      onSaving: (saving) => this.update({ saving }),
      page: this.page,
      range,
      source,
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
    if (!this.editor.isDestroyed) {
      this.editor.setEditable(editable);
    }
  }

  close(discard = false): Promise<void> {
    this.closing ??= (async () => {
      this.saves.cancel();
      const kept = !discard && (await this.saves.finish());
      const settled = await this.page.close({
        discard: !kept,
        version: this.saves.version,
        wrote: this.saves.wrote,
      });
      if (settled) {
        this.editor.destroy();
        this.root.remove();
      }
      this.onClose();
    })();
    return this.closing;
  }

  private handleKeyDown(event: KeyboardEvent): boolean {
    if (event.key === "Escape" && !this.slash.open) {
      void this.close();
      return true;
    }
    return false;
  }
}
