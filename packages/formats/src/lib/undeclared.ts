import type { Divergence } from './divergence.js';
import { isRecord } from './records.js';

/**
 * One `undeclared` divergence for each key of `given` that the schema
 * stripped from `kept`. An import passes `reservePath` to charge each path to
 * its budget before the path is joined, and a refused path is left out.
 */
export function undeclaredDivergences(
  given: unknown,
  kept: unknown,
  reservePath: (path: readonly string[]) => boolean = () => true,
): readonly Divergence[] {
  return undeclaredKeys(given, kept, [], reservePath).map(
    (key): Divergence => ({
      subject: { kind: 'model' },
      detail: { code: 'key-undeclared', parameters: { path: key } },
      reason: 'undeclared',
    }),
  );
}

function undeclaredKeys(
  given: unknown,
  kept: unknown,
  path: readonly string[],
  reservePath: (path: readonly string[]) => boolean,
): string[] {
  if (Array.isArray(given) && Array.isArray(kept)) {
    return given.flatMap((entry, index) =>
      undeclaredKeys(entry, kept[index], [...path, String(index)], reservePath),
    );
  }
  if (isRecord(given) && isRecord(kept)) {
    return Object.keys(given).flatMap((key) =>
      Object.hasOwn(kept, key)
        ? undeclaredKeys(given[key], kept[key], [...path, key], reservePath)
        : reservePath([...path, key])
          ? [joinPath([...path, key])]
          : [],
    );
  }
  return [];
}

const escapableSegment = /[\\.]/g;

function joinPath(path: readonly string[]): string {
  return path
    .map((segment) => segment.replace(escapableSegment, '\\$&'))
    .join('.');
}
