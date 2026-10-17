import { OperationFailure, type Model } from '@saerskriven/model';
import {
  assumptionId,
  diagramId,
  drawnAt,
  drawnOn,
  elementId,
  mitigationId,
  drawnFixture,
  copiesModel,
  sharedModel,
  threatId,
  validModelFixture,
} from '@saerskriven/model/fixtures';
import { Either } from 'effect';
import type { EditInput } from './edit.fixtures.js';
import {
  applyEdits,
  modelEditSchema,
  renderRefusedEdit,
  type AppliedBatch,
  type RefusedEdit,
} from './edits.js';

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
  MergeIntoItself: OperationFailure.MergeIntoItself({
    elementId: elementId('element-api'),
  }),
  MergeKindsDiffer: OperationFailure.MergeKindsDiffer({
    elementId: elementId('element-db'),
    elementKind: 'store',
    intoId: elementId('element-api'),
    intoKind: 'process',
  }),
  MergeJoinedByFlow: OperationFailure.MergeJoinedByFlow({
    elementId: elementId('element-api'),
    intoId: elementId('element-db'),
    flowId: elementId('element-order-flow'),
  }),
  MergeFlowEndsDiffer: OperationFailure.MergeFlowEndsDiffer({
    elementId: elementId('element-order-flow'),
    intoId: elementId('element-read-flow'),
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
  FlowEndNotAway: OperationFailure.FlowEndNotAway({
    elementId: elementId('element-order-flow'),
    diagramId: diagramId('diagram-main'),
    side: 'source',
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

const refusalOf = (failure: RefusedEdit['failure'], index = 0): string =>
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

    expect(refusal).toContain(
      'an actor, process or store of the diagram the edit draws it on',
    );
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

const batchOn = (
  model: Model,
  edits: readonly EditInput[],
): Either.Either<AppliedBatch, RefusedEdit['failure']> =>
  Either.mapLeft(
    applyEdits(
      model,
      edits.map((edit) => modelEditSchema.parse(edit)),
    ),
    ({ failure }) => failure,
  );

const modelAfter = (model: Model, edits: readonly EditInput[]): Model =>
  Either.getOrThrow(batchOn(model, edits)).model;

const overview = 'overview';

const payments = 'payments';

const lastOn = (model: Model, diagram: string) =>
  drawnAt(
    model,
    model.diagrams.findIndex(({ id }) => id === diagram),
  ).at(-1);

describe('an edit of an element drawn on more than one diagram', () => {
  it.each<EditInput>([
    { op: 'move_element', element: 'payments-api', offset: { x: 10, y: 0 } },
    {
      op: 'resize_element',
      element: 'payments-api',
      size: { width: 200, height: 80 },
    },
    {
      op: 'set_boundary_shape',
      element: 'payments-zone',
      shape: {
        kind: 'curve',
        waypoints: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
      },
    },
    { op: 'set_accent', elements: ['payments-api'], accent: 'l2' },
    {
      op: 'set_flow_waypoints',
      element: 'charge',
      waypoints: [{ x: 600, y: 150 }],
    },
    {
      op: 'set_flow_end_position',
      element: 'charge',
      side: 'source',
      position: { x: 300, y: 300 },
    },
    {
      op: 'reconnect_flow',
      element: 'charge',
      side: 'source',
      endpoint: 'payments-api',
      anchor: 'left',
    },
  ])(
    'is refused without a diagram where it changes geometry or an accent, naming the diagrams ($op)',
    (edit) => {
      expect(batchOn(sharedModel, [edit])).toMatchObject({
        left: {
          _tag: 'ElementOnSeveralDiagrams',
          diagramIds: ['overview', 'payments'],
        },
      });
    },
  );

  it('moves, resizes and accents it on the diagram an edit names alone', () => {
    const edited = modelAfter(sharedModel, [
      {
        op: 'move_element',
        element: 'payments-api',
        diagram: 'payments',
        offset: { x: 10, y: 20 },
      },
      {
        op: 'resize_element',
        element: 'payments-api',
        diagram: 'payments',
        size: { width: 200, height: 80 },
      },
      {
        op: 'set_accent',
        elements: ['payments-api', 'card-vault'],
        diagram: 'payments',
        accent: 'l2',
      },
    ]);
    expect(drawnOn(edited, payments, 'payments-api')).toMatchObject({
      position: { x: 250, y: 120 },
      size: { width: 200, height: 80 },
      accent: 'l2',
    });
    expect(drawnOn(edited, payments, 'card-vault')?.accent).toBe('l2');
    expect(drawnOn(edited, overview, 'payments-api')).toEqual(
      drawnOn(sharedModel, overview, 'payments-api'),
    );
  });

  it('routes and reshapes it on the diagram an edit names alone', () => {
    const edited = modelAfter(sharedModel, [
      {
        op: 'set_flow_waypoints',
        element: 'charge',
        diagram: 'overview',
        waypoints: [{ x: 600, y: 150 }],
      },
      {
        op: 'set_boundary_shape',
        element: 'payments-zone',
        diagram: 'payments',
        shape: {
          kind: 'curve',
          waypoints: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
          ],
        },
      },
    ]);
    expect(drawnOn(edited, overview, 'charge')).toMatchObject({
      waypoints: [{ x: 600, y: 150 }],
    });
    expect(drawnOn(edited, payments, 'charge')).toEqual(
      drawnOn(sharedModel, payments, 'charge'),
    );
    expect(drawnOn(edited, payments, 'payments-zone')).toMatchObject({
      shape: { kind: 'curve' },
    });
    expect(drawnOn(edited, overview, 'payments-zone')).toEqual(
      drawnOn(sharedModel, overview, 'payments-zone'),
    );
  });

  it('frees an end at the position on the diagram it names, and on every other where it was drawn', () => {
    const edited = modelAfter(sharedModel, [
      {
        op: 'set_flow_end_position',
        element: 'charge',
        diagram: 'overview',
        side: 'target',
        position: { x: 700, y: 220 },
      },
    ]);
    expect(drawnOn(edited, overview, 'charge')).toMatchObject({
      target: { kind: 'free', position: { x: 700, y: 220 } },
    });
    expect(drawnOn(edited, payments, 'charge')).toMatchObject({
      target: { kind: 'free', position: { x: 520, y: 130 } },
    });
  });

  it('pins a reconnected end on the diagram it names and draws it away where its element is not', () => {
    const edited = modelAfter(sharedModel, [
      {
        op: 'reconnect_flow',
        element: 'charge',
        diagram: 'payments',
        side: 'source',
        endpoint: 'fraud-check',
        anchor: 'bottom',
      },
    ]);
    expect(drawnOn(edited, payments, 'charge')).toMatchObject({
      source: { kind: 'attached', element: 'fraud-check', side: 'bottom' },
    });
    expect(drawnOn(edited, overview, 'charge')).toMatchObject({
      source: { kind: 'away', element: 'fraud-check' },
    });
  });

  it('is refused where it names a diagram that does not draw the element', () => {
    expect(
      batchOn(sharedModel, [
        {
          op: 'move_element',
          element: 'card-vault',
          diagram: 'overview',
          offset: { x: 10, y: 0 },
        },
      ]),
    ).toMatchObject({
      left: { _tag: 'ElementNotOnDiagram', diagramId: 'overview' },
    });
  });

  it('applies where it changes the element on every diagram', () => {
    const edited = modelAfter(sharedModel, [
      { op: 'rename_element', element: 'payments-api', name: 'Gateway' },
    ]);
    expect(
      [overview, payments].map(
        (diagram) => drawnOn(edited, diagram, 'payments-api')?.name,
      ),
    ).toEqual(['Gateway', 'Gateway']);
  });

  it('takes the element off every diagram on remove_element, culling the threat it was the last attachment of', () => {
    const removed = Either.getOrThrow(
      batchOn(sharedModel, [{ op: 'remove_element', element: 'payments-api' }]),
    );
    expect(
      removed.model.diagrams.flatMap(({ placements }) =>
        placements.filter(({ element }) => element === 'payments-api'),
      ),
    ).toEqual([]);
    expect(removed.culledThreats.map(({ id }) => id)).toEqual([
      'threat-card-data',
    ]);
  });
});

const lastBox = (model: Model) => {
  const last = lastOn(model, payments);
  return last !== undefined && 'position' in last
    ? { id: last.id, position: last.position, size: last.size }
    : undefined;
};

const boundaryBox = {
  kind: 'box',
  position: { x: 0, y: 0 },
  size: { width: 600, height: 300 },
} as const;

describe('what place_element does', () => {
  it('places an element the model holds on one more diagram, last there, with its geometry and accent', () => {
    const placed = modelAfter(sharedModel, [
      {
        op: 'place_element',
        element: 'customer',
        diagram: 'payments',
        placement: {
          position: { x: 40, y: 400 },
          size: { width: 120, height: 60 },
        },
        accent: 's3',
      },
    ]);
    expect(lastOn(placed, payments)).toMatchObject({
      id: 'customer',
      position: { x: 40, y: 400 },
      accent: 's3',
    });
    expect(placed.elements).toEqual(sharedModel.elements);
  });

  it('puts an "auto" placement where add_element puts one at the same index', () => {
    const viaPlace = modelAfter(sharedModel, [
      {
        op: 'place_element',
        element: 'customer',
        diagram: 'payments',
        placement: 'auto',
      },
    ]);
    const viaAdd = modelAfter(sharedModel, [
      {
        op: 'add_element',
        diagram: 'payments',
        element: {
          kind: 'actor',
          id: 'auditor',
          name: 'Auditor',
          placement: 'auto',
        },
      },
    ]);
    expect(lastBox(viaPlace)).toEqual({
      ...lastBox(viaAdd),
      id: 'customer',
    });
  });

  it('places a flow with a pinned end and an end drawn away, and a trust boundary by its shape', () => {
    const placed = modelAfter(sharedModel, [
      {
        op: 'place_element',
        element: 'card-details',
        diagram: 'payments',
        placement: {
          source: { position: { x: 0, y: 130 } },
          target: { side: 'left' },
        },
      },
      {
        op: 'unplace_element',
        element: 'payments-zone',
        diagram: 'payments',
      },
      {
        op: 'place_element',
        element: 'payments-zone',
        diagram: 'payments',
        placement: { shape: boundaryBox },
      },
    ]);
    expect(drawnOn(placed, payments, 'card-details')).toMatchObject({
      source: { kind: 'away', element: 'web-app', position: { x: 0, y: 130 } },
      target: { kind: 'attached', element: 'payments-api', side: 'left' },
      waypoints: [],
    });
    expect(lastOn(placed, payments)).toMatchObject({
      id: 'payments-zone',
      shape: boundaryBox,
    });
  });

  it.each<{
    readonly name: string;
    readonly edit: EditInput;
    readonly tag: OperationFailure['_tag'];
  }>([
    {
      name: 'an element already on the diagram',
      edit: {
        op: 'place_element',
        element: 'payments-api',
        diagram: 'payments',
        placement: 'auto',
      },
      tag: 'ElementAlreadyOnDiagram',
    },
    {
      name: 'geometry the element kind does not take',
      edit: {
        op: 'place_element',
        element: 'customer',
        diagram: 'payments',
        placement: { source: {}, target: {} },
      },
      tag: 'InvalidPlacement',
    },
    {
      name: 'an element the model does not hold',
      edit: {
        op: 'place_element',
        element: 'auditor',
        diagram: 'payments',
        placement: 'auto',
      },
      tag: 'UnknownElement',
    },
  ])('refuses $name', ({ edit, tag }) => {
    expect(batchOn(sharedModel, [edit])).toMatchObject({ left: { _tag: tag } });
  });
});

describe('what unplace_element does', () => {
  it('takes an element off one diagram, keeps it on the other with its threats, and culls nothing', () => {
    const unplaced = Either.getOrThrow(
      batchOn(sharedModel, [
        { op: 'unplace_element', element: 'payments-api', diagram: 'payments' },
      ]),
    );
    expect(drawnOn(unplaced.model, payments, 'payments-api')).toBeUndefined();
    expect(drawnOn(unplaced.model, overview, 'payments-api')).toEqual(
      drawnOn(sharedModel, overview, 'payments-api'),
    );
    expect(drawnOn(unplaced.model, payments, 'score')).toMatchObject({
      target: { kind: 'away', element: 'payments-api' },
    });
    expect({
      threats: unplaced.model.threats,
      culled: unplaced.culled,
      culledThreats: unplaced.culledThreats,
    }).toEqual({ threats: sharedModel.threats, culled: [], culledThreats: [] });
  });

  it('refuses the last diagram an element is on, pointing to remove_element', () => {
    const refused = batchOn(sharedModel, [
      { op: 'unplace_element', element: 'card-vault', diagram: 'payments' },
    ]);
    expect(refused).toMatchObject({ left: { _tag: 'LastPlacement' } });
    expect(
      Either.isLeft(refused) ? refusalOf(refused.left) : undefined,
    ).toContain('remove_element');
  });
});

describe('a refusal of an edit another op does', () => {
  it.each<{
    readonly name: string;
    readonly edit: EditInput;
    readonly tag: OperationFailure['_tag'];
    readonly pointsTo: string;
  }>([
    {
      name: 'add_element on an id the model holds to place_element',
      edit: {
        op: 'add_element',
        diagram: 'payments',
        element: {
          kind: 'actor',
          id: 'customer',
          name: 'Customer',
          placement: 'auto',
        },
      },
      tag: 'DuplicateElementId',
      pointsTo: 'place_element',
    },
    {
      name: 'remove_diagram on a diagram holding elements to unplace_element',
      edit: { op: 'remove_diagram', diagram: 'payments' },
      tag: 'DiagramNotEmpty',
      pointsTo: 'unplace_element',
    },
  ])('points $name', ({ edit, tag, pointsTo }) => {
    const refused = batchOn(sharedModel, [edit]);
    expect(refused).toMatchObject({ left: { _tag: tag } });
    expect(
      Either.isLeft(refused) ? refusalOf(refused.left) : undefined,
    ).toContain(pointsTo);
  });
});

describe('a diagram an edit names by its exact title', () => {
  it('changes the drawing on the diagram the title names alone', () => {
    const edited = modelAfter(sharedModel, [
      {
        op: 'move_element',
        element: 'payments-api',
        diagram: 'Payments',
        offset: { x: 10, y: 20 },
      },
      {
        op: 'set_accent',
        elements: ['payments-api'],
        diagram: 'Payments',
        accent: 'l2',
      },
    ]);
    expect(drawnOn(edited, payments, 'payments-api')).toMatchObject({
      position: { x: 250, y: 120 },
      accent: 'l2',
    });
    expect(drawnOn(edited, overview, 'payments-api')).toEqual(
      drawnOn(sharedModel, overview, 'payments-api'),
    );
  });

  it('places on, takes off, renames and removes the diagram the title names', () => {
    const edited = modelAfter(sharedModel, [
      {
        op: 'place_element',
        element: 'customer',
        diagram: 'Payments',
        placement: 'auto',
      },
      {
        op: 'unplace_element',
        element: 'payments-api',
        diagram: 'High level',
      },
      { op: 'add_diagram', diagram: 'spare', title: 'Spare' },
      { op: 'rename_diagram', diagram: 'Spare', title: 'Kept spare' },
      { op: 'add_diagram', diagram: 'unused', title: 'Unused' },
      { op: 'remove_diagram', diagram: 'Unused' },
    ]);
    expect(lastOn(edited, payments)?.id).toBe('customer');
    expect(drawnOn(edited, overview, 'payments-api')).toBeUndefined();
    expect(edited.diagrams.map(({ id, title }) => ({ id, title }))).toEqual([
      { id: 'overview', title: 'High level' },
      { id: 'payments', title: 'Payments' },
      { id: 'spare', title: 'Kept spare' },
    ]);
  });

  it('refuses a title two diagrams have and no diagram has as its id, naming their ids', () => {
    const refused = batchOn(sharedModel, [
      { op: 'rename_diagram', diagram: 'payments', title: 'High level' },
      {
        op: 'move_element',
        element: 'payments-api',
        diagram: 'High level',
        offset: { x: 10, y: 0 },
      },
    ]);
    expect(refused).toMatchObject({
      left: {
        _tag: 'AmbiguousDiagram',
        name: 'High level',
        diagramIds: ['overview', 'payments'],
      },
    });
    const refusal = Either.isLeft(refused) ? refusalOf(refused.left, 1) : '';
    expect(refusal).toContain('"overview"');
    expect(refusal).toContain('"payments"');
  });

  it('adds a diagram under the id given where another diagram has it as its title', () => {
    const edited = modelAfter(sharedModel, [
      { op: 'add_diagram', diagram: 'Payments', title: 'Payments again' },
    ]);
    expect(edited.diagrams.map(({ id }) => id)).toEqual([
      'overview',
      'payments',
      'Payments',
    ]);
  });

  it('takes the id first where one diagram has as its title the id of another', () => {
    const edited = modelAfter(sharedModel, [
      { op: 'add_diagram', diagram: 'spare', title: 'payments' },
      { op: 'rename_diagram', diagram: 'payments', title: 'Renamed' },
    ]);
    expect(edited.diagrams.map(({ title }) => title)).toEqual([
      'High level',
      'Renamed',
      'payments',
    ]);
  });

  it('refuses a name no diagram has as its id or its title, naming it', () => {
    const refused = batchOn(sharedModel, [
      { op: 'remove_diagram', diagram: 'Nothing' },
    ]);
    expect(refused).toMatchObject({
      left: { _tag: 'UnknownDiagram', diagramId: 'Nothing' },
    });
    expect(
      Either.isLeft(refused) ? refusalOf(refused.left) : undefined,
    ).toContain('saer_inspect');
  });
});

const mergeRefusal = (edit: EditInput): string =>
  Either.match(batchOn(copiesModel, [edit]), {
    onLeft: (failure) => refusalOf(failure),
    onRight: () => '',
  });

describe('what merge_elements does', () => {
  it('merges a copy into the element kept, reporting what moved and what was dropped', () => {
    const merged = Either.getOrThrow(
      batchOn(copiesModel, [
        {
          op: 'merge_elements',
          element: 'orders-api-copy',
          into: 'orders-api',
        },
        { op: 'merge_elements', element: 'stock-copy', into: 'stock' },
        { op: 'merge_elements', element: 'reserve-copy', into: 'reserve' },
      ]),
    );
    expect(drawnOn(merged.model, 'fulfilment', 'reserve')).toMatchObject({
      source: { kind: 'attached', element: 'orders-api' },
      target: { kind: 'attached', element: 'stock' },
    });
    expect(merged.merged).toEqual([
      {
        element: 'orders-api-copy',
        into: 'orders-api',
        movedOn: ['fulfilment'],
        droppedOn: [],
        threats: [],
        flows: ['reserve-copy'],
      },
      {
        element: 'stock-copy',
        into: 'stock',
        movedOn: ['fulfilment'],
        droppedOn: [],
        threats: ['threat-stock-read'],
        flows: ['reserve-copy'],
      },
      {
        element: 'reserve-copy',
        into: 'reserve',
        movedOn: ['fulfilment'],
        droppedOn: [],
        threats: ['threat-reservation-replayed'],
        flows: [],
      },
    ]);
    expect({
      culled: merged.culled,
      culledThreats: merged.culledThreats,
    }).toEqual({ culled: [], culledThreats: [] });
  });

  it('reports the diagram where it dropped the drawing of an element the kept one shares', () => {
    const merged = Either.getOrThrow(
      batchOn(copiesModel, [
        {
          op: 'place_element',
          element: 'orders-api-copy',
          diagram: 'storefront',
          placement: 'auto',
        },
        {
          op: 'merge_elements',
          element: 'orders-api',
          into: 'orders-api-copy',
        },
      ]),
    );
    expect(merged.merged).toMatchObject([
      { movedOn: [], droppedOn: ['storefront'], flows: ['order', 'reserve'] },
    ]);
    expect(drawnOn(merged.model, 'storefront', 'order')).toMatchObject({
      target: { kind: 'attached', element: 'orders-api-copy' },
    });
  });

  it.each<{
    readonly name: string;
    readonly edit: EditInput;
    readonly tag: OperationFailure['_tag'];
  }>([
    {
      name: 'one element given as both',
      edit: { op: 'merge_elements', element: 'stock', into: 'stock' },
      tag: 'MergeIntoItself',
    },
    {
      name: 'an element the model does not hold',
      edit: { op: 'merge_elements', element: 'ghost', into: 'stock' },
      tag: 'UnknownElement',
    },
    {
      name: 'two kinds',
      edit: { op: 'merge_elements', element: 'stock', into: 'orders-api' },
      tag: 'MergeKindsDiffer',
    },
    {
      name: 'two elements a flow joins',
      edit: { op: 'merge_elements', element: 'web-shop', into: 'orders-api' },
      tag: 'MergeJoinedByFlow',
    },
    {
      name: 'two flows joining different elements',
      edit: { op: 'merge_elements', element: 'reserve-copy', into: 'reserve' },
      tag: 'MergeFlowEndsDiffer',
    },
  ])('refuses $name', ({ edit, tag }) => {
    expect(batchOn(copiesModel, [edit])).toMatchObject({
      left: { _tag: tag },
    });
  });

  it('names both kinds, and the flow joining the two, in its refusal', () => {
    expect(
      mergeRefusal({
        op: 'merge_elements',
        element: 'stock',
        into: 'orders-api',
      }),
    ).toMatch(/kind store .* kind process/u);
    expect(
      mergeRefusal({
        op: 'merge_elements',
        element: 'web-shop',
        into: 'orders-api',
      }),
    ).toContain('"order"');
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
