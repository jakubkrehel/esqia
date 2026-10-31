export interface Op {
  end: number;
  expected: string;
  start: number;
  text: string;
}

export type OpsResult =
  | { ok: true; source: string }
  | { ok: false; reason: string };

export function applyOps(source: string, ops: Op[]): OpsResult {
  const sorted = [...ops].sort((a, b) => b.start - a.start);
  let result = source;
  let floor = Number.POSITIVE_INFINITY;

  for (const op of sorted) {
    if (op.start < 0 || op.end < op.start || op.end > source.length) {
      return {
        ok: false,
        reason: `Range ${op.start}–${op.end} is outside the file.`,
      };
    }
    if (op.end > floor) {
      return { ok: false, reason: "Edits overlap." };
    }
    if (source.slice(op.start, op.end) !== op.expected) {
      return { ok: false, reason: "The file changed on disk." };
    }
    result = result.slice(0, op.start) + op.text + result.slice(op.end);
    floor = op.start;
  }

  return { ok: true, source: result };
}

export interface BlockRange {
  end: number;
  start: number;
}

export function moveOps(
  source: string,
  blocks: BlockRange[],
  block: BlockRange,
  target: BlockRange | null
): Op[] {
  const text = source.slice(block.start, block.end);
  const removal = removalRange(blocks, block);
  const insertAt = target
    ? target.start
    : (blocks.at(-1)?.end ?? source.length);
  if (insertAt >= removal.start && insertAt <= removal.end) {
    return [];
  }

  return [
    {
      end: removal.end,
      expected: source.slice(removal.start, removal.end),
      start: removal.start,
      text: "",
    },
    target
      ? { end: insertAt, expected: "", start: insertAt, text: `${text}\n\n` }
      : { end: insertAt, expected: "", start: insertAt, text: `\n\n${text}` },
  ];
}

export function deleteOps(
  source: string,
  blocks: BlockRange[],
  block: BlockRange
): Op[] {
  const { start, end } = removalRange(blocks, block);
  return [{ end, expected: source.slice(start, end), start, text: "" }];
}

function removalRange(blocks: BlockRange[], block: BlockRange): BlockRange {
  const index = blocks.findIndex((b) => b.start === block.start);
  const next = blocks[index + 1];
  if (next) {
    return { end: next.start, start: block.start };
  }
  const previous = blocks[index - 1];
  return { end: block.end, start: previous ? previous.end : block.start };
}
