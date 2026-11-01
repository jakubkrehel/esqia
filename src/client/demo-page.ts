import type { Editor } from "@tiptap/core";
import { type BlockType, blockType, parseMdx } from "../shared/markdown";
import { type BlockRange, mapRange, mapSpan, type Op } from "../shared/ops";
import { WRAPPER, type WrapperFields } from "../shared/wrapper";
import {
  createWrapper,
  fileWrappers,
  markRemoved,
  readRange,
  stampRange,
  stampWrapper,
} from "./blocks";
import { writtenBlocks } from "./convert";
import type { PageClosing, PageOpening, RunPage } from "./page";

const ignore = () => undefined;

export class DemoPage implements RunPage {
  private readonly editor: Editor;
  private readonly file: string;
  private readonly own: HTMLElement[];
  private readonly root: HTMLElement;
  private readonly source: () => string;

  constructor(
    { blocks, editor, file, root }: PageOpening,
    source: () => string
  ) {
    this.editor = editor;
    this.file = file;
    this.root = root;
    this.source = source;
    this.own = blocks.map((block) => block.el);
    for (const el of this.own) {
      el.style.setProperty("display", "none", "important");
    }
  }

  readonly track = ignore;

  close({ version }: PageClosing) {
    const range = readRange(this.root);
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

function runRoots(file: string): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(`[${WRAPPER.run}]`)].filter(
    (el) => el.getAttribute(WRAPPER.run) === file
  );
}

interface PageEdit {
  after: string;
  before: string;
  file: string;
  ops: Op[];
}

export function syncPage(edit: PageEdit, version: string) {
  const { after, before, file, ops } = edit;
  const placed: { el: HTMLElement; start: number }[] = [];
  const orphans: { el: HTMLElement; text: string }[] = [];
  for (const el of fileWrappers(file)) {
    const range = readRange(el);
    const mapped = mapRange(ops, range);
    if (mapped) {
      stampRange(el, mapped);
      el.setAttribute(WRAPPER.version, version);
      placed.push({ el, start: mapped.start });
    } else {
      orphans.push({ el, text: before.slice(range.start, range.end) });
    }
  }
  const runs: BlockRange[] = [];
  for (const root of runRoots(file)) {
    const range = mapSpan(ops, readRange(root));
    stampRange(root, range);
    runs.push(range);
    placed.push({ el: root, start: range.start });
  }

  for (const node of parseMdx(after).children) {
    const start = node.position?.start.offset ?? 0;
    const end = node.position?.end.offset ?? 0;
    const owned =
      placed.some((p) => p.start === start) ||
      runs.some((run) => start >= run.start && end <= run.end);
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
    orphan.el.removeAttribute(WRAPPER.removed);
    orphan.el.style.setProperty("display", "contents");
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
