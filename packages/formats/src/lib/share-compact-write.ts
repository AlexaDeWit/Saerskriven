import type { SaerskrivenYamlV2Document } from '@saerskriven/wire-saerskriven-yaml-v2';
import { Either } from 'effect';
import type { ReadFailure } from './codec.js';
import { withinTextLimit } from './read-limits.js';
import { isRecord } from './records.js';
import {
  compactLayout,
  compactRowLimit,
  compactTag,
  hasColumns,
  malformedCompact,
} from './share-compact-common.js';
import { compactLayouts, compactRoot } from './share-compact-layout.js';
import type { CompactLayout } from './share-compact-types.js';

/** A native version 2 document in the frozen compact transport layout. */
export function writeCompactDocument(
  document: SaerskrivenYamlV2Document,
): Either.Either<string, ReadFailure> {
  const ids = [
    ...new Set([
      ...document.assumptions.map((record) => record.id),
      ...document.diagrams.flatMap((diagram) => [
        diagram.id,
        ...diagram.elements.map((element) => element.id),
      ]),
      ...document.mitigations.map((record) => record.id),
      ...document.threats.map((record) => record.id),
    ]),
  ];
  if (ids.length > compactRowLimit)
    return malformedCompact('too many identifiers');
  const references = new Map(ids.map((id, index) => [id, index]));
  return Either.flatMap(pack(compactRoot, document, references), (data) =>
    withinTextLimit(JSON.stringify([ids, data])),
  );
}

function pack(
  index: number,
  value: unknown,
  ids: ReadonlyMap<string, number>,
): Either.Either<unknown, ReadFailure> {
  return Either.flatMap(compactLayout(index), (layout) =>
    packAs(layout, value, ids),
  );
}

function packAs(
  layout: CompactLayout,
  value: unknown,
  ids: ReadonlyMap<string, number>,
): Either.Either<unknown, ReadFailure> {
  switch (layout.kind) {
    case 'object':
      return packObject(layout, value, ids);
    case 'array':
      return packArray(layout.element, value, ids);
    case 'variant':
      return packVariant(layout, value, ids);
    case 'optional':
      return value === undefined
        ? Either.right(null)
        : Either.map(pack(layout.value, value, ids), (held) => [held]);
    case 'literal':
      return value === layout.value
        ? Either.right(value)
        : malformedCompact('unexpected literal');
    case 'enum': {
      const index =
        typeof value === 'string' ? layout.values.indexOf(value) : -1;
      return index >= 0
        ? Either.right(index)
        : malformedCompact('unknown enum value');
    }
    case 'string':
      return typeof value === 'string'
        ? Either.right(value === '' ? null : (ids.get(value) ?? value))
        : malformedCompact('expected text');
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
        ? Either.right(Object.is(value, -0) ? '-0' : value)
        : malformedCompact('expected a finite number');
    case 'boolean':
      return typeof value === 'boolean'
        ? Either.right(value ? 1 : 0)
        : malformedCompact('expected a boolean');
    default:
      return malformedCompact('unknown layout');
  }
}

function packObject(
  layout: Extract<CompactLayout, { kind: 'object' }>,
  value: unknown,
  ids: ReadonlyMap<string, number>,
): Either.Either<unknown[], ReadFailure> {
  if (!isRecord(value)) return malformedCompact('expected an object');
  const known = new Set(layout.fields.map((field) => field.name));
  if (Object.keys(value).some((key) => !known.has(key)))
    return malformedCompact('a field is outside the frozen layout');
  const row: unknown[] = [];
  for (const field of layout.fields) {
    const held = pack(field.layout, value[field.name], ids);
    if (Either.isLeft(held)) return Either.left(held.left);
    if (compactLayouts[field.layout]?.kind !== 'literal') row.push(held.right);
  }
  while (row.length > 0 && row.at(-1) === null) row.pop();
  return Either.right(row);
}

function packVariant(
  layout: Extract<CompactLayout, { kind: 'variant' }>,
  value: unknown,
  ids: ReadonlyMap<string, number>,
): Either.Either<unknown[], ReadFailure> {
  if (!isRecord(value)) return malformedCompact('expected a variant');
  const tag = layout.options.findIndex(
    (option) =>
      compactTag(option, layout.discriminator) === value[layout.discriminator],
  );
  const selected = layout.options[tag];
  if (selected === undefined) return malformedCompact('unknown variant');
  return Either.flatMap(pack(selected, value, ids), (row) => {
    if (!Array.isArray(row)) return malformedCompact('invalid variant row');
    const values: unknown[] = row;
    return Either.right([tag, ...values]);
  });
}

function packArray(
  element: number,
  value: unknown,
  ids: ReadonlyMap<string, number>,
): Either.Either<unknown, ReadFailure> {
  if (!Array.isArray(value) || value.length > compactRowLimit)
    return malformedCompact('invalid list length');
  if (value.length === 0) return Either.right(null);
  const rows: unknown[] = [];
  for (const item of value) {
    const held = pack(element, item, ids);
    if (Either.isLeft(held)) return Either.left(held.left);
    rows.push(held.right);
  }
  return Either.flatMap(compactLayout(element), (layout) => {
    if (!hasColumns(layout)) return Either.right(rows);
    const records: unknown[][] = [];
    for (const row of rows) {
      if (!Array.isArray(row)) return malformedCompact('invalid column row');
      records.push(row);
    }
    const width = records.reduce(
      (maximum, row) => Math.max(maximum, row.length),
      0,
    );
    const columns: unknown[] = [records.length];
    for (let slot = 0; slot < width; slot += 1) {
      columns.push(records.map((row) => row[slot] ?? null));
    }
    return Either.right(columns);
  });
}
