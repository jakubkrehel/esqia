import type { BlockRange, Intent, Op } from "../shared/ops";
import { type Backend, ConflictError } from "./api";
import type { PageSync, RunPage } from "./page";
import { RunSave } from "./run-save";

export interface RunOpening {
  at: "run" | "after";
  body: () => string;
  file: string;
  onFailed: (message: string) => void;
  onSaved: () => void;
  onSaving: (saving: boolean) => void;
  page: RunPage;
  range: BlockRange;
  source: string;
  version: string;
}

export interface RunEdits {
  close: () => Promise<boolean>;
  schedule: () => void;
}

export type Write = (
  file: string,
  hash: string,
  intent: Intent,
  group?: string
) => Promise<{ hash: string; ops: Op[] } | null>;

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

  async apply(file: string, hash: string, intent: Intent) {
    const written = await this.write(file, hash, intent);
    if (written) {
      this.sync.applied({ file, ...written });
    }
  }

  openRun(opening: RunOpening): RunEdits {
    return new RunSave(opening, this.sync, this.write);
  }

  private readonly write: Write = async (file, hash, intent, group) => {
    const written = await this.backend.edit(file, hash, intent, group);
    return written.hash === hash ? null : written;
  };
}
