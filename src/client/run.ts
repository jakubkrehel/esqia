import { Editor } from "@tiptap/core";
import type { ClientConfig } from "../shared/config";
import { detectStyle, type MarkdownStyle } from "../shared/markdown";
import type { BlockRange } from "../shared/ops";
import { ConflictError, errorText } from "./api";
import type { Block } from "./blocks";
import { placeCaret } from "./commands";
import { fingerprint, type Original, parseRun, serializeRun } from "./convert";
import { Draft } from "./draft";
import { createExtensions } from "./editor";
import type { FileEdits } from "./file-edits";
import type { RunIntent } from "./intents";
import type { RunPage } from "./page";
import { SlashMenuStore } from "./slash-menu";
import { Store } from "./store";
import { sampleTemplates } from "./templates";

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
  caret?: { index: number; offset: number };
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

const SAVE_DELAY = 800;

export class Run extends Store<RunSnapshot> {
  readonly file: string;
  readonly root: HTMLElement;
  readonly editor: Editor;
  readonly slash: SlashMenuStore;

  private hash: string;
  private readonly draft: Draft;
  private readonly edits: FileEdits;
  private readonly originals: Map<string, Original>;
  private readonly style: MarkdownStyle;
  private readonly page: RunPage;
  private readonly group = Math.random().toString(36).slice(2);
  private readonly onError: (message: string) => void;
  private readonly onClose: () => void;
  private readonly onSaved: () => void;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private saving: Promise<void> | null = null;
  private wrote = false;
  private closing: Promise<void> | null = null;

  constructor(options: RunOptions) {
    super(IDLE_RUN);
    const { at, blocks, mount, range } = options.placement;
    const { config } = options;
    this.edits = options.edits;
    this.file = options.file;
    this.onError = options.onError;
    this.onClose = options.onClose;
    this.onSaved = options.onSaved;
    this.hash = options.hash;
    this.draft = new Draft(at, options.source, range);
    this.style = {
      ...detectStyle(options.source),
      smartypants: config.smartypants,
    };

    const parsed = parseRun(this.draft.text, config.smartypants);
    this.originals = parsed.originals;

    this.root = document.createElement("div");
    this.root.className = "esqia-editor";
    mount(this.root);

    this.slash = new SlashMenuStore(config, () => this.editor);
    this.editor = new Editor({
      content: parsed.doc,
      editorProps: {
        handleKeyDown: (_view, event) => this.handleKeyDown(event),
      },
      element: this.root,
      extensions: createExtensions({
        config,
        slash: { onChange: this.slash.show, onKeyDown: this.slash.key },
        spacers: this.style.spacers,
        templates: sampleTemplates(),
      }),
    });

    this.editor.state.doc.forEach((node) => {
      const original = node.attrs.id
        ? this.originals.get(node.attrs.id)
        : undefined;
      if (original) {
        original.fingerprint = fingerprint(node);
      }
    });

    this.page = this.edits.open({
      blocks,
      editor: this.editor,
      file: this.file,
      range,
      root: this.root,
      version: this.hash,
    });

    this.editor.on("update", () => this.schedule());
    this.editor.on("focus", () => options.onFocus(this));
    this.editor.on("transaction", () =>
      this.update({ revision: this.snapshot.revision + 1 })
    );
    placeCaret(this.editor, options.caret);
  }

  setEditable(editable: boolean) {
    if (!this.editor.isDestroyed) {
      this.editor.setEditable(editable);
    }
  }

  private schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.save(), SAVE_DELAY);
  }

  private async save(closing = false): Promise<void> {
    clearTimeout(this.timer);
    if (this.saving) {
      await this.saving;
      return this.save(closing);
    }
    const body = serializeRun(
      this.editor.state.doc,
      this.originals,
      this.style
    );
    const intent = this.draft.next(body, closing);
    if (!intent) {
      return;
    }

    this.update({ saving: true });
    this.saving = this.persist(intent)
      .catch((error: unknown) => {
        this.onError(
          error instanceof ConflictError
            ? "Changed in your editor. Reopen the block to keep going."
            : errorText(error)
        );
        void this.close(true);
      })
      .finally(() => {
        this.saving = null;
        this.update({ saving: false });
      });
    return this.saving;
  }

  private async persist(intent: RunIntent) {
    const written = await this.edits.applyRun(this.file, this.hash, intent, {
      group: this.group,
      page: this.page,
    });
    if (!written) {
      return;
    }
    this.hash = written.hash;
    this.draft.saved(intent, written.range);
    this.wrote = true;
    this.onSaved();
  }

  close(discard = false): Promise<void> {
    this.closing ??= (async () => {
      clearTimeout(this.timer);
      if (!discard) {
        await this.save(true);
      }
      const settled = await this.page.close({
        discard,
        version: this.hash,
        wrote: this.wrote,
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
