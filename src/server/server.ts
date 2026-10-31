import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import path from "node:path";
import { hashSource } from "../remark";
import type { Smartypants } from "../shared/markdown";
import { applyOps, type Op } from "../shared/ops";
import { upload } from "./upload";

export interface EsqiaOptions {
  /** Inline JSX the toolbar can wrap a selection in, e.g. a font. */
  marks?: { name: string; tag: string; className: string }[];
  media?: {
    /** Where pasted and dropped files go. Defaults to Vercel Blob when a token is set, else `public/`. */
    upload?: "vercel-blob" | "public";
    /** Path prefix for uploads. `{dir}` is the name of the folder the MDX file sits in. */
    path?: string;
    /** Inserted for an image. Placeholders: `{url}`, `{width}`, `{height}`, `{name}`. */
    image?: string;
    /** Inserted for a video. Same placeholders as `image`. */
    video?: string;
  };
  /** The options you pass to `remark-smartypants`, so the editor shows the same punctuation the page does. */
  smartypants?: Smartypants;
  /** Blocks offered in the `/` menu, inserted verbatim. */
  snippets?: { name: string; source: string }[];
}

export interface ClientConfig {
  marks: NonNullable<EsqiaOptions["marks"]>;
  media: { image: string; video: string };
  smartypants: Smartypants;
  snippets: NonNullable<EsqiaOptions["snippets"]>;
}

interface HistoryEntry {
  afterHash: string;
  before: string;
  group?: string;
}

const HISTORY_LIMIT = 100;

export interface Sidecar {
  token: string;
  url: string;
}

/** The address is derived from the project path, so every process that loads the config agrees on it without talking to each other. */
export function sidecarAddress(root: string): Sidecar {
  const port = 4800 + (Number.parseInt(hashSource(root).slice(0, 4), 16) % 100);
  return { token: persistentToken(root), url: `http://127.0.0.1:${port}` };
}

export async function startSidecar(
  root: string,
  options: EsqiaOptions
): Promise<void> {
  const { url, token } = sidecarAddress(root);
  const port = Number(new URL(url).port);
  if (await listen(port, root, token, options)) {
    return;
  }
  if (await isOurs(url, root)) {
    // A sidecar from an earlier config load keeps running across Next's config reloads; give it the current options.
    await fetch(`${url}/configure`, {
      body: JSON.stringify(options),
      headers: { "content-type": "application/json", "x-esqia-token": token },
      method: "POST",
    }).catch(() => undefined);
    return;
  }
  throw new Error(
    `port ${port} is taken by something else. Free it and restart \`next dev\`.`
  );
}

function persistentToken(root: string): string {
  const file = path.join(root, "node_modules", ".cache", "esqia", "token");
  try {
    return readFileSync(file, "utf8").trim();
  } catch {
    const token = randomBytes(24).toString("hex");
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, token);
    return token;
  }
}

async function isOurs(url: string, root: string): Promise<boolean> {
  try {
    const response = await fetch(`${url}/health`);
    const body = (await response.json()) as { name?: string; root?: string };
    return body.name === "esqia" && body.root === root;
  } catch {
    return false;
  }
}

function listen(
  port: number,
  root: string,
  token: string,
  options: EsqiaOptions
): Promise<boolean> {
  const context: Context = { history: new Map(), options, root, token };
  const server = createServer((req, res) => {
    handle(req, res, context).catch((error: unknown) => {
      send(res, 500, {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  });

  return new Promise((resolve) => {
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => {
      // The config is loaded by processes that are meant to exit; the sidecar must not keep them alive.
      server.unref();
      resolve(true);
    });
  });
}

interface Context {
  history: Map<string, HistoryEntry[]>;
  options: EsqiaOptions;
  root: string;
  token: string;
}

const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  context: Context
) {
  const origin = req.headers.origin;
  if (origin && LOCAL_ORIGIN.test(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader(
      "Access-Control-Allow-Headers",
      "content-type, x-esqia-token, x-esqia-file, x-esqia-name"
    );
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  }
  if (req.method === "OPTIONS") {
    return send(res, 204);
  }

  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (url.pathname === "/health") {
    return send(res, 200, { name: "esqia", root: context.root });
  }

  if (origin && !LOCAL_ORIGIN.test(origin)) {
    return send(res, 403, { error: "Origin not allowed." });
  }
  if (req.headers["x-esqia-token"] !== context.token) {
    return send(res, 401, { error: "Bad token." });
  }

  switch (`${req.method} ${url.pathname}`) {
    case "GET /config":
      return send(res, 200, clientConfig(context.options));

    case "POST /configure":
      if (origin) {
        return send(res, 403, {
          error: "Only the Next config can reconfigure the sidecar.",
        });
      }
      context.options = JSON.parse(
        await readBody(req, 100_000)
      ) as EsqiaOptions;
      return send(res, 204);

    case "GET /source": {
      const file = resolveFile(context.root, url.searchParams.get("file"));
      const source = await readFile(file, "utf8");
      return send(res, 200, { hash: hashSource(source), source });
    }

    case "POST /ops": {
      const body = JSON.parse(await readBody(req, 5_000_000)) as {
        file: string;
        hash: string;
        ops: Op[];
        group?: string;
      };
      const file = resolveFile(context.root, body.file);
      const source = await readFile(file, "utf8");
      if (hashSource(source) !== body.hash) {
        return send(res, 409, {
          error: "The file changed on disk.",
          hash: hashSource(source),
        });
      }
      const result = applyOps(source, body.ops);
      if (!result.ok) {
        return send(res, 409, {
          error: result.reason,
          hash: hashSource(source),
        });
      }

      const afterHash = hashSource(result.source);
      if (afterHash !== body.hash) {
        await writeFile(file, result.source);
        record(context.history, file, {
          afterHash,
          before: source,
          group: body.group,
        });
      }
      return send(res, 200, { hash: afterHash });
    }

    case "POST /undo": {
      const body = JSON.parse(await readBody(req, 10_000)) as { file: string };
      const file = resolveFile(context.root, body.file);
      const entries = context.history.get(file) ?? [];
      const last = entries.at(-1);
      if (!last) {
        return send(res, 404, { error: "Nothing to undo." });
      }
      const source = await readFile(file, "utf8");
      if (hashSource(source) !== last.afterHash) {
        entries.length = 0;
        return send(res, 409, {
          error: "The file changed in your editor since the last edit here.",
        });
      }
      entries.pop();
      await writeFile(file, last.before);
      return send(res, 200, { hash: hashSource(last.before) });
    }

    case "POST /upload": {
      const file = resolveFile(
        context.root,
        firstHeader(req.headers["x-esqia-file"])
      );
      const name = path.basename(
        decodeURIComponent(firstHeader(req.headers["x-esqia-name"]) ?? "upload")
      );
      const body = await readBody(req, 200_000_000, true);
      const uploaded = await upload({
        body,
        contentType:
          firstHeader(req.headers["content-type"]) ??
          "application/octet-stream",
        dir: path.basename(path.dirname(file)),
        name,
        options: context.options.media ?? {},
        root: context.root,
      });
      return send(res, 200, { url: uploaded });
    }

    default:
      return send(res, 404, { error: "Not found." });
  }
}

function clientConfig(options: EsqiaOptions): ClientConfig {
  return {
    marks: options.marks ?? [],
    media: {
      image:
        options.media?.image ??
        '<Image src="{url}" alt="" width={{width}} height={{height}} />',
      video:
        options.media?.video ??
        '<Video src="{url}" width={{width}} height={{height}} />',
    },
    smartypants: options.smartypants ?? false,
    snippets: options.snippets ?? [],
  };
}

function record(
  history: Map<string, HistoryEntry[]>,
  file: string,
  entry: HistoryEntry
) {
  const entries = history.get(file) ?? [];
  const last = entries.at(-1);
  if (last && entry.group && last.group === entry.group) {
    last.afterHash = entry.afterHash;
  } else {
    entries.push(entry);
    if (entries.length > HISTORY_LIMIT) {
      entries.shift();
    }
  }
  history.set(file, entries);
}

function resolveFile(root: string, file: string | null | undefined): string {
  if (!file) {
    throw new Error("Missing file.");
  }
  const resolved = path.resolve(root, file);
  const inside = resolved.startsWith(root + path.sep);
  if (
    !inside ||
    !/\.mdx?$/.test(resolved) ||
    resolved.includes(`${path.sep}node_modules${path.sep}`)
  ) {
    throw new Error(`Refusing to touch ${file}.`);
  }
  return resolved;
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function readBody(req: IncomingMessage, limit: number): Promise<string>;
function readBody(
  req: IncomingMessage,
  limit: number,
  binary: true
): Promise<Buffer>;
function readBody(
  req: IncomingMessage,
  limit: number,
  binary?: boolean
): Promise<string | Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("Request body too large."));
        req.destroy();
      } else {
        chunks.push(chunk);
      }
    });
    req.on("end", () => {
      const buffer = Buffer.concat(chunks);
      resolve(binary ? buffer : buffer.toString("utf8"));
    });
    req.on("error", reject);
  });
}

function send(res: ServerResponse, status: number, body?: unknown) {
  res.statusCode = status;
  if (body === undefined) {
    return res.end();
  }
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}
