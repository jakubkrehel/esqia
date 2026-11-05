import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { sidecarAddress, startSidecar } from "../src/server/server";

const root = mkdtempSync(path.join(tmpdir(), "esqia-"));
const file = "posts/hello/content.mdx";
const { url, token } = sidecarAddress(root);
const call = (route: string, init: RequestInit = {}) =>
  fetch(`${url}${route}`, {
    ...init,
    headers: { "x-esqia-token": token, ...init.headers },
  });
const json = (body: unknown) => ({
  body: JSON.stringify(body),
  headers: { "content-type": "application/json" },
  method: "POST",
});

beforeAll(async () => {
  mkdirSync(path.join(root, "posts/hello"), { recursive: true });
  writeFileSync(path.join(root, file), "# Hello\n\nFirst.\n");
  await startSidecar(root, {});
});

describe("sidecar", () => {
  it("rejects a missing token", async () => {
    expect((await fetch(`${url}/source?file=${file}`)).status).toBe(401);
  });

  it("refuses files outside the root or that aren't MDX", async () => {
    expect((await call(`/source?file=../../etc/passwd`)).status).toBe(500);
    expect((await call(`/source?file=package.json`)).status).toBe(500);
  });

  it("applies ops, rejects stale ones and undoes", async () => {
    const { hash } = await (await call(`/source?file=${file}`)).json();
    const op = { end: 15, expected: "First.", start: 9, text: "Second." };
    const ok = await call(
      "/edit",
      json({ file, hash, intent: { kind: "replace", op } })
    );
    expect(ok.status).toBe(200);
    expect(readFileSync(path.join(root, file), "utf8")).toBe(
      "# Hello\n\nSecond.\n"
    );

    const stale = await call(
      "/edit",
      json({ file, hash, intent: { kind: "replace", op } })
    );
    expect(stale.status).toBe(409);

    expect((await call("/undo", json({ file }))).status).toBe(200);
    expect(readFileSync(path.join(root, file), "utf8")).toBe(
      "# Hello\n\nFirst.\n"
    );
    expect((await (await call("/changes")).json()).redos).toBe(1);

    expect((await call("/redo", json({ file }))).status).toBe(200);
    expect(readFileSync(path.join(root, file), "utf8")).toBe(
      "# Hello\n\nSecond.\n"
    );
    expect((await call("/redo", json({ file }))).status).toBe(404);

    expect((await call("/undo", json({ file }))).status).toBe(200);
    expect(readFileSync(path.join(root, file), "utf8")).toBe(
      "# Hello\n\nFirst.\n"
    );
  });

  it("reverts every changed file to before the first edit", async () => {
    const before = readFileSync(path.join(root, file), "utf8");
    for (const text of ["One.", "Two."]) {
      const { hash, source } = await (
        await call(`/source?file=${file}`)
      ).json();
      const start = source.indexOf("\n\n") + 2;
      const end = source.length - 1;
      await call(
        "/edit",
        json({
          file,
          hash,
          intent: {
            kind: "replace",
            op: { end, expected: source.slice(start, end), start, text },
          },
        })
      );
    }
    expect((await (await call("/changes")).json()).files).toEqual([file]);
    const result = await (await call("/revert", { method: "POST" })).json();
    expect(result).toEqual({ reverted: [file], skipped: [] });
    expect(readFileSync(path.join(root, file), "utf8")).toBe(before);
    expect((await (await call("/changes")).json()).files).toEqual([]);
  });

  it("answers CORS preflight for this machine and the local network only", async () => {
    const local = await fetch(`${url}/edit`, {
      headers: { origin: "http://localhost:3000" },
      method: "OPTIONS",
    });
    expect(local.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3000"
    );
    const network = await fetch(`${url}/edit`, {
      headers: { origin: "http://172.16.227.17:3000" },
      method: "OPTIONS",
    });
    expect(network.headers.get("access-control-allow-origin")).toBe(
      "http://172.16.227.17:3000"
    );
    const remote = await fetch(`${url}/edit`, {
      headers: { origin: "https://evil.example" },
      method: "OPTIONS",
    });
    expect(remote.headers.get("access-control-allow-origin")).toBeNull();
  });
});
