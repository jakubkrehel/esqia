import { applyOps, type Op } from "./ops";

export interface FileStore {
  read: (file: string) => Promise<{ hash: string; source: string }>;
  write: (file: string, source: string) => Promise<string>;
}

export type Outcome =
  | { ok: true; hash: string }
  | { ok: false; reason: "conflict" | "nothing"; error: string; hash?: string };

export interface Changes {
  edits: number;
  files: string[];
  redos: number;
}

interface HistoryEntry {
  afterHash: string;
  before: string;
  group?: string;
}

interface RedoEntry {
  after: string;
  before: string;
}

const HISTORY_LIMIT = 100;

export class EditHistory {
  private readonly store: FileStore;
  private readonly history = new Map<string, HistoryEntry[]>();
  private readonly redos = new Map<string, RedoEntry[]>();

  constructor(store: FileStore) {
    this.store = store;
  }

  source(file: string) {
    return this.store.read(file);
  }

  async apply(
    file: string,
    hash: string,
    ops: Op[],
    group?: string
  ): Promise<Outcome> {
    const current = await this.store.read(file);
    if (current.hash !== hash) {
      return conflict("The file changed on disk.", current.hash);
    }
    const result = applyOps(current.source, ops);
    if (!result.ok) {
      return conflict(result.reason, current.hash);
    }
    if (result.source === current.source) {
      return { hash: current.hash, ok: true };
    }
    const afterHash = await this.store.write(file, result.source);
    this.record(file, { afterHash, before: current.source, group });
    this.redos.delete(file);
    return { hash: afterHash, ok: true };
  }

  async undo(file: string): Promise<Outcome> {
    const entries = this.history.get(file) ?? [];
    const last = entries.at(-1);
    if (!last) {
      return { error: "Nothing to undo.", ok: false, reason: "nothing" };
    }
    const current = await this.store.read(file);
    if (current.hash !== last.afterHash) {
      entries.length = 0;
      return conflict(
        "The file changed in your editor since the last edit here."
      );
    }
    entries.pop();
    const hash = await this.store.write(file, last.before);
    this.redos.set(file, [
      ...(this.redos.get(file) ?? []),
      { after: current.source, before: last.before },
    ]);
    return { hash, ok: true };
  }

  async redo(file: string): Promise<Outcome> {
    const entries = this.redos.get(file) ?? [];
    const last = entries.at(-1);
    if (!last) {
      return { error: "Nothing to redo.", ok: false, reason: "nothing" };
    }
    const current = await this.store.read(file);
    if (current.source !== last.before) {
      this.redos.delete(file);
      return conflict(
        "The file changed in your editor since the last undo here."
      );
    }
    entries.pop();
    const hash = await this.store.write(file, last.after);
    this.record(file, { afterHash: hash, before: last.before });
    return { hash, ok: true };
  }

  changes(): Changes {
    const touched = [...this.history].filter(
      ([, entries]) => entries.length > 0
    );
    return {
      edits: touched.reduce((sum, [, entries]) => sum + entries.length, 0),
      files: touched.map(([file]) => file),
      redos: [...this.redos.values()].reduce(
        (sum, entries) => sum + entries.length,
        0
      ),
    };
  }

  async revertAll(): Promise<{ reverted: string[]; skipped: string[] }> {
    const reverted: string[] = [];
    const skipped: string[] = [];
    this.redos.clear();
    for (const [file, entries] of this.history) {
      const first = entries[0];
      const last = entries.at(-1);
      entries.length = 0;
      if (!(first && last)) {
        continue;
      }
      const current = await this.store.read(file);
      if (current.hash === last.afterHash) {
        await this.store.write(file, first.before);
        reverted.push(file);
      } else {
        skipped.push(file);
      }
    }
    return { reverted, skipped };
  }

  private record(file: string, entry: HistoryEntry) {
    const entries = this.history.get(file) ?? [];
    const last = entries.at(-1);
    if (last && entry.group && last.group === entry.group) {
      last.afterHash = entry.afterHash;
    } else {
      entries.push(entry);
      if (entries.length > HISTORY_LIMIT) {
        entries.shift();
      }
    }
    this.history.set(file, entries);
  }
}

function conflict(error: string, hash?: string): Outcome {
  return { error, hash, ok: false, reason: "conflict" };
}

export interface MemoryStore extends FileStore {
  previous: (file: string) => string;
  text: (file: string) => string;
}

export function memoryStore(
  initial: (file: string) => { hash: string; source: string }
): MemoryStore {
  const files = new Map<string, { hash: string; source: string }>();
  const previous = new Map<string, string>();
  let writes = 0;
  const current = (file: string) => {
    const existing = files.get(file);
    if (existing) {
      return existing;
    }
    const created = initial(file);
    files.set(file, created);
    return created;
  };
  return {
    previous: (file) => previous.get(file) ?? current(file).source,
    read: (file) => Promise.resolve({ ...current(file) }),
    text: (file) => current(file).source,
    write: (file, source) => {
      previous.set(file, current(file).source);
      writes += 1;
      const hash = `memory-${writes}`;
      files.set(file, { hash, source });
      return Promise.resolve(hash);
    },
  };
}
