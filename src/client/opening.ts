import type { BlockRange } from "../shared/ops";
import { type Block, readBlock, runAround } from "./blocks";
import { type Caret, textRangeIn } from "./caret";

export type OpenTarget =
  | { at: "run"; block: Block; caret?: { x: number; y: number } }
  | { at: "after"; block: Block };

export interface Placement {
  at: "run" | "after";
  blocks: Block[];
  mount: (root: HTMLElement) => void;
  range: BlockRange;
}

export interface Opening {
  caret?: Caret;
  file: string;
  placement: Placement;
  version: string;
}

export function prepareOpening(target: OpenTarget): () => Opening | null {
  const { el } = target.block;
  const selected = target.at === "run" ? textRangeIn(el, target.caret) : null;

  return () => {
    if (!el.isConnected) {
      return null;
    }
    const block = readBlock(el);
    const placement = place(target.at, block);
    if (!placement) {
      return null;
    }
    const index = placement.blocks.findIndex((b) => b.el === el);
    return {
      caret:
        index >= 0 ? { anchor: 0, head: 0, ...selected, index } : undefined,
      file: block.file,
      placement,
      version: block.version,
    };
  };
}

function place(at: OpenTarget["at"], block: Block): Placement | null {
  if (at === "after") {
    return {
      at: "after",
      blocks: [],
      mount: (root) => block.el.after(root),
      range: { end: block.end, start: block.end },
    };
  }
  const blocks = runAround(block);
  const first = blocks[0];
  const last = blocks.at(-1);
  if (!(first && last)) {
    return null;
  }
  return {
    at: "run",
    blocks,
    mount: (root) => first.el.before(root),
    range: { end: last.end, start: first.start },
  };
}
