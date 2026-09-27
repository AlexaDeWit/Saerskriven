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

const mitigationRowSchema = mitigationSchema.extend({
  kind: z.literal('mitigation'),
  prose: mitigationSchema.shape.prose.optional(),
});

const assumptionRowSchema = assumptionSchema.extend({
  kind: z.literal('assumption'),
  prose: assumptionSchema.shape.prose.optional(),
});

/**
 * One mitigation or assumption as a record search carries it: the whole
 * record under its kind, with `prose` left out of a concise row.
 */
export const recordRowSchema = z.discriminatedUnion('kind', [
  mitigationRowSchema,
  assumptionRowSchema,
]);

/** One record as a record search carries it. */
export type RecordRow = z.infer<typeof recordRowSchema>;

/** A whole mitigation or assumption under its kind, the detailed row of a record search. */
export type KindedRecord =
  | (Mitigation & { readonly kind: 'mitigation' })
  | (Assumption & { readonly kind: 'assumption' });

/** The identifying fields of one record: every field but its prose. */
export function recordRow(record: KindedRecord): RecordRow {
  return record.kind === 'mitigation'
    ? {
        kind: record.kind,
        id: record.id,
        title: record.title,
        status: record.status,
        threats: record.threats,
      }
    : {
        kind: record.kind,
        id: record.id,
        status: record.status,
        threats: record.threats,
        appliesToModel: record.appliesToModel,
      };
}

/**
 * Whether a record is linked to nothing: a mitigation linking no threat, or
 * an assumption linking no threat that does not apply to the model.
 */
export function linkedToNothing(record: RecordRow): boolean {
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
 * One assumption as the line a text result carries: its id, status and
 * prose. Read on a threat, the line also says where the assumption applies
 * to the model.
 */
export function renderAssumption(
  assumption: Assumption,
  readOn: 'threat' | 'model',
): string {
  const scope =
    readOn === 'threat' && assumption.appliesToModel
      ? ['also applies to the model']
      : [];
  return `${recordHeading(assumption, scope)}: ${escapedForTerminal(assumption.prose)}`;
}

/**
 * One record of a record search as the lines its text result carries: its
 * kind and heading, which says where an assumption applies to the model and
 * where the record is linked to nothing, then the threats it links. A
 * detailed row adds the prose, as {@link renderMitigation} and
 * {@link renderAssumption} place it.
 */
export function renderRecord(row: RecordRow): readonly string[] {
  const qualifiers = [
    ...(row.kind === 'assumption' && row.appliesToModel
      ? ['applies to the model']
      : []),
    ...(linkedToNothing(row) ? ['linked to nothing'] : []),
  ];
  const threats = `    threats: ${quotedList(row.threats)}`;
  if (row.kind === 'assumption') {
    const heading = recordHeading(row, qualifiers);
    return [
      `  assumption ${row.prose === undefined ? heading : `${heading}: ${escapedForTerminal(row.prose)}`}`,
      threats,
    ];
  }
  const [heading = '', ...prose] = renderMitigation(
    { ...row, prose: row.prose ?? '' },
    qualifiers,
  );
  return [
    `  mitigation ${heading}`,
    threats,
    ...prose.map((line) => `  ${line}`),
  ];
}

function recordHeading(
  record: { readonly id: string; readonly status: string },
  qualifiers: readonly string[],
): string {
  return `${quotedForTerminal(record.id)} (${[record.status, ...qualifiers].join(', ')})`;
}
