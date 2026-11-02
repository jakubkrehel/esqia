import type { BlockRange, Op } from "../shared/ops";
import { type Backend, ConflictError } from "./api";
import { type Intent, intentOps, type RunIntent, spanAfter } from "./intents";
import type { PageOpening, PageSync, RunPage } from "./page";

export interface RunWriter {
  group: string;
  page: RunPage;
}

export class FileEdits {
  private readonly backend: Backend;
  private readonly sync: PageSync;

  constructor(backend: Backend, sync: PageSync) {
    this.backend = backend;
    this.sync = sync;
  }

  async read(file: string, version: string) {
    const fetched = await this.backend.source(file);
    if (fetched.hash !== version) {
      throw new ConflictError(
        "The page is behind the file. Wait for it to refresh, then try again."
      );
    }
    return fetched;
  }

  open(opening: PageOpening): RunPage {
    return this.sync.open(opening);
  }

  async apply(file: string, hash: string, intent: Intent) {
    const written = await this.write(file, hash, intent);
    if (written) {
      this.sync.applied({ file, ...written });
    }
  }

  async applyRun(
    file: string,
    hash: string,
    intent: RunIntent,
    writer: RunWriter
  ): Promise<{ hash: string; range: BlockRange } | null> {
    const written = await this.write(file, hash, intent, writer.group);
    if (!written) {
      return null;
    }
    const range = spanAfter(intent, written.ops);
    this.sync.applied({ file, ...written, run: { page: writer.page, range } });
    return { hash: written.hash, range };
  }

  private async write(
    file: string,
    hash: string,
    intent: Intent,
    group?: string
  ): Promise<{ hash: string; ops: Op[] } | null> {
    const ops = await intentOps(
      intent,
      async () => (await this.read(file, hash)).source
    );
    if (ops.length === 0) {
      return null;
    }
    const written = await this.backend.ops(file, hash, ops, group);
    return written.hash === hash ? null : { hash: written.hash, ops };
  }
}
