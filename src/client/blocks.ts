import { type BlockType, EDITABLE } from "../shared/markdown";
import type { BlockRange, Intent } from "../shared/ops";
import {
  BLOCK_SELECTOR,
  WRAPPER,
  type WrapperFields,
  wrapperAttributes,
} from "../shared/wrapper";

export interface Block extends WrapperFields {
  el: HTMLElement;
}

const LIVE_SELECTOR = `${BLOCK_SELECTOR}:not([${WRAPPER.removed}])`;

export function readBlock(el: HTMLElement): Block {
  return {
    el,
    end: Number(el.getAttribute(WRAPPER.end)),
    file: el.getAttribute(WRAPPER.file) ?? "",
    start: Number(el.getAttribute(WRAPPER.start)),
    type: (el.getAttribute(WRAPPER.type) ?? "block") as BlockType,
    version: el.getAttribute(WRAPPER.version) ?? "",
  };
}

export function blockAt(target: Element): Block | null {
  const el = target.closest<HTMLElement>(LIVE_SELECTOR);
  return el && readBlock(el);
}

export function editableBlockAt(target: Element): Block | null {
  const block = blockAt(target);
  return block && EDITABLE.has(block.type) ? block : null;
}

export function pageWrappers(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(LIVE_SELECTOR)];
}

export function pageHasBlocks(): boolean {
  return document.querySelector(LIVE_SELECTOR) !== null;
}

export function firstFile(): string | null {
  return (
    document.querySelector(LIVE_SELECTOR)?.getAttribute(WRAPPER.file) ?? null
  );
}

export function fileWrappers(file: string): HTMLElement[] {
  return pageWrappers().filter((el) => el.getAttribute(WRAPPER.file) === file);
}

export function fileBlocks(file: string): Block[] {
  return fileWrappers(file)
    .map(readBlock)
    .sort((a, b) => a.start - b.start);
}

export function editableBeside(
  root: Node,
  file: string,
  direction: -1 | 1
): Block | null {
  const run = document.createRange();
  run.selectNode(root);
  const beside = fileWrappers(file)
    .filter((el) => !isHidden(el) && run.comparePoint(el, 0) === direction)
    .map(readBlock)
    .filter((block) => EDITABLE.has(block.type));
  return beside.at(direction < 0 ? -1 : 0) ?? null;
}

export function blockOfType(type: BlockType): string {
  return `[${WRAPPER.type}="${type}"]`;
}

function rangeOf({ end, start }: BlockRange): BlockRange {
  return { end, start };
}

export function removeIntent(block: Block): Intent {
  return { expected: null, kind: "remove", range: rangeOf(block) };
}

export function moveIntent(block: Block, target: Block | null): Intent {
  return {
    blocks: fileBlocks(block.file).map(rangeOf),
    kind: "move",
    range: rangeOf(block),
    target: target && rangeOf(readBlock(target.el)),
  };
}

export function watchBlocks(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.body, {
    attributeFilter: [WRAPPER.version, WRAPPER.start],
    attributes: true,
    childList: true,
    subtree: true,
  });
  return () => observer.disconnect();
}

export function createWrapper(fields: WrapperFields, child: Node): HTMLElement {
  const wrapper = document.createElement("div");
  showBlock(wrapper);
  stampWrapper(wrapper, fields);
  wrapper.append(child);
  return wrapper;
}

export function stampWrapper(el: HTMLElement, fields: WrapperFields) {
  for (const [name, value] of wrapperAttributes(fields)) {
    el.setAttribute(name, value);
  }
}

export function readRange(el: HTMLElement): BlockRange {
  return {
    end: Number(el.getAttribute(WRAPPER.end)),
    start: Number(el.getAttribute(WRAPPER.start)),
  };
}

export function stampRange(el: HTMLElement, range: BlockRange) {
  el.setAttribute(WRAPPER.start, String(range.start));
  el.setAttribute(WRAPPER.end, String(range.end));
}

export function stampVersion(el: HTMLElement, version: string) {
  el.setAttribute(WRAPPER.version, version);
}

export function hideBlock(el: HTMLElement) {
  el.style.setProperty("display", "none", "important");
}

export function showBlock(el: HTMLElement) {
  el.style.setProperty("display", "contents");
}

export function isHidden(el: HTMLElement): boolean {
  return el.style.display === "none";
}

export function markRemoved(el: HTMLElement) {
  el.setAttribute(WRAPPER.removed, "");
  hideBlock(el);
}

export function restoreRemoved(el: HTMLElement) {
  el.removeAttribute(WRAPPER.removed);
  showBlock(el);
}
