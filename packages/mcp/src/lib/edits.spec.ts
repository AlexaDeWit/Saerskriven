import { linkAssumptionToModel, OperationFailure } from '@saerskriven/model';
import {
  assumptionId,
  diagramId,
  elementId,
  mitigationId,
  parsedFixture,
  threatId,
  validModelFixture,
} from '@saerskriven/model/fixtures';
import { Either } from 'effect';
import { applyEdits, editOps, renderRefusedEdit } from './edits.js';

type ByTag<Union extends { readonly _tag: string }> = {
  readonly [Tag in Union['_tag']]: Extract<Union, { readonly _tag: Tag }>;
};

const failures: ByTag<OperationFailure> = {
  InvalidElementProperties: OperationFailure.InvalidElementProperties({
    elementId: elementId('element-api'),
    issues: [
      { path: ['kind'], code: 'custom', message: 'Element kind changed.' },
    ],
  }),
  InvalidElementRelationship: OperationFailure.InvalidElementRelationship({
    elementId: elementId('element-api'),
    issues: [
      {
        path: ['trustBoundaryIds', 0],
        code: 'custom',
        message: 'Unknown boundary.',
      },
    ],
  }),
  InvalidFragment: OperationFailure.InvalidFragment({
    issues: [{ path: ['op'], code: 'custom', message: 'nothing applies it' }],
  }),
  UnknownDiagram: OperationFailure.UnknownDiagram({
    diagramId: diagramId('diagram-main'),
  }),
  DuplicateDiagramId: OperationFailure.DuplicateDiagramId({
    diagramId: diagramId('diagram-main'),
  }),
  EmptyTitle: OperationFailure.EmptyTitle({
    diagramId: diagramId('diagram-main'),
  }),
  RefusedTitleCharacter: OperationFailure.RefusedTitleCharacter({
    diagramId: diagramId('diagram-main'),
    at: 3,
  }),
  DiagramNotEmpty: OperationFailure.DiagramNotEmpty({
    diagramId: diagramId('diagram-main'),
    elements: 4,
  }),
  UnknownElement: OperationFailure.UnknownElement({
    elementId: elementId('element-api'),
  }),
  UnknownThreat: OperationFailure.UnknownThreat({
    threatId: threatId('threat-tamper-order'),
  }),
  UnknownMitigation: OperationFailure.UnknownMitigation({
    mitigationId: mitigationId('mitigation-tls'),
  }),
  UnknownAssumption: OperationFailure.UnknownAssumption({
    assumptionId: assumptionId('assumption-managed-db'),
  }),
  DuplicateElementId: OperationFailure.DuplicateElementId({
    elementId: elementId('element-api'),
  }),
  DuplicateThreatId: OperationFailure.DuplicateThreatId({
    threatId: threatId('threat-tamper-order'),
  }),
  DuplicateMitigationId: OperationFailure.DuplicateMitigationId({
    mitigationId: mitigationId('mitigation-tls'),
  }),
  DuplicateAssumptionId: OperationFailure.DuplicateAssumptionId({
    assumptionId: assumptionId('assumption-managed-db'),
  }),
  RecordWithoutThreat: OperationFailure.RecordWithoutThreat({
    record: { kind: 'mitigation', id: mitigationId('mitigation-tls') },
  }),
  AssumptionWithoutReference: OperationFailure.AssumptionWithoutReference({
    assumptionId: assumptionId('assumption-managed-db'),
  }),
  ReusedThreatNumber: OperationFailure.ReusedThreatNumber({ number: 4 }),
  ChangedThreatNumber: OperationFailure.ChangedThreatNumber({
    threatId: threatId('threat-tamper-order'),
    number: 9,
  }),
  InvalidFlowEndpoint: OperationFailure.InvalidFlowEndpoint({
    side: 'target',
    reference: elementId('element-perimeter'),
  }),
  NotResizable: OperationFailure.NotResizable({
    elementId: elementId('element-order-flow'),
  }),
  NotTextElement: OperationFailure.NotTextElement({
    elementId: elementId('element-api'),
  }),
  NotFlowElement: OperationFailure.NotFlowElement({
    elementId: elementId('element-api'),
  }),
  EmptyName: OperationFailure.EmptyName({
    elementId: elementId('element-api'),
  }),
  RefusedCharacter: OperationFailure.RefusedCharacter({
    elementId: elementId('element-api'),
    at: 2,
  }),
  RefusedMetadataCharacter: OperationFailure.RefusedMetadataCharacter({
    field: 'owner',
    at: 1,
  }),
  RefusedContributorCharacter: OperationFailure.RefusedContributorCharacter({
    contributor: 2,
    at: 0,
  }),
};

const refusalOf = (failure: OperationFailure, index = 0): string =>
  renderRefusedEdit({ index, failure })[1] ?? '';

describe('what a refused edit reads as', () => {
  for (const failure of Object.values<OperationFailure>(failures)) {
    it(`words ${failure._tag} rather than showing its tag`, () => {
      const refusal = refusalOf(failure);

      expect(refusal.length > 0).toBe(true);
      expect(refusal).not.toContain(failure._tag);
    });
  }

  it('names the edit of the batch that was refused', () => {
    expect(
      renderRefusedEdit({ index: 3, failure: failures.EmptyName })[0],
    ).toEqual(
      'The edit at index 3 was refused, so none of the batch was applied and the file is as it was.',
    );
  });

  it('escapes an id that carries a control character', () => {
    expect(
      refusalOf(
        OperationFailure.UnknownElement({ elementId: elementId('one\ntwo') }),
      ),
    ).toContain('"one\\u000atwo"');
  });
});

describe('replace_assumption', () => {
  it('keeps the model link of an assumption that links no threat', () => {
    const managedDb = assumptionId('assumption-managed-db');
    const modelWide = Either.getOrThrow(
      linkAssumptionToModel(
        parsedFixture({
          ...validModelFixture,
          assumptions: validModelFixture.assumptions.map((assumption) => ({
            ...assumption,
            threats: [],
          })),
        }),
        managedDb,
      ),
    );
    const applied = Either.getOrThrow(
      applyEdits(modelWide, [
        {
          op: 'replace_assumption',
          assumption: {
            id: managedDb,
            prose: 'Reworded.',
            status: 'valid',
            threats: [],
          },
        },
      ]),
    );
    expect(applied.model.assumptions).toEqual([
      { ...modelWide.assumptions[0], prose: 'Reworded.' },
    ]);
    expect(applied.culled).toEqual([]);
  });
});

describe('the ops the schema declares', () => {
  it('names each one once', () => {
    expect(editOps.length).toEqual(new Set(editOps).size);
  });
});
