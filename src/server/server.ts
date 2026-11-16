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
import { EditHistory, type FileStore } from "../shared/history";
import type { Intent } from "../shared/ops";
import type { Outcome } from "../shared/outcome";

export type { ClientConfig, EsqiaOptions } from "../shared/config";

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
    history: new EditHistory(fileStore(root)),
    options,
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
  history: EditHistory;
  options: EsqiaOptions;
  root: string;
  token: string;
}

function fileStore(root: string): FileStore {
  return {
    read: async (file) => {
      const source = await readFile(path.join(root, file), "utf8");
      return { hash: hashSource(source), source };
    },
    write: async (file, source) => {
      await writeFile(path.join(root, file), source);
      return hashSource(source);
    },
  };
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
      "content-type, x-esqia-token"
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
      return send(res, 200, await context.history.source(file));
    }

    case "POST /edit": {
      const body = JSON.parse(await readBody(req, 5_000_000)) as {
        file: string;
        hash: string;
        intent: Intent;
        group?: string;
      };
      const file = resolveFile(context.root, body.file);
      return reply(
        res,
        await context.history.edit(file, body.hash, body.intent, body.group)
      );
    }

    case "POST /undo": {
      const body = JSON.parse(await readBody(req, 10_000)) as { file: string };
      return reply(
        res,
        await context.history.undo(resolveFile(context.root, body.file))
      );
    }

    case "POST /redo": {
      const body = JSON.parse(await readBody(req, 10_000)) as { file: string };
      return reply(
        res,
        await context.history.redo(resolveFile(context.root, body.file))
      );
    }

    case "GET /changes":
      return send(res, 200, context.history.changes());

    case "POST /revert":
      return send(res, 200, await context.history.revertAll());

    default:
      return send(res, 404, { error: "Not found." });
  }
}

function reply(res: ServerResponse, outcome: Outcome) {
  if (outcome.ok) {
    return send(res, 200, outcome);
  }
  return send(res, outcome.reason === "conflict" ? 409 : 404, outcome);
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
  return path.relative(root, resolved).split(path.sep).join("/");
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
