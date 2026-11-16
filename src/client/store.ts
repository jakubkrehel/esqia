export class Store<T> {
  private readonly listeners = new Set<() => void>();
  protected snapshot: T;

  constructor(initial: T) {
    this.snapshot = initial;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  protected update(patch: Partial<T>) {
    this.set({ ...this.snapshot, ...patch });
  }

  protected set(snapshot: T) {
    this.snapshot = snapshot;
    for (const listener of this.listeners) {
      listener();
    }
  }
}
