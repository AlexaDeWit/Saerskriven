import type { z } from 'zod';
import { drawnElement } from './drawing.js';
import type { DrawnElement } from './drawn-elements.js';
import type { Element } from './elements.js';
import type { ElementId } from './ids.js';
import type { modelSchema } from './model.js';
import type { ParseIssue, ParseIssueCode } from './parse-issue.js';
import type { Placement } from './placements.js';
import { elementsById } from './references.js';
import { relationshipIssues } from './relationships.js';

type StructuralModel = z.infer<typeof modelSchema>;

/**
 * Where a boundary's and a flow's relationship lists resolve: anywhere in the
 * model, or among the elements of the diagrams placing the element that
 * holds the list, the rule a read of a format with no shared elements keeps.
 */
export type RelationshipScope = 'model' | 'diagram';

/**
 * What the model's own rules refuse in a structurally valid model: unique
 * identities, a placement of every element that fits it, at most one on each
 * diagram, issuance bookkeeping, flow ends each diagram can draw, and
 * relationship lists resolving within `scope`. An element whose id no other
 * element holds draws each of its placements. Each element sharing an id
 * pairs with the first of that id's placements left, in diagram order, whose
 * geometry fits it, or with the first left where none fits, so copies placed
 * once each report only as a duplicate id.
 */
export function collectViolations(
  model: StructuralModel,
  scope: RelationshipScope = 'model',
): ParseIssue[] {
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
    ...relationshipViolations(model, drawings, scope),
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

type Drawing = {
  readonly diagram: number;
  readonly placement: Placement;
};

type Drawings = {
  readonly elementDrawings: readonly (readonly Drawing[])[];
  readonly drawnBy: readonly (readonly (Element | undefined)[])[];
  readonly neighbours: readonly ReadonlyMap<ElementId, Element>[];
};

function drawingsOf(model: StructuralModel): Drawings {
  const queued = new Map<ElementId, [number, number][]>();
  model.diagrams.forEach((diagram, diagramIndex) => {
    diagram.placements.forEach(({ element }, placementIndex) => {
      queued.set(element, [
        ...(queued.get(element) ?? []),
        [diagramIndex, placementIndex],
      ]);
    });
  });
  const copies = new Map<ElementId, number>();
  for (const { id } of model.elements) {
    copies.set(id, (copies.get(id) ?? 0) + 1);
  }
  const drawnBy = model.diagrams.map(({ placements }) =>
    placements.map((): Element | undefined => undefined),
  );
  const elementDrawings = model.elements.map((element): Drawing[] => {
    const queue = queued.get(element.id) ?? [];
    const taken =
      copies.get(element.id) === 1
        ? onEachDiagramOnce(queue)
        : firstFitting(element, queue, model);
    return taken.map(([diagramIndex, placementIndex]) => {
      drawnBy[diagramIndex][placementIndex] = element;
      return {
        diagram: diagramIndex,
        placement: model.diagrams[diagramIndex].placements[placementIndex],
      };
    });
  });
  const neighbours = drawnBy.map(
    (drawn) =>
      new Map(
        drawn.flatMap((element) =>
          element === undefined ? [] : [[element.id, element] as const],
        ),
      ),
  );
  return { elementDrawings, drawnBy, neighbours };
}

function onEachDiagramOnce(
  queue: readonly (readonly [number, number])[],
): (readonly [number, number])[] {
  return queue.filter(
    ([diagramIndex], index) =>
      queue.findIndex(([held]) => held === diagramIndex) === index,
  );
}

function firstFitting(
  element: Element,
  queue: [number, number][],
  model: StructuralModel,
): (readonly [number, number])[] {
  const fitting = queue.findIndex(
    ([diagramIndex, placementIndex]) =>
      drawnElement(
        element,
        model.diagrams[diagramIndex].placements[placementIndex],
      ) !== undefined,
  );
  return queue.splice(Math.max(fitting, 0), 1);
}

function placementViolations(
  model: StructuralModel,
  { drawnBy, neighbours }: Drawings,
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
      const drawn = drawnElement(element, placement);
      return drawn === undefined ||
        drawnAwayFromNeighbour(drawn, neighbours[diagramIndex])
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

function drawnAwayFromNeighbour(
  drawn: DrawnElement,
  neighbours: ReadonlyMap<ElementId, Element>,
): boolean {
  return (
    drawn.kind === 'flow' &&
    [drawn.source, drawn.target].some(
      (end) => end.kind === 'away' && neighbours.has(end.element),
    )
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
  { elementDrawings, neighbours }: Drawings,
): ParseIssue[] {
  const known = new Set<string>(model.elements.map(({ id }) => id));
  return model.elements.flatMap((element, elementIndex) => {
    if (element.kind !== 'flow') {
      return [];
    }
    return (['source', 'target'] as const).flatMap((side): ParseIssue[] => {
      const end = element[side];
      if (end.kind !== 'attached') {
        return [];
      }
      const path = ['elements', elementIndex, side, 'element'];
      if (end.element === element.id) {
        return [
          {
            path,
            detail: {
              code: 'flow-endpoint-self',
              parameters: { id: end.element },
            },
          },
        ];
      }
      const undrawable =
        !known.has(end.element) ||
        elementDrawings[elementIndex].some(
          ({ diagram, placement }) =>
            'waypoints' in placement &&
            placement[side].position === undefined &&
            !neighbours[diagram].has(end.element),
        );
      return undrawable
        ? [
            {
              path,
              detail: {
                code: 'flow-endpoint-foreign',
                parameters: { id: end.element },
              },
            },
          ]
        : [];
    });
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
  { elementDrawings, neighbours }: Drawings,
  scope: RelationshipScope,
): ParseIssue[] {
  const everywhere = elementsById(model.elements);
  return model.elements.flatMap((element, elementIndex) =>
    relationshipIssues(
      element,
      everywhere,
      scope === 'model'
        ? everywhere
        : new Map(
            elementDrawings[elementIndex].flatMap(({ diagram }) => [
              ...neighbours[diagram],
            ]),
          ),
    ).map((issue): ParseIssue => ({
      path: ['elements', elementIndex, ...issue.path],
      detail: issue.detail,
    })),
  );
}
