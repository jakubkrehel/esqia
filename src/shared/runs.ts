import { type BlockType, EDITABLE } from "./markdown";
import type { BlockRange, Path } from "./ops";

interface Typed {
  type: BlockType;
}

const joinsRun = (block: Typed | undefined): boolean =>
  block !== undefined && block.type !== "code" && EDITABLE.has(block.type);

export function runAround<T extends Typed>(blocks: T[], index: number): T[] {
  const block = blocks[index];
  if (!(block && EDITABLE.has(block.type))) {
    return [];
  }
  if (block.type === "code") {
    return [block];
  }
  let first = index;
  let last = index;
  while (joinsRun(blocks[first - 1])) {
    first--;
  }
  while (joinsRun(blocks[last + 1])) {
    last++;
  }
  return blocks.slice(first, last + 1);
}

export function splitRuns<T extends Typed>(blocks: T[]): T[][] {
  const runs: T[][] = [];
  let index = 0;
  while (index < blocks.length) {
    const run = runAround(blocks, index);
    if (run.length > 0) {
      runs.push(run);
    }
    index += Math.max(run.length, 1);
  }
  return runs;
}

export function blockAhead<T extends BlockRange>(
  path: Path,
  block: BlockRange,
  blocks: T[]
): T | null {
  const range = path.map(block);
  return (
    (range &&
      blocks.find((b) => b.start === range.start && b.end === range.end)) ??
    null
  );
}

export function runAhead<T extends Typed & BlockRange>(
  path: Path,
  anchors: BlockRange[],
  written: T[],
  whole: boolean
): BlockRange | null {
  const ahead = anchors.map((anchor) => blockAhead(path, anchor, written));
  const head = ahead[0];
  const tail = ahead.at(-1);
  if (!(head && tail) || ahead.includes(null)) {
    return null;
  }
  const at = written.indexOf(head);
  if (ahead.some((block, index) => block !== written[at + index])) {
    return null;
  }
  if (whole) {
    const run = runAround(written, at);
    if (run[0] !== head || run.at(-1) !== tail) {
      return null;
    }
  }
  return { end: tail.end, start: head.start };
}
