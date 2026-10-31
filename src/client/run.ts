import { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { detectStyle, type MarkdownStyle } from "../shared/markdown";
import { api, type ClientConfig, ConflictError } from "./api";
import { type Block, fileBlocks, waitForVersion } from "./blocks";
import { fingerprint, type Original, parseRun, serializeRun } from "./convert";
import { createExtensions, sampleTemplates } from "./editor";

export interface SlashState {
  query: string;
  rect: { left: number; top: number; bottom: number };
}

export interface RunSnapshot {
  saving: boolean;
  busy: string | null;
  slash: SlashState | null;
  selection: number;
}

export interface OpenOptions {
  file: string;
  /** The blocks to edit. Empty to start a new paragraph after `after`. */
  blocks: Block[];
  after?: Block;
  caret?: { index: number; offset: number };
  config: ClientConfig;
  onError(message: string): void;
  onClose(): void;
}

const SAVE_DELAY = 800;

/**
 * One editing session over a contiguous run of blocks. The rendered blocks are
 * hidden, not edited: React owns them, and typing into its DOM would break the
 * next Fast Refresh. The editor sits beside them and writes the run's source.
 */
export class Run {
  readonly file: string;
  readonly root: HTMLElement;
  readonly editor: Editor;
  readonly config: ClientConfig;

  slashKeys: ((event: KeyboardEvent) => boolean) | null = null;

  private hash: string;
  private start: number;
  private current: string;
  private readonly prefix: string;
  private readonly originals: Map<string, Original>;
  private readonly style: MarkdownStyle;
  private readonly ranges = new Map<string, [number, number]>();
  private readonly hidden = new Set<HTMLElement>();
  private readonly observer: MutationObserver;
  private readonly group = Math.random().toString(36).slice(2);
  private readonly onError: (message: string) => void;
  private readonly onClose: () => void;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private saving: Promise<void> | null = null;
  private wrote = false;
  private closing: Promise<void> | null = null;
  private snapshot: RunSnapshot = { saving: false, busy: null, slash: null, selection: 0 };
  private listeners = new Set<() => void>();

  static async open(options: OpenOptions): Promise<Run> {
    const { source, hash } = await api.source(options.file);
    const version = options.blocks[0]?.version ?? options.after?.version;
    if (version && version !== hash) {
      throw new ConflictError("The page is behind the file. Wait for it to refresh, then try again.");
    }
    return new Run(options, source, hash);
  }

  private constructor(options: OpenOptions, source: string, hash: string) {
    this.file = options.file;
    this.config = options.config;
    this.onError = options.onError;
    this.onClose = options.onClose;
    this.hash = hash;

    const first = options.blocks[0];
    const last = options.blocks.at(-1);
    this.start = first ? first.start : (options.after?.end ?? source.length);
    const end = last ? last.end : this.start;
    this.current = source.slice(this.start, end);
    this.prefix = first ? "" : "\n\n";
    this.style = { ...detectStyle(source), smartypants: this.config.smartypants };
    this.ranges.set(hash, [this.start, end]);

    const parsed = parseRun(this.current, this.config.smartypants);
    this.originals = parsed.originals;

    this.root = document.createElement("div");
    this.root.className = "esqe-editor";
    if (first) first.el.before(this.root);
    else options.after?.el.after(this.root);

    const templates = sampleTemplates();
    this.editor = new Editor({
      element: this.root,
      extensions: createExtensions({ templates, config: this.config, spacers: this.style.spacers }),
      content: parsed.doc,
      editorProps: {
        handleKeyDown: (_view, event) => this.handleKeyDown(event),
        handlePaste: (_view, event) => this.handleFiles(event.clipboardData?.files),
        handleDrop: (view, event, _slice, moved) => {
          if (moved) return false;
          const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
          return this.handleFiles(event.dataTransfer?.files, pos);
        },
      },
    });

    this.editor.state.doc.forEach((node) => {
      const original = node.attrs.id ? this.originals.get(node.attrs.id) : undefined;
      if (original) original.fingerprint = fingerprint(node);
    });

    this.hide();
    this.observer = new MutationObserver(() => this.hide());
    this.observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-esqe-v", "data-esqe-start"],
    });

    this.editor.on("update", () => this.schedule());
    this.editor.on("transaction", () => this.update({ slash: this.readSlash(), selection: this.snapshot.selection + 1 }));
    this.placeCaret(options.caret);
  }

  get usesSpacers() {
    return this.style.spacers;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  private update(patch: Partial<RunSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }

  /** Hide every rendered block that falls inside the run, in whichever version of the file the page currently shows. */
  private hide() {
    for (const block of fileBlocks(this.file)) {
      const range = this.ranges.get(block.version);
      const inside = range && block.start >= range[0] && block.start < range[1];
      if (inside && block.el.style.display !== "none") {
        block.el.style.setProperty("display", "none", "important");
        this.hidden.add(block.el);
      } else if (!inside && this.hidden.has(block.el)) {
        block.el.style.setProperty("display", "contents");
        this.hidden.delete(block.el);
      }
    }
  }

  private placeCaret(caret: OpenOptions["caret"]) {
    const { doc } = this.editor.state;
    let pos = 1;
    if (caret) {
      doc.forEach((node, offset, index) => {
        if (index === caret.index) pos = offset + 1 + inlinePos(node, caret.offset);
      });
    }
    const selection = TextSelection.near(doc.resolve(Math.min(pos, doc.content.size)));
    this.editor.view.dispatch(this.editor.state.tr.setSelection(selection));
    this.editor.view.focus();
  }

  private schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.save(), SAVE_DELAY);
  }

  private async save(): Promise<void> {
    clearTimeout(this.timer);
    if (this.saving) {
      await this.saving;
      return this.save();
    }
    const body = serializeRun(this.editor.state.doc, this.originals, this.style);
    const text = body && this.prefix + body;
    if (text === this.current) return;

    const op = { start: this.start, end: this.start + this.current.length, expected: this.current, text };
    this.update({ saving: true });
    this.saving = api
      .ops(this.file, this.hash, [op], this.group)
      .then(({ hash }) => {
        this.hash = hash;
        this.current = text;
        this.wrote = true;
        this.ranges.set(hash, [this.start, this.start + text.length]);
      })
      .catch((error: unknown) => {
        this.onError(error instanceof ConflictError ? "Changed in your editor. Reopen the block to keep going." : String(error));
        void this.close(true);
      })
      .finally(() => {
        this.saving = null;
        this.update({ saving: false });
      });
    return this.saving;
  }

  /** Writes what's left, waits for the page to render that version, then hands the blocks back to React. */
  close(discard = false): Promise<void> {
    this.closing ??= (async () => {
      clearTimeout(this.timer);
      if (!discard) await this.save();
      if (this.current === "" && this.prefix === "" && !discard) await this.collapseGap();
      if (this.wrote && !discard && !(await waitForVersion(this.file, this.hash))) {
        location.reload();
        return;
      }
      this.observer.disconnect();
      this.editor.destroy();
      this.root.remove();
      for (const el of this.hidden) el.style.setProperty("display", "contents");
      this.onClose();
    })();
    return this.closing;
  }

  /** Every block of the run was deleted; fold the blank lines it leaves behind into one gap. */
  private async collapseGap() {
    const { source, hash } = await api.source(this.file);
    if (hash !== this.hash) return;
    let a = this.start;
    let b = this.start;
    while (a > 0 && /\s/.test(source[a - 1] ?? "")) a--;
    while (b < source.length && /\s/.test(source[b] ?? "")) b++;
    const text = a === 0 || b === source.length ? (b === source.length ? "\n" : "") : "\n\n";
    try {
      const result = await api.ops(this.file, hash, [{ start: a, end: b, expected: source.slice(a, b), text }], this.group);
      this.hash = result.hash;
      this.wrote = true;
    } catch {}
  }

  private handleKeyDown(event: KeyboardEvent): boolean {
    if (this.snapshot.slash && this.slashKeys?.(event)) return true;
    if (event.key === "Escape") {
      void this.close();
      return true;
    }
    return false;
  }

  private readSlash(): SlashState | null {
    const { $from, empty } = this.editor.state.selection;
    if (!empty || $from.parent.type.name !== "paragraph" || $from.depth !== 1) return null;
    const text = $from.parent.textContent;
    const match = /^\/([\w ]{0,24})$/.exec(text);
    if (!match || $from.parentOffset !== text.length) return null;
    const coords = this.editor.view.coordsAtPos($from.pos);
    return { query: match[1] ?? "", rect: { left: coords.left, top: coords.top, bottom: coords.bottom } };
  }

  /** Replace the `/query` paragraph the slash menu was opened from. */
  clearSlashText() {
    const { $from } = this.editor.state.selection;
    this.editor
      .chain()
      .deleteRange({ from: $from.start(), to: $from.end() })
      .run();
  }

  insertBlock(raw: string) {
    const { $from } = this.editor.state.selection;
    const node = this.editor.schema.nodes.jsxBlock.create({ raw });
    const emptyParagraph = $from.depth === 1 && $from.parent.type.name === "paragraph" && $from.parent.content.size === 0;
    const tr = this.editor.state.tr;
    if (emptyParagraph) tr.replaceWith($from.before(), $from.after(), node);
    else tr.insert($from.after(1), node);
    this.editor.view.dispatch(tr.scrollIntoView());
    this.editor.view.focus();
  }

  insertSpacer() {
    const { $from } = this.editor.state.selection;
    const { spacer, paragraph } = this.editor.schema.nodes;
    const tr = this.editor.state.tr.replaceWith($from.before(), $from.after(), [spacer.create(), paragraph.create()]);
    tr.setSelection(TextSelection.near(tr.doc.resolve($from.before() + 2)));
    this.editor.view.dispatch(tr);
  }

  private handleFiles(files: FileList | undefined, pos?: number): boolean {
    const media = [...(files ?? [])].filter((file) => /^(image|video)\//.test(file.type));
    if (media.length === 0) return false;
    if (pos !== undefined) {
      this.editor.view.dispatch(this.editor.state.tr.setSelection(TextSelection.near(this.editor.state.doc.resolve(pos))));
    }
    void (async () => {
      for (const file of media) await this.insertMedia(file);
    })();
    return true;
  }

  async insertMedia(file: File) {
    this.update({ busy: `Uploading ${file.name}…` });
    try {
      const [{ width, height }, { url }] = await Promise.all([measure(file), api.upload(this.file, file)]);
      const template = file.type.startsWith("video/") ? this.config.media.video : this.config.media.image;
      const raw = template
        .replaceAll("{url}", url)
        .replaceAll("{width}", String(width))
        .replaceAll("{height}", String(height))
        .replaceAll("{name}", file.name.replace(/\.[^.]+$/, ""));
      this.insertBlock(raw);
    } catch (error) {
      this.onError(`Upload failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.update({ busy: null });
    }
  }
}

function inlinePos(node: PMNode, offset: number): number {
  if (!node.isTextblock) return 0;
  let remaining = offset;
  let pos = 0;
  let done = false;
  node.forEach((child) => {
    if (done) return;
    const length = child.isText ? (child.text?.length ?? 0) : 1;
    if (remaining <= length) {
      pos += remaining;
      done = true;
      return;
    }
    remaining -= length;
    pos += child.nodeSize;
  });
  return pos;
}

async function measure(file: File): Promise<{ width: number; height: number }> {
  if (file.type.startsWith("video/")) {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = URL.createObjectURL(file);
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = reject;
    });
    URL.revokeObjectURL(video.src);
    return { width: video.videoWidth, height: video.videoHeight };
  }
  const bitmap = await createImageBitmap(file);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}
