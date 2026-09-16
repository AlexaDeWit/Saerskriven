/**
 * `compute` cached per key object in a `WeakMap`, so a layout that hands the
 * same node or flow back on the next drag frame reuses what was derived from
 * it, and a dropped key releases its entry.
 */
export function memoizedByIdentity<K extends object, V>(
  compute: (key: K) => V,
): (key: K) => V {
  const cache = new WeakMap<K, V>();
  return (key) => {
    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const value = compute(key);
    cache.set(key, value);
    return value;
  };
}
