import { describe, expect, it } from "vitest";
import { intentOps, spanAfter } from "../src/client/intents";
import { blockType, parseMdx } from "../src/shared/markdown";
import { insertBreakOps, moveOps, removeOps } from "../src/shared/ops";

const source = "# Title\n\nFirst.\n\n<br />\n\nSecond.\n\n<Demo />\n";
const blocks = parseMdx(source).children.map((node) => ({
  end: node.position?.end.offset ?? 0,
  start: node.position?.start.offset ?? 0,
  type: blockType(node),
}));
const read = () => Promise.resolve(source);

describe("intents", () => {
  const [, first, , second] = blocks;

  it("builds the same ops as the helpers they name", async () => {
    if (!(first && second)) {
      throw new Error("missing blocks");
    }
    await expect(
      intentOps({ kind: "remove", range: first }, read)
    ).resolves.toEqual(removeOps(source, first));
    await expect(
      intentOps({ kind: "break", range: first }, read)
    ).resolves.toEqual(insertBreakOps(first));
    await expect(
      intentOps({ blocks, kind: "move", range: second, target: first }, read)
    ).resolves.toEqual(moveOps(source, blocks, second, first));
  });

  it("writes a replacement without reading the file", async () => {
    const op = { end: 15, expected: "First.", start: 9, text: "Changed." };
    const unread = () => Promise.reject(new Error("read"));
    await expect(intentOps({ kind: "replace", op }, unread)).resolves.toEqual([
      op,
    ]);
  });

  it("collapses a removed run to where the removal landed", async () => {
    if (!first) {
      throw new Error("missing block");
    }
    const intent = { kind: "remove", range: first } as const;
    expect(spanAfter(intent, await intentOps(intent, read))).toEqual({
      end: 9,
      start: 9,
    });
  });
});
