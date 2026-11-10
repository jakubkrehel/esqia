import { parseMdx } from "../shared/markdown";
import type { Intent } from "../shared/ops";
import { type Block, removeIntent } from "./blocks";
import { Store } from "./store";

interface SourceSnapshot {
  problem: string | null;
  saving: boolean;
  text: string;
}

export class SourceDraft extends Store<SourceSnapshot> {
  readonly block: Block;
  readonly line: number;
  private readonly original: string;
  private readonly write: (
    intent: (block: Block) => Intent
  ) => Promise<boolean>;
  private readonly onClose: () => void;
  private saving: Promise<boolean> | null = null;
  private closed = false;

  constructor(
    block: Block,
    source: string,
    write: (intent: (block: Block) => Intent) => Promise<boolean>,
    onClose: () => void
  ) {
    const text = source.slice(block.start, block.end);
    super({ problem: null, saving: false, text });
    this.block = block;
    this.line = source.slice(0, block.start).split("\n").length;
    this.original = text;
    this.write = write;
    this.onClose = onClose;
  }

  change(text: string) {
    if (!(this.closed || this.saving)) {
      this.update({
        problem: text === this.original ? null : syntaxError(text),
        text,
      });
    }
  }

  commit(): Promise<boolean> {
    if (this.saving) {
      return this.saving;
    }
    if (this.closed) {
      return Promise.resolve(false);
    }
    const text = this.snapshot.text.trim();
    if (text === this.original.trim()) {
      this.cancel();
      return Promise.resolve(true);
    }
    if (this.snapshot.problem) {
      return Promise.resolve(false);
    }
    this.update({ saving: true });
    this.saving = this.write((block) =>
      text
        ? {
            kind: "replace",
            op: {
              end: block.end,
              expected: this.original,
              start: block.start,
              text,
            },
          }
        : { ...removeIntent(block), expected: this.original }
    )
      .then((saved) => {
        if (saved) {
          this.cancel();
        }
        return saved;
      })
      .finally(() => {
        this.saving = null;
        this.update({ saving: false });
      });
    return this.saving;
  }

  cancel() {
    if (!this.closed) {
      this.closed = true;
      this.onClose();
    }
  }
}

function syntaxError(text: string): string | null {
  try {
    parseMdx(text);
    return null;
  } catch (error) {
    const { line, reason } = error as { line?: number; reason?: string };
    const message = reason ?? String(error);
    return line ? `Line ${line}: ${message}` : message;
  }
}
