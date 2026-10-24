import { Result } from 'effect';
import { parseDocument, YAMLParseError } from 'yaml';
import { ReadFailure } from './codec.js';
import {
  exceededReadLimit,
  parseWithinLimits,
  readLimits,
} from './read-limits.js';
import { aliasCostIn, type ComposedDocument } from './yaml-alias-cost.js';

/**
 * YAML or JSON parsed within the size, nesting and alias bounds, the alias
 * bounds measured by {@link aliasCostIn}. A nesting the parser has no stack
 * for is reported as `maxNestingDepth`.
 */
export function parseYaml(text: string): Result.Result<unknown, ReadFailure> {
  return parseWithinLimits(text, (bounded) =>
    Result.flatMap(
      Result.flatMap(
        compose(bounded.replace(/\r(?!\n)/gu, '\n')),
        withinAliasLimits,
      ),
      toValue,
    ),
  );
}

function compose(text: string): Result.Result<ComposedDocument, ReadFailure> {
  return Result.flatMap(
    Result.try({ try: () => parseDocument(text), catch: toReadFailure }),
    (document) => {
      const [refused] = document.errors;
      return refused === undefined
        ? Result.succeed(document)
        : Result.fail(toReadFailure(refused));
    },
  );
}

function withinAliasLimits(
  document: ComposedDocument,
): Result.Result<ComposedDocument, ReadFailure> {
  const cost = aliasCostIn(document, {
    expanded: readLimits.maxAliasCount + 1,
    reached: readLimits.maxAliasExpansion + 1,
  });
  if (cost.expanded > readLimits.maxAliasCount) {
    return Result.fail(exceededReadLimit('maxAliasCount', cost.expanded));
  }
  return cost.reached > readLimits.maxAliasExpansion
    ? Result.fail(exceededReadLimit('maxAliasExpansion', cost.reached))
    : Result.succeed(document);
}

function toValue(
  document: ComposedDocument,
): Result.Result<unknown, ReadFailure> {
  return Result.try({
    try: () => document.toJS({ maxAliasCount: -1 }) as unknown,
    catch: toReadFailure,
  });
}

function toReadFailure(error: unknown): ReadFailure {
  if (error instanceof YAMLParseError && error.code === 'RESOURCE_EXHAUSTION') {
    return exceededReadLimit('maxNestingDepth', readLimits.maxNestingDepth + 1);
  }
  return ReadFailure.MalformedText({ message: String(error) });
}
