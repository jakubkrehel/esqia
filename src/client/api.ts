import type { ClientConfig } from "../shared/config";
import type { Changes } from "../shared/history";
import type { Intent, Op } from "../shared/ops";
import { isOutcome, settle } from "../shared/outcome";

export { ConflictError } from "../shared/outcome";

export function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export interface Backend {
  changes: () => Promise<Changes>;
  config: () => Promise<ClientConfig>;
  edit: (
    file: string,
    hash: string,
    intent: Intent,
    group?: string
  ) => Promise<{ hash: string; ops: Op[] }>;
  notice: string | null;
  open?: (file: string, line: number) => Promise<void>;
  redo: (file: string) => Promise<{ hash: string }>;
  revert: () => Promise<{ reverted: string[]; skipped: string[] }>;
  source: (file: string) => Promise<{ source: string; hash: string }>;
  undo: (file: string) => Promise<{ hash: string }>;
}

const url = process.env.NEXT_PUBLIC_ESQIA_URL;

export const configured = Boolean(url);

const post = (body: unknown): RequestInit => ({
  body: JSON.stringify(body),
  headers: { "content-type": "application/json" },
  method: "POST",
});

export function sidecarBackend(address: string, token: string): Backend {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${address}${path}`, {
      ...init,
      headers: { "x-esqia-token": token, ...init.headers },
    });
    const body = (await response.json().catch(() => ({}))) as T & {
      error?: string;
    };
    if (isOutcome(body)) {
      settle(body);
    }
    if (!response.ok) {
      throw new Error(body.error ?? `esqia: ${response.status}`);
    }
    return body;
  }

  return {
    changes: () => request<Changes>("/changes"),
    config: () => request<ClientConfig>("/config"),
    edit: (file, hash, intent, group) =>
      request<{ hash: string; ops: Op[] }>(
        "/edit",
        post({ file, group, hash, intent })
      ),
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
}

export const sidecar = sidecarBackend(
  url ?? "",
  process.env.NEXT_PUBLIC_ESQIA_TOKEN ?? ""
);
