import { type BlockType, EDITABLE } from "../shared/markdown";
import { api } from "./api";

export interface Block {
  el: HTMLElement;
  end: number;
  file: string;
  start: number;
  type: BlockType;
  version: string;
}

export const BLOCK_SELECTOR = "[data-esqia-file]";

export function readBlock(el: HTMLElement): Block {
  const file = el.dataset.esqiaFile ?? "";
  const revision = Number(el.dataset.esqiaRev ?? 0);
  return {
    el,
    end: api.mapOffset(file, Number(el.dataset.esqiaEnd), revision),
    file,
    start: api.mapOffset(file, Number(el.dataset.esqiaStart), revision),
    type: (el.dataset.esqiaType ?? "block") as BlockType,
    version: el.dataset.esqiaV ?? "",
  };
}

export function fileBlocks(file: string): Block[] {
  return [...document.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)]
    .filter(
      (el) => el.dataset.esqiaFile === file && !("esqiaRemoved" in el.dataset)
    )
    .map(readBlock)
    .sort((a, b) => a.start - b.start);
}

export function runAround(block: Block): Block[] {
  const blocks = fileBlocks(block.file);
  const index = blocks.findIndex((b) => b.start === block.start);
  let first = index;
  let last = index;
  while (first > 0 && EDITABLE.has((blocks[first - 1] as Block).type)) {
    first--;
  }
  while (
    last < blocks.length - 1 &&
    EDITABLE.has((blocks[last + 1] as Block).type)
  ) {
    last++;
  }
  return blocks.slice(first, last + 1);
}

export function blockRect(el: HTMLElement): DOMRect | null {
  if (el.style.display === "none") {
    return null;
  }
  const range = document.createRange();
  range.selectNodeContents(el);
  const rect = range.getBoundingClientRect();
  if (el.dataset.esqiaType === "spacer") {
    return spacerRect(el, rect);
  }
  return rect.width === 0 && rect.height === 0 ? null : rect;
}

function spacerRect(el: HTMLElement, line: DOMRect): DOMRect | null {
  const column = el.parentElement;
  if (!column || line.height === 0) {
    return null;
  }
  const box = column.getBoundingClientRect();
  const style = getComputedStyle(column);
  const left = box.left + Number.parseFloat(style.paddingLeft);
  const right = box.right - Number.parseFloat(style.paddingRight);
  return new DOMRect(left, line.top, right - left, line.height);
}

export function waitForVersion(
  file: string,
  version: string,
  timeout = 3000
): Promise<boolean> {
  const current = () =>
    fileBlocks(file).every((block) => block.version === version);
  if (current()) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      if (!current()) {
        return;
      }
      finish(true);
    });
    const timer = setTimeout(() => finish(false), timeout);
    const finish = (ok: boolean) => {
      observer.disconnect();
      clearTimeout(timer);
      resolve(ok);
    };
    observer.observe(document.body, {
      attributeFilter: ["data-esqia-v"],
      attributes: true,
      childList: true,
      subtree: true,
    });
  });
}

export function textOffsetAt(
  el: HTMLElement,
  x: number,
  y: number
): number | null {
  let node: Node | null = null;
  let offset = 0;
  if (document.caretPositionFromPoint) {
    const position = document.caretPositionFromPoint(x, y);
    node = position?.offsetNode ?? null;
    offset = position?.offset ?? 0;
  } else {
    const range = document.caretRangeFromPoint?.(x, y);
    node = range?.startContainer ?? null;
    offset = range?.startOffset ?? 0;
  }
  if (!node || !el.contains(node)) {
    return null;
  }
  const range = document.createRange();
  range.setStart(el, 0);
  range.setEnd(node, offset);
  return range.toString().length;
}
