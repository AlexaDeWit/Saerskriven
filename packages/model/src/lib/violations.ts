import type { z } from 'zod';
import type { modelSchema } from './model.js';
import type { ParseIssue, ParseIssueCode } from './parse-issue.js';
import {
  elementIdsAcross,
  elementIdsIn,
  elementsById,
  endpointViolationsOf,
} from './references.js';
import { relationshipIssues } from './relationships.js';

type StructuralModel = z.infer<typeof modelSchema>;

/**
 * What the model's own rules refuse in a structurally valid model: unique
 * identities, issuance bookkeeping, and diagram-local references.
 */
export function collectViolations(model: StructuralModel): ParseIssue[] {
  return [
    ...elementIdViolations(model),
    ...diagramIdViolations(model),
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
  const entries = model.diagrams.flatMap((diagram, diagramIndex) =>
    diagram.elements.map((element, elementIndex) => ({
      id: element.id,
      diagramIndex,
      elementIndex,
    })),
  );
  return duplicateViolations(
    entries,
    (entry) => entry.id,
    (entry) => ({
      path: [
        'diagrams',
        entry.diagramIndex,
        'elements',
        entry.elementIndex,
        'id',
      ],
      detail: {
        code: 'duplicate-element-id',
        parameters: { id: entry.id },
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

function flowEndpointViolations(model: StructuralModel): ParseIssue[] {
  return model.diagrams.flatMap((diagram, diagramIndex) => {
    const diagramElementIds = elementIdsIn(diagram);
    return diagram.elements.flatMap((element, elementIndex) => {
      if (element.kind !== 'flow') {
        return [];
      }
      return endpointViolationsOf(element, diagramElementIds).map(
        ({ side, reference, reason }): ParseIssue => ({
          path: [
            'diagrams',
            diagramIndex,
            'elements',
            elementIndex,
            side,
            'element',
          ],
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
  });
}

function referenceViolations(model: StructuralModel): ParseIssue[] {
  const elementIds = elementIdsAcross(model.diagrams);
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
  return model.diagrams.flatMap((diagram, diagramIndex) => {
    const known = elementsById(diagram.elements);
    return diagram.elements.flatMap((element, elementIndex) =>
      relationshipIssues(element, known).map((issue): ParseIssue => ({
        path: [
          'diagrams',
          diagramIndex,
          'elements',
          elementIndex,
          ...issue.path,
        ],
        detail: issue.detail,
      })),
    );
  });
}
