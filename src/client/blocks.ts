import type { BlockType } from "../shared/markdown";
import type { BlockRange } from "../shared/ops";
import { runAround as sharedRunAround } from "../shared/runs";
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

export function runAround(block: Block): Block[] {
  const blocks = fileBlocks(block.file);
  return sharedRunAround(
    blocks,
    blocks.findIndex((b) => b.start === block.start)
  );
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
