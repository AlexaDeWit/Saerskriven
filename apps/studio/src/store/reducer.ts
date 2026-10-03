import {
  addAssumption,
  addDiagram,
  addMitigation,
  linkAssumption,
  linkAssumptionToModel,
  linkMitigation,
  linkThreatToModel,
  replaceAssumption,
  replaceMitigation,
  setAssumptionStatus,
  setModelMetadata,
  setMitigationStatus,
  unlinkAssumption,
  unlinkAssumptionFromModel,
  unlinkMitigation,
  unlinkThreatFromModel,
  addElement,
  setElementDetails,
  setElementProperties,
  insertFragment,
  renameDiagram,
  reconnectFlow,
  addThreat,
  attachThreat,
  detachThreat,
  editNote,
  elementIdsAcross,
  moveElement,
  removeElement,
  removeThreat,
  renameElement,
  replaceThreat,
  resizeElement,
  reverseFlow,
  setBoundaryShape,
  setFlowDirection,
  setFlowEndPosition,
  setFlowWaypoints,
  OperationFailure,
  type Diagram,
  type DiagramId,
  type ElementId,
  type Model,
} from '@saerskriven/model';
import { Either } from 'effect';
import { Action } from './actions.js';
import { activeDiagramId, holdsDiagram } from './selectors.js';
import { sameSelection } from './selection.js';
import {
  FileLifecycle,
  StudioFailure,
  initialState,
  placeholderModel,
  type State,
} from './state.js';
import type { SyncedState } from './sync.js';

/** Refused model operations preserve the model and history, and record the failure. */
export function reduce(state: State, action: Action): State {
  return Action.$match(action, {
    SetElementProperties: ({ elementId, properties }) =>
      edited(state, setElementProperties(state.present, elementId, properties)),
    SetElementDetails: ({ elementId, change }) =>
      edited(state, setElementDetails(state.present, elementId, change)),
    InsertFragment: ({ diagramId, fragment }) =>
      edited(state, insertFragment(state.present, diagramId, fragment)),
    ReconnectFlow: ({ elementId, side, endpointId, anchor }) =>
      edited(
        state,
        reconnectFlow(state.present, elementId, side, endpointId, anchor),
      ),
    SetFlowDirection: ({ elementId, bidirectional }) =>
      edited(state, setFlowDirection(state.present, elementId, bidirectional)),
    SetFlowEndPosition: ({ elementId, side, position }) =>
      edited(
        state,
        setFlowEndPosition(state.present, elementId, side, position),
      ),
    ReverseFlow: ({ elementId }) =>
      edited(state, reverseFlow(state.present, elementId)),
    SetBoundaryShape: ({ elementId, shape }) =>
      edited(state, setBoundaryShape(state.present, elementId, shape)),
    ArrangeElements: ({ moves }) =>
      edited(
        state,
        moves.reduce<Either.Either<Model, OperationFailure>>(
          (outcome, { elementId, offset }) =>
            Either.flatMap(outcome, (model) =>
              offset.x === 0 && offset.y === 0
                ? Either.right(model)
                : moveElement(model, elementId, offset),
            ),
          Either.right(state.present),
        ),
      ),
    AddElement: ({ diagramId, element }) =>
      edited(state, addElement(state.present, diagramId, element)),
    RemoveElement: ({ elementId }) => removedElements(state, [elementId]),
    RemoveElements: ({ elementIds }) => removedElements(state, elementIds),
    MoveElement: ({ elementId, offset }) =>
      edited(state, moveElement(state.present, elementId, offset)),
    MoveElements: ({ elementIds, offset }) =>
      edited(
        state,
        editElements(state.present, elementIds, (model, elementId) =>
          moveElement(model, elementId, offset),
        ),
      ),
    ResizeElement: ({ elementId, offset, size }) =>
      edited(
        state,
        Either.flatMap(moveElement(state.present, elementId, offset), (moved) =>
          resizeElement(moved, elementId, size),
        ),
      ),
    RenameElement: ({ elementId, name }) =>
      edited(state, renameElement(state.present, elementId, name)),
    EditNote: ({ elementId, text }) =>
      edited(state, editNote(state.present, elementId, text)),
    SetFlowWaypoints: ({ elementId, waypoints }) =>
      edited(state, setFlowWaypoints(state.present, elementId, waypoints)),
    AddThreat: ({ threat }) => edited(state, addThreat(state.present, threat)),
    RemoveThreat: ({ threatId }) =>
      edited(state, removeThreat(state.present, threatId)),
    ReplaceThreat: ({ threat }) =>
      edited(state, replaceThreat(state.present, threat)),
    AttachThreat: ({ threatId, elementId }) =>
      edited(state, attachThreat(state.present, threatId, elementId)),
    DetachThreat: ({ threatId, elementId }) =>
      edited(state, detachThreat(state.present, threatId, elementId)),
    LinkThreatToModel: ({ threatId }) =>
      edited(state, linkThreatToModel(state.present, threatId)),
    UnlinkThreatFromModel: ({ threatId }) =>
      edited(state, unlinkThreatFromModel(state.present, threatId)),
    AddMitigation: ({ mitigation }) =>
      edited(state, addMitigation(state.present, mitigation)),
    ReplaceMitigation: ({ mitigation }) =>
      edited(state, replaceMitigation(state.present, mitigation)),
    LinkMitigation: ({ mitigationId, threatId }) =>
      edited(state, linkMitigation(state.present, mitigationId, threatId)),
    UnlinkMitigation: ({ mitigationId, threatId }) =>
      edited(state, unlinkMitigation(state.present, mitigationId, threatId)),
    SetMitigationStatus: ({ mitigationId, status }) =>
      edited(state, setMitigationStatus(state.present, mitigationId, status)),
    AddAssumption: ({ assumption }) =>
      edited(state, addAssumption(state.present, assumption)),
    ReplaceAssumption: ({ assumption }) =>
      edited(state, replaceAssumption(state.present, assumption)),
    LinkAssumption: ({ assumptionId, threatId }) =>
      edited(state, linkAssumption(state.present, assumptionId, threatId)),
    UnlinkAssumption: ({ assumptionId, threatId }) =>
      edited(state, unlinkAssumption(state.present, assumptionId, threatId)),
    SetAssumptionStatus: ({ assumptionId, status }) =>
      edited(state, setAssumptionStatus(state.present, assumptionId, status)),
    LinkAssumptionToModel: ({ assumptionId }) =>
      edited(state, linkAssumptionToModel(state.present, assumptionId)),
    UnlinkAssumptionFromModel: ({ assumptionId }) =>
      edited(state, unlinkAssumptionFromModel(state.present, assumptionId)),
    SetModelMetadata: ({ change }) =>
      edited(state, setModelMetadata(state.present, change)),
    AddDiagram: ({ diagram }) => addedDiagram(state, diagram),
    RenameDiagram: ({ diagramId, title }) =>
      edited(state, renameDiagram(state.present, diagramId, title)),
    Undo: () => undone(state),
    Redo: () => redone(state),
    SelectDiagram: ({ diagramId }) => selectedDiagram(state, diagramId),
    Select: ({ elementIds }) => withSelection(state, elementIds),
    ShowModelPanel: () =>
      state.modelPanel && state.selection.length === 0
        ? state
        : { ...state, selection: [], modelPanel: true },
    HideModelPanel: () =>
      state.modelPanel ? { ...state, modelPanel: false } : state,
    InlineEditing: ({ editor }) => ({ ...state, inlineEditor: editor }),
    Opened: ({ model, name, source }) => ({
      ...initialState(model),
      file: FileLifecycle.Opened({ name, source }),
    }),
    Imported: ({ model, name }) => arrivedUnsaved(model, name),
    LinkOpened: ({ model, name }) => arrivedUnsaved(model, name),
    Saved: ({ name, source }) => ({
      ...state,
      saved: state.present,
      file: FileLifecycle.Opened({ name, source }),
      lastFailure: undefined,
    }),
    Closed: () => initialState(placeholderModel),
    Followed: ({ state: synced }) => followed(state, synced),
    ReadFailed: ({ name, failure }) => ({
      ...state,
      file: FileLifecycle.NoFile(),
      lastFailure: StudioFailure.Read({ name, failure }),
    }),
    FileRefused: ({ operation, reason }) => ({
      ...state,
      file: operation === 'open' ? FileLifecycle.NoFile() : state.file,
      lastFailure: StudioFailure.File({ reason }),
    }),
    LinkRefused: ({ failure }) => ({
      ...state,
      lastFailure: StudioFailure.Link({ failure }),
    }),
    DismissFailure: () =>
      state.lastFailure === undefined
        ? state
        : { ...state, lastFailure: undefined },
  });
}

function arrivedUnsaved(model: Model, name: string): State {
  return {
    ...initialState(model),
    saved: { ...model },
    file: FileLifecycle.Opened({
      name,
      source: { format: 'saerskriven-yaml', document: undefined },
    }),
  };
}

function edited(
  state: State,
  outcome: Either.Either<Model, OperationFailure>,
): State {
  return Either.match(outcome, {
    onLeft: (failure) => ({
      ...state,
      lastFailure: StudioFailure.Operation({ failure }),
    }),
    onRight: (present) =>
      present === state.present
        ? state
        : {
            ...state,
            present,
            past: [...state.past, state.present],
            future: [],
            lastFailure: undefined,
          },
  });
}

function addedDiagram(state: State, diagram: Diagram): State {
  const outcome = addDiagram(state.present, diagram);
  const next = edited(state, outcome);
  return Either.isLeft(outcome) ? next : selectedDiagram(next, diagram.id);
}

function selectedDiagram(state: State, diagramId: DiagramId): State {
  if (!holdsDiagram(state.present, diagramId)) {
    return {
      ...state,
      lastFailure: StudioFailure.Operation({
        failure: OperationFailure.UnknownDiagram({ diagramId }),
      }),
    };
  }
  if (diagramId === activeDiagramId(state)) {
    return state;
  }
  return {
    ...state,
    activeDiagram: diagramId,
    selection: state.selection.length === 0 ? state.selection : [],
    inlineEditor: undefined,
  };
}

function withSelection(state: State, elementIds: readonly ElementId[]): State {
  const selection = [...new Set(elementIds)];
  const modelPanel = state.modelPanel && selection.length === 0;
  return sameSelection(state.selection, selection) &&
    modelPanel === state.modelPanel
    ? state
    : { ...state, selection, modelPanel };
}

function removedElements(
  state: State,
  elementIds: readonly ElementId[],
): State {
  const removed = new Set(elementIds);
  if (removed.size === 0) {
    return state;
  }
  const outcome = editElements(state.present, [...removed], removeElement);
  const next = edited(state, outcome);
  if (Either.isLeft(outcome)) {
    return next;
  }
  return {
    ...next,
    selection: next.selection.filter((selected) => !removed.has(selected)),
    inlineEditor:
      next.inlineEditor !== undefined &&
      removed.has(next.inlineEditor.elementId)
        ? undefined
        : next.inlineEditor,
  };
}

function editElements(
  model: Model,
  elementIds: readonly ElementId[],
  edit: (
    current: Model,
    elementId: ElementId,
  ) => Either.Either<Model, OperationFailure>,
): Either.Either<Model, OperationFailure> {
  return [...new Set(elementIds)].reduce<
    Either.Either<Model, OperationFailure>
  >(
    (outcome, elementId) =>
      Either.flatMap(outcome, (current) => edit(current, elementId)),
    Either.right(model),
  );
}

function followed(state: State, synced: SyncedState): State {
  const { present, past, future, saved, file, recoveryCurrent } = synced;
  const drawn = elementIdsAcross(present.diagrams);
  const selection = state.selection.filter((selected) => drawn.has(selected));
  return {
    ...state,
    present,
    past,
    future,
    saved,
    file,
    recoveryCurrent,
    selection: sameSelection(state.selection, selection)
      ? state.selection
      : selection,
    inlineEditor:
      state.inlineEditor !== undefined &&
      drawn.has(state.inlineEditor.elementId)
        ? state.inlineEditor
        : undefined,
    lastFailure: undefined,
  };
}

function undone(state: State): State {
  const previous = state.past.at(-1);
  return previous === undefined
    ? state
    : {
        ...state,
        present: previous,
        past: state.past.slice(0, -1),
        future: [state.present, ...state.future],
        lastFailure: undefined,
      };
}

function redone(state: State): State {
  const next = state.future.at(0);
  return next === undefined
    ? state
    : {
        ...state,
        present: next,
        past: [...state.past, state.present],
        future: state.future.slice(1),
        lastFailure: undefined,
      };
}
