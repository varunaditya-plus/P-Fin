type Pending<T> = {
  controller: AbortController;
  promise: Promise<T>;
  subscribers: number;
  settled: boolean;
};

/** Share a read without letting one disappearing carousel cancel another. */
export function createSharedRequest<T>() {
  const pending = new Map<string, Pending<T>>();
  return (
    key: string,
    signal: AbortSignal | undefined,
    load: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> => {
    signal?.throwIfAborted();
    let request = pending.get(key);
    if (!request) {
      const controller = new AbortController();
      const next: Pending<T> = {
        controller,
        subscribers: 0,
        settled: false,
        promise: Promise.resolve(undefined as T),
      };
      next.promise = load(controller.signal).finally(() => {
        next.settled = true;
        if (pending.get(key) === next) pending.delete(key);
      });
      request = next;
      pending.set(key, next);
    }
    const shared = request;
    shared.subscribers += 1;
    return new Promise<T>((resolve, reject) => {
      let finished = false;
      let abort: () => void;
      const release = () => {
        signal?.removeEventListener("abort", abort);
        shared.subscribers -= 1;
        if (!shared.subscribers && !shared.settled) {
          shared.controller.abort();
          if (pending.get(key) === shared) pending.delete(key);
        }
      };
      abort = () => {
        if (finished) return;
        finished = true;
        release();
        reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
      };
      signal?.addEventListener("abort", abort, { once: true });
      shared.promise.then(
        (value) => {
          if (finished) return;
          finished = true;
          release();
          resolve(value);
        },
        (reason) => {
          if (finished) return;
          finished = true;
          release();
          reject(reason);
        },
      );
    });
  };
}
