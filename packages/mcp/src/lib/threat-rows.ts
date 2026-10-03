import { escapedForTerminal, quotedForTerminal } from '@saerskriven/formats';
import {
  acceptedTextSchema,
  assumptionSchema,
  elementIdSchema,
  mitigationSchema,
  recordsLinkedTo,
  severitySchema,
  threatCategorySchema,
  threatFlagSchema,
  threatFlags,
  threatIdSchema,
  threatStatusSchema,
  type Model,
  type Threat,
  type ThreatCategory,
  type ThreatFlag,
} from '@saerskriven/model';
import { Either } from 'effect';
import { z } from 'zod';
import { quotedList } from './reading.js';
import {
  appliesToModelQualifier,
  renderAssumption,
  renderMitigation,
  threatReadQualifiers,
} from './record-rows.js';

const threatRowSchema = z.object({
  number: z.int().positive(),
  id: threatIdSchema,
  title: acceptedTextSchema,
  status: threatStatusSchema,
  severity: severitySchema,
  category: threatCategorySchema,
  elements: z.array(elementIdSchema),
  appliesToModel: z
    .boolean()
    .describe('Whether the threat applies to the model as a whole.'),
  flags: z.array(threatFlagSchema),
});

/**
 * A threat row with its description and the mitigations and assumptions
 * linked to it, which is what a caller reads to judge the threat rather than
 * to find it.
 */
export const threatDetailSchema = threatRowSchema.extend({
  description: acceptedTextSchema.optional(),
  mitigations: z.array(mitigationSchema).optional(),
  assumptions: z.array(assumptionSchema).optional(),
});

/** One threat as a search carries it. */
export type ThreatDetail = z.infer<typeof threatDetailSchema>;

/** The identifying fields of one threat, and the flags `model` raises on it. */
export function threatRow(threat: Threat, model: Model): ThreatDetail {
  return {
    number: threat.number,
    id: threat.id,
    title: threat.title,
    status: threat.status,
    severity: threat.severity,
    category: threat.category,
    elements: threat.elements,
    appliesToModel: threat.appliesToModel,
    flags: threatFlags(model, threat),
  };
}

/** One threat row with its description and the records `model` links to it. */
export function threatDetail(threat: Threat, model: Model): ThreatDetail {
  return {
    ...threatRow(threat, model),
    description: threat.description,
    mitigations: recordsLinkedTo(model.mitigations, threat.id),
    assumptions: recordsLinkedTo(model.assumptions, threat.id),
  };
}

/**
 * The methodology and the category of a threat joined by a slash, such as
 * `STRIDE/tampering`. The names are the model's own values rather than the
 * display labels the markdown register writes, and a custom category is
 * named by its own methodology name. The `category` filter of
 * `saer_search_threats` compares against this, without case.
 */
export function categoryName(category: ThreatCategory): string {
  return category.methodology === 'custom'
    ? `${category.methodologyName}/${category.category}`
    : `${category.methodology}/${category.category}`;
}

/** {@link categoryName} as a text result carries it, escaped for a terminal. */
export function renderCategory(category: ThreatCategory): string {
  return escapedForTerminal(categoryName(category));
}

/**
 * The threat `ref` names by id, or else by its number as digits, or the
 * lines refusing a ref that names no threat of the model. An id is tried
 * first, so a model whose threat ids are digits is read by id.
 */
export function threatNamed(
  model: Model,
  ref: string,
): Either.Either<Threat, readonly string[]> {
  const found =
    model.threats.find((threat) => threat.id === ref) ??
    model.threats.find((threat) => String(threat.number) === ref);
  return found === undefined
    ? Either.left([
        `The model holds no threat ${quotedForTerminal(ref)}, by number or by id.`,
        `It holds ${String(model.threats.length)} threats. Call saer_search_threats for their numbers.`,
      ])
    : Either.right(found);
}

/**
 * The line a text result names one threat by: its number, its id and its
 * title. The caller supplies whatever precedes it, an indent or a word.
 */
export function threatHeadingLine(
  threat: Pick<Threat, 'number' | 'id' | 'title'>,
): string {
  return `${String(threat.number)} (${quotedForTerminal(threat.id)}): ${escapedForTerminal(threat.title)}`;
}

/**
 * One threat as the lines a text result carries: a heading line naming it,
 * and one indented line per field the row carries past the heading. The
 * first of them ends by saying where the threat applies to the model.
 */
export function renderThreat(row: ThreatDetail): readonly string[] {
  return [
    `  ${threatHeadingLine(row)}`,
    ...detailLines(row).map((line) => `    ${line}`),
  ];
}

/** What a flag on a threat read means, for the descriptions of the tools that read one. */
export const flagsDescription =
  "A flag says where a threat and its records disagree, for you to act on: `mitigated-without-implemented-work` is a `mitigated` threat with no linked mitigation `implemented` or `verified`, and `rests-on-invalidated-assumption` is a threat with a linked `invalidated` assumption. Flags are derived from threat links on every read, so an assumption's model link raises none, and a flag never changes a threat status.";

/** The flags a threat raises, as the one line a text result carries. */
export function renderFlags(flags: readonly ThreatFlag[]): string {
  return `flags: ${flags.length === 0 ? 'none' : flags.join(', ')}`;
}

function detailLines(row: ThreatDetail): readonly string[] {
  return [
    [
      `status ${row.status}`,
      `severity ${row.severity}`,
      `category ${renderCategory(row.category)}`,
      ...(row.appliesToModel ? [appliesToModelQualifier] : []),
    ].join(', '),
    `elements: ${quotedList(row.elements)}`,
    renderFlags(row.flags),
    ...(row.description === undefined || row.description.length === 0
      ? []
      : [`description: ${escapedForTerminal(row.description)}`]),
    ...(row.mitigations ?? []).flatMap((mitigation) => {
      const [heading = '', ...prose] = renderMitigation(mitigation);
      return [`mitigation ${heading}`, ...prose];
    }),
    ...(row.assumptions ?? []).map(
      (assumption) =>
        `assumption ${renderAssumption(assumption, threatReadQualifiers(assumption))}`,
    ),
  ];
}
