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
 */
export function collectViolations(model: StructuralModel): ParseIssue[] {
  return [
    ...elementIdViolations(model),
    ...diagramIdViolations(model),
    ...placementViolations(model),
    ...unplacedViolations(model),
    ...threatNumberViolations(model),
    ...lastIssuedThreatNumberViolations(model),
    ...recordIdViolations(model),
    ...flowEndpointViolations(model),
    ...referenceViolations(model),
    ...relationshipViolations(model),
  ];
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

function placementViolations(model: StructuralModel): ParseIssue[] {
  const elements = elementsById(model.elements);
  const placed = new Set<string>();
  return model.diagrams.flatMap((diagram, diagramIndex) =>
    diagram.placements.flatMap((placement, placementIndex): ParseIssue[] => {
      const path = ['diagrams', diagramIndex, 'placements', placementIndex];
      const id = placement.element;
      const element = elements.get(id);
      const code: ParseIssueCode | undefined =
        element === undefined
          ? 'placement-element-unknown'
          : placed.has(id)
            ? 'duplicate-placement'
            : drawnElement(element, placement) === undefined
              ? 'placement-geometry-mismatch'
              : undefined;
      placed.add(id);
      return code === undefined
        ? []
        : [
            {
              path:
                code === 'placement-geometry-mismatch'
                  ? path
                  : [...path, 'element'],
              detail: { code, parameters: { id } },
            },
          ];
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

/**
 * Each element's id mapped to the elements of the first diagram placing it,
 * the diagram its flow ends and relationship lists resolve in.
 */
function diagramNeighbours(
  model: StructuralModel,
): Map<ElementId, ReadonlyMap<ElementId, Element>> {
  const elements = elementsById(model.elements);
  const neighbours = new Map<ElementId, ReadonlyMap<ElementId, Element>>();
  for (const diagram of model.diagrams) {
    const drawn = new Map(
      diagram.placements.flatMap(({ element: id }) => {
        const element = elements.get(id);
        return element === undefined ? [] : [[id, element] as const];
      }),
    );
    for (const id of drawn.keys()) {
      if (!neighbours.has(id)) {
        neighbours.set(id, drawn);
      }
    }
  }
  return neighbours;
}

function flowEndpointViolations(model: StructuralModel): ParseIssue[] {
  const neighbours = diagramNeighbours(model);
  return model.elements.flatMap((element, elementIndex) => {
    const drawnWith = neighbours.get(element.id);
    if (element.kind !== 'flow' || drawnWith === undefined) {
      return [];
    }
    return endpointViolationsOf(element, new Set(drawnWith.keys())).map(
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

function relationshipViolations(model: StructuralModel): ParseIssue[] {
  const neighbours = diagramNeighbours(model);
  return model.elements.flatMap((element, elementIndex) => {
    const drawnWith = neighbours.get(element.id);
    return drawnWith === undefined
      ? []
      : relationshipIssues(element, drawnWith).map((issue): ParseIssue => ({
          path: ['elements', elementIndex, ...issue.path],
          detail: issue.detail,
        }));
  });
}
