import { Editor } from "@tiptap/core";
import { detectStyle, type MarkdownStyle } from "../shared/markdown";
import { type BlockRange, type Op, removeOps } from "../shared/ops";
import { WRAPPER } from "../shared/wrapper";
import {
  type Backend,
  type ClientConfig,
  ConflictError,
  errorText,
} from "./api";
import { type Block, readRange, stampRange } from "./blocks";
import {
  placeCaret,
  type SlashItem,
  type SlashMenu,
  type SlashState,
  slashItems,
} from "./commands";
import { fingerprint, type Original, parseRun, serializeRun } from "./convert";
import { createExtensions } from "./editor";
import type { RunPage } from "./page";
import { Store } from "./store";
import { sampleTemplates } from "./templates";

export interface RunSnapshot {
  revision: number;
  saving: boolean;
  slash: SlashMenu | null;
}

export const IDLE_RUN: RunSnapshot = {
  revision: 0,
  saving: false,
  slash: null,
};

export interface Placement {
  at: "run" | "after";
  blocks: Block[];
  mount: (root: HTMLElement) => void;
  range: BlockRange;
}

export interface RunOptions {
  backend: Backend;
  caret?: { index: number; offset: number };
  config: ClientConfig;
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

  private hash: string;
  private current: string;
  private readonly backend: Backend;
  private readonly config: ClientConfig;
  private readonly replacing: boolean;
  private readonly prefix: string;
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
    this.backend = options.backend;
    this.file = options.file;
    this.config = options.config;
    this.onError = options.onError;
    this.onClose = options.onClose;
    this.onSaved = options.onSaved;
    this.hash = options.hash;
    this.replacing = at === "run";
    this.prefix = this.replacing ? "" : "\n\n";
    this.current = options.source.slice(range.start, range.end);
    this.style = {
      ...detectStyle(options.source),
      smartypants: this.config.smartypants,
    };

    const parsed = parseRun(this.current, this.config.smartypants);
    this.originals = parsed.originals;

    this.root = document.createElement("div");
    this.root.className = "esqia-editor";
    this.root.setAttribute(WRAPPER.run, this.file);
    stampRange(this.root, range);
    mount(this.root);

    this.editor = new Editor({
      content: parsed.doc,
      editorProps: {
        handleKeyDown: (_view, event) => this.handleKeyDown(event),
      },
      element: this.root,
      extensions: createExtensions({
        config: this.config,
        slash: {
          onChange: (slash) => this.showSlash(slash),
          onKeyDown: (event) => this.slashKey(event),
        },
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

    this.page = this.backend.page({
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

  chooseSlash(item: SlashItem) {
    const { slash } = this.snapshot;
    if (!slash) {
      return;
    }
    this.editor.chain().focus().deleteRange(slash.range).run();
    item.apply(this.editor);
  }

  private showSlash(state: SlashState | null) {
    if (!state) {
      this.update({ slash: null });
      return;
    }
    const query = state.query.trim().toLowerCase();
    const previous = this.snapshot.slash;
    this.update({
      slash: {
        ...state,
        active: previous?.query === query ? previous.active : 0,
        items: slashItems(this.config, query),
        query,
      },
    });
  }

  private slashKey(event: KeyboardEvent): boolean {
    const { slash } = this.snapshot;
    const count = slash?.items.length ?? 0;
    if (!slash || count === 0) {
      return false;
    }
    const step = (by: number) => {
      this.update({
        slash: { ...slash, active: (slash.active + by + count) % count },
      });
      return true;
    };
    if (event.key === "ArrowDown" || (event.key === "Tab" && !event.shiftKey)) {
      return step(1);
    }
    if (event.key === "ArrowUp" || (event.key === "Tab" && event.shiftKey)) {
      return step(-1);
    }
    if (event.key === "Enter") {
      const item = slash.items[slash.active];
      if (item) {
        this.chooseSlash(item);
      }
      return true;
    }
    return false;
  }

  private get start(): number {
    return readRange(this.root).start;
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
    const text = body && this.prefix + body;
    const emptied = closing && this.replacing && text === "";
    if (text === this.current && !emptied) {
      return;
    }

    this.update({ saving: true });
    this.saving = (emptied ? this.remove() : this.replace(text))
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

  private replace(text: string) {
    const { start, current } = this;
    const op = { end: start + current.length, expected: current, start, text };
    return this.write([op], text, start);
  }

  private async remove() {
    const { source } = await this.backend.source(this.file);
    const range = { end: this.start + this.current.length, start: this.start };
    if (source.slice(range.start, range.end) !== this.current) {
      throw new ConflictError("The file changed on disk.");
    }
    const ops = removeOps(source, range);
    const [op] = ops;
    if (op) {
      await this.write(ops, "", op.start + op.text.length);
    }
  }

  private async write(ops: Op[], text: string, start: number) {
    const { hash } = await this.backend.ops(
      this.file,
      this.hash,
      ops,
      this.group
    );
    this.hash = hash;
    this.current = text;
    this.wrote = true;
    const range = { end: start + text.length, start };
    stampRange(this.root, range);
    this.page.track(hash, range);
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
    if (event.key === "Escape" && !this.snapshot.slash) {
      void this.close();
      return true;
    }
    return false;
  }
}
