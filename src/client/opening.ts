import type { BlockRange, Path } from "../shared/ops";
import { blockAhead, runAhead, runAround } from "../shared/runs";
import { sourceBlocks } from "../shared/wrapper";
import { type Block, fileBlocks, readBlock } from "./blocks";
import type { Caret } from "./caret";
import type { FileEdits } from "./file-edits";
import type { Placement } from "./run";

export type OpenTarget =
  | { at: "run"; block: Block; caret?: { x: number; y: number } }
  | { at: "after"; block: Block };

export type Selected = Pick<Caret, "anchor" | "head"> | null;

export interface Opening {
  caret?: Caret;
  file: string;
  hash: string;
  path: Path;
  placement: Placement;
  range: BlockRange;
  source: string;
}

export type Located =
  | { state: "ready"; opening: Opening }
  | { state: "behind" }
  | { state: "gone" };

const GONE: Located = { state: "gone" };
const BEHIND: Located = { state: "behind" };

export async function locateOpening(
  edits: FileEdits,
  target: OpenTarget,
  selected: Selected
): Promise<Located> {
  const rendered = fileBlocks(target.block.file);
  const block = follow(edits, target.block, rendered);
  const placed = block && place(target.at, block, rendered);
  if (!placed) {
    return GONE;
  }
  const { anchors, placement } = placed;
  const { file, version } = block;
  const { hash, path, source } = await edits.read(file, version);
  if (!block.el.isConnected) {
    return GONE;
  }
  if (!path || readBlock(block.el).version !== version) {
    return BEHIND;
  }
  const span = path.ahead
    ? runAhead(
        path,
        anchors,
        sourceBlocks(source, file, hash),
        placement.at === "run"
      )
    : spanOf(anchors);
  if (!span) {
    return BEHIND;
  }
  const index = anchors.findIndex((anchor) => anchor.el === block.el);
  return {
    opening: {
      caret:
        placement.at === "run"
          ? { anchor: 0, head: 0, ...selected, index }
          : undefined,
      file,
      hash,
      path,
      placement,
      range: placedRange(placement.at, span),
      source,
    },
    state: "ready",
  };
}

function follow(edits: FileEdits, block: Block, rendered: Block[]) {
  const version = rendered[0]?.version;
  const path =
    version === undefined
      ? null
      : edits.pathBetween(block.file, block.version, version);
  if (path) {
    return blockAhead(path, block, rendered);
  }
  return block.el.isConnected ? readBlock(block.el) : null;
}

function place(
  at: Placement["at"],
  block: Block,
  rendered: Block[]
): { anchors: Block[]; placement: Placement } | null {
  const anchors =
    at === "run"
      ? runAround(
          rendered,
          rendered.findIndex((b) => b.el === block.el)
        )
      : [block];
  const span = spanOf(anchors);
  const first = anchors[0];
  if (!(span && first)) {
    return null;
  }
  return {
    anchors,
    placement:
      at === "run"
        ? {
            at,
            blocks: anchors,
            mount: (root) => first.el.before(root),
            range: span,
          }
        : {
            at,
            blocks: [],
            mount: (root) => block.el.after(root),
            range: placedRange(at, span),
          },
  };
}

function spanOf(blocks: BlockRange[]): BlockRange | null {
  const first = blocks[0];
  const last = blocks.at(-1);
  return first && last ? { end: last.end, start: first.start } : null;
}

function placedRange(at: Placement["at"], span: BlockRange): BlockRange {
  return at === "run" ? span : { end: span.end, start: span.end };
}
