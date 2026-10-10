import {
  saerskrivenYamlV2WireSchema,
  type SaerskrivenYamlV2Document,
} from '@saerskriven/wire-saerskriven-yaml-v2';
import { Either } from 'effect';
import { z } from 'zod';
import { parseWire, type ReadFailure } from './codec.js';
import { parseJson } from './parse-json.js';
import {
  compactBudget,
  compactFields,
  compactLayout,
  compactRowLimit,
  hasColumns,
  malformedCompact,
  type CompactBudget,
} from './share-compact-common.js';
import { compactLayouts, compactRoot } from './share-compact-layout.js';
import type { CompactLayout } from './share-compact-types.js';

const envelope = z.tuple([
  z.array(z.string().min(1)).max(compactRowLimit),
  z.unknown(),
]);

/** Reconstructs the native wire document within the compact expansion limits. */
export function readCompactDocument(
  text: string,
): Either.Either<SaerskrivenYamlV2Document, ReadFailure> {
  return Either.flatMap(parseJson(text), (given) =>
    Either.flatMap(parseWire(envelope, given), ([ids, data]) => {
      if (new Set(ids).size !== ids.length)
        return malformedCompact('duplicate identifiers');
      return Either.flatMap(
        unpack(compactRoot, data, ids, compactBudget()),
        (document) => parseWire(saerskrivenYamlV2WireSchema, document),
      );
    }),
  );
}

function unpack(
  index: number,
  value: unknown,
  ids: readonly string[],
  budget: CompactBudget,
): Either.Either<unknown, ReadFailure> {
  return Either.flatMap(budget.node(), () =>
    Either.flatMap(compactLayout(index), (layout) =>
      unpackAs(layout, value, ids, budget),
    ),
  );
}

function unpackAs(
  layout: CompactLayout,
  value: unknown,
  ids: readonly string[],
  budget: CompactBudget,
): Either.Either<unknown, ReadFailure> {
  switch (layout.kind) {
    case 'object':
      return unpackObject(layout, value, ids, budget);
    case 'array':
      return unpackArray(layout.element, value, ids, budget);
    case 'variant':
      return unpackVariant(layout, value, ids, budget);
    case 'optional':
      if (value === null || value === undefined) return Either.right(undefined);
      return Array.isArray(value) && value.length === 1
        ? unpack(layout.value, value[0], ids, budget)
        : malformedCompact('invalid optional value');
    case 'literal':
      return Either.right(layout.value);
    case 'enum': {
      const held =
        typeof value === 'number' && Number.isInteger(value)
          ? layout.values[value]
          : undefined;
      return held === undefined
        ? malformedCompact('invalid enum index')
        : Either.right(held);
    }
    case 'string':
      return unpackText(value, ids, budget);
    case 'number':
      if (value === '-0') return Either.right(-0);
      return typeof value === 'number' && Number.isFinite(value)
        ? Either.right(value)
        : malformedCompact('expected a finite number');
    case 'boolean':
      return value === 0 || value === 1
        ? Either.right(value === 1)
        : malformedCompact('invalid boolean');
    default:
      return malformedCompact('unknown layout');
  }
}

function unpackText(
  value: unknown,
  ids: readonly string[],
  budget: CompactBudget,
): Either.Either<string, ReadFailure> {
  if (value === null || value === undefined) return budget.text('');
  if (typeof value === 'string') return budget.text(value);
  const text =
    typeof value === 'number' && Number.isInteger(value)
      ? ids[value]
      : undefined;
  return text === undefined
    ? malformedCompact('invalid identifier reference')
    : budget.text(text);
}

function unpackObject(
  layout: Extract<CompactLayout, { kind: 'object' }>,
  value: unknown,
  ids: readonly string[],
  budget: CompactBudget,
): Either.Either<Record<string, unknown>, ReadFailure> {
  if (!Array.isArray(value) || value.length > compactFields(layout).length)
    return malformedCompact('invalid object width');
  const fields: [string, unknown][] = [];
  let slot = 0;
  for (const field of layout.fields) {
    const charged = budget.key(field.name);
    if (Either.isLeft(charged)) return Either.left(charged.left);
    const literal = compactLayouts[field.layout]?.kind === 'literal';
    const decoded = unpack(
      field.layout,
      literal ? undefined : value[slot++],
      ids,
      budget,
    );
    if (Either.isLeft(decoded)) return Either.left(decoded.left);
    if (decoded.right !== undefined) fields.push([field.name, decoded.right]);
  }
  return Either.right(Object.fromEntries(fields));
}

function unpackVariant(
  layout: Extract<CompactLayout, { kind: 'variant' }>,
  value: unknown,
  ids: readonly string[],
  budget: CompactBudget,
): Either.Either<unknown, ReadFailure> {
  if (!Array.isArray(value)) return malformedCompact('expected a variant row');
  const tag: unknown = value[0];
  const selected =
    typeof tag === 'number' && Number.isInteger(tag)
      ? layout.options[tag]
      : undefined;
  return selected === undefined
    ? malformedCompact('invalid variant index')
    : unpack(selected, value.slice(1), ids, budget);
}

function unpackArray(
  element: number,
  value: unknown,
  ids: readonly string[],
  budget: CompactBudget,
): Either.Either<unknown[], ReadFailure> {
  if (value === null || value === undefined) return Either.right([]);
  if (!Array.isArray(value)) return malformedCompact('expected a list');
  return Either.flatMap(compactLayout(element), (layout) => {
    if (hasColumns(layout))
      return unpackColumns(element, value, layout, ids, budget);
    if (value.length > compactRowLimit)
      return malformedCompact('too many list entries');
    const items: unknown[] = [];
    for (const item of value) {
      const decoded = unpack(element, item, ids, budget);
      if (Either.isLeft(decoded)) return Either.left(decoded.left);
      items.push(decoded.right);
    }
    return Either.right(items);
  });
}

function unpackColumns(
  element: number,
  value: readonly unknown[],
  layout: CompactLayout,
  ids: readonly string[],
  budget: CompactBudget,
): Either.Either<unknown[], ReadFailure> {
  const count = value[0];
  if (
    typeof count !== 'number' ||
    !Number.isInteger(count) ||
    count < 1 ||
    count > compactRowLimit
  ) {
    return malformedCompact('invalid row count');
  }
  if (value.length - 1 > rowWidth(layout))
    return malformedCompact('too many columns');
  const columns: unknown[][] = [];
  for (const column of value.slice(1)) {
    if (!Array.isArray(column) || column.length !== count)
      return malformedCompact('column length differs from row count');
    columns.push(column);
  }
  const items: unknown[] = [];
  for (let row = 0; row < count; row += 1) {
    const values = columns.map((column) => column[row]);
    while (values.at(-1) === null) values.pop();
    const decoded = unpack(element, values, ids, budget);
    if (Either.isLeft(decoded)) return Either.left(decoded.left);
    items.push(decoded.right);
  }
  return Either.right(items);
}

function rowWidth(layout: CompactLayout): number {
  if (layout.kind === 'object') return compactFields(layout).length;
  if (layout.kind !== 'variant') return 0;
  return (
    1 +
    layout.options.reduce((maximum, index) => {
      const option = compactLayouts[index];
      return option === undefined
        ? maximum
        : Math.max(maximum, rowWidth(option));
    }, 0)
  );
}
