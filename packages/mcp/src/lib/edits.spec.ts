import { OperationFailure } from '@saerskriven/model';
import {
  assumptionId,
  diagramId,
  elementId,
  mitigationId,
  drawnFixture,
  sharedModel,
  threatId,
  validModelFixture,
} from '@saerskriven/model/fixtures';
import { Either } from 'effect';
import { applyEdits, modelEditSchema, renderRefusedEdit } from './edits.js';

type ByTag<Union extends { readonly _tag: string }> = {
  readonly [Tag in Union['_tag']]: Extract<Union, { readonly _tag: Tag }>;
};

const failures: ByTag<OperationFailure> = {
  InvalidElementProperties: OperationFailure.InvalidElementProperties({
    elementId: elementId('element-api'),
    issues: [{ path: ['kind'], detail: { code: 'element-kind-changed' } }],
  }),
  InvalidElementRelationship: OperationFailure.InvalidElementRelationship({
    elementId: elementId('element-api'),
    issues: [
      {
        path: ['trustBoundaryIds', 0],
        detail: {
          code: 'related-boundary-unknown',
          parameters: { id: 'element-perimeter' },
        },
      },
    ],
  }),
  InvalidFragment: OperationFailure.InvalidFragment({
    issues: [
      {
        path: ['op'],
        detail: {
          code: 'unknown-element-reference',
          parameters: { id: 'element-ghost' },
        },
      },
    ],
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
  ElementNotOnDiagram: OperationFailure.ElementNotOnDiagram({
    elementId: elementId('element-api'),
    diagramId: diagramId('diagram-empty'),
  }),
  ElementAlreadyOnDiagram: OperationFailure.ElementAlreadyOnDiagram({
    elementId: elementId('element-api'),
    diagramId: diagramId('diagram-main'),
  }),
  LastPlacement: OperationFailure.LastPlacement({
    elementId: elementId('element-api'),
    diagramId: diagramId('diagram-main'),
  }),
  InvalidPlacement: OperationFailure.InvalidPlacement({
    elementId: elementId('element-api'),
    diagramId: diagramId('diagram-main'),
  }),
  ElementOnSeveralDiagrams: OperationFailure.ElementOnSeveralDiagrams({
    elementId: elementId('element-api'),
    diagramIds: [diagramId('diagram-main'), diagramId('diagram-second')],
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
  NotTrustBoundaryElement: OperationFailure.NotTrustBoundaryElement({
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

  it('words a refused flow end by the whole rule, which every such refusal breaks', () => {
    const refusal = refusalOf(failures.InvalidFlowEndpoint);

    expect(refusal).toContain('an actor, process or store of its own diagram');
    expect(refusal).toContain('never to the element its other end');
  });

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

describe('an edit of an element drawn on more than one diagram', () => {
  const shared = sharedModel;

  it.each([
    { op: 'move_element', element: 'payments-api', offset: { x: 10, y: 0 } },
    { op: 'set_accent', elements: ['payments-api'], accent: 'l2' },
    {
      op: 'set_flow_waypoints',
      element: 'charge',
      waypoints: [{ x: 600, y: 150 }],
    },
  ] as const)(
    'is refused where it changes geometry or an accent, naming the diagrams ($op)',
    (edit) => {
      const refused = applyEdits(shared, [modelEditSchema.parse(edit)]);
      const failure = Either.isLeft(refused) ? refused.left.failure : undefined;
      expect(failure).toMatchObject({
        _tag: 'ElementOnSeveralDiagrams',
        diagramIds: ['overview', 'payments'],
      });
    },
  );

  it('applies where it changes the element on every diagram', () => {
    const applied = applyEdits(shared, [
      modelEditSchema.parse({
        op: 'rename_element',
        element: 'payments-api',
        name: 'Gateway',
      }),
    ]);
    expect(
      Either.isRight(applied)
        ? applied.right.model.elements.find(({ id }) => id === 'payments-api')
            ?.name
        : undefined,
    ).toBe('Gateway');
  });
});

describe('the records a batch culls more than once', () => {
  it('names a record once though two edits of the batch culled it', () => {
    const tls = mitigationId('mitigation-tls');
    const tamper = threatId('threat-tamper-order');
    const unlinking = {
      op: 'unlink_mitigation',
      mitigation: tls,
      threat: tamper,
    } as const;
    const applied = Either.getOrThrow(
      applyEdits(drawnFixture(validModelFixture), [
        unlinking,
        {
          op: 'add_mitigation',
          mitigation: {
            id: tls,
            title: 'TLS again',
            prose: '',
            status: 'proposed',
            threats: [tamper],
          },
        },
        unlinking,
      ]),
    );
    expect(applied.culled).toEqual([{ kind: 'mitigation', id: tls }]);
  });
});
