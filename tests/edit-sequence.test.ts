import { describe, expect, it, vi } from "vitest";
import { EditSequence } from "../src/client/edit-sequence";

const nothingOpen = () => Promise.resolve(true);

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, reject, resolve };
};

const sequenced = () => {
  const busy: boolean[] = [];
  const sequence = new EditSequence((state) => busy.push(state));
  return { busy, sequence };
};

describe("writes", () => {
  it("run one at a time, in the order they were asked for", async () => {
    const { sequence } = sequenced();
    const first = deferred<undefined>();
    const order: string[] = [];
    const slow = sequence.write(async () => {
      await first.promise;
      order.push("first");
    }, nothingOpen);
    const fast = sequence.write(() => {
      order.push("second");
      return Promise.resolve();
    }, nothingOpen);
    await Promise.resolve();
    expect(order).toEqual([]);
    first.resolve(undefined);
    await Promise.all([slow, fast]);
    expect(order).toEqual(["first", "second"]);
  });

  it("carry on after one fails", async () => {
    const { sequence } = sequenced();
    const failed = sequence.write(
      () => Promise.reject(new Error("Changed on disk.")),
      nothingOpen
    );
    const next = sequence.write(() => Promise.resolve("written"), nothingOpen);
    await expect(failed).rejects.toThrow("Changed on disk.");
    await expect(next).resolves.toBe("written");
  });

  it("report busy until the last one lands", async () => {
    const { busy, sequence } = sequenced();
    const first = deferred<undefined>();
    const slow = sequence.write(() => first.promise, nothingOpen);
    const fast = sequence.write(() => Promise.resolve(), nothingOpen);
    expect(busy).toEqual([true, true]);
    first.resolve(undefined);
    await Promise.all([slow, fast]);
    await Promise.resolve();
    expect(busy.at(-1)).toBe(false);
    expect(busy.filter((state) => !state)).toHaveLength(1);
  });

  it("wait for the open edit, and do not run when it refuses", async () => {
    const { sequence } = sequenced();
    const settling = deferred<boolean>();
    const action = vi.fn<() => Promise<string>>(() =>
      Promise.resolve("written")
    );
    const waiting = sequence.write(action, () => settling.promise);
    await Promise.resolve();
    expect(action).not.toHaveBeenCalled();
    settling.resolve(true);
    await expect(waiting).resolves.toBe("written");

    const refused = vi.fn<() => Promise<string>>(() =>
      Promise.resolve("written")
    );
    await expect(
      sequence.write(refused, () => Promise.resolve(false))
    ).resolves.toBeUndefined();
    expect(refused).not.toHaveBeenCalled();
  });
});

describe("openings", () => {
  it("wait for the writes already asked for", async () => {
    const { sequence } = sequenced();
    const writing = deferred<undefined>();
    const order: string[] = [];
    const write = sequence.write(async () => {
      await writing.promise;
      order.push("written");
    }, nothingOpen);
    const opening = sequence.open(nothingOpen).then((newest) => {
      order.push("opened");
      return newest;
    });
    writing.resolve(undefined);
    await write;
    const newest = await opening;
    expect(order).toEqual(["written", "opened"]);
    expect(newest?.()).toBe(true);
  });

  it("are dropped when the open edit refuses to settle", async () => {
    const { sequence } = sequenced();
    await expect(
      sequence.open(() => Promise.resolve(false))
    ).resolves.toBeNull();
  });

  it("are dropped when a write is asked for before they finish", async () => {
    const { sequence } = sequenced();
    const settling = deferred<boolean>();
    const opening = sequence.open(() => settling.promise);
    const write = sequence.write(() => Promise.resolve(), nothingOpen);
    settling.resolve(true);
    await expect(opening).resolves.toBeNull();
    await write;
  });

  it("are dropped when a newer opening starts", async () => {
    const { sequence } = sequenced();
    const settling = deferred<boolean>();
    const older = sequence.open(() => settling.promise);
    const newer = sequence.open(nothingOpen);
    settling.resolve(true);
    await expect(older).resolves.toBeNull();
    expect((await newer)?.()).toBe(true);
  });

  it("stop being the newest once something else is asked for", async () => {
    const { sequence } = sequenced();
    const closed = await sequence.open(nothingOpen);
    sequence.supersede();
    expect(closed?.()).toBe(false);

    const written = await sequence.open(nothingOpen);
    const write = sequence.write(() => Promise.resolve(), nothingOpen);
    expect(written?.()).toBe(false);
    await write;
  });
});
