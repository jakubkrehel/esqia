import type { ClientConfig } from "../shared/config";
import { applyOps, type Op } from "../shared/ops";

export type { ClientConfig };

export class ConflictError extends Error {
  override readonly name = "ConflictError";
}

interface Backend {
  config: () => Promise<ClientConfig>;

  live: boolean;

  mapOffset: (file: string, offset: number, since: number) => number;
  ops: (
    file: string,
    hash: string,
    ops: Op[],
    group?: string
  ) => Promise<{ hash: string }>;
  revision: (file: string) => number;
  source: (file: string) => Promise<{ source: string; hash: string }>;
  undo: (file: string) => Promise<{ hash: string }>;
  upload: (file: string, blob: File) => Promise<{ url: string }>;
}

const url = process.env.NEXT_PUBLIC_ESQIA_URL;
const token = process.env.NEXT_PUBLIC_ESQIA_TOKEN ?? "";

export const configured = Boolean(url);

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: { "x-esqia-token": token, ...init.headers },
  });
  const body = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };
  if (response.status === 409) {
    throw new ConflictError(body.error ?? "The file changed on disk.");
  }
  if (!response.ok) {
    throw new Error(body.error ?? `esqia: ${response.status}`);
  }
  return body;
}

const sidecar: Backend = {
  config: () => request<ClientConfig>("/config"),
  live: true,
  mapOffset: (_file, offset) => offset,
  ops: (file, hash, ops, group) =>
    request<{ hash: string }>("/ops", {
      body: JSON.stringify({ file, group, hash, ops }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }),
  revision: () => 0,
  source: (file) =>
    request<{ source: string; hash: string }>(
      `/source?file=${encodeURIComponent(file)}`
    ),
  undo: (file) =>
    request<{ hash: string }>("/undo", {
      body: JSON.stringify({ file }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }),
  upload: (file, blob) =>
    request<{ url: string }>("/upload", {
      body: blob,
      headers: {
        "content-type": blob.type || "application/octet-stream",
        "x-esqia-file": file,
        "x-esqia-name": encodeURIComponent(blob.name),
      },
      method: "POST",
    }),
};

interface Shift {
  at: number;
  delta: number;
  end: number;
}

interface MemoryFile {
  hash: string;
  shifts: Shift[];
  source: string;
}

function memory(
  sources: Record<string, string>,
  config: ClientConfig
): Backend {
  const files = new Map<string, MemoryFile>();
  let writes = 0;

  const file = (name: string): MemoryFile => {
    const existing = files.get(name);
    if (existing) {
      return existing;
    }
    const source = sources[name];
    if (source === undefined) {
      throw new Error(`esqia: the demo has no source for ${name}.`);
    }

    const rendered = document.querySelector<HTMLElement>(
      `[data-esqia-file="${CSS.escape(name)}"]`
    )?.dataset.esqiaV;
    const created: MemoryFile = {
      hash: rendered ?? "demo",
      shifts: [],
      source,
    };
    files.set(name, created);
    return created;
  };

  return {
    config: () => Promise.resolve(config),
    live: false,
    mapOffset: (name, offset, since) => {
      let mapped = offset;
      for (const shift of file(name).shifts.slice(since)) {
        const inserted = shift.at === shift.end;
        if (inserted ? mapped >= shift.at : mapped >= shift.end) {
          mapped += shift.delta;
        }
      }
      return mapped;
    },
    ops: (name, _hash, ops) => {
      const current = file(name);
      const result = applyOps(current.source, ops);
      if (!result.ok) {
        return Promise.reject(new ConflictError(result.reason));
      }

      for (const op of [...ops].sort((a, b) => b.start - a.start)) {
        current.shifts.push({
          at: op.start,
          delta: op.text.length - (op.end - op.start),
          end: op.end,
        });
      }
      current.source = result.source;
      writes += 1;
      current.hash = `demo-${writes}`;
      return Promise.resolve({ hash: current.hash });
    },
    revision: (name) => file(name).shifts.length,
    source: (name) => {
      const current = file(name);
      return Promise.resolve({ hash: current.hash, source: current.source });
    },
    undo: () =>
      Promise.reject(
        new Error("Undo saves to your files, so it needs the dev server.")
      ),
    upload: (_name, blob) =>
      Promise.resolve({ url: URL.createObjectURL(blob) }),
  };
}

let backend: Backend = sidecar;

export function startDemo(
  sources: Record<string, string>,
  config: ClientConfig
) {
  backend = memory(sources, config);
}

export const api: Backend = {
  config: () => backend.config(),
  get live() {
    return backend.live;
  },
  mapOffset: (file, offset, since) => backend.mapOffset(file, offset, since),
  ops: (file, hash, ops, group) => backend.ops(file, hash, ops, group),
  revision: (file) => backend.revision(file),
  source: (file) => backend.source(file),
  undo: (file) => backend.undo(file),
  upload: (file, blob) => backend.upload(file, blob),
};
