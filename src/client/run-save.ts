import type { BlockRange, Intent, Op } from "../shared/ops";
import { ConflictError, errorText } from "./api";
import type { Closing, Read, RunEdits, RunOpening, Write } from "./file-edits";
import type { PageSync, RunPage } from "./page";

const SAVE_DELAY = 800;
const CHANGED =
  "This block changed in your editor. Copy your text, then reopen the block.";

export class RunSave implements RunEdits {
  private readonly opening: RunOpening;
  private readonly sync: PageSync;
  private readonly write: Write;
  private readonly read: Read;
  private readonly page: RunPage;
  private readonly prefix: string;
  private readonly replacing: boolean;
  private readonly group = Math.random().toString(36).slice(2);
  private start: number;
  private current: string;
  private hash: string;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private saving: Promise<void> | null = null;
  private failed = false;
  private wrote = false;

  constructor(opening: RunOpening, sync: PageSync, write: Write, read: Read) {
    const { at, range, source, version } = opening;
    this.opening = opening;
    this.sync = sync;
    this.write = write;
    this.read = read;
    this.page = opening.page;
    this.replacing = at === "run";
    this.prefix = this.replacing ? "" : "\n\n";
    this.start = range.start;
    this.current = source.slice(range.start, range.end);
    this.hash = version;
  }

  private get range(): BlockRange {
    return { end: this.start + this.current.length, start: this.start };
  }

  schedule() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.save(false), SAVE_DELAY);
  }

  close(): Closing<boolean> {
    const saved = this.save(true);
    const closed = saved.then(() =>
      this.page.close({
        discard: this.failed,
        version: this.hash,
        wrote: this.wrote,
      })
    );
    return { closed, saved };
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
    const intent = this.next(this.opening.body(), closing);
    if (!intent) {
      return;
    }

    this.opening.onSaving(true);
    this.saving = this.persist(intent)
      .catch(async (error: unknown) => {
        if (!(error instanceof ConflictError && (await this.rebase()))) {
          throw error;
        }
        const again = this.next(this.opening.body(), closing);
        if (again) {
          await this.persist(again);
        }
      })
      .catch((error: unknown) => {
        this.fail(error instanceof ConflictError ? CHANGED : errorText(error));
      })
      .finally(() => {
        this.saving = null;
        this.opening.onSaving(false);
      });
    return this.saving;
  }

  async follow(): Promise<void> {
    await this.saving;
    if (this.failed) {
      return;
    }
    try {
      if (!(await this.rebase())) {
        this.fail(CHANGED);
      }
    } catch (error) {
      this.fail(errorText(error));
    }
  }

  private fail(message: string) {
    if (!this.failed) {
      this.failed = true;
      this.opening.onFailed(message);
    }
  }

  private async rebase(): Promise<boolean> {
    const { hash, source } = await this.read(this.opening.file);
    if (hash === this.hash) {
      return true;
    }
    const at = this.current ? source.indexOf(this.current) : -1;
    if (at < 0 || source.includes(this.current, at + 1)) {
      return false;
    }
    this.hash = hash;
    this.start = at;
    this.page.track(hash, this.range);
    return true;
  }

  private next(body: string, closing: boolean): Intent | null {
    const text = body && this.prefix + body;
    if (closing && this.replacing && text === "") {
      return { expected: this.current, kind: "remove", range: this.range };
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

  private async persist(intent: Intent) {
    const { file } = this.opening;
    const written = await this.write(file, this.hash, intent, this.group);
    if (!written) {
      return;
    }
    const range = spanAfter(intent, written.ops);
    this.hash = written.hash;
    this.start = range.start;
    this.current = intent.kind === "replace" ? intent.op.text : "";
    this.wrote = true;
    this.sync.applied({ file, ...written, run: { page: this.page, range } });
    this.opening.onSaved();
  }
}

function spanAfter(intent: Intent, ops: Op[]): BlockRange {
  if (intent.kind === "replace") {
    const { start, text } = intent.op;
    return { end: start + text.length, start };
  }
  const [op] = ops;
  const collapsed = op ? op.start + op.text.length : intent.range.start;
  return { end: collapsed, start: collapsed };
}
