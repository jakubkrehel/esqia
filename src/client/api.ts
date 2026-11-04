import type { ClientConfig } from "../shared/config";
import type { Changes } from "../shared/history";
import type { Op } from "../shared/ops";

export class ConflictError extends Error {
  override readonly name = "ConflictError";
}

export function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export interface Backend {
  changes: () => Promise<Changes>;
  config: () => Promise<ClientConfig>;
  notice: string | null;
  open?: (file: string, line: number) => Promise<void>;
  ops: (
    file: string,
    hash: string,
    ops: Op[],
    group?: string
  ) => Promise<{ hash: string }>;
  redo?: (file: string) => Promise<{ hash: string }>;
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

const post = (body: unknown): RequestInit => ({
  body: JSON.stringify(body),
  headers: { "content-type": "application/json" },
  method: "POST",
});

export const sidecar: Backend = {
  changes: () => request<Changes>("/changes"),
  config: () => request<ClientConfig>("/config"),
  notice: null,
  open: async (file, line) => {
    const params = new URLSearchParams({
      column1: "1",
      file,
      line1: String(line),
    });
    const response = await fetch(`/__nextjs_launch-editor?${params}`);
    if (!response.ok) {
      throw new Error(`Couldn't open ${file} in your editor.`);
    }
  },
  ops: (file, hash, ops, group) =>
    request<{ hash: string }>("/ops", post({ file, group, hash, ops })),
  redo: (file) => request<{ hash: string }>("/redo", post({ file })),
  revert: () =>
    request<{ reverted: string[]; skipped: string[] }>("/revert", {
      method: "POST",
    }),
  source: (file) =>
    request<{ source: string; hash: string }>(
      `/source?file=${encodeURIComponent(file)}`
    ),
  undo: (file) => request<{ hash: string }>("/undo", post({ file })),
};
