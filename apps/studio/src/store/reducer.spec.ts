import { ReadFailure } from '@saerskriven/formats';
import { ShareLinkFailure } from '@saerskriven/formats/share-link';
import {
  emptyModel,
  OperationFailure,
  type DiagramId,
  type ElementDetailsChange,
  type ElementId,
} from '@saerskriven/model';
import {
  assumptionId,
  diagramId,
  elementId,
  mitigationId,
  softHyphen,
  threatId,
} from '@saerskriven/model/fixtures';
import { Action } from './actions.js';
import { reduce } from './reducer.js';
import { activeDiagramId, elementById } from './selectors.js';
import {
  FileLifecycle,
  LinkFailure,
  StudioFailure,
  initialState,
  placeholderModel,
  type State,
} from './state.js';
import {
  actorElement,
  addedProcess,
  firstAssumption,
  firstMitigation,
  firstThreat,
  foreignSource,
  mainDiagram,
  nativeSource,
  newNote,
  newProcess,
  otherElement,
  processElement,
  recordedModel,
  sampleModel,
  sampleThreat,
  secondDiagram,
  secondThreat,
  twoDiagramModel,
} from './store.fixtures.js';

const start = initialState(sampleModel);
const recordedStart = initialState(recordedModel);
const [heldMitigation] = recordedModel.mitigations;
const [heldAssumption] = recordedModel.assumptions;
const noteElement = elementId('note-editable');
const noteModel = {
  ...sampleModel,
  diagrams: sampleModel.diagrams.map((diagram) => ({
    ...diagram,
    elements: [...diagram.elements, newNote(noteElement, 'Draft note')],
  })),
};
const noteStart = initialState(noteModel);
const boundaryElement = elementId('boundary-edge');
const boundaryStart = initialState(
  reduce(
    start,
    Action.AddElement({
      diagramId: mainDiagram,
      element: {
        kind: 'trust-boundary',
        id: boundaryElement,
        name: 'Edge',
        description: '',
        outOfScope: false,
        reasonOutOfScope: '',
        shape: {
          kind: 'box',
          position: { x: -20, y: -20 },
          size: { width: 360, height: 100 },
        },
      },
    }),
  ).present,
);
type StudioActionTag =
  | 'Undo'
  | 'Redo'
  | 'SelectDiagram'
  | 'Select'
  | 'ShowModelPanel'
  | 'HideModelPanel'
  | 'InlineEditing'
  | 'Imported'
  | 'LinkOpened'
  | 'Opened'
  | 'Saved'
  | 'Closed'
  | 'Followed'
  | 'ReadFailed'
  | 'FileRefused'
  | 'LinkRefused'
  | 'DismissFailure';

type ModelActionTag = Exclude<Action['_tag'], StudioActionTag>;

type ActionsByTag<Tag extends Action['_tag']> = {
  readonly [T in Tag]: Extract<Action, { readonly _tag: T }>;
};

const applied: ActionsByTag<ModelActionTag> = {
  SetElementProperties: Action.SetElementProperties({
    elementId: processElement,
    properties: { kind: 'process', isWebApplication: true },
  }),
  SetElementDetails: Action.SetElementDetails({
    elementId: processElement,
    change: { description: 'Edits the models.' },
  }),
  AddDiagram: Action.AddDiagram({
    diagram: { id: secondDiagram, title: 'Second', elements: [] },
  }),
  RenameDiagram: Action.RenameDiagram({
    diagramId: mainDiagram,
    title: 'Retitled',
  }),
  InsertFragment: Action.InsertFragment({
    diagramId: mainDiagram,
    fragment: placeholderModel,
  }),
  ArrangeElements: Action.ArrangeElements({
    moves: [{ elementId: processElement, offset: { x: 10, y: 20 } }],
    decimals: 3,
  }),
  ReconnectFlow: Action.ReconnectFlow({
    elementId: elementId('placeholder-flow'),
    side: 'source',
    endpointId: elementId('extra-actor'),
  }),
  AddElement: addedProcess,
  RemoveElement: Action.RemoveElement({
    elementId: processElement,
    decimals: 3,
  }),
  RemoveElements: Action.RemoveElements({
    elementIds: [actorElement, processElement],
    decimals: 3,
  }),
  MoveElement: Action.MoveElement({
    elementId: processElement,
    offset: { x: 10, y: -5 },
    decimals: 1,
  }),
  MoveElements: Action.MoveElements({
    elementIds: [actorElement, processElement],
    offset: { x: 10, y: -5 },
    decimals: 1,
  }),
  ResizeElement: Action.ResizeElement({
    elementId: processElement,
    offset: { x: -10, y: -5 },
    size: { width: 200, height: 90 },
    decimals: 1,
  }),
  RenameElement: Action.RenameElement({
    elementId: processElement,
    name: 'Renamed',
  }),
  EditNote: Action.EditNote({
    elementId: noteElement,
    text: 'Edited note',
  }),
  SetFlowWaypoints: Action.SetFlowWaypoints({
    elementId: elementId('placeholder-flow'),
    waypoints: [{ x: 200, y: 100 }],
    decimals: 1,
  }),
  SetFlowDirection: Action.SetFlowDirection({
    elementId: elementId('placeholder-flow'),
    bidirectional: true,
  }),
  SetFlowEndPosition: Action.SetFlowEndPosition({
    elementId: elementId('placeholder-flow'),
    side: 'target',
    position: { x: 400, y: 200 },
    decimals: 3,
  }),
  ReverseFlow: Action.ReverseFlow({ elementId: elementId('placeholder-flow') }),
  SetBoundaryShape: Action.SetBoundaryShape({
    elementId: boundaryElement,
    shape: {
      kind: 'curve',
      waypoints: [
        { x: -20, y: 80 },
        { x: 160, y: -20 },
        { x: 340, y: 80 },
      ],
    },
    decimals: 3,
  }),
  AddThreat: Action.AddThreat({
    threat: { ...sampleThreat, id: threatId('threat-added'), number: 2 },
  }),
  RemoveThreat: Action.RemoveThreat({ threatId: firstThreat }),
  ReplaceThreat: Action.ReplaceThreat({
    threat: { ...sampleThreat, title: 'Retitled' },
  }),
  AttachThreat: Action.AttachThreat({
    threatId: firstThreat,
    elementId: processElement,
  }),
  DetachThreat: Action.DetachThreat({
    threatId: firstThreat,
    elementId: actorElement,
  }),
  AddMitigation: Action.AddMitigation({
    mitigation: {
      ...heldMitigation,
      id: mitigationId('mitigation-added'),
      threats: [secondThreat],
    },
  }),
  ReplaceMitigation: Action.ReplaceMitigation({
    mitigation: { ...heldMitigation, title: 'Signed share links' },
  }),
  LinkMitigation: Action.LinkMitigation({
    mitigationId: firstMitigation,
    threatId: secondThreat,
  }),
  UnlinkMitigation: Action.UnlinkMitigation({
    mitigationId: firstMitigation,
    threatId: firstThreat,
  }),
  SetMitigationStatus: Action.SetMitigationStatus({
    mitigationId: firstMitigation,
    status: 'implemented',
  }),
  AddAssumption: Action.AddAssumption({
    assumption: {
      ...heldAssumption,
      id: assumptionId('assumption-added'),
      threats: [secondThreat],
    },
  }),
  ReplaceAssumption: Action.ReplaceAssumption({
    assumption: { ...heldAssumption, prose: 'Every reader is signed in.' },
  }),
  LinkAssumption: Action.LinkAssumption({
    assumptionId: firstAssumption,
    threatId: secondThreat,
  }),
  UnlinkAssumption: Action.UnlinkAssumption({
    assumptionId: firstAssumption,
    threatId: firstThreat,
  }),
  SetAssumptionStatus: Action.SetAssumptionStatus({
    assumptionId: firstAssumption,
    status: 'invalidated',
  }),
  LinkAssumptionToModel: Action.LinkAssumptionToModel({
    assumptionId: firstAssumption,
  }),
  UnlinkAssumptionFromModel: Action.UnlinkAssumptionFromModel({
    assumptionId: firstAssumption,
  }),
  SetModelMetadata: Action.SetModelMetadata({
    change: { title: 'Retitled model' },
  }),
};

const refused: ActionsByTag<ModelActionTag> = {
  SetElementProperties: Action.SetElementProperties({
    elementId: processElement,
    properties: { kind: 'actor', providesAuthentication: true },
  }),
  SetElementDetails: Action.SetElementDetails({
    elementId: elementId('element-missing'),
    change: { outOfScope: true },
  }),
  AddDiagram: Action.AddDiagram({
    diagram: { id: mainDiagram, title: 'Again', elements: [] },
  }),
  RenameDiagram: Action.RenameDiagram({
    diagramId: diagramId('diagram-missing'),
    title: 'Retitled',
  }),
  InsertFragment: Action.InsertFragment({
    diagramId: mainDiagram,
    fragment: sampleModel,
  }),
  ArrangeElements: Action.ArrangeElements({
    moves: [
      { elementId: processElement, offset: { x: 10, y: 20 } },
      { elementId: elementId('missing'), offset: { x: 10, y: 20 } },
    ],
  }),
  ReconnectFlow: Action.ReconnectFlow({
    elementId: processElement,
    side: 'source',
    endpointId: actorElement,
  }),
  AddElement: Action.AddElement({
    diagramId: diagramId('diagram-missing'),
    element: newProcess('process-refused', 'Refused'),
  }),
  RemoveElement: Action.RemoveElement({
    elementId: elementId('element-missing'),
  }),
  RemoveElements: Action.RemoveElements({
    elementIds: [processElement, elementId('element-missing')],
  }),
  MoveElement: Action.MoveElement({
    elementId: elementId('element-missing'),
    offset: { x: 1, y: 1 },
  }),
  MoveElements: Action.MoveElements({
    elementIds: [processElement, elementId('element-missing')],
    offset: { x: 1, y: 1 },
  }),
  ResizeElement: Action.ResizeElement({
    elementId: elementId('element-missing'),
    offset: { x: 0, y: 0 },
    size: { width: 10, height: 10 },
  }),
  RenameElement: Action.RenameElement({
    elementId: processElement,
    name: '',
  }),
  EditNote: Action.EditNote({
    elementId: processElement,
    text: 'Not a note',
  }),
  SetFlowWaypoints: Action.SetFlowWaypoints({
    elementId: processElement,
    waypoints: [],
  }),
  SetFlowDirection: Action.SetFlowDirection({
    elementId: processElement,
    bidirectional: true,
  }),
  SetFlowEndPosition: Action.SetFlowEndPosition({
    elementId: processElement,
    side: 'source',
    position: { x: 0, y: 0 },
  }),
  ReverseFlow: Action.ReverseFlow({ elementId: processElement }),
  SetBoundaryShape: Action.SetBoundaryShape({
    elementId: processElement,
    shape: {
      kind: 'box',
      position: { x: 0, y: 0 },
      size: { width: 10, height: 10 },
    },
  }),
  AddThreat: Action.AddThreat({
    threat: { ...sampleThreat, id: threatId('threat-reused'), number: 1 },
  }),
  RemoveThreat: Action.RemoveThreat({ threatId: threatId('threat-missing') }),
  ReplaceThreat: Action.ReplaceThreat({
    threat: { ...sampleThreat, id: threatId('threat-missing') },
  }),
  AttachThreat: Action.AttachThreat({
    threatId: threatId('threat-missing'),
    elementId: actorElement,
  }),
  DetachThreat: Action.DetachThreat({
    threatId: threatId('threat-missing'),
    elementId: actorElement,
  }),
  AddMitigation: Action.AddMitigation({
    mitigation: { ...heldMitigation, threats: [] },
  }),
  ReplaceMitigation: Action.ReplaceMitigation({ mitigation: heldMitigation }),
  LinkMitigation: Action.LinkMitigation({
    mitigationId: firstMitigation,
    threatId: firstThreat,
  }),
  UnlinkMitigation: Action.UnlinkMitigation({
    mitigationId: firstMitigation,
    threatId: firstThreat,
  }),
  SetMitigationStatus: Action.SetMitigationStatus({
    mitigationId: firstMitigation,
    status: 'verified',
  }),
  AddAssumption: Action.AddAssumption({
    assumption: { ...heldAssumption, threats: [] },
  }),
  ReplaceAssumption: Action.ReplaceAssumption({ assumption: heldAssumption }),
  LinkAssumption: Action.LinkAssumption({
    assumptionId: firstAssumption,
    threatId: firstThreat,
  }),
  UnlinkAssumption: Action.UnlinkAssumption({
    assumptionId: firstAssumption,
    threatId: firstThreat,
  }),
  SetAssumptionStatus: Action.SetAssumptionStatus({
    assumptionId: firstAssumption,
    status: 'valid',
  }),
  LinkAssumptionToModel: Action.LinkAssumptionToModel({
    assumptionId: assumptionId('assumption-missing'),
  }),
  UnlinkAssumptionFromModel: Action.UnlinkAssumptionFromModel({
    assumptionId: assumptionId('assumption-missing'),
  }),
  SetModelMetadata: Action.SetModelMetadata({
    change: { description: `Pasted${softHyphen}prose` },
  }),
};

const recordActions = new Set<Action['_tag']>([
  'AddMitigation',
  'ReplaceMitigation',
  'LinkMitigation',
  'UnlinkMitigation',
  'SetMitigationStatus',
  'AddAssumption',
  'ReplaceAssumption',
  'LinkAssumption',
  'UnlinkAssumption',
  'SetAssumptionStatus',
  'LinkAssumptionToModel',
]);

const modelScopedStart = initialState(
  reduce(recordedStart, applied.LinkAssumptionToModel).present,
);

const withHistory: State = {
  ...start,
  past: [emptyModel],
  future: [emptyModel],
  file: FileLifecycle.Opened({ name: 'model.json', source: foreignSource }),
};

const studioActions: ActionsByTag<StudioActionTag> = {
  Undo: Action.Undo(),
  Redo: Action.Redo(),
  SelectDiagram: Action.SelectDiagram({ diagramId: mainDiagram }),
  Select: Action.Select({ elementIds: [actorElement] }),
  ShowModelPanel: Action.ShowModelPanel(),
  HideModelPanel: Action.HideModelPanel(),
  InlineEditing: Action.InlineEditing({
    editor: { kind: 'name', elementId: actorElement },
  }),
  Opened: Action.Opened({
    model: emptyModel,
    name: 'model.json',
    source: foreignSource,
    divergences: [],
  }),
  Imported: Action.Imported({
    model: emptyModel,
    name: 'imported.yaml',
    format: 'otm',
    divergences: [],
  }),
  LinkOpened: Action.LinkOpened({ model: emptyModel, name: 'shared.yaml' }),
  Saved: Action.Saved({ name: 'model.yaml', source: nativeSource }),
  Closed: Action.Closed(),
  Followed: Action.Followed({
    state: {
      ...initialState(placeholderModel),
      past: [sampleModel],
      file: FileLifecycle.Opened({ name: 'model.json', source: foreignSource }),
      recoveryCurrent: true,
    },
  }),
  ReadFailed: Action.ReadFailed({
    name: 'model.yaml',
    failure: ReadFailure.MalformedText({ message: 'not YAML' }),
  }),
  FileRefused: Action.FileRefused({
    operation: 'open',
    reason: 'the browser said no',
  }),
  LinkRefused: Action.LinkRefused({
    failure: LinkFailure.Codec({ failure: ShareLinkFailure.NotAShareLink() }),
  }),
  DismissFailure: Action.DismissFailure(),
};

const purityCases: readonly (readonly [State, Action])[] = [
  ...Object.values(applied).map(
    (action) => [stateFor(action), action] as const,
  ),
  ...Object.values(refused).map((action) => [start, action] as const),
  ...Object.values(studioActions).map(
    (action) => [withHistory, action] as const,
  ),
];

function stateFor(action: Action): State {
  if (Action.$is('ReconnectFlow')(action)) {
    return initialState(
      reduce(
        initialState(placeholderModel),
        Action.AddElement({
          diagramId: placeholderModel.diagrams[0].id,
          element: newProcess('extra-actor', 'Extra actor'),
        }),
      ).present,
    );
  }
  if (
    Action.$is('SetFlowWaypoints')(action) ||
    Action.$is('SetFlowDirection')(action) ||
    Action.$is('SetFlowEndPosition')(action) ||
    Action.$is('ReverseFlow')(action)
  ) {
    return initialState(placeholderModel);
  }
  if (Action.$is('SetBoundaryShape')(action)) {
    return boundaryStart;
  }
  if (Action.$is('UnlinkAssumptionFromModel')(action)) {
    return modelScopedStart;
  }
  if (recordActions.has(action._tag)) {
    return recordedStart;
  }
  return Action.$is('EditNote')(action) ? noteStart : start;
}

describe('purity', () => {
  for (const [state, action] of purityCases) {
    it(`leaves the state it was handed untouched while reducing ${action._tag}`, () => {
      const before = structuredClone(state);
      reduce(state, action);
      expect(state).toStrictEqual(before);
    });
  }
});

describe('a model operation', () => {
  for (const action of Object.values(applied)) {
    it(`pushes the model ${action._tag} replaced onto the past, and round-trips it through undo and redo`, () => {
      const before = stateFor(action);
      const edited = reduce(before, action);
      expect(edited.present).not.toBe(before.present);
      expect(edited.past).toHaveLength(1);
      expect(edited.past.at(0)).toBe(before.present);
      expect(edited.future).toEqual([]);
      expect(edited.lastFailure).toBeUndefined();
      const undone = reduce(edited, Action.Undo());
      expect(undone.present).toBe(before.present);
      expect(undone.past).toEqual([]);
      const redone = reduce(undone, Action.Redo());
      expect(redone.present).toBe(edited.present);
      expect(reduce(redone, Action.Undo()).present).toBe(before.present);
    });
  }
});

describe('an operation the model refuses', () => {
  for (const action of Object.values(refused)) {
    it(`leaves the model and both stacks alone and records why ${action._tag} failed`, () => {
      const next = reduce(start, action);
      expect(next.present).toBe(start.present);
      expect(next.past).toEqual([]);
      expect(next.future).toEqual([]);
      expect(next.lastFailure?._tag).toBe('Operation');
    });
  }

  it('clears the failure on the next edit that lands', () => {
    const stuck = reduce(start, refused.AddElement);
    expect(reduce(stuck, applied.AddElement).lastFailure).toBeUndefined();
  });
});

describe('an edit that names its decimals', () => {
  const flow = elementId('placeholder-flow');
  const placed = initialState(placeholderModel);
  const cases: readonly (readonly [State, Action, ElementId, object])[] = [
    [
      start,
      Action.MoveElement({
        elementId: processElement,
        offset: { x: 0.123456, y: 0.04 },
        decimals: 1,
      }),
      processElement,
      { position: { x: 200.1, y: 0 } },
    ],
    [
      start,
      Action.MoveElements({
        elementIds: [actorElement, processElement],
        offset: { x: 0.123456, y: 0.04 },
        decimals: 3,
      }),
      processElement,
      { position: { x: 200.123, y: 0.04 } },
    ],
    [
      start,
      Action.ArrangeElements({
        moves: [
          { elementId: processElement, offset: { x: 0.123456, y: 0.04 } },
        ],
        decimals: 1,
      }),
      processElement,
      { position: { x: 200.1, y: 0 } },
    ],
    [
      start,
      Action.ResizeElement({
        elementId: processElement,
        offset: { x: 0.123456, y: 0 },
        size: { width: 200.5558, height: 90.4444 },
        decimals: 1,
      }),
      processElement,
      { position: { x: 200.1, y: 0 }, size: { width: 200.6, height: 90.4 } },
    ],
    [
      start,
      Action.AddElement({
        diagramId: mainDiagram,
        element: newProcess('process-noisy', 'Noisy', {
          x: 0.123456,
          y: 200.98765,
        }),
        decimals: 1,
      }),
      elementId('process-noisy'),
      { position: { x: 0.1, y: 201 } },
    ],
    [
      placed,
      Action.SetFlowWaypoints({
        elementId: flow,
        waypoints: [{ x: 200.123456, y: 100.98765 }],
        decimals: 1,
      }),
      flow,
      { waypoints: [{ x: 200.1, y: 101 }] },
    ],
    [
      placed,
      Action.SetFlowEndPosition({
        elementId: flow,
        side: 'target',
        position: { x: 400.123456, y: 200.98765 },
        decimals: 3,
      }),
      flow,
      { target: { position: { x: 400.123, y: 200.988 } } },
    ],
    [
      boundaryStart,
      Action.SetBoundaryShape({
        elementId: boundaryElement,
        shape: {
          kind: 'curve',
          waypoints: [
            { x: -20.123456, y: 80 },
            { x: 160, y: -20.98765 },
          ],
        },
        decimals: 1,
      }),
      boundaryElement,
      {
        shape: {
          waypoints: [
            { x: -20.1, y: 80 },
            { x: 160, y: -21 },
          ],
        },
      },
    ],
  ];

  it.each(cases)(
    'hands the count to the operation, which stores what it writes at it (%#)',
    (state, action, id, stored) => {
      expect(elementById(reduce(state, action), id)).toMatchObject(stored);
    },
  );

  it('frees the flow ends a removal detaches at the count it names', () => {
    const resized = reduce(
      placed,
      Action.ResizeElement({
        elementId: elementId('placeholder-actor'),
        offset: { x: 0.123456, y: 0 },
        size: { width: 100.5558, height: 50.4444 },
      }),
    );
    const before = elementById(resized, elementId('placeholder-actor'));
    const centre =
      before !== undefined && 'position' in before
        ? {
            x: before.position.x + before.size.width / 2,
            y: before.position.y + before.size.height / 2,
          }
        : { x: Number.NaN, y: Number.NaN };

    const removed = reduce(
      resized,
      Action.RemoveElement({
        elementId: elementId('placeholder-actor'),
        decimals: 1,
      }),
    );

    expect(elementById(removed, flow)).toMatchObject({
      source: {
        kind: 'free',
        position: {
          x: Number(centre.x.toFixed(1)),
          y: Number(centre.y.toFixed(1)),
        },
      },
    });
  });
});

describe('the flow end, direction and boundary shape edits', () => {
  const flow = elementId('placeholder-flow');

  it('free one end of a flow at the position given', () => {
    const edited = reduce(
      stateFor(applied.SetFlowEndPosition),
      applied.SetFlowEndPosition,
    );
    expect(elementById(edited, flow)).toMatchObject({
      source: { kind: 'attached', element: 'placeholder-actor' },
      target: { kind: 'free', position: { x: 400, y: 200 } },
    });
  });

  it('swap the two ends of a flow', () => {
    const edited = reduce(stateFor(applied.ReverseFlow), applied.ReverseFlow);
    expect(elementById(edited, flow)).toMatchObject({
      source: { kind: 'attached', element: 'placeholder-store' },
      target: { kind: 'attached', element: 'placeholder-actor' },
    });
  });

  it('give a trust boundary the shape given', () => {
    const edited = reduce(boundaryStart, applied.SetBoundaryShape);
    expect(elementById(edited, boundaryElement)).toMatchObject({
      shape: applied.SetBoundaryShape.shape,
    });
  });
});

describe('history', () => {
  it('is a no-op with nothing to go back to or forward to', () => {
    expect(reduce(start, Action.Undo())).toBe(start);
    expect(reduce(start, Action.Redo())).toBe(start);
  });

  it('restores a removed threat and the records it culled, links and all, in one undo', () => {
    const removed = reduce(recordedStart, applied.RemoveThreat);
    expect(removed.present.mitigations).toEqual([]);
    expect(removed.present.assumptions).toEqual([]);
    expect(reduce(removed, Action.Undo()).present).toBe(recordedStart.present);
  });

  it('keeps history and saved identity for an unchanged route', () => {
    const before = stateFor(applied.SetFlowWaypoints);
    const next = reduce(
      before,
      Action.SetFlowWaypoints({ ...applied.SetFlowWaypoints, waypoints: [] }),
    );
    expect(next).toBe(before);
  });

  it('drops the future once an edit lands on an undone model', () => {
    const undone = reduce(reduce(start, applied.AddElement), Action.Undo());
    expect(undone.future).toHaveLength(1);
    expect(reduce(undone, applied.MoveElement).future).toEqual([]);
  });
});

describe('a threat', () => {
  it('goes with the detach that takes its last element, and one undo brings it back with what it culled', () => {
    const detached = reduce(recordedStart, applied.DetachThreat);
    expect(detached.present.threats.map((threat) => threat.id)).not.toContain(
      firstThreat,
    );
    expect(detached.present.mitigations).toEqual([]);
    expect(detached.past).toHaveLength(1);
    expect(reduce(detached, Action.Undo()).present).toBe(recordedStart.present);
  });

  it('stays where the detach leaves it another element', () => {
    const attached = reduce(recordedStart, applied.AttachThreat);
    const detached = reduce(attached, applied.DetachThreat);
    expect(
      detached.present.threats.find((threat) => threat.id === firstThreat)
        ?.elements,
    ).toEqual([processElement]);
  });

  it('goes with a replace that takes its last element, and one undo brings it back with what it culled', () => {
    const replaced = reduce(
      recordedStart,
      Action.ReplaceThreat({ threat: { ...sampleThreat, elements: [] } }),
    );
    expect(replaced.present.threats.map((threat) => threat.id)).not.toContain(
      firstThreat,
    );
    expect(replaced.present.mitigations).toEqual([]);
    expect(replaced.present.assumptions).toEqual([]);
    expect(replaced.past).toHaveLength(1);
    expect(reduce(replaced, Action.Undo()).present).toBe(recordedStart.present);
  });
});

describe('a record', () => {
  it('goes with the unlink that takes its last threat, and one undo brings it back linked', () => {
    const unlinked = reduce(recordedStart, applied.UnlinkMitigation);
    expect(unlinked.present.mitigations).toEqual([]);
    expect(unlinked.past).toHaveLength(1);
    expect(reduce(unlinked, Action.Undo()).present.mitigations).toEqual([
      heldMitigation,
    ]);
  });

  it('stays on its other threats when a shared link is unlinked', () => {
    const shared = reduce(recordedStart, applied.LinkAssumption);
    const unlinked = reduce(shared, applied.UnlinkAssumption);
    expect(unlinked.present.assumptions).toEqual([
      { ...heldAssumption, threats: [secondThreat] },
    ]);
  });

  it('changes status as one undo step without moving any threat status', () => {
    const changed = reduce(
      reduce(recordedStart, applied.SetMitigationStatus),
      applied.SetAssumptionStatus,
    );
    expect(changed.past).toHaveLength(2);
    expect(changed.present.threats).toBe(recordedStart.present.threats);
  });

  it('keeps history alone for a status or a link it already holds', () => {
    expect(
      reduce(
        recordedStart,
        Action.SetMitigationStatus({
          mitigationId: firstMitigation,
          status: 'proposed',
        }),
      ),
    ).toBe(recordedStart);
    expect(reduce(recordedStart, refused.LinkAssumption)).toBe(recordedStart);
  });
});

describe('an assumption that applies to the model', () => {
  const [modelScoped] = modelScopedStart.present.assumptions;
  const unlinkFromThreat = Action.UnlinkAssumption({
    assumptionId: firstAssumption,
    threatId: firstThreat,
  });

  it('keeps its threat links when it is applied to the model', () => {
    expect(modelScoped).toEqual({ ...heldAssumption, appliesToModel: true });
  });

  it('stays in the model when its only threat link goes, and goes with its model link after that, one undo bringing it back', () => {
    const threatless = reduce(modelScopedStart, unlinkFromThreat);
    expect(threatless.present.assumptions).toEqual([
      { ...modelScoped, threats: [] },
    ]);
    const removed = reduce(threatless, applied.UnlinkAssumptionFromModel);
    expect(removed.present.assumptions).toEqual([]);
    expect(reduce(removed, Action.Undo()).present).toBe(threatless.present);
  });

  it('stays on its threat when its model link goes', () => {
    expect(
      reduce(modelScopedStart, applied.UnlinkAssumptionFromModel).present
        .assumptions,
    ).toEqual([heldAssumption]);
  });
});

describe('the model metadata', () => {
  it('commits the title and the description as one undo step each', () => {
    const retitled = reduce(start, applied.SetModelMetadata);
    const described = reduce(
      retitled,
      Action.SetModelMetadata({ change: { description: 'Shared models.' } }),
    );
    expect(described.present.metadata).toMatchObject({
      title: 'Retitled model',
      description: 'Shared models.',
    });
    expect(described.past).toHaveLength(2);
    expect(reduce(described, Action.Undo()).present.metadata).toBe(
      retitled.present.metadata,
    );
  });

  it('keeps history alone for a value the model already holds', () => {
    expect(
      reduce(
        start,
        Action.SetModelMetadata({
          change: { title: start.present.metadata.title },
        }),
      ),
    ).toBe(start);
  });
});

const details = (state: State) => {
  const element = elementById(state, noteElement);
  return {
    description: element?.description,
    outOfScope: element?.outOfScope,
    reasonOutOfScope: element?.reasonOutOfScope,
  };
};

const detailed = (state: State, change: ElementDetailsChange) =>
  reduce(state, Action.SetElementDetails({ elementId: noteElement, change }));

describe('the element details', () => {
  it('commits the description, the flag and the reason on a note as one undo step each', () => {
    const described = detailed(noteStart, { description: 'Draft only.' });
    const flagged = detailed(described, { outOfScope: true });
    const reasoned = detailed(flagged, { reasonOutOfScope: 'Not deployed.' });
    expect(details(reasoned)).toEqual({
      description: 'Draft only.',
      outOfScope: true,
      reasonOutOfScope: 'Not deployed.',
    });
    expect(reasoned.past).toHaveLength(3);
    expect(reduce(reasoned, Action.Undo()).present).toBe(flagged.present);
  });

  it('keeps the reason when the flag clears, and the flag when the reason changes', () => {
    const outOfScope = detailed(noteStart, {
      outOfScope: true,
      reasonOutOfScope: 'Not deployed.',
    });
    expect(details(detailed(outOfScope, { outOfScope: false }))).toMatchObject({
      outOfScope: false,
      reasonOutOfScope: 'Not deployed.',
    });
    expect(
      details(detailed(outOfScope, { reasonOutOfScope: '' })),
    ).toMatchObject({ outOfScope: true, reasonOutOfScope: '' });
  });

  it('keeps history alone for a value the element already holds', () => {
    expect(detailed(noteStart, { outOfScope: false })).toBe(noteStart);
  });

  it('records a refused character or an unknown element as the model names it, leaving the model alone', () => {
    const refusedReason = detailed(noteStart, {
      reasonOutOfScope: `Not${softHyphen}deployed`,
    });
    expect(refusedReason.present).toBe(noteStart.present);
    expect(refusedReason.lastFailure).toMatchObject({
      failure: { _tag: 'RefusedCharacter' },
    });
    expect(
      reduce(noteStart, refused.SetElementDetails).lastFailure,
    ).toMatchObject({ failure: { _tag: 'UnknownElement' } });
  });
});

describe('the model panel', () => {
  const selected = reduce(start, Action.Select({ elementIds: [actorElement] }));
  const shown = reduce(selected, Action.ShowModelPanel());

  it('shows in place of the selection, clearing it, with no history and no unsaved work', () => {
    expect(shown.modelPanel).toBe(true);
    expect(shown.selection).toEqual([]);
    expect(shown.present).toBe(start.present);
    expect(shown.past).toEqual([]);
  });

  it('gives way to a selection, and stays through a cleared one', () => {
    expect(
      reduce(shown, Action.Select({ elementIds: [actorElement] })).modelPanel,
    ).toBe(false);
    expect(reduce(shown, Action.Select({ elementIds: [] }))).toBe(shown);
  });

  it('hides on request, and is the same state where it is not shown', () => {
    expect(reduce(shown, Action.HideModelPanel()).modelPanel).toBe(false);
    expect(reduce(start, Action.HideModelPanel())).toBe(start);
    expect(reduce(shown, Action.ShowModelPanel())).toBe(shown);
  });

  it('stays through an edit another tab made, and closes on a new model', () => {
    const elsewhere = reduce(start, applied.SetModelMetadata);
    expect(
      reduce(shown, Action.Followed({ state: result(elsewhere) })).modelPanel,
    ).toBe(true);
    expect(reduce(shown, studioActions.Opened).modelPanel).toBe(false);
    expect(reduce(shown, Action.Closed()).modelPanel).toBe(false);
  });
});

describe('selection', () => {
  it('follows what a view selects', () => {
    const selected = reduce(
      start,
      Action.Select({ elementIds: [actorElement] }),
    );
    expect(selected.selection).toEqual([actorElement]);
    expect(
      reduce(selected, Action.Select({ elementIds: [] })).selection,
    ).toEqual([]);
  });

  it('clears when the element it names is removed', () => {
    const selected = reduce(
      start,
      Action.Select({ elementIds: [processElement] }),
    );
    expect(reduce(selected, applied.RemoveElement).selection).toEqual([]);
  });

  it('stays on an element another removal does not touch', () => {
    const selected = reduce(
      start,
      Action.Select({ elementIds: [actorElement] }),
    );
    expect(reduce(selected, applied.RemoveElement).selection).toEqual([
      actorElement,
    ]);
  });

  it('clears every removed member of a multi-selection', () => {
    const selected = reduce(
      start,
      Action.Select({ elementIds: [actorElement, processElement] }),
    );
    expect(reduce(selected, applied.RemoveElements).selection).toEqual([]);
  });
});

const show = (chosen: DiagramId): Action =>
  Action.SelectDiagram({ diagramId: chosen });

describe('the active diagram', () => {
  const twoStart = initialState(twoDiagramModel);

  it('moves to the diagram chosen, with no history and no unsaved work', () => {
    const switched = reduce(twoStart, show(secondDiagram));
    expect(activeDiagramId(switched)).toBe(secondDiagram);
    expect(switched.present).toBe(twoStart.present);
    expect(switched.saved).toBe(twoStart.saved);
    expect(switched.past).toEqual([]);
    expect(switched.future).toEqual([]);
    expect(reduce(switched, Action.Undo())).toBe(switched);
  });

  it('is the same state when the diagram chosen is the one on screen', () => {
    expect(reduce(twoStart, show(mainDiagram))).toBe(twoStart);
    const switched = reduce(twoStart, show(secondDiagram));
    expect(reduce(switched, show(secondDiagram))).toBe(switched);
  });

  it('clears the selection and closes the inline editor, which belong to the diagram left', () => {
    const editing = reduce(
      reduce(twoStart, Action.Select({ elementIds: [actorElement] })),
      Action.InlineEditing({
        editor: { kind: 'name', elementId: actorElement },
      }),
    );
    const switched = reduce(editing, show(secondDiagram));
    expect(switched.selection).toEqual([]);
    expect(switched.inlineEditor).toBeUndefined();
  });

  it('refuses a diagram the model does not hold and stays where it is', () => {
    const unknown = reduce(twoStart, show(diagramId('diagram-missing')));
    expect(activeDiagramId(unknown)).toBe(mainDiagram);
    expect(unknown.lastFailure).toEqual(
      StudioFailure.Operation({
        failure: OperationFailure.UnknownDiagram({
          diagramId: diagramId('diagram-missing'),
        }),
      }),
    );
  });

  it('stays through an edit and its undo, an edit being the only thing the stacks hold', () => {
    const switched = reduce(twoStart, show(secondDiagram));
    const edited = reduce(
      switched,
      Action.RenameElement({ elementId: otherElement, name: 'Renamed' }),
    );
    expect(activeDiagramId(edited)).toBe(secondDiagram);
    expect(activeDiagramId(reduce(edited, Action.Undo()))).toBe(secondDiagram);
  });

  it('falls back to the first diagram while the model no longer holds the one named', () => {
    const switched = reduce(twoStart, show(secondDiagram));
    const opened = reduce(
      switched,
      Action.Opened({
        model: sampleModel,
        name: 'one.yaml',
        source: nativeSource,
        divergences: [],
      }),
    );
    expect(opened.activeDiagram).toBeUndefined();
    expect(activeDiagramId(opened)).toBe(mainDiagram);
  });

  it('shows the diagram it adds, and shows the first again once the add is undone', () => {
    const selected = reduce(
      start,
      Action.Select({ elementIds: [actorElement] }),
    );
    const added = reduce(selected, applied.AddDiagram);
    expect(activeDiagramId(added)).toBe(secondDiagram);
    expect(added.selection).toEqual([]);
    expect(added.past).toHaveLength(1);
    expect(activeDiagramId(reduce(added, Action.Undo()))).toBe(mainDiagram);
    expect(reduce(start, refused.AddDiagram)).toMatchObject({
      present: start.present,
      activeDiagram: undefined,
    });
  });

  it('resets on a new model and on closing, with the rest of the view state', () => {
    const switched = reduce(twoStart, show(secondDiagram));
    expect(
      reduce(switched, studioActions.Imported).activeDiagram,
    ).toBeUndefined();
    expect(
      reduce(switched, studioActions.LinkOpened).activeDiagram,
    ).toBeUndefined();
    expect(reduce(switched, Action.Closed()).activeDiagram).toBeUndefined();
  });
});

describe('the inline editor', () => {
  const editor = { kind: 'name', elementId: processElement } as const;
  const opened = reduce(start, Action.InlineEditing({ editor }));

  it('follows what the canvas opens and closes', () => {
    expect(opened.inlineEditor).toEqual(editor);
    expect(
      reduce(opened, Action.InlineEditing({ editor: undefined })).inlineEditor,
    ).toBeUndefined();
  });

  it('stays out of the undo stacks, an edit being the only thing they hold', () => {
    expect(opened.past).toEqual([]);
    expect(opened.present).toBe(start.present);
    const edited = reduce(opened, applied.RenameElement);
    expect(reduce(edited, Action.Undo()).inlineEditor).toEqual(editor);
  });

  it('closes when the element it names is removed', () => {
    expect(reduce(opened, applied.RemoveElement).inlineEditor).toBeUndefined();
  });
});

describe('the file lifecycle', () => {
  it('opens on a fresh history, with the opened model already saved', () => {
    const working = reduce(start, applied.AddElement);
    const opened = reduce(working, studioActions.Opened);
    expect(opened.present).toBe(emptyModel);
    expect(opened.saved).toBe(emptyModel);
    expect(opened.past).toEqual([]);
    expect(opened.future).toEqual([]);
    expect(opened.file).toEqual(
      FileLifecycle.Opened({ name: 'model.json', source: foreignSource }),
    );
  });

  it('keeps nothing of what the read dropped, which describes the file', () => {
    const opened = reduce(
      start,
      Action.Opened({
        model: emptyModel,
        name: 'model.json',
        source: foreignSource,
        divergences: [
          {
            subject: { kind: 'model' },
            detail: {
              code: 'key-undeclared',
              parameters: { path: 'unknownRoot' },
            },
            reason: 'undeclared',
          },
        ],
      }),
    );

    expect(JSON.stringify(opened)).not.toContain('unknownRoot');
  });

  it('names the file a first save writes to, having had none', () => {
    const working = reduce(start, applied.AddElement);
    const saved = reduce(
      working,
      Action.Saved({ name: 'new.yaml', source: nativeSource }),
    );
    expect(saved.saved).toBe(working.present);
    expect(saved.past).toBe(working.past);
    expect(saved.file).toEqual(
      FileLifecycle.Opened({ name: 'new.yaml', source: nativeSource }),
    );
  });

  it('moves the open file, and what a save merges onto, when a save writes elsewhere', () => {
    const opened = reduce(
      start,
      Action.Opened({
        model: sampleModel,
        name: 'model.json',
        source: foreignSource,
        divergences: [],
      }),
    );
    const working = reduce(opened, applied.AddElement);
    const saved = reduce(
      working,
      Action.Saved({ name: 'model.yaml', source: nativeSource }),
    );
    expect(saved.saved).toBe(working.present);
    expect(saved.file).toEqual(
      FileLifecycle.Opened({ name: 'model.yaml', source: nativeSource }),
    );
  });

  it('keeps the retained document out of the undo stacks', () => {
    const opened = reduce(start, studioActions.Opened);
    const working = reduce(opened, applied.AddElement);
    expect(reduce(working, Action.Undo()).file).toBe(opened.file);
  });

  it('closes back to the state the studio booted in, keeping nothing of the file', () => {
    const working = reduce(
      withHistory,
      Action.Select({ elementIds: [actorElement] }),
    );
    expect(working.past).toHaveLength(1);
    expect(working.future).toHaveLength(1);

    const closed = reduce(working, Action.Closed());

    expect(closed.file).toEqual(FileLifecycle.NoFile());
    expect(closed.present).toBe(placeholderModel);
    expect(closed.saved).toBe(placeholderModel);
    expect(closed.past).toEqual([]);
    expect(closed.future).toEqual([]);
    expect(closed.selection).toEqual([]);
  });
});

const result = (state: State) => ({
  present: state.present,
  past: state.past,
  future: state.future,
  saved: state.saved,
  file: state.file,
  recoveryCurrent: state.recoveryCurrent,
});

describe('following another tab', () => {
  const working = reduce(
    reduce(
      reduce(withHistory, Action.Select({ elementIds: [actorElement] })),
      Action.InlineEditing({
        editor: { kind: 'name', elementId: actorElement },
      }),
    ),
    refused.RemoveElement,
  );
  const elsewhere = reduce(
    reduce(withHistory, applied.AddElement),
    Action.Saved({
      name: 'elsewhere.yaml',
      source: nativeSource,
    }),
  );
  it('adopts the model, both stacks, the saved point and the file another tab reached, and clears the last refusal', () => {
    expect(working.lastFailure).toBeDefined();

    const followed = reduce(
      working,
      Action.Followed({ state: result(elsewhere) }),
    );

    expect(result(followed)).toEqual(result(elsewhere));
    expect(followed.present).toBe(elsewhere.present);
    expect(followed.past).toBe(elsewhere.past);
    expect(followed.lastFailure).toBeUndefined();
  });

  it('keeps the selection and the open field where the model still draws them', () => {
    const followed = reduce(
      working,
      Action.Followed({ state: result(elsewhere) }),
    );

    expect(followed.selection).toBe(working.selection);
    expect(followed.inlineEditor).toBe(working.inlineEditor);
  });

  it('drops the selection and closes the field over an element the model no longer draws', () => {
    const followed = reduce(
      working,
      Action.Followed({ state: result(initialState(placeholderModel)) }),
    );

    expect(followed.selection).toEqual([]);
    expect(followed.inlineEditor).toBeUndefined();
  });

  it('keeps the diagram on screen to this tab, falling back where the adopted model lacks it', () => {
    const shown = reduce(
      initialState(twoDiagramModel),
      Action.SelectDiagram({ diagramId: secondDiagram }),
    );

    const same = reduce(
      shown,
      Action.Followed({ state: result(initialState(twoDiagramModel)) }),
    );
    const without = reduce(
      shown,
      Action.Followed({ state: result(initialState(sampleModel)) }),
    );

    expect(same.activeDiagram).toBe(secondDiagram);
    expect(activeDiagramId(same)).toBe(secondDiagram);
    expect(activeDiagramId(without)).toBe(mainDiagram);
  });
});

describe('a refusal outside the model', () => {
  it.each(['open', 'save'] as const)(
    'records a %s refusal with its file policy',
    (operation) => {
      const opened = reduce(start, studioActions.Opened);
      const next = reduce(
        opened,
        Action.FileRefused({ operation, reason: 'NotAllowedError' }),
      );
      expect(next.file).toEqual(
        operation === 'open' ? FileLifecycle.NoFile() : opened.file,
      );
      expect(next.present).toBe(opened.present);
      expect(next.saved).toBe(opened.saved);
    },
  );

  it('records why nothing read the file, leaving the model alone', () => {
    const next = reduce(start, studioActions.ReadFailed);
    expect(next.present).toBe(start.present);
    expect(next.past).toEqual([]);
    expect(next.lastFailure).toEqual(
      StudioFailure.Read({
        name: 'model.yaml',
        failure: ReadFailure.MalformedText({ message: 'not YAML' }),
      }),
    );
  });

  it('records what the platform said when no file arrived at all', () => {
    const next = reduce(start, studioActions.FileRefused);
    expect(next.lastFailure).toEqual(
      StudioFailure.File({ reason: 'the browser said no' }),
    );
  });

  it('records why a shared link opened nothing, leaving the model and the file alone', () => {
    const opened = reduce(withHistory, studioActions.Opened);
    const next = reduce(opened, studioActions.LinkRefused);

    expect(next.lastFailure).toEqual(
      StudioFailure.Link({ failure: studioActions.LinkRefused.failure }),
    );
    expect(next.present).toBe(opened.present);
    expect(next.saved).toBe(opened.saved);
    expect(next.file).toBe(opened.file);
  });

  it('clears a stale refusal once a save lands', () => {
    const stuck = reduce(start, studioActions.FileRefused);
    expect(reduce(stuck, studioActions.Saved).lastFailure).toBeUndefined();
  });

  it('puts a refusal away on a dismissal, moving neither model nor stacks', () => {
    const stuck = reduce(withHistory, studioActions.FileRefused);
    const next = reduce(stuck, studioActions.DismissFailure);

    expect(next.lastFailure).toBeUndefined();
    expect(next.present).toBe(stuck.present);
    expect(next.past).toBe(stuck.past);
    expect(next.future).toBe(stuck.future);
    expect(next.saved).toBe(stuck.saved);
    expect(next.file).toBe(stuck.file);
  });

  it('records a later refusal after a dismissal', () => {
    const dismissed = reduce(
      reduce(start, studioActions.FileRefused),
      studioActions.DismissFailure,
    );

    expect(reduce(dismissed, studioActions.ReadFailed).lastFailure).toEqual(
      StudioFailure.Read({
        name: 'model.yaml',
        failure: ReadFailure.MalformedText({ message: 'not YAML' }),
      }),
    );
  });

  it('keeps the state it was handed where there is no refusal to dismiss', () => {
    expect(reduce(start, studioActions.DismissFailure)).toBe(start);
  });
});
