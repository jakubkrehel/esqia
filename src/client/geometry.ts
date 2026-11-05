import {
  type Block,
  fileBlocks,
  isHidden,
  pageWrappers,
  readBlock,
} from "./blocks";

export interface Rect {
  height: number;
  left: number;
  top: number;
  width: number;
}

export interface Geometry {
  handleTop: number;
  radius: number;
  rect: Rect;
}
export const PAD = 4;
export const HANDLE = 28;
const HANDLE_GAP = 10;
const HIT_SLOP = { bottom: 4, left: 64, right: 16, top: 4 };
const DROP_LINE = 2;
const DROP_EDGE_GAP = 6;
const FIRST_LINE_REACH = 64;

export function hitTest(x: number, y: number): Block | null {
  let best: { block: Block; area: number } | null = null;
  for (const el of pageWrappers()) {
    const rect = blockRect(el);
    if (!rect) {
      continue;
    }
    if (
      y < rect.top - HIT_SLOP.top ||
      y > rect.bottom + HIT_SLOP.bottom ||
      x < rect.left - HIT_SLOP.left ||
      x > rect.right + HIT_SLOP.right
    ) {
      continue;
    }
    const area = rect.width * rect.height;
    if (!best || area < best.area) {
      best = { area, block: readBlock(el) };
    }
  }
  return best?.block ?? null;
}

export function dropTarget(
  block: Block,
  y: number
): { line: Rect | null; target: Block | null } {
  const siblings = fileBlocks(block.file).filter(
    (b) => b.el.parentElement === block.el.parentElement
  );
  const own = blockRect(block.el);
  const left = own?.left ?? 0;
  const width = own?.width ?? 0;
  let previousBottom: number | null = null;

  for (const sibling of siblings) {
    const rect = blockRect(sibling.el);
    if (!rect) {
      continue;
    }
    if (y < rect.top + rect.height / 2) {
      const top =
        previousBottom === null
          ? rect.top - DROP_EDGE_GAP
          : (previousBottom + rect.top - DROP_LINE) / 2;
      return { line: { height: DROP_LINE, left, top, width }, target: sibling };
    }
    previousBottom = rect.bottom;
  }
  return {
    line:
      previousBottom === null
        ? null
        : {
            height: DROP_LINE,
            left,
            top: previousBottom + DROP_EDGE_GAP,
            width,
          },
    target: null,
  };
}

export function measureBlock(block: Block): Geometry | null {
  const rect = blockRect(block.el);
  if (!rect) {
    return null;
  }
  const first = block.el.firstElementChild;
  const radius = first
    ? Number.parseFloat(getComputedStyle(first).borderTopLeftRadius) || 0
    : 0;
  const line = firstLineRect(block.el);

  let center = rect.top + HANDLE / 2;
  if (line && line.top - rect.top < FIRST_LINE_REACH) {
    center = line.top + line.height / 2;
  } else if (!line && rect.height < FIRST_LINE_REACH) {
    center = rect.top + rect.height / 2;
  }
  return { handleTop: center - HANDLE / 2, radius, rect: toRect(rect) };
}

function firstLineRect(el: HTMLElement): DOMRect | null {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.textContent?.trim()
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP,
  });
  const text = walker.nextNode();
  if (!text?.textContent) {
    return null;
  }
  const start = text.textContent.search(/\S/);
  const range = document.createRange();
  range.setStart(text, start);
  range.setEnd(text, start + 1);
  return range.getClientRects()[0] ?? null;
}

export function gutterPosition(geometry: Geometry) {
  return {
    left: geometry.rect.left - PAD - HANDLE_GAP,
    top: geometry.handleTop,
    transform: "translateX(-100%)",
  };
}

function toRect(rect: DOMRect): Rect {
  return {
    height: rect.height,
    left: rect.left,
    top: rect.top,
    width: rect.width,
  };
}

export function box(rect: Rect) {
  return {
    height: rect.height + PAD * 2,
    left: rect.left - PAD,
    top: rect.top - PAD,
    width: rect.width + PAD * 2,
  };
}

export function blockRect(el: HTMLElement): DOMRect | null {
  if (isHidden(el)) {
    return null;
  }
  const range = document.createRange();
  range.selectNodeContents(el);
  const rect = range.getBoundingClientRect();
  if (readBlock(el).type === "spacer") {
    return spacerRect(el, rect);
  }
  return rect.width === 0 && rect.height === 0 ? null : rect;
}

function spacerRect(el: HTMLElement, line: DOMRect): DOMRect | null {
  const column = el.parentElement;
  if (!column || line.height === 0) {
    return null;
  }
  const bounds = column.getBoundingClientRect();
  const style = getComputedStyle(column);
  const left = bounds.left + Number.parseFloat(style.paddingLeft);
  const right = bounds.right - Number.parseFloat(style.paddingRight);
  return new DOMRect(left, line.top, right - left, line.height);
}

export function firstVisibleBlock(): Block | null {
  for (const el of pageWrappers()) {
    const rect = blockRect(el);
    if (rect && rect.bottom > 0) {
      return readBlock(el);
    }
  }
  return null;
}
