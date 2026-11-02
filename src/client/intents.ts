import {
  type BlockRange,
  insertBreakOps,
  moveOps,
  type Op,
  removeOps,
} from "../shared/ops";

export type RunIntent =
  | { kind: "replace"; op: Op }
  | { kind: "remove"; range: BlockRange };

export type Intent =
  | RunIntent
  | {
      kind: "move";
      range: BlockRange;
      target: BlockRange | null;
      blocks: BlockRange[];
    }
  | { kind: "break"; range: BlockRange };

export async function intentOps(
  intent: Intent,
  source: () => Promise<string>
): Promise<Op[]> {
  switch (intent.kind) {
    case "replace":
      return [intent.op];
    case "remove":
      return removeOps(await source(), intent.range);
    case "move":
      return moveOps(
        await source(),
        intent.blocks,
        intent.range,
        intent.target
      );
    case "break":
      return insertBreakOps(intent.range);
    default:
      return [];
  }
}

export function spanAfter(intent: RunIntent, ops: Op[]): BlockRange {
  if (intent.kind === "replace") {
    const { start, text } = intent.op;
    return { end: start + text.length, start };
  }
  const [op] = ops;
  const collapsed = op ? op.start + op.text.length : intent.range.start;
  return { end: collapsed, start: collapsed };
}
