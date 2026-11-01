import type { ClientConfig } from "../shared/config";
import { applyOps, type Op } from "../shared/ops";
import { fileWrappers, readBlock } from "./blocks";
import { DemoPage, syncPage } from "./demo-page";
import { LivePage } from "./live-page";
import type { PageOpening, RunPage } from "./page";

export type { ClientConfig };

export class ConflictError extends Error {
  override readonly name = "ConflictError";
}

export function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export interface Backend {
  changes: () => Promise<{ files: string[] }>;
  config: () => Promise<ClientConfig>;
  notice: string | null;
  ops: (
    file: string,
    hash: string,
    ops: Op[],
    group?: string
  ) => Promise<{ hash: string }>;
  page: (opening: PageOpening) => RunPage;
  revert: () => Promise<{ reverted: string[]; skipped: string[] }>;
  source: (file: string) => Promise<{ source: string; hash: string }>;
  undo?: (file: string) => Promise<{ hash: string }>;
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

export const sidecar: Backend = {
  changes: () => request<{ files: string[] }>("/changes"),
  config: () => request<ClientConfig>("/config"),
  notice: null,
  ops: (file, hash, ops, group) =>
    request<{ hash: string }>("/ops", {
      body: JSON.stringify({ file, group, hash, ops }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }),
  page: (opening) => new LivePage(opening),
  revert: () =>
    request<{ reverted: string[]; skipped: string[] }>("/revert", {
      method: "POST",
    }),
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
};

interface MemoryFile {
  hash: string;
  source: string;
}

export function memoryBackend(
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
    const rendered = fileWrappers(name)[0];
    const created: MemoryFile = {
      hash: (rendered && readBlock(rendered).version) || "demo",
      source,
    };
    files.set(name, created);
    return created;
  };

  return {
    changes: () =>
      Promise.resolve({
        files: [...files]
          .filter(([name, f]) => f.source !== sources[name])
          .map(([name]) => name),
      }),
    config: () => Promise.resolve(config),
    notice: "Edits stay in this tab. Install esqia to save them to your files.",
    ops: (name, _hash, ops) => {
      const current = file(name);
      const before = current.source;
      const result = applyOps(before, ops);
      if (!result.ok) {
        return Promise.reject(new ConflictError(result.reason));
      }
      current.source = result.source;
      writes += 1;
      current.hash = `demo-${writes}`;
      syncPage(
        { after: current.source, before, file: name, ops },
        current.hash
      );
      return Promise.resolve({ hash: current.hash });
    },
    page: (opening) => new DemoPage(opening, () => file(opening.file).source),
    revert: () => {
      location.reload();
      return Promise.resolve({ reverted: [], skipped: [] });
    },
    source: (name) => {
      const current = file(name);
      return Promise.resolve({ hash: current.hash, source: current.source });
    },
  };
}
