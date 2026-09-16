import { isRecord } from './records.js';

/**
 * Whether two parsed values say the same thing: the same primitives, array
 * order and own keys throughout. Keys are compared with `Object.hasOwn`, so a
 * key named after a prototype member matches only a key of that name.
 */
export function equivalent(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((entry, index) => equivalent(entry, right[index]))
    );
  }
  if (isRecord(left) && isRecord(right)) {
    const keys = Object.keys(left);
    return (
      keys.length === Object.keys(right).length &&
      keys.every(
        (key) => Object.hasOwn(right, key) && equivalent(left[key], right[key]),
      )
    );
  }
  return left === right;
}
