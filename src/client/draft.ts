import type { BlockRange } from "../shared/ops";
import type { RunIntent } from "./intents";

export class Draft {
  private start: number;
  private current: string;
  private readonly prefix: string;
  private readonly replacing: boolean;

  constructor(at: "run" | "after", source: string, range: BlockRange) {
    this.replacing = at === "run";
    this.prefix = this.replacing ? "" : "\n\n";
    this.start = range.start;
    this.current = source.slice(range.start, range.end);
  }

  get text(): string {
    return this.current;
  }

  get range(): BlockRange {
    return { end: this.start + this.current.length, start: this.start };
  }

  next(body: string, closing: boolean): RunIntent | null {
    const text = body && this.prefix + body;
    const emptied = closing && this.replacing && text === "";
    if (emptied) {
      return { kind: "remove", range: this.range };
    }
    if (text === this.current) {
      return null;
    }
    const { end, start } = this.range;
    return {
      kind: "replace",
      op: { end, expected: this.current, start, text },
    };
  }

  saved(intent: RunIntent, range: BlockRange) {
    this.start = range.start;
    this.current = intent.kind === "replace" ? intent.op.text : "";
  }
}
