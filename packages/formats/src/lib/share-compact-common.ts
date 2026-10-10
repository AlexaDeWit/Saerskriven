import { Either } from 'effect';
import { ReadFailure } from './codec.js';
import { importBudget } from './import-budget.js';
import { compactLayouts } from './share-compact-layout.js';
import type { CompactLayout } from './share-compact-types.js';

/** The maximum rows in one column group in the experimental transport. */
export const compactRowLimit = 100_000;

/** A compact value that cannot reconstruct the frozen native projection. */
export function malformedCompact(
  message: string,
): Either.Either<never, ReadFailure> {
  return Either.left(
    ReadFailure.MalformedText({
      message: 'Invalid compact share data: ' + message,
    }),
  );
}

/** A frozen descriptor, never selected directly by untrusted data. */
export function compactLayout(
  index: number,
): Either.Either<CompactLayout, ReadFailure> {
  const held = compactLayouts[index];
  return held === undefined
    ? malformedCompact('unknown layout')
    : Either.right(held);
}

/** Whether a list of this layout is transposed into columns. */
export function hasColumns(layout: CompactLayout): boolean {
  return layout.kind === 'object' || layout.kind === 'variant';
}

/** Fields that consume payload slots. */
export function compactFields(
  layout: Extract<CompactLayout, { kind: 'object' }>,
) {
  return layout.fields.filter(
    (field) => compactLayouts[field.layout]?.kind !== 'literal',
  );
}

/** The discriminator value fixed by one variant's object layout. */
export function compactTag(
  index: number,
  discriminator: string,
): string | number | undefined {
  const layout = compactLayouts[index];
  if (layout?.kind !== 'object') return undefined;
  const field = layout.fields.find(
    (candidate) => candidate.name === discriminator,
  );
  const tag = field === undefined ? undefined : compactLayouts[field.layout];
  return tag?.kind === 'literal' ? tag.value : undefined;
}

/** A per-read budget for expanded ID references, keys, and decoded nodes. */
export function compactBudget() {
  const budget = importBudget();
  let nodes = 0;
  return {
    node: (): Either.Either<void, ReadFailure> => {
      nodes += 1;
      if (nodes > 1_000_000)
        return malformedCompact('too many expanded values');
      return Either.right(undefined);
    },
    key: (key: string): Either.Either<void, ReadFailure> => {
      budget.reservePath([key]);
      return budget.failure === undefined
        ? Either.right(undefined)
        : Either.left(budget.failure);
    },
    text: (text: string): Either.Either<string, ReadFailure> => {
      const kept = budget.text([text], '');
      return budget.failure === undefined
        ? Either.right(kept)
        : Either.left(budget.failure);
    },
  };
}

/** The state of one bounded compact expansion. */
export type CompactBudget = ReturnType<typeof compactBudget>;
