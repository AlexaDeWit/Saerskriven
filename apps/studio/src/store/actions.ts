import type {
  DetectionFailure,
  Divergence,
  ImportFormat,
  ReadFailure,
  RetainedSource,
} from '@saerskriven/formats';
import type {
  Assumption,
  AssumptionId,
  AssumptionStatus,
  BoundaryShape,
  Decimals,
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

/**
 * Every state change the reducer accepts. An edit that writes geometry carries
 * `decimals`, the count its model operation stores at, and says `undefined`
 * where it means the operation to store what it computes.
 */
export type Action = Data.TaggedEnum<{
  SetElementProperties: {
    readonly elementId: ElementId;
    readonly properties: ElementProperties;
  };
  SetElementDetails: {
    readonly elementId: ElementId;
    readonly change: ElementDetailsChange;
  };
  AddElement: {
    readonly diagramId: DiagramId;
    readonly element: Element;
    readonly decimals: Decimals | undefined;
  };
  InsertFragment: { readonly diagramId: DiagramId; readonly fragment: Model };
  ArrangeElements: {
    readonly moves: readonly {
      readonly elementId: ElementId;
      readonly offset: Point;
    }[];
    readonly decimals: Decimals | undefined;
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
    readonly decimals: Decimals | undefined;
  };
  ReverseFlow: { readonly elementId: ElementId };
  SetBoundaryShape: {
    readonly elementId: ElementId;
    readonly shape: BoundaryShape;
    readonly decimals: Decimals | undefined;
  };
  RemoveElement: {
    readonly elementId: ElementId;
    readonly decimals: Decimals | undefined;
  };
  RemoveElements: {
    readonly elementIds: readonly ElementId[];
    readonly decimals: Decimals | undefined;
  };
  MoveElement: {
    readonly elementId: ElementId;
    readonly offset: Point;
    readonly decimals: Decimals | undefined;
  };
  MoveElements: {
    readonly elementIds: readonly ElementId[];
    readonly offset: Point;
    readonly decimals: Decimals | undefined;
  };
  ResizeElement: {
    readonly elementId: ElementId;
    readonly offset: Point;
    readonly size: Size;
    readonly decimals: Decimals | undefined;
  };
  RenameElement: { readonly elementId: ElementId; readonly name: string };
  EditNote: { readonly elementId: ElementId; readonly text: string };
  SetFlowWaypoints: {
    readonly elementId: ElementId;
    readonly waypoints: readonly Point[];
    readonly decimals: Decimals | undefined;
  };
  AddThreat: { readonly threat: Threat };
  RemoveThreat: { readonly threatId: ThreatId };
  ReplaceThreat: { readonly threat: Threat };
  AttachThreat: { readonly threatId: ThreatId; readonly elementId: ElementId };
  DetachThreat: { readonly threatId: ThreatId; readonly elementId: ElementId };
  LinkThreatToModel: { readonly threatId: ThreatId };
  UnlinkThreatFromModel: { readonly threatId: ThreatId };
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

/** Constructors and matching helpers for store actions. */
export const Action = Data.taggedEnum<Action>();
