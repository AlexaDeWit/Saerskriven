import { Either } from 'effect';
import { ReadFailure } from './codec.js';
import { isKeyed } from './records.js';

/**
 * What a read may spend on a text before refusing it, one value so a caller
 * checking a file first enforces the codecs' own numbers. Each parsing bound
 * has headroom over the largest vendored file and a fixture under
 * `test-data/adversarial` built to break it.
 */
export const readLimits = Object.freeze({
  /** UTF-8 input bytes, checked before parsing. Up to 0.3.0 it was 4 MiB. */
  maxTextBytes: 8_388_608,
  /** UTF-16 units an import may charge for expanded references and escaped ids. */
  maxImportTextUnits: 16_777_216,
  /** Maximum parsed depth, including values in extension maps. */
  maxNestingDepth: 64,
  /** Expanded YAML alias count, checked before resolving aliases. */
  maxAliasCount: 50,
  /** Nodes reached through YAML aliases, checked before resolving aliases. */
  maxAliasExpansion: 100_000,
});

/** Which bound a read stopped on, named as {@link readLimits} names it. */
export type ReadLimit = keyof typeof readLimits;

/**
 * A read stopped by a bound. `observed` is the UTF-8 byte count for
 * `maxTextBytes`, or the UTF-16 length where that alone breaks the bound, and
 * one past the bound for the depth and alias limits, which stop measuring
 * there.
 */
export function exceededReadLimit(
  limit: ReadLimit,
  observed: number,
): ReadFailure {
  return ReadFailure.ExceededReadLimit({
    limit,
    bound: readLimits[limit],
    observed,
  });
}

/**
 * `parse` run on a text within `maxTextBytes`, its result then walked for
 * `maxNestingDepth`. The walk keeps its own stack and expands a node only when
 * it reaches that node deeper than before, so a value an alias makes
 * reachable along many paths costs its own size, and a cycle is refused at
 * the bound rather than followed. `JSON.parse` builds any depth without
 * recursing, which leaves this walk as the depth bound on a JSON read.
 */
export function parseWithinLimits(
  text: string,
  parse: (text: string) => Either.Either<unknown, ReadFailure>,
): Either.Either<unknown, ReadFailure> {
  return Either.flatMap(withinTextLimit(text), (bounded) =>
    Either.flatMap(parse(bounded), withinNestingLimit),
  );
}

/** Refuses text whose UTF-8 size exceeds the shared read bound. */
export function withinTextLimit(
  text: string,
): Either.Either<string, ReadFailure> {
  const observed =
    text.length > readLimits.maxTextBytes
      ? text.length
      : encoder.encode(text).length;
  return withinTextBytes(observed)
    ? Either.right(text)
    : Either.left(exceededReadLimit('maxTextBytes', observed));
}

/**
 * Whether a text of `bytes` UTF-8 bytes is inside the shared read bound. A
 * write checks what it produces here, so a file a writer produced is one the
 * reads accept.
 */
export function withinTextBytes(bytes: number): boolean {
  return bytes <= readLimits.maxTextBytes;
}

const encoder = new TextEncoder();

function withinNestingLimit(
  value: unknown,
): Either.Either<unknown, ReadFailure> {
  return deeperThanLimit(value)
    ? Either.left(
        exceededReadLimit('maxNestingDepth', readLimits.maxNestingDepth + 1),
      )
    : Either.right(value);
}

function deeperThanLimit(value: unknown): boolean {
  const reached = new Map<object, number>();
  let frontier: readonly unknown[] = [value];
  let depth = 0;
  while (frontier.length > 0) {
    if (depth > readLimits.maxNestingDepth) {
      return true;
    }
    frontier = frontier.flatMap((node) => childrenOf(node, depth, reached));
    depth += 1;
  }
  return false;
}

function childrenOf(
  node: unknown,
  depth: number,
  reached: Map<object, number>,
): readonly unknown[] {
  if (!isKeyed(node)) {
    return [];
  }
  const deepest = reached.get(node);
  if (deepest !== undefined && deepest >= depth) {
    return [];
  }
  reached.set(node, depth);
  return Object.values(node);
}
