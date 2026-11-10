export type Settle = () => Promise<boolean>;

export type Newest = () => boolean;

export class EditSequence {
  private readonly onBusy: (busy: boolean) => void;
  private newest = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private waiting = 0;

  constructor(onBusy: (busy: boolean) => void) {
    this.onBusy = onBusy;
  }

  supersede() {
    this.newest++;
  }

  async open(settle: Settle): Promise<Newest | null> {
    const settled = settle();
    const turn = ++this.newest;
    if (!(await settled)) {
      return null;
    }
    await this.queue;
    const newest = () => turn === this.newest;
    return newest() ? newest : null;
  }

  write<T>(action: () => Promise<T>, settle: Settle): Promise<T | undefined> {
    this.newest++;
    this.waiting++;
    this.onBusy(true);
    const settled = settle();
    const written = this.queue.then(async () =>
      (await settled) ? action() : undefined
    );
    this.queue = written
      .catch(() => undefined)
      .finally(() => {
        this.waiting--;
        this.onBusy(this.waiting > 0);
      });
    return written;
  }
}
