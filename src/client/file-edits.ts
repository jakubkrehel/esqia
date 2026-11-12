import {
  type BlockRange,
  type Intent,
  type Op,
  Path,
  type Step,
} from "../shared/ops";
import type { Backend } from "./api";
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

export interface Closing<Closed> {
  closed: Promise<Closed>;
  saved: Promise<void>;
}

export interface RunEdits {
  close: () => Closing<boolean>;
  schedule: () => void;
}

export type Write = (
  file: string,
  hash: string,
  intent: Intent,
  group?: string
) => Promise<{ hash: string; ops: Op[] } | null>;

interface Written extends Step {
  before: string;
}

const WRITTEN_LIMIT = 50;

export const PAGE_BEHIND =
  "The page is behind the file. Wait for it to refresh, then try again.";

export class FileEdits {
  private readonly backend: Backend;
  private readonly sync: PageSync;
  private readonly written = new Map<string, Written[]>();

  constructor(backend: Backend, sync: PageSync) {
    this.backend = backend;
    this.sync = sync;
  }

  async read(file: string, version: string) {
    const fetched = await this.backend.source(file);
    return { ...fetched, path: this.pathBetween(file, version, fetched.hash) };
  }

  pathBetween(file: string, version: string, hash: string): Path | null {
    const steps: Step[] = [];
    let at = hash;
    for (const { before, ops, version: after } of (
      this.written.get(file) ?? []
    ).toReversed()) {
      if (at === version || after !== at) {
        break;
      }
      steps.unshift({ ops, version: after });
      at = before;
    }
    return at === version ? new Path(version, steps) : null;
  }

  async apply(file: string, hash: string, intent: Intent) {
    const written = await this.write(file, hash, intent);
    if (written) {
      this.sync.applied({ file, ...written });
    }
    return written !== null;
  }

  openRun(opening: RunOpening): RunEdits {
    return new RunSave(opening, this.sync, this.write);
  }

  private readonly write: Write = async (file, hash, intent, group) => {
    const written = await this.backend.edit(file, hash, intent, group);
    if (written.hash === hash) {
      return null;
    }
    const log = this.written.get(file) ?? [];
    log.push({ before: hash, ops: written.ops, version: written.hash });
    this.written.set(file, log.slice(-WRITTEN_LIMIT));
    return written;
  };
}
