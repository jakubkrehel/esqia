import { LINE_BREAK } from "./markdown";

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
  const [removal] = removeOps(source, block);
  const insertAt = target
    ? target.start
    : (blocks.at(-1)?.end ?? source.length);
  if (!removal || (insertAt >= removal.start && insertAt <= removal.end)) {
    return [];
  }

  return [
    removal,
    target
      ? { end: insertAt, expected: "", start: insertAt, text: `${text}\n\n` }
      : { end: insertAt, expected: "", start: insertAt, text: `\n\n${text}` },
  ];
}

export function insertBreakOps(block: BlockRange): Op[] {
  return [
    {
      end: block.end,
      expected: "",
      start: block.end,
      text: `\n\n${LINE_BREAK}`,
    },
  ];
}

export function removeOps(source: string, range: BlockRange): Op[] {
  let { start, end } = range;
  while (start > 0 && /\s/.test(source[start - 1] ?? "")) {
    start--;
  }
  while (end < source.length && /\s/.test(source[end] ?? "")) {
    end++;
  }
  let text = "\n\n";
  if (end === source.length) {
    text = "\n";
  } else if (start === 0) {
    text = "";
  }
  const expected = source.slice(start, end);
  return expected === text ? [] : [{ end, expected, start, text }];
}

export function mapRange(ops: Op[], range: BlockRange): BlockRange | null {
  let delta = 0;
  for (const op of ops) {
    const insertion = op.start === op.end;
    const inside = insertion
      ? op.start > range.start && op.start < range.end
      : op.start < range.end && op.end > range.start;
    if (inside) {
      return null;
    }
    if (op.end <= range.start) {
      delta += op.text.length - (op.end - op.start);
    }
  }
  return { end: range.end + delta, start: range.start + delta };
}

export function mapSpan(ops: Op[], range: BlockRange): BlockRange {
  let { start, end } = range;
  for (const op of ops) {
    const delta = op.text.length - (op.end - op.start);
    if (op.start >= range.start && op.start <= range.end) {
      end += delta;
    } else if (op.end <= range.start) {
      start += delta;
      end += delta;
    }
  }
  return { end, start };
}
