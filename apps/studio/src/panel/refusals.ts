import { useState } from 'react';
import type { RefusedDraft } from '../ui/text-field.js';
import type { RecordFieldName } from './records.js';

const textFields = ['Title', 'Description'] as const;

type TextFieldName = (typeof textFields)[number] | RecordFieldName;

/** A refused draft, and the status picked in the empty record row it was typed in, if it was typed in one. */
export type RefusedText = RefusedDraft & { readonly status?: string };

/** A refused draft with the field it was typed in, which is what puts it back. */
export type RefusedField = RefusedText & { readonly field: TextFieldName };

type Refusals = ReadonlyMap<TextFieldName, RefusedText>;

type RefusalChange = readonly [TextFieldName, RefusedText | undefined];

/** The draft held for `field`, where the held refusal was typed there. */
export function draftIn(
  held: RefusedField | undefined,
  field: TextFieldName,
): string | undefined {
  return held?.field === field ? held.text : undefined;
}

/**
 * The refusals one editor's text fields hold. Every note reports to
 * `onRefusal` the first refusal still held, Title then Description ahead of a
 * record's, which is the draft the panel keeps once the editor is gone.
 */
export function useRefusals(
  onRefusal: (refused: RefusedField | undefined) => void,
): {
  readonly refusals: Refusals;
  readonly note: (changes: readonly RefusalChange[]) => void;
  readonly refused: (
    field: TextFieldName,
  ) => (draft: RefusedDraft | undefined) => void;
} {
  const [refusals, setRefusals] = useState<Refusals>(new Map());

  const note = (changes: readonly RefusalChange[]): void => {
    const noted = new Map(refusals);
    for (const [field, draft] of changes) {
      if (draft === undefined) {
        noted.delete(field);
      } else {
        noted.set(field, draft);
      }
    }
    if (
      changes.some(
        ([field, draft]) => draft !== undefined || refusals.has(field),
      )
    ) {
      setRefusals(noted);
    }
    onRefusal(firstRefusal(noted));
  };

  return {
    refusals,
    note,
    refused: (field) => (draft) => {
      note([[field, draft]]);
    },
  };
}

function firstRefusal(refusals: Refusals): RefusedField | undefined {
  const field =
    textFields.find((name) => refusals.has(name)) ??
    refusals.keys().next().value;
  const draft = field === undefined ? undefined : refusals.get(field);
  return field === undefined || draft === undefined
    ? undefined
    : { field, ...draft };
}
