import type { BlockRange } from "../shared/ops";
import { ConflictError, errorText } from "./api";
import type { FileEdits } from "./file-edits";
import type { RunIntent } from "./intents";
import type { RunPage } from "./page";

export interface RunSaveOptions {
  at: "run" | "after";
  body: () => string;
  edits: FileEdits;
  file: string;
  hash: string;
  onFailed: (message: string) => void;
  onSaved: () => void;
  onSaving: (saving: boolean) => void;
  page: RunPage;
  range: BlockRange;
  source: string;
}

const SAVE_DELAY = 800;

export class RunSave {
  private readonly options: RunSaveOptions;
  private readonly prefix: string;
  private readonly replacing: boolean;
  private readonly group = Math.random().toString(36).slice(2);
  private start: number;
  private current: string;
  private hash: string;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private saving: Promise<void> | null = null;
  private failed = false;
  private wroteAny = false;

  constructor(options: RunSaveOptions) {
    const { at, hash, range, source } = options;
    this.options = options;
    this.replacing = at === "run";
    this.prefix = this.replacing ? "" : "\n\n";
    this.start = range.start;
    this.current = source.slice(range.start, range.end);
    this.hash = hash;
  }

  get version(): string {
    return this.hash;
  }

  get wrote(): boolean {
    return this.wroteAny;
  }

  private get range(): BlockRange {
    return { end: this.start + this.current.length, start: this.start };
  }

  schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.save(false), SAVE_DELAY);
  }

  cancel() {
    clearTimeout(this.timer);
  }

  async finish(): Promise<boolean> {
    await this.save(true);
    return !this.failed;
  }

  private async save(closing: boolean): Promise<void> {
    clearTimeout(this.timer);
    if (this.saving) {
      await this.saving;
      return this.save(closing);
    }
    if (this.failed) {
      return;
    }
    const intent = this.next(this.options.body(), closing);
    if (!intent) {
      return;
    }

    this.options.onSaving(true);
    this.saving = this.persist(intent)
      .catch((error: unknown) => {
        this.failed = true;
        this.options.onFailed(
          error instanceof ConflictError
            ? "Changed in your editor. Reopen the block to keep going."
            : errorText(error)
        );
      })
      .finally(() => {
        this.saving = null;
        this.options.onSaving(false);
      });
    return this.saving;
  }

  private next(body: string, closing: boolean): RunIntent | null {
    const text = body && this.prefix + body;
    if (closing && this.replacing && text === "") {
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

  private async persist(intent: RunIntent) {
    const { edits, file, onSaved, page } = this.options;
    const written = await edits.applyRun(file, this.hash, intent, {
      group: this.group,
      page,
    });
    if (!written) {
      return;
    }
    this.hash = written.hash;
    this.start = written.range.start;
    this.current = intent.kind === "replace" ? intent.op.text : "";
    this.wroteAny = true;
    onSaved();
  }
}
