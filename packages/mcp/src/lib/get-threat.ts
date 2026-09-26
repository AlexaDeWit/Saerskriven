import { escapedForTerminal, quotedForTerminal } from '@saerskriven/formats';
import {
  assumptionSchema,
  mitigationSchema,
  recordsLinkedTo,
  threatCountByElement,
  threatFlagSchema,
  threatFlags,
  threatSchema,
  type Model,
  type Threat,
} from '@saerskriven/model';
import { Either } from 'effect';
import { z } from 'zod';
import {
  elementDetail,
  elementDetailSchema,
  elementsOnDiagrams,
  renderElement,
} from './element-rows.js';
import { fileArgumentSchema } from './inspect.js';
import {
  readNamed,
  readingSchema,
  renderReading,
  reportedReading,
  type ModelReading,
} from './reading.js';
import {
  flagsDescription,
  renderAssumption,
  renderCategory,
  renderFlags,
  renderMitigation,
  threatHeadingLine,
} from './threat-rows.js';
import type { ModelWorkspace } from './workspace.js';

/** What `saer_get_threat` takes. */
export const getThreatArgumentsSchema = fileArgumentSchema.extend({
  ref: z
    .string()
    .describe(
      'Which threat to read: its number as digits, or its id. An id is tried first, so a model whose threat ids are digits is read by id rather than by number.',
    ),
});

/** What `saer_get_threat` takes. */
export type GetThreatArguments = z.infer<typeof getThreatArgumentsSchema>;

/** What `saer_get_threat` answers with. */
export const getThreatResultSchema = readingSchema.extend({
  threat: threatSchema,
  flags: z.array(threatFlagSchema),
  elements: z.array(elementDetailSchema),
  mitigations: z.array(mitigationSchema),
  assumptions: z.array(assumptionSchema),
});

/** What `saer_get_threat` answers with. */
export type GetThreatResult = z.infer<typeof getThreatResultSchema>;

/** What `saer_get_threat` tells a client it is for. */
export const getThreatDescription = [
  'Read one threat of a Saerskriven threat model in full: the whole record, the flags its records raise, the elements it attaches to, the mitigation records addressing it, and the assumption records its analysis rests on, each assumption saying whether it also applies to the model.',
  flagsDescription,
  'Use this once you know which threat you mean. Find that threat with saer_search_threats, which takes the filters and carries the numbers, and use saer_register where you want every threat rather than one.',
  'Pass `ref` as the threat number or the threat id. Pass `file` as a path relative to the server root, or leave it out where the server was started with a default model.',
  'A ref naming no threat of the model is refused with the count of threats it holds rather than answered with an empty record. This tool never writes.',
].join(' ');

/**
 * One threat with everything the model links to it, or the lines saying why
 * there is no such threat. The mitigations and assumptions are the ones
 * naming this threat, which is a link the threat record itself does not
 * carry.
 */
export function getThreat(
  workspace: ModelWorkspace,
  args: GetThreatArguments,
): Either.Either<GetThreatResult, readonly string[]> {
  return Either.flatMap(readNamed(workspace, args.file), (reading) =>
    Either.map(threatOf(reading.model, args.ref), (threat) =>
      recorded(reading, threat),
    ),
  );
}

/** The threat as the lines its text result carries. */
export function renderThreatRecord(result: GetThreatResult): readonly string[] {
  const { threat } = result;
  return [
    ...renderReading(result),
    `threat ${threatHeadingLine(threat)}`,
    `status: ${threat.status}`,
    `severity: ${threat.severity}`,
    `category: ${renderCategory(threat.category)}`,
    renderFlags(result.flags),
    `description: ${escapedForTerminal(threat.description)}`,
    'elements:',
    ...result.elements.flatMap(renderElement),
    'mitigations:',
    ...result.mitigations.flatMap((mitigation) =>
      renderMitigation(mitigation).map((line) => `  ${line}`),
    ),
    'assumptions:',
    ...result.assumptions.map(
      (assumption) => `  ${renderAssumption(assumption, 'threat')}`,
    ),
  ];
}

function threatOf(
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

function recorded(reading: ModelReading, threat: Threat): GetThreatResult {
  const { model } = reading;
  const attached = new Set<string>(threat.elements);
  const counts = threatCountByElement(model);
  return {
    ...reportedReading(reading),
    threat,
    flags: threatFlags(model, threat),
    elements: elementsOnDiagrams(model.diagrams)
      .filter((placed) => attached.has(placed.element.id))
      .map((placed) => elementDetail(placed, counts)),
    mitigations: recordsLinkedTo(model.mitigations, threat.id),
    assumptions: recordsLinkedTo(model.assumptions, threat.id),
  };
}
