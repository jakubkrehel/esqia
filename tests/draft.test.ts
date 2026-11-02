import { describe, expect, it } from "vitest";
import { Draft } from "../src/client/draft";
import { intentOps, spanAfter } from "../src/client/intents";
import { applyOps } from "../src/shared/ops";

const source = "# Title\n\nFirst.\n\nSecond.\n";
const first = { end: 15, start: 9 };

const save = async (draft: Draft, body: string, closing = false) => {
  const intent = draft.next(body, closing);
  if (!intent) {
    return null;
  }
  const ops = await intentOps(intent, () => Promise.resolve(source));
  draft.saved(intent, spanAfter(intent, ops));
  const result = applyOps(source, ops);
  return result.ok ? result.source : null;
};

describe("draft", () => {
  it("skips a write when the text is unchanged", () => {
    expect(new Draft("run", source, first).next("First.", false)).toBeNull();
  });

  it("replaces its range and follows the new length", async () => {
    const draft = new Draft("run", source, first);
    await expect(save(draft, "Longer first.")).resolves.toBe(
      "# Title\n\nLonger first.\n\nSecond.\n"
    );
    expect(draft.range).toEqual({ end: 22, start: 9 });
  });

  it("removes the run when it is emptied on close, not while typing", async () => {
    const draft = new Draft("run", source, first);
    expect(draft.next("", false)).toMatchObject({
      kind: "replace",
      op: { text: "" },
    });
    await expect(save(new Draft("run", source, first), "", true)).resolves.toBe(
      "# Title\n\nSecond.\n"
    );
  });

  it("separates a new block from the one it follows", async () => {
    const draft = new Draft("after", source, { end: 15, start: 15 });
    expect(draft.next("", true)).toBeNull();
    await expect(save(draft, "Inserted.")).resolves.toBe(
      "# Title\n\nFirst.\n\nInserted.\n\nSecond.\n"
    );
  });
});
