import type { Editor } from "@tiptap/core";
import type { BlockRange } from "../shared/ops";
import type { Block } from "./blocks";

export interface PageOpening {
  blocks: Block[];
  editor: Editor;
  file: string;
  range: BlockRange;
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
