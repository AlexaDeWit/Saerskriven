import {
  strideCategorySchema,
  threatCountByElement,
  type DrawnElement,
  type Element,
  type StrideCategory,
} from '@saerskriven/model';
import { Result } from 'effect';
import { z } from 'zod';
import {
  elementDetail,
  elementsOnDiagrams,
  renderElement,
  type ElementOnDiagram,
} from './element-rows.js';
import { fileArgumentSchema } from './path-arguments.js';
import {
  PromptFailure,
  briefDataReminder,
  type PromptParts,
} from './prompt-result.js';
import {
  readNamed,
  renderReading,
  reportedReading,
  type ModelReading,
} from './reading.js';
import { renderThreat, threatRow } from './threat-rows.js';
import type { ModelWorkspace } from './workspace.js';

export const stridePassArgumentsSchema = fileArgumentSchema.extend({
  element: z
    .string()
    .describe(
      'The element to run the pass over, named by its id or its exact name. An id is tried first.',
    ),
});

export type StridePassArguments = z.infer<typeof stridePassArgumentsSchema>;

export const stridePassDescription =
  'Run a STRIDE pass over one element of a Saerskriven threat model: the questions that apply to its kind, with its flows, the stores those flows reach and the threats already recorded against it.';

type AnalyzedKind = Extract<
  Element['kind'],
  'actor' | 'process' | 'store' | 'flow'
>;

type StrideName = StrideCategory['category'];

/**
 * The STRIDE categories that apply to each kind of element, after the
 * STRIDE-per-element table: an external actor is spoofed or repudiates, a
 * store is tampered with, read, exhausted or left without a trail, and a flow
 * is tampered with, read or cut. A process is open to all six.
 */
export const strideByKind: Readonly<
  Record<AnalyzedKind, readonly StrideName[]>
> = {
  actor: ['spoofing', 'repudiation'],
  process: strideCategorySchema.shape.category.options,
  store: [
    'tampering',
    'repudiation',
    'information-disclosure',
    'denial-of-service',
  ],
  flow: ['tampering', 'information-disclosure', 'denial-of-service'],
};

const questions: Readonly<Record<StrideName, string>> = {
  spoofing:
    'Spoofing: can anything pretend to be this element, or pretend to be what it trusts, and what authenticates each side?',
  tampering:
    'Tampering: who can change what this element holds, carries or runs, and what detects a change?',
  repudiation:
    'Repudiation: can an action through this element be denied afterwards, and what record would settle it?',
  'information-disclosure':
    'Information disclosure: what could this element expose, to whom, and what keeps it confidential in transit and at rest?',
  'denial-of-service':
    'Denial of service: what exhausts, blocks or floods this element, and what depends on it staying up?',
  'elevation-of-privilege':
    'Elevation of privilege: can a caller make this element act with more authority than the caller holds?',
};

/**
 * The data and brief of a STRIDE pass over one element, or why there is
 * none.
 */
export function stridePass(
  workspace: ModelWorkspace,
  args: StridePassArguments,
): Result.Result<PromptParts, PromptFailure> {
  const read = Result.mapError(readNamed(workspace, args.file), () =>
    PromptFailure.NoModel(),
  );
  return Result.flatMap(read, (reading) => {
    const placed = elementsOnDiagrams(reading.model, reading.model.diagrams);
    return Result.flatMap(namedElement(placed, args.element), (chosen) =>
      Result.map(analyzedKind(chosen.element), (kind) => ({
        data: passData(reading, chosen, placed),
        brief: strideBrief(kind),
      })),
    );
  });
}

/**
 * The brief of a STRIDE pass over an element of one kind. It is built from
 * the kind alone, so no text out of a model file reaches it.
 */
export function strideBrief(kind: AnalyzedKind): readonly string[] {
  return [
    `Run a STRIDE pass over the ${kind} in the data above, using its flows, the stores they reach and the threats already recorded against it.`,
    'Answer each question for this element:',
    ...strideByKind[kind].map((category) => `- ${questions[category]}`),
    'Where the recorded threats do not already answer a question, propose a threat with its STRIDE category, a severity and the ids of the elements it attaches to. Record one with saer_edit only once the user agrees, quoting the revision in the data above.',
    briefDataReminder,
  ];
}

function passData(
  reading: ModelReading,
  chosen: ElementOnDiagram,
  placed: readonly ElementOnDiagram[],
): readonly string[] {
  const counts = threatCountByElement(reading.model);
  const rows = (elements: readonly ElementOnDiagram[]) =>
    elements.flatMap((one) => renderElement(elementDetail(one, counts)));
  const flows = flowsOf(chosen, placed);
  return [
    ...renderReading(reportedReading(reading)),
    'element:',
    ...rows([chosen]),
    'flows:',
    ...rows(flows),
    'stores the flows reach:',
    ...rows(storesReached(chosen, flows, placed)),
    'threats recorded against it:',
    ...reading.model.threats
      .filter((threat) => threat.elements.includes(chosen.element.id))
      .flatMap((threat) => renderThreat(threatRow(threat, reading.model))),
  ];
}

function namedElement(
  placed: readonly ElementOnDiagram[],
  named: string,
): Result.Result<ElementOnDiagram, PromptFailure> {
  const byId = placed.find((one) => one.element.id === named);
  if (byId !== undefined) {
    return Result.succeed(byId);
  }
  const byName = placed.filter((one) => one.element.name === named);
  const [only] = byName;
  if (only !== undefined && byName.length === 1) {
    return Result.succeed(only);
  }
  return Result.fail(
    byName.length === 0
      ? PromptFailure.NoSuchElement()
      : PromptFailure.SharedName(),
  );
}

function analyzedKind(
  element: DrawnElement,
): Result.Result<AnalyzedKind, PromptFailure> {
  return element.kind === 'trust-boundary' || element.kind === 'text'
    ? Result.fail(PromptFailure.UncoveredKind())
    : Result.succeed(element.kind);
}

function flowsOf(
  chosen: ElementOnDiagram,
  placed: readonly ElementOnDiagram[],
): ElementOnDiagram[] {
  return placed.filter(
    ({ element }) =>
      element.kind === 'flow' &&
      element.id !== chosen.element.id &&
      endpointsOf(element).includes(chosen.element.id),
  );
}

function storesReached(
  chosen: ElementOnDiagram,
  flows: readonly ElementOnDiagram[],
  placed: readonly ElementOnDiagram[],
): ElementOnDiagram[] {
  const reached = new Set(
    [chosen, ...flows].flatMap((one) => endpointsOf(one.element)),
  );
  return placed.filter(
    ({ element }) =>
      element.kind === 'store' &&
      element.id !== chosen.element.id &&
      reached.has(element.id),
  );
}

function endpointsOf(element: DrawnElement): readonly string[] {
  return element.kind === 'flow'
    ? [element.source, element.target].flatMap((endpoint) =>
        endpoint.kind === 'free' ? [] : [endpoint.element],
      )
    : [];
}
