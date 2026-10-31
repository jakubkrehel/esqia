import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { sidecarAddress, startSidecar } from "../src/server/server";

const root = mkdtempSync(path.join(tmpdir(), "esqe-"));
const file = "posts/hello/content.mdx";
const { url, token } = sidecarAddress(root);
const call = (route: string, init: RequestInit = {}) =>
  fetch(`${url}${route}`, { ...init, headers: { "x-esqe-token": token, ...init.headers } });
const json = (body: unknown) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

beforeAll(async () => {
  mkdirSync(path.join(root, "posts/hello"), { recursive: true });
  writeFileSync(path.join(root, file), "# Hello\n\nFirst.\n");
  await startSidecar(root, { media: { upload: "public" } });
});

describe("sidecar", () => {
  test("rejects a missing token", async () => {
    expect((await fetch(`${url}/source?file=${file}`)).status).toBe(401);
  });

  test("refuses files outside the root or that aren't MDX", async () => {
    expect((await call(`/source?file=../../etc/passwd`)).status).toBe(500);
    expect((await call(`/source?file=package.json`)).status).toBe(500);
  });

  test("applies ops, rejects stale ones and undoes", async () => {
    const { hash } = await (await call(`/source?file=${file}`)).json();
    const ok = await call("/ops", json({ file, hash, ops: [{ start: 9, end: 15, expected: "First.", text: "Second." }] }));
    expect(ok.status).toBe(200);
    expect(readFileSync(path.join(root, file), "utf8")).toBe("# Hello\n\nSecond.\n");

    const stale = await call("/ops", json({ file, hash, ops: [] }));
    expect(stale.status).toBe(409);

    expect((await call("/undo", json({ file }))).status).toBe(200);
    expect(readFileSync(path.join(root, file), "utf8")).toBe("# Hello\n\nFirst.\n");
  });

  test("uploads to public/ under the post's folder name", async () => {
    const response = await call("/upload", {
      method: "POST",
      headers: { "content-type": "image/png", "x-esqe-file": file, "x-esqe-name": "shot.png" },
      body: new Uint8Array([1, 2, 3]),
    });
    const { url: uploaded } = await response.json();
    expect(uploaded).toBe("/hello/shot.png");
    expect([...readFileSync(path.join(root, "public/hello/shot.png"))]).toEqual([1, 2, 3]);
  });

  test("answers CORS preflight only for localhost", async () => {
    const local = await fetch(`${url}/ops`, { method: "OPTIONS", headers: { origin: "http://localhost:3000" } });
    expect(local.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
    const remote = await fetch(`${url}/ops`, { method: "OPTIONS", headers: { origin: "https://evil.example" } });
    expect(remote.headers.get("access-control-allow-origin")).toBeNull();
  });
});
