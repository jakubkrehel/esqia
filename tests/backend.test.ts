import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { type Backend, ConflictError, sidecarBackend } from "../src/client/api";
import { memoryBackend } from "../src/client/memory-backend";
import { sidecarAddress, startSidecar } from "../src/server/server";
import { clientConfig } from "../src/shared/config";
import { memoryStore } from "../src/shared/history";
import type { Intent } from "../src/shared/ops";

const text = "# Hello\n\nFirst.\n";

const replace = (from: string, to: string): Intent => ({
  kind: "replace",
  op: { end: 9 + from.length, expected: from, start: 9, text: to },
});

interface Adapter {
  backend: Backend;
  fresh: () => string;
}

const numbered = () => {
  let count = 0;
  return () => `${++count}.mdx`;
};

const adapters: { name: string; make: () => Promise<Adapter> }[] = [
  {
    make: () =>
      Promise.resolve({
        backend: memoryBackend(
          memoryStore(() => ({ hash: "initial", source: text })),
          clientConfig({})
        ),
        fresh: numbered(),
      }),
    name: "memory",
  },
  {
    make: async () => {
      const root = mkdtempSync(path.join(tmpdir(), "esqia-backend-"));
      await startSidecar(root, {});
      const { url, token } = sidecarAddress(root);
      const name = numbered();
      return {
        backend: sidecarBackend(url, token),
        fresh: () => {
          const file = name();
          writeFileSync(path.join(root, file), text);
          return file;
        },
      };
    },
    name: "sidecar",
  },
];

describe.each(adapters)("the $name backend", ({ make }) => {
  let backend: Backend;
  let fresh: () => string;

  beforeAll(async () => {
    ({ backend, fresh } = await make());
  });

  it("reads a file with the hash that edits must match", async () => {
    const file = fresh();
    const read = await backend.source(file);
    expect(read.source).toBe(text);
    const written = await backend.edit(
      file,
      read.hash,
      replace("First.", "Second.")
    );
    expect(written.hash).not.toBe(read.hash);
    await expect(backend.source(file)).resolves.toEqual({
      hash: written.hash,
      source: "# Hello\n\nSecond.\n",
    });
  });

  it("rejects an edit made against an older hash as a conflict", async () => {
    const file = fresh();
    const { hash } = await backend.source(file);
    await backend.edit(file, hash, replace("First.", "Second."));
    await expect(
      backend.edit(file, hash, replace("Second.", "Third."))
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("rejects an edit whose expected text is gone as a conflict", async () => {
    const file = fresh();
    const { hash } = await backend.source(file);
    await expect(
      backend.edit(file, hash, replace("Other.", "Second."))
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(
      backend.edit(file, hash, {
        expected: "Other.",
        kind: "remove",
        range: { end: 15, start: 9 },
      })
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("answers an edit that changes nothing with the same hash", async () => {
    const file = fresh();
    const { hash } = await backend.source(file);
    const written = await backend.edit(file, hash, replace("First.", "First."));
    expect(written.hash).toBe(hash);
  });

  it("undoes and redoes, and has nothing to redo after that", async () => {
    const file = fresh();
    const { hash } = await backend.source(file);
    await backend.edit(file, hash, replace("First.", "Second."));
    await backend.undo(file);
    expect((await backend.source(file)).source).toBe(text);
    await backend.redo(file);
    expect((await backend.source(file)).source).toBe("# Hello\n\nSecond.\n");
    await expect(backend.redo(file)).rejects.toThrow("Nothing to redo.");
  });

  it("counts changes and reverts every changed file", async () => {
    const file = fresh();
    const { hash } = await backend.source(file);
    await backend.edit(file, hash, replace("First.", "Second."));
    expect((await backend.changes()).files).toContain(file);
    const { reverted, skipped } = await backend.revert();
    expect(reverted).toContain(file);
    expect(skipped).toEqual([]);
    expect((await backend.source(file)).source).toBe(text);
    await expect(backend.changes()).resolves.toMatchObject({
      edits: 0,
      files: [],
    });
  });
});
