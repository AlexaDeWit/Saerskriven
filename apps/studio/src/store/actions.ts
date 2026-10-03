import type {
  DetectionFailure,
  Divergence,
  ImportFormat,
  ReadFailure,
  RetainedSource,
} from '@saerskriven/formats';
import type { GestureInput } from '@saerskriven/canvas';
import type {
  Assumption,
  AssumptionId,
  AssumptionStatus,
  BoundaryShape,
  Diagram,
  DiagramId,
  Element,
  ElementDetailsChange,
  ElementId,
  ElementProperties,
  Mitigation,
  MitigationId,
  MitigationStatus,
  Model,
  ModelMetadataChange,
  Point,
  Side,
  Size,
  Threat,
  ThreatId,
} from '@saerskriven/model';
import { Data } from 'effect';
import type { InlineEditor, LinkFailure } from './state.js';
import type { SyncedState } from './sync.js';

/** Every state change the reducer accepts. */
export type Action = Data.TaggedEnum<{
  SetElementProperties: {
    readonly elementId: ElementId;
    readonly properties: ElementProperties;
  };
  SetElementDetails: {
    readonly elementId: ElementId;
    readonly change: ElementDetailsChange;
  };
  AddElement: { readonly diagramId: DiagramId; readonly element: Element };
  InsertFragment: { readonly diagramId: DiagramId; readonly fragment: Model };
  ArrangeElements: {
    readonly moves: readonly {
      readonly elementId: ElementId;
      readonly offset: Point;
    }[];
  };
  ReconnectFlow: {
    readonly elementId: ElementId;
    readonly side: 'source' | 'target';
    readonly endpointId: ElementId;
    readonly anchor?: Side;
  };
  SetFlowDirection: {
    readonly elementId: ElementId;
    readonly bidirectional: boolean;
  };
  SetFlowEndPosition: {
    readonly elementId: ElementId;
    readonly side: 'source' | 'target';
    readonly position: Point;
  };
  ReverseFlow: { readonly elementId: ElementId };
  SetBoundaryShape: {
    readonly elementId: ElementId;
    readonly shape: BoundaryShape;
  };
  RemoveElement: { readonly elementId: ElementId };
  RemoveElements: { readonly elementIds: readonly ElementId[] };
  MoveElement: { readonly elementId: ElementId; readonly offset: Point };
  MoveElements: {
    readonly elementIds: readonly ElementId[];
    readonly offset: Point;
  };
  ResizeElement: {
    readonly elementId: ElementId;
    readonly offset: Point;
    readonly size: Size;
  };
  RenameElement: { readonly elementId: ElementId; readonly name: string };
  EditNote: { readonly elementId: ElementId; readonly text: string };
  SetFlowWaypoints: {
    readonly elementId: ElementId;
    readonly waypoints: readonly Point[];
  };
  AddThreat: { readonly threat: Threat };
  RemoveThreat: { readonly threatId: ThreatId };
  ReplaceThreat: { readonly threat: Threat };
  AttachThreat: { readonly threatId: ThreatId; readonly elementId: ElementId };
  DetachThreat: { readonly threatId: ThreatId; readonly elementId: ElementId };
  AddMitigation: { readonly mitigation: Mitigation };
  ReplaceMitigation: { readonly mitigation: Mitigation };
  LinkMitigation: {
    readonly mitigationId: MitigationId;
    readonly threatId: ThreatId;
  };
  UnlinkMitigation: {
    readonly mitigationId: MitigationId;
    readonly threatId: ThreatId;
  };
  SetMitigationStatus: {
    readonly mitigationId: MitigationId;
    readonly status: MitigationStatus;
  };
  AddAssumption: { readonly assumption: Assumption };
  ReplaceAssumption: { readonly assumption: Assumption };
  LinkAssumption: {
    readonly assumptionId: AssumptionId;
    readonly threatId: ThreatId;
  };
  UnlinkAssumption: {
    readonly assumptionId: AssumptionId;
    readonly threatId: ThreatId;
  };
  SetAssumptionStatus: {
    readonly assumptionId: AssumptionId;
    readonly status: AssumptionStatus;
  };
  LinkAssumptionToModel: { readonly assumptionId: AssumptionId };
  UnlinkAssumptionFromModel: { readonly assumptionId: AssumptionId };
  SetModelMetadata: { readonly change: ModelMetadataChange };
  Gesture: { readonly input: GestureInput; readonly edit: GestureEdit };
  AddDiagram: { readonly diagram: Diagram };
  RenameDiagram: { readonly diagramId: DiagramId; readonly title: string };
  Undo: {};
  Redo: {};
  SelectDiagram: { readonly diagramId: DiagramId };
  Select: { readonly elementIds: readonly ElementId[] };
  ShowModelPanel: {};
  HideModelPanel: {};
  InlineEditing: { readonly editor: InlineEditor | undefined };
  Opened: {
    readonly model: Model;
    readonly name: string;
    readonly source: RetainedSource;
    readonly divergences: readonly Divergence[];
  };
  Imported: {
    readonly model: Model;
    readonly name: string;
    readonly format: ImportFormat;
    readonly divergences: readonly Divergence[];
  };
  LinkOpened: { readonly model: Model; readonly name: string };
  Saved: { readonly name: string; readonly source: RetainedSource };
  Closed: {};
  Followed: { readonly state: SyncedState };
  ReadFailed: {
    readonly name: string;
    readonly failure: ReadFailure | DetectionFailure;
  };
  FileRefused: {
    readonly operation: 'open' | 'save';
    readonly reason: string;
  };
  LinkRefused: { readonly failure: LinkFailure };
  DismissFailure: {};
}>;

/** An edit a canvas gesture commits: one that can write a position, a size or a run of points. */
export type GestureEdit = Extract<
  Action,
  {
    readonly _tag:
      | 'AddElement'
      | 'MoveElement'
      | 'MoveElements'
      | 'ReconnectFlow'
      | 'ResizeElement'
      | 'SetBoundaryShape'
      | 'SetFlowEndPosition'
      | 'SetFlowWaypoints';
  }
>;

/** Constructors and matching helpers for store actions. */
export const Action = Data.taggedEnum<Action>();

/**
 * `edit` as a gesture made with `input` commits it, or as it is where nothing
 * names an input: a typed number or a command, whose numbers the store does
 * not round.
 */
export function committedBy(
  input: GestureInput | undefined,
  edit: GestureEdit,
): Action {
  return input === undefined ? edit : Action.Gesture({ input, edit });
}
