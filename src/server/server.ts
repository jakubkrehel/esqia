import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import path from "node:path";
import { clientConfig, type EsqiaOptions } from "../shared/config";
import { hashSource } from "../shared/hash";
import { applyOps, type Op } from "../shared/ops";

export type { ClientConfig, EsqiaOptions } from "../shared/config";

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

export interface Sidecar {
  token: string;
  url: string;
}

export function sidecarAddress(root: string): Sidecar {
  const port =
    20_000 + (Number.parseInt(hashSource(root).slice(0, 6), 16) % 20_000);
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
  const context: Context = {
    history: new Map(),
    options,
    redo: new Map(),
    root,
    token,
  };
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
      server.unref();
      resolve(true);
    });
  });
}

interface Context {
  history: Map<string, HistoryEntry[]>;
  options: EsqiaOptions;
  redo: Map<string, RedoEntry[]>;
  root: string;
  token: string;
}

const PRIVATE_HOST =
  /^(localhost|127\.0\.0\.1|\[::1\]|.+\.localhost|.+\.local|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/;

function isPrivateOrigin(origin: string): boolean {
  try {
    return PRIVATE_HOST.test(new URL(origin).hostname);
  } catch {
    return false;
  }
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  context: Context
) {
  const origin = req.headers.origin;
  if (origin && isPrivateOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader(
      "Access-Control-Allow-Headers",
      "content-type, x-esqia-token, x-esqia-file, x-esqia-name"
    );
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

    res.setHeader("Access-Control-Allow-Private-Network", "true");
  }
  if (req.method === "OPTIONS") {
    return send(res, 204);
  }

  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (url.pathname === "/health") {
    return send(res, 200, { name: "esqia", root: context.root });
  }

  if (origin && !isPrivateOrigin(origin)) {
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
        context.redo.delete(file);
      }
      return send(res, 200, { hash: afterHash });
    }

    case "POST /undo": {
      const body = JSON.parse(await readBody(req, 10_000)) as { file: string };
      return undo(res, context, resolveFile(context.root, body.file));
    }

    case "POST /redo": {
      const body = JSON.parse(await readBody(req, 10_000)) as { file: string };
      return redo(res, context, resolveFile(context.root, body.file));
    }

    case "GET /changes":
      return send(res, 200, changes(context));

    case "POST /revert":
      return send(res, 200, await revertAll(context));

    default:
      return send(res, 404, { error: "Not found." });
  }
}

async function undo(res: ServerResponse, context: Context, file: string) {
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
  context.redo.set(file, [
    ...(context.redo.get(file) ?? []),
    { after: source, before: last.before },
  ]);
  return send(res, 200, { hash: hashSource(last.before) });
}

async function redo(res: ServerResponse, context: Context, file: string) {
  const entries = context.redo.get(file) ?? [];
  const last = entries.at(-1);
  if (!last) {
    return send(res, 404, { error: "Nothing to redo." });
  }
  const source = await readFile(file, "utf8");
  if (source !== last.before) {
    context.redo.delete(file);
    return send(res, 409, {
      error: "The file changed in your editor since the last undo here.",
    });
  }
  entries.pop();
  await writeFile(file, last.after);
  record(context.history, file, {
    afterHash: hashSource(last.after),
    before: last.before,
  });
  return send(res, 200, { hash: hashSource(last.after) });
}

function changes(context: Context) {
  const touched = [...context.history].filter(
    ([, entries]) => entries.length > 0
  );
  return {
    edits: touched.reduce((sum, [, entries]) => sum + entries.length, 0),
    files: touched.map(([file]) => path.relative(context.root, file)),
    redos: [...context.redo.values()].reduce(
      (sum, entries) => sum + entries.length,
      0
    ),
  };
}

async function revertAll(context: Context) {
  const reverted: string[] = [];
  const skipped: string[] = [];
  context.redo.clear();
  for (const [file, entries] of context.history) {
    const first = entries[0];
    const last = entries.at(-1);
    entries.length = 0;
    if (!(first && last)) {
      continue;
    }
    const name = path.relative(context.root, file);
    const source = await readFile(file, "utf8");
    if (hashSource(source) === last.afterHash) {
      await writeFile(file, first.before);
      reverted.push(name);
    } else {
      skipped.push(name);
    }
  }
  return { reverted, skipped };
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

function readBody(req: IncomingMessage, limit: number): Promise<string> {
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
      resolve(buffer.toString("utf8"));
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
