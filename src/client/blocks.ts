import type { BlockType } from "../shared/markdown";
import type { BlockRange } from "../shared/ops";
import { runAround as sharedRunAround } from "../shared/runs";
import {
  BLOCK_SELECTOR,
  WRAPPER,
  type WrapperFields,
  wrapperAttributes,
} from "../shared/wrapper";

export { BLOCK_SELECTOR };

export interface Block extends WrapperFields {
  el: HTMLElement;
}

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

export function createWrapper(fields: WrapperFields, child: Node): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.style.display = "contents";
  stampWrapper(wrapper, fields);
  wrapper.append(child);
  return wrapper;
}

export function stampWrapper(el: HTMLElement, fields: WrapperFields) {
  for (const [name, value] of wrapperAttributes(fields)) {
    el.setAttribute(name, value);
  }
}

export function markRemoved(el: HTMLElement) {
  el.setAttribute(WRAPPER.removed, "");
  el.style.setProperty("display", "none", "important");
}

export function fileWrappers(file: string): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)].filter(
    (el) =>
      el.getAttribute(WRAPPER.file) === file &&
      !el.hasAttribute(WRAPPER.removed)
  );
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
