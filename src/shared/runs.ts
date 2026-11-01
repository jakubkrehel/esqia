import { type BlockType, EDITABLE } from "./markdown";

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
