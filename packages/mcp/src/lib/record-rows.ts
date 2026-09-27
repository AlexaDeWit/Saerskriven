import { escapedForTerminal, quotedForTerminal } from '@saerskriven/formats';
import {
  assumptionHasReference,
  assumptionSchema,
  mitigationHasReference,
  mitigationSchema,
  type Assumption,
  type Mitigation,
} from '@saerskriven/model';
import { z } from 'zod';
import { quotedList } from './reading.js';
import type { ResponseFormat } from './search.js';

const recordContextSchema = z.object({ unlinked: z.boolean() });

const mitigationRowSchema = mitigationSchema
  .extend({
    kind: z.literal('mitigation'),
    prose: mitigationSchema.shape.prose.optional(),
  })
  .extend(recordContextSchema.shape);

const assumptionRowSchema = assumptionSchema
  .extend({ kind: z.literal('assumption') })
  .extend(recordContextSchema.shape);

/**
 * One mitigation or assumption as a record search carries it: the whole
 * record under its kind, with `unlinked` true where it is linked to nothing.
 * A concise row leaves out a mitigation's `prose` and keeps an assumption's,
 * which is the only text an assumption has.
 */
export const recordRowSchema = z.discriminatedUnion('kind', [
  mitigationRowSchema,
  assumptionRowSchema,
]);

/** One record as a record search carries it. */
export type RecordRow = z.infer<typeof recordRowSchema>;

/** A whole mitigation or assumption under its kind, as a record search filters it. */
export type KindedRecord =
  | (Mitigation & { readonly kind: 'mitigation' })
  | (Assumption & { readonly kind: 'assumption' });

/**
 * One record as a search in `format` carries it: the whole record, less a
 * mitigation's prose where the search is concise, and whether it is linked
 * to nothing.
 */
export function recordRow(
  record: KindedRecord,
  format: ResponseFormat,
): RecordRow {
  const unlinked = linkedToNothing(record);
  return record.kind === 'assumption' || format === 'detailed'
    ? { ...record, unlinked }
    : {
        kind: record.kind,
        id: record.id,
        title: record.title,
        status: record.status,
        threats: record.threats,
        unlinked,
      };
}

/**
 * Whether a record is linked to nothing: a mitigation linking no threat, or
 * an assumption linking no threat that does not apply to the model.
 */
export function linkedToNothing(record: KindedRecord): boolean {
  return record.kind === 'mitigation'
    ? !mitigationHasReference(record)
    : !assumptionHasReference(record);
}

/**
 * One mitigation as the lines a text result carries: its id, its status
 * with any `qualifiers` after it, and its title, then its prose indented
 * beneath where it has any.
 */
export function renderMitigation(
  mitigation: Mitigation,
  qualifiers: readonly string[] = [],
): readonly string[] {
  return [
    `${recordHeading(mitigation, qualifiers)}: ${escapedForTerminal(mitigation.title)}`,
    ...(mitigation.prose === ''
      ? []
      : [`  ${escapedForTerminal(mitigation.prose)}`]),
  ];
}

/**
 * One assumption as the line a text result carries: its id, its status
 * with any `qualifiers` after it, and its prose.
 */
export function renderAssumption(
  assumption: Assumption,
  qualifiers: readonly string[] = [],
): string {
  return `${recordHeading(assumption, qualifiers)}: ${escapedForTerminal(assumption.prose)}`;
}

/**
 * The qualifier an assumption read on a threat carries where it also
 * applies to the model, for {@link renderAssumption}.
 */
export function threatReadQualifiers(
  assumption: Pick<Assumption, 'appliesToModel'>,
): readonly string[] {
  return assumption.appliesToModel ? ['also applies to the model'] : [];
}

/**
 * One record of a record search as the lines its text result carries: its
 * kind and the lines of its renderer, whose heading says where an
 * assumption applies to the model and where the record is linked to
 * nothing, then the threats it links. A mitigation's prose, where the row
 * carries it, comes after the threats and one level deeper.
 */
export function renderRecord(row: RecordRow): readonly string[] {
  const qualifiers = [
    ...(row.kind === 'assumption' && row.appliesToModel
      ? ['applies to the model']
      : []),
    ...(row.unlinked ? ['linked to nothing'] : []),
  ];
  const threats = `    threats: ${quotedList(row.threats)}`;
  if (row.kind === 'assumption') {
    return [`  assumption ${renderAssumption(row, qualifiers)}`, threats];
  }
  const [heading = '', ...prose] = renderMitigation(
    { ...row, prose: row.prose ?? '' },
    qualifiers,
  );
  return [
    `  mitigation ${heading}`,
    threats,
    ...prose.map((line) => `    ${line}`),
  ];
}

function recordHeading(
  record: { readonly id: string; readonly status: string },
  qualifiers: readonly string[],
): string {
  return `${quotedForTerminal(record.id)} (${[record.status, ...qualifiers].join(', ')})`;
}
