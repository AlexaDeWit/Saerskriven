import { escapedForTerminal } from '@saerskriven/formats';
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
  type Assumption,
  type Mitigation,
  type Model,
  type Threat,
  type ThreatCategory,
  type ThreatFlag,
} from '@saerskriven/model';
import { z } from 'zod';

/**
 * What every threat row names: the number and id a further call passes, its
 * title, where it stands, how bad it is, its category, the elements it
 * attaches to, and the flags its records raise.
 */
export const threatRowSchema = z.object({
  number: z.int().positive(),
  id: threatIdSchema,
  title: acceptedTextSchema,
  status: threatStatusSchema,
  severity: severitySchema,
  category: threatCategorySchema,
  elements: z.array(elementIdSchema),
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
 * The methodology and the category of a threat as one word pair. The names
 * are the model's own values rather than the display labels the markdown
 * register writes, so what a text result names is what a `category` filter
 * takes.
 */
export function renderCategory(category: ThreatCategory): string {
  return category.methodology === 'custom'
    ? `${escapedForTerminal(category.methodologyName)}/${escapedForTerminal(category.category)}`
    : `${category.methodology}/${category.category}`;
}

/**
 * One threat as the lines a text result carries: a heading line naming it,
 * and one indented line per field the row carries past the heading.
 */
export function renderThreat(row: ThreatDetail): readonly string[] {
  return [
    `  ${String(row.number)} (${row.id}): ${escapedForTerminal(row.title)}`,
    ...detailLines(row).map((line) => `    ${line}`),
  ];
}

/**
 * One mitigation as the lines a text result carries: its id, status and
 * title, then its prose indented beneath where it has any.
 */
export function renderMitigation(mitigation: Mitigation): readonly string[] {
  return [
    `${mitigation.id} (${mitigation.status}): ${escapedForTerminal(mitigation.title)}`,
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
      ? ', also applies to the model'
      : '';
  return `${assumption.id} (${assumption.status}${scope}): ${escapedForTerminal(assumption.prose)}`;
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
    `status ${row.status}, severity ${row.severity}, category ${renderCategory(row.category)}`,
    `elements: ${row.elements.length === 0 ? 'none' : row.elements.join(', ')}`,
    renderFlags(row.flags),
    ...(row.description === undefined || row.description.length === 0
      ? []
      : [`description: ${escapedForTerminal(row.description)}`]),
    ...(row.mitigations ?? []).flatMap((mitigation) => {
      const [heading = '', ...prose] = renderMitigation(mitigation);
      return [`mitigation ${heading}`, ...prose];
    }),
    ...(row.assumptions ?? []).map(
      (assumption) => `assumption ${renderAssumption(assumption, 'threat')}`,
    ),
  ];
}
