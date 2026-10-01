/**
 * Runs tasks that share a key strictly one after another (FIFO); different keys run in
 * parallel. In-process only — cross-process coordination is done in Redis.
 */
export class KeyedMutex {
  private tails = new Map<string, Promise<unknown>>();

  run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(task);
    this.tails.set(key, current);
    void current
      .catch(() => undefined)
      .finally(() => {
        if (this.tails.get(key) === current) this.tails.delete(key);
      });
    return current;
  }
}
