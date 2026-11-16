import type { Editor } from "@tiptap/core";
import type { BlockRange, Shown } from "../shared/ops";
import {
  fileBlocks,
  hideBlock,
  isHidden,
  showBlock,
  watchBlocks,
} from "./blocks";
import type { PageClosing, PageOpening, RunPage } from "./page";

export interface LivePages {
  closed: (page: LivePage) => void;
  refreshed: (page: LivePage, current: () => boolean) => Promise<boolean>;
}

export class LivePage implements RunPage {
  readonly file: string;
  private latest: Shown;
  private readonly shown = new Map<string, BlockRange>();
  private readonly hidden = new Set<HTMLElement>();
  private readonly root: HTMLElement;
  private readonly editor: Editor;
  private readonly host: LivePages;
  private readonly unwatch: () => void;
  private readonly onBehind: () => void;
  private readonly asked = new Set<string>();

  constructor(opening: PageOpening, host: LivePages) {
    const { editor, file, path, range, rendered, root, version } = opening;
    this.editor = editor;
    this.file = file;
    this.host = host;
    this.onBehind = opening.onBehind;
    this.root = root;
    this.latest = { range, version };
    for (const behind of path.along(rendered)) {
      this.shown.set(behind.version, behind.range);
    }
    this.shown.set(version, range);
    this.arrange();
    this.unwatch = watchBlocks(() => this.arrange());
  }

  get range(): BlockRange {
    return this.latest.range;
  }

  track(version: string, range: BlockRange) {
    this.latest = { range, version };
    this.shown.set(version, range);
    this.arrange();
  }

  async close({ discard, wrote }: PageClosing): Promise<boolean> {
    const current = () =>
      fileBlocks(this.file).every(
        (block) => block.version === this.latest.version
      );
    if (wrote && !discard && !(await this.host.refreshed(this, current))) {
      return false;
    }
    this.unwatch();
    for (const el of this.hidden) {
      showBlock(el);
    }
    hideBlock(this.root);
    this.host.closed(this);
    return true;
  }

  arrange() {
    let first: HTMLElement | null = null;
    let previous: HTMLElement | null = null;
    const blocks = fileBlocks(this.file);
    const unknown = blocks.find((block) => !this.shown.has(block.version));
    if (unknown) {
      if (!this.asked.has(unknown.version)) {
        this.asked.add(unknown.version);
        this.onBehind();
      }
      return;
    }
    for (const block of blocks) {
      const range = this.shown.get(block.version);
      const inside =
        range && block.start >= range.start && block.start < range.end;
      if (inside) {
        first ??= block.el;
        if (!isHidden(block.el)) {
          hideBlock(block.el);
        }
        this.hidden.add(block.el);
      } else if (this.hidden.has(block.el)) {
        showBlock(block.el);
        this.hidden.delete(block.el);
      }
      if (range && block.start < range.start) {
        previous = block.el;
      }
    }
    if (first) {
      this.seat(first, "before");
    } else if (previous) {
      this.seat(previous, "after");
    }
  }

  private seat(beside: HTMLElement, side: "before" | "after") {
    const seated =
      side === "before"
        ? this.root.nextElementSibling === beside
        : this.root.previousElementSibling === beside;
    if (seated) {
      return;
    }
    const focused = this.root.contains(document.activeElement);
    beside[side](this.root);
    if (focused && !this.editor.isDestroyed) {
      this.editor.view.focus();
    }
  }
}
