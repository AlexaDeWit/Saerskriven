import type { z } from 'zod';
import { drawnElement } from './drawing.js';
import type { Element } from './elements.js';
import type { ElementId } from './ids.js';
import type { modelSchema } from './model.js';
import type { ParseIssue, ParseIssueCode } from './parse-issue.js';
import { elementsById, endpointViolationsOf } from './references.js';
import { relationshipIssues } from './relationships.js';

type StructuralModel = z.infer<typeof modelSchema>;

/**
 * What the model's own rules refuse in a structurally valid model: unique
 * identities, one placement of every element that fits it, issuance
 * bookkeeping, and references local to the diagram drawing an element.
 * Elements sharing an id pair with that id's placements in turn, in diagram
 * order, so each copy is checked on the diagram that draws it and a repeated
 * id reports only as a duplicate id.
 */
export function collectViolations(model: StructuralModel): ParseIssue[] {
  const drawings = drawingsOf(model);
  return [
    ...elementIdViolations(model),
    ...diagramIdViolations(model),
    ...placementViolations(model, drawings),
    ...unplacedViolations(model),
    ...threatNumberViolations(model),
    ...lastIssuedThreatNumberViolations(model),
    ...recordIdViolations(model),
    ...flowEndpointViolations(model, drawings),
    ...referenceViolations(model),
    ...relationshipViolations(model, drawings),
  ];
}

/**
 * `schema`, refusing beside its own issues each issue `violationsOf` finds
 * in the value it parsed. The check runs after any issue that leaves the
 * value whole, a refused character or a short id, so one parse reports both.
 */
export function refusingViolations<Output>(
  schema: z.ZodType<Output>,
  violationsOf: (value: Output) => readonly ParseIssue[],
): z.ZodType<Output> {
  return schema.superRefine((value, ctx) => {
    for (const violation of violationsOf(value)) {
      ctx.addIssue({
        code: 'custom',
        path: [...violation.path],
        params: violation.detail,
      });
    }
  });
}

function duplicateViolations<T>(
  items: readonly T[],
  keyOf: (item: T) => PropertyKey,
  violationOf: (item: T, index: number) => ParseIssue,
): ParseIssue[] {
  const seen = new Set<PropertyKey>();
  const violations: ParseIssue[] = [];
  items.forEach((item, index) => {
    const key = keyOf(item);
    if (seen.has(key)) {
      violations.push(violationOf(item, index));
    }
    seen.add(key);
  });
  return violations;
}

function elementIdViolations(model: StructuralModel): ParseIssue[] {
  return duplicateViolations(
    model.elements,
    (element) => element.id,
    (element, index) => ({
      path: ['elements', index, 'id'],
      detail: {
        code: 'duplicate-element-id',
        parameters: { id: element.id },
      },
    }),
  );
}

function diagramIdViolations(model: StructuralModel): ParseIssue[] {
  return duplicateViolations(
    model.diagrams,
    (diagram) => diagram.id,
    (diagram, index) => ({
      path: ['diagrams', index, 'id'],
      detail: {
        code: 'duplicate-diagram-id',
        parameters: { id: diagram.id },
      },
    }),
  );
}

function threatNumberViolations(model: StructuralModel): ParseIssue[] {
  return duplicateViolations(
    model.threats,
    (threat) => threat.number,
    (threat, index) => ({
      path: ['threats', index, 'number'],
      detail: {
        code: 'duplicate-threat-number',
        parameters: { number: threat.number },
      },
    }),
  );
}

function lastIssuedThreatNumberViolations(
  model: StructuralModel,
): ParseIssue[] {
  const highest = model.threats.reduce(
    (max, threat) => Math.max(max, threat.number),
    0,
  );
  return highest > model.lastIssuedThreatNumber
    ? [
        {
          path: ['lastIssuedThreatNumber'],
          detail: {
            code: 'threat-number-above-issued',
            parameters: {
              number: highest,
              issued: model.lastIssuedThreatNumber,
            },
          },
        },
      ]
    : [];
}

function recordIdViolations(model: StructuralModel): ParseIssue[] {
  return [
    ...duplicateRecordIds(
      model.threats.map((threat) => threat.id),
      'threats',
      'duplicate-threat-id',
    ),
    ...duplicateRecordIds(
      model.mitigations.map((mitigation) => mitigation.id),
      'mitigations',
      'duplicate-mitigation-id',
    ),
    ...duplicateRecordIds(
      model.assumptions.map((assumption) => assumption.id),
      'assumptions',
      'duplicate-assumption-id',
    ),
  ];
}

function duplicateRecordIds(
  ids: readonly string[],
  collection: 'threats' | 'mitigations' | 'assumptions',
  code: Extract<ParseIssueCode, `duplicate-${string}-id`>,
): ParseIssue[] {
  return duplicateViolations(
    ids,
    (id) => id,
    (id, index) => ({
      path: [collection, index, 'id'],
      detail: { code, parameters: { id } },
    }),
  );
}

type Drawings = {
  readonly diagramOf: readonly (number | undefined)[];
  readonly drawnBy: readonly (readonly (Element | undefined)[])[];
  readonly neighbours: readonly ReadonlyMap<ElementId, Element>[];
};

function drawingsOf(model: StructuralModel): Drawings {
  const queued = new Map<ElementId, [number, number][]>();
  model.diagrams.forEach((diagram, diagramIndex) => {
    diagram.placements.forEach(({ element }, placementIndex) => {
      const queue = queued.get(element) ?? [];
      queue.push([diagramIndex, placementIndex]);
      queued.set(element, queue);
    });
  });
  const drawnBy = model.diagrams.map(({ placements }) =>
    placements.map((): Element | undefined => undefined),
  );
  const diagramOf = model.elements.map((element) => {
    const drawing = queued.get(element.id)?.shift();
    if (drawing === undefined) {
      return undefined;
    }
    const [diagramIndex, placementIndex] = drawing;
    drawnBy[diagramIndex][placementIndex] = element;
    return diagramIndex;
  });
  const elements = elementsById(model.elements);
  const neighbours = model.diagrams.map(
    ({ placements }, diagramIndex) =>
      new Map(
        placements.flatMap(({ element: id }, placementIndex) => {
          const element =
            drawnBy[diagramIndex][placementIndex] ?? elements.get(id);
          return element === undefined ? [] : [[id, element] as const];
        }),
      ),
  );
  return { diagramOf, drawnBy, neighbours };
}

function placementViolations(
  model: StructuralModel,
  { drawnBy }: Drawings,
): ParseIssue[] {
  const known = new Set<string>(model.elements.map(({ id }) => id));
  return model.diagrams.flatMap((diagram, diagramIndex) =>
    diagram.placements.flatMap((placement, placementIndex): ParseIssue[] => {
      const path = ['diagrams', diagramIndex, 'placements', placementIndex];
      const id = placement.element;
      const element = drawnBy[diagramIndex][placementIndex];
      if (element === undefined) {
        return [
          {
            path: [...path, 'element'],
            detail: {
              code: known.has(id)
                ? 'duplicate-placement'
                : 'placement-element-unknown',
              parameters: { id },
            },
          },
        ];
      }
      return drawnElement(element, placement) === undefined
        ? [
            {
              path,
              detail: {
                code: 'placement-geometry-mismatch',
                parameters: { id },
              },
            },
          ]
        : [];
    }),
  );
}

function unplacedViolations(model: StructuralModel): ParseIssue[] {
  const placed = new Set<string>(
    model.diagrams.flatMap((diagram) =>
      diagram.placements.map(({ element }) => element),
    ),
  );
  return model.elements.flatMap((element, index): ParseIssue[] =>
    placed.has(element.id)
      ? []
      : [
          {
            path: ['elements', index],
            detail: {
              code: 'element-unplaced',
              parameters: { id: element.id },
            },
          },
        ],
  );
}

function flowEndpointViolations(
  model: StructuralModel,
  { diagramOf, neighbours }: Drawings,
): ParseIssue[] {
  return model.elements.flatMap((element, elementIndex) => {
    const diagramIndex = diagramOf[elementIndex];
    if (element.kind !== 'flow' || diagramIndex === undefined) {
      return [];
    }
    const drawnWith = new Set(neighbours[diagramIndex].keys());
    return endpointViolationsOf(element, drawnWith).map(
      ({ side, reference, reason }): ParseIssue => ({
        path: ['elements', elementIndex, side, 'element'],
        detail: {
          code:
            reason === 'self-anchored'
              ? 'flow-endpoint-self'
              : 'flow-endpoint-foreign',
          parameters: { id: reference },
        },
      }),
    );
  });
}

function referenceViolations(model: StructuralModel): ParseIssue[] {
  const elementIds = new Set<string>(model.elements.map(({ id }) => id));
  const threatIds = new Set<string>(model.threats.map((threat) => threat.id));
  const references = [
    {
      collection: 'threats',
      field: 'elements',
      code: 'unknown-element-reference',
      known: elementIds,
      idLists: model.threats.map((threat) => threat.elements),
    },
    {
      collection: 'mitigations',
      field: 'threats',
      code: 'unknown-threat-reference',
      known: threatIds,
      idLists: model.mitigations.map((mitigation) => mitigation.threats),
    },
    {
      collection: 'assumptions',
      field: 'threats',
      code: 'unknown-threat-reference',
      known: threatIds,
      idLists: model.assumptions.map((assumption) => assumption.threats),
    },
  ] as const;
  return references.flatMap(({ collection, field, code, known, idLists }) =>
    idLists.flatMap((ids, recordIndex) =>
      ids.flatMap((id, idIndex): ParseIssue[] =>
        known.has(id)
          ? []
          : [
              {
                path: [collection, recordIndex, field, idIndex],
                detail: { code, parameters: { id } },
              },
            ],
      ),
    ),
  );
}

function relationshipViolations(
  model: StructuralModel,
  { diagramOf, neighbours }: Drawings,
): ParseIssue[] {
  return model.elements.flatMap((element, elementIndex) => {
    const diagramIndex = diagramOf[elementIndex];
    return diagramIndex === undefined
      ? []
      : relationshipIssues(element, neighbours[diagramIndex]).map(
          (issue): ParseIssue => ({
            path: ['elements', elementIndex, ...issue.path],
            detail: issue.detail,
          }),
        );
  });
}
