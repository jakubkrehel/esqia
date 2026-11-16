import type { Editor } from "@tiptap/core";
import { type BlockRange, mapSpan, type Op, type Path } from "../shared/ops";
import type { Backend } from "./api";
import type { Block } from "./blocks";

export interface PageOpening {
  blocks: Block[];
  editor: Editor;
  file: string;
  onBehind: () => void;
  path: Path;
  range: BlockRange;
  rendered: BlockRange;
  root: HTMLElement;
  version: string;
}

export interface PageClosing {
  discard: boolean;
  version: string;
  wrote: boolean;
}

export interface RunPage {
  close: (closing: PageClosing) => Promise<boolean>;
  track: (version: string, range: BlockRange) => void;
}

export interface AppliedEdit {
  file: string;
  hash: string;
  ops: Op[];
  run?: { page: RunPage; range: BlockRange };
}

export type Preview = (writtenAt: string | null) => void;

export interface PageSync {
  applied: (edit: AppliedEdit) => void;
  moving: (block: Block, target: Block | null) => Preview;
  open: (opening: PageOpening) => RunPage;
  refreshes: boolean;
  removing: (block: Block) => Preview;
  reverted: () => void;
}

export interface EditingHost {
  backend: Backend;
  sync: PageSync;
}

export function trackRuns(
  pages: Iterable<RunPage & { file: string; range: BlockRange }>,
  { file, hash, ops, run }: AppliedEdit
) {
  for (const page of pages) {
    if (page.file === file) {
      page.track(
        hash,
        page === run?.page ? run.range : mapSpan(ops, page.range)
      );
    }
  }
}
