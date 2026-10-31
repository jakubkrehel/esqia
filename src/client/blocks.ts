import { type BlockType, EDITABLE } from "../shared/markdown";

export interface Block {
  el: HTMLElement;
  end: number;
  file: string;
  start: number;
  type: BlockType;
  version: string;
}

export const BLOCK_SELECTOR = "[data-esqe-file]";

export function readBlock(el: HTMLElement): Block {
  return {
    el,
    end: Number(el.dataset.esqeEnd),
    file: el.dataset.esqeFile ?? "",
    start: Number(el.dataset.esqeStart),
    type: (el.dataset.esqeType ?? "block") as BlockType,
    version: el.dataset.esqeV ?? "",
  };
}

export function fileBlocks(file: string): Block[] {
  return [...document.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)]
    .filter((el) => el.dataset.esqeFile === file)
    .map(readBlock)
    .sort((a, b) => a.start - b.start);
}

/** The clicked block plus its editable neighbours, up to the nearest demo or other JSX on either side. */
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

/** A `display: contents` wrapper has no box of its own, so measure what it contains. */
export function blockRect(el: HTMLElement): DOMRect | null {
  const range = document.createRange();
  range.selectNodeContents(el);
  const rect = range.getBoundingClientRect();
  return rect.width === 0 && rect.height === 0 ? null : rect;
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
      attributeFilter: ["data-esqe-v"],
      attributes: true,
      childList: true,
      subtree: true,
    });
  });
}

/** Characters of rendered text between the start of `el` and the point under the pointer. */
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
