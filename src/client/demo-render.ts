import type { Editor } from "@tiptap/core";
import { type BlockRange, mapRange, type Op } from "../shared/ops";
import { sourceBlocks, type WrapperFields } from "../shared/wrapper";
import {
  createWrapper,
  fileWrappers,
  markRemoved,
  readRange,
  restoreRemoved,
  stampRange,
  stampVersion,
  stampWrapper,
} from "./blocks";
import { writtenBlocks } from "./serialize-run";

export interface ClosedRun {
  editor: Editor;
  file: string;
  range: BlockRange;
  root: HTMLElement;
  text: string;
  version: string;
}

export function renderClosedRun(run: ClosedRun) {
  const { editor, file, range, root, text, version } = run;
  const blocks = sourceBlocks(text, file, version).map((fields) => ({
    ...fields,
    end: range.start + fields.end,
    start: range.start + fields.start,
  }));
  const written = writtenBlocks(editor.state.doc);

  if (blocks.length === written.length) {
    written.forEach(({ node, offset }, index) => {
      const fields = blocks[index];
      const rendered = editor.view.nodeDOM(offset);
      if (!(fields && rendered instanceof HTMLElement)) {
        return;
      }
      const content =
        node.type.name === "spacer"
          ? document.createElement("br")
          : settled(rendered);
      root.before(createWrapper(fields, content));
    });
    return;
  }

  const first = blocks[0];
  if (!first) {
    return;
  }
  const whole = document.createDocumentFragment();
  for (const { offset } of written) {
    const rendered = editor.view.nodeDOM(offset);
    if (rendered instanceof HTMLElement) {
      whole.append(settled(rendered));
    }
  }
  const span = { end: range.start + text.length, start: range.start };
  root.before(createWrapper({ ...first, ...span }, whole));
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

export interface FileEdit {
  after: string;
  before: string;
  file: string;
  ops: Op[];
}

export interface OpenRun {
  range: BlockRange;
  root: HTMLElement;
}

export function restampFile(edit: FileEdit, version: string, runs: OpenRun[]) {
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

  for (const fields of sourceBlocks(after, file, version)) {
    const { end, start } = fields;
    const owned =
      placed.some((p) => p.start === start) ||
      runs.some(({ range }) => start >= range.start && end <= range.end);
    if (owned) {
      continue;
    }
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
