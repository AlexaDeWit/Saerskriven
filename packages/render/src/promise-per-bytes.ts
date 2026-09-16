/**
 * A cache of one promise per byte buffer, keyed by identity. A buffer seen
 * before gets the promise its first call started, and a promise that rejects
 * is dropped, so the next call with that buffer starts again.
 */
export function promisePerBytes<T>(): (
  bytes: Uint8Array,
  start: () => Promise<T>,
) => Promise<T> {
  const started = new WeakMap<Uint8Array, Promise<T>>();
  return (bytes, start) => {
    const known = started.get(bytes);
    if (known !== undefined) {
      return known;
    }
    const attempt = start().catch((error: unknown) => {
      started.delete(bytes);
      throw error;
    });
    started.set(bytes, attempt);
    return attempt;
  };
}
