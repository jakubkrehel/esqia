import type { ClientConfig } from "../server/server";
import type { Op } from "../shared/ops";

export type { ClientConfig };

export class ConflictError extends Error {
  override readonly name = "ConflictError";
}

const url = process.env.NEXT_PUBLIC_ESQE_URL;
const token = process.env.NEXT_PUBLIC_ESQE_TOKEN ?? "";

export const configured = Boolean(url);

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${url}${path}`, {
    ...init,
    headers: { "x-esqe-token": token, ...init.headers },
  });
  const body = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };
  if (response.status === 409) {
    throw new ConflictError(body.error ?? "The file changed on disk.");
  }
  if (!response.ok) {
    throw new Error(body.error ?? `esqe: ${response.status}`);
  }
  return body;
}

export const api = {
  config: () => request<ClientConfig>("/config"),

  ops: (file: string, hash: string, ops: Op[], group?: string) =>
    request<{ hash: string }>("/ops", {
      body: JSON.stringify({ file, group, hash, ops }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }),

  source: (file: string) =>
    request<{ source: string; hash: string }>(
      `/source?file=${encodeURIComponent(file)}`
    ),

  undo: (file: string) =>
    request<{ hash: string }>("/undo", {
      body: JSON.stringify({ file }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }),

  upload: (file: string, blob: File) =>
    request<{ url: string }>("/upload", {
      body: blob,
      headers: {
        "content-type": blob.type || "application/octet-stream",
        "x-esqe-file": file,
        "x-esqe-name": encodeURIComponent(blob.name),
      },
      method: "POST",
    }),
};
