import type { Editor } from "@tiptap/core";
import type { ClientConfig } from "../shared/config";
import { type MemoryStore, memoryStore } from "../shared/history";
import { type BlockType, blockType, parseMdx } from "../shared/markdown";
import { type BlockRange, mapRange, mapSpan, type Op } from "../shared/ops";
import type { WrapperFields } from "../shared/wrapper";
import { type Backend, memoryBackend } from "./api";
import {
  createWrapper,
  fileWrappers,
  hideBlock,
  markRemoved,
  readBlock,
  readRange,
  restoreRemoved,
  stampRange,
  stampVersion,
  stampWrapper,
} from "./blocks";
import { writtenBlocks } from "./convert";
import type { PageClosing, PageOpening, PageSync, RunPage } from "./page";

export function demoEditing(
  sources: Record<string, string>,
  config: ClientConfig
): { backend: Backend; sync: PageSync } {
  const store = memoryStore((file) => {
    const source = sources[file];
    if (source === undefined) {
      throw new Error(`esqia: the demo has no source for ${file}.`);
    }
    const rendered = fileWrappers(file)[0];
    return {
      hash: (rendered && readBlock(rendered).version) || "demo",
      source,
    };
  });
  return { backend: memoryBackend(store, config), sync: demoSync(store) };
}

function demoSync(store: MemoryStore): PageSync {
  const open = new Set<DemoPage>();

  return {
    applied({ file, hash, ops, run }) {
      const runs = [...open].filter((page) => page.file === file);
      for (const page of runs) {
        page.track(
          hash,
          page === run?.page ? run.range : mapSpan(ops, page.range)
        );
      }
      const edit = {
        after: store.text(file),
        before: store.previous(file),
        file,
        ops,
      };
      syncPage(edit, hash, runs);
    },
    open(opening) {
      const page = new DemoPage(
        opening,
        () => store.text(opening.file),
        () => open.delete(page)
      );
      open.add(page);
      return page;
    },
  };
}

class DemoPage implements RunPage {
  readonly file: string;
  readonly root: HTMLElement;
  range: BlockRange;
  private readonly editor: Editor;
  private readonly own: HTMLElement[];
  private readonly source: () => string;
  private readonly onClose: () => void;

  constructor(
    { blocks, editor, file, range, root }: PageOpening,
    source: () => string,
    onClose: () => void
  ) {
    this.editor = editor;
    this.file = file;
    this.range = range;
    this.root = root;
    this.source = source;
    this.onClose = onClose;
    this.own = blocks.map((block) => block.el);
    for (const el of this.own) {
      hideBlock(el);
    }
  }

  track(_version: string, range: BlockRange) {
    this.range = range;
  }

  close({ version }: PageClosing) {
    this.onClose();
    const { range } = this;
    const text = this.source().slice(range.start, range.end);
    const blocks = parseMdx(text).children;
    const written = writtenBlocks(this.editor.state.doc);
    const fields = (start: number, end: number, type: BlockType) => ({
      end: range.start + end,
      file: this.file,
      start: range.start + start,
      type,
      version,
    });

    if (blocks.length === written.length) {
      written.forEach(({ node, offset }, index) => {
        const block = blocks[index];
        const rendered = this.editor.view.nodeDOM(offset);
        if (!(block && rendered instanceof HTMLElement)) {
          return;
        }
        const wrapper = createWrapper(
          fields(
            block.position?.start.offset ?? 0,
            block.position?.end.offset ?? 0,
            blockType(block)
          ),
          node.type.name === "spacer"
            ? document.createElement("br")
            : settled(rendered)
        );
        this.root.before(wrapper);
      });
    } else if (blocks[0]) {
      const whole = document.createDocumentFragment();
      for (const { offset } of written) {
        const rendered = this.editor.view.nodeDOM(offset);
        if (rendered instanceof HTMLElement) {
          whole.append(settled(rendered));
        }
      }
      this.root.before(
        createWrapper(fields(0, text.length, blockType(blocks[0])), whole)
      );
    }

    for (const el of this.own) {
      markRemoved(el);
    }
    return Promise.resolve(true);
  }
}

function settled(rendered: HTMLElement): HTMLElement {
  const copy = rendered.cloneNode(true) as HTMLElement;
  for (const el of [copy, ...copy.querySelectorAll<HTMLElement>("*")]) {
    el.removeAttribute("contenteditable");
    el.removeAttribute("draggable");
    delete el.dataset.placeholder;
    el.classList.remove("is-empty", "is-editor-empty");
    if (
      el.classList.contains("ProseMirror-trailingBreak") ||
      el.classList.contains("ProseMirror-separator")
    ) {
      el.remove();
    }
  }
  return copy;
}

interface PageEdit {
  after: string;
  before: string;
  file: string;
  ops: Op[];
}

function syncPage(edit: PageEdit, version: string, runs: DemoPage[]) {
  const { after, before, file, ops } = edit;
  const placed: { el: HTMLElement; start: number }[] = [];
  const orphans: { el: HTMLElement; text: string }[] = [];
  for (const el of fileWrappers(file)) {
    const range = readRange(el);
    const mapped = mapRange(ops, range);
    if (mapped) {
      stampRange(el, mapped);
      stampVersion(el, version);
      placed.push({ el, start: mapped.start });
    } else {
      orphans.push({ el, text: before.slice(range.start, range.end) });
    }
  }
  for (const run of runs) {
    placed.push({ el: run.root, start: run.range.start });
  }

  for (const node of parseMdx(after).children) {
    const start = node.position?.start.offset ?? 0;
    const end = node.position?.end.offset ?? 0;
    const owned =
      placed.some((p) => p.start === start) ||
      runs.some(({ range }) => start >= range.start && end <= range.end);
    if (owned) {
      continue;
    }
    const fields = { end, file, start, type: blockType(node), version };
    const el = adoptOrphan(orphans, after.slice(start, end), fields);
    if (el) {
      placeAmong(placed, el, start);
    }
  }

  for (const orphan of orphans) {
    markRemoved(orphan.el);
  }
}

function adoptOrphan(
  orphans: { el: HTMLElement; text: string }[],
  text: string,
  fields: WrapperFields
): HTMLElement | null {
  const index = orphans.findIndex((orphan) => orphan.text === text);
  const orphan = index >= 0 ? orphans.splice(index, 1)[0] : undefined;
  if (orphan) {
    restoreRemoved(orphan.el);
    stampWrapper(orphan.el, fields);
    return orphan.el;
  }
  return fields.type === "spacer"
    ? createWrapper(fields, document.createElement("br"))
    : null;
}

function placeAmong(
  placed: { el: HTMLElement; start: number }[],
  el: HTMLElement,
  start: number
) {
  const next = placed
    .filter((p) => p.start > start)
    .sort((a, b) => a.start - b.start)[0];
  const previous = placed
    .filter((p) => p.start < start)
    .sort((a, b) => b.start - a.start)[0];
  if (next) {
    next.el.before(el);
  } else {
    previous?.el.after(el);
  }
  placed.push({ el, start });
}
