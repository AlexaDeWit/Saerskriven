export {
  acceptedTextSchema,
  firstRefusedCharacter,
  isEmptyName,
} from './lib/text.js';
export * from './lib/ids.js';
export * from './lib/geometry.js';
export * from './lib/elements.js';
export * from './lib/element-properties.js';
export * from './lib/categories.js';
export * from './lib/threats.js';
export * from './lib/mitigations.js';
export * from './lib/assumptions.js';
export {
  diagramSchema,
  modelMetadataChangeSchema,
  modelMetadataSchema,
  type Diagram,
  type DiagramInput,
  type ModelInput,
  type ModelMetadata,
  type ModelMetadataChange,
  type ModelMetadataInput,
} from './lib/model.js';
export { carrying, coded, codesOf } from './lib/coded.js';
export {
  issueFloodCode,
  issueLine,
  parseIssueDetailSchema,
  parseIssueText,
  toParseIssues,
  type ParseIssue,
  type ParseIssueCode,
  type ParseIssueDetail,
  type RefusalKind,
  type SchemaIssue,
  type SchemaParser,
  type StringFormat,
  type ValueKind,
} from './lib/parse-issue.js';
export * from './lib/parse.js';
export * from './lib/empty.js';
export * from './lib/operation-failures.js';
export * from './lib/element-operations.js';
export * from './lib/flow-operations.js';
export * from './lib/boundary-operations.js';
export * from './lib/diagram-operations.js';
export {
  addThreat,
  attachThreat,
  detachThreat,
  droppedThreats,
  linkThreatToModel,
  nextThreatNumber,
  removeThreat,
  replaceThreat,
  unlinkThreatFromModel,
  type AddThreatFailure,
  type AttachThreatFailure,
  type DetachThreatFailure,
  type RemoveThreatFailure,
  type ReplaceThreatFailure,
  type ThreatModelLinkFailure,
} from './lib/threat-operations.js';
export * from './lib/mitigation-operations.js';
export * from './lib/assumption-operations.js';
export * from './lib/metadata-operations.js';
export {
  chosenDiagram,
  diagramsNamed,
  DiagramChoiceFailure,
  elementIdsAcross,
  elementIdsIn,
  elementsAcross,
  elementsById,
  flowEndName,
  flowEnds,
  unlabelledFlow,
  type FlowEnd,
  type FlowEnds,
} from './lib/references.js';
export {
  assumptionHasReference,
  droppedRecords,
  mitigationHasReference,
  recordReferenceSchema,
  recordsLinkedTo,
  threatHasReference,
  type RecordReference,
} from './lib/records.js';
export * from './lib/threat-flags.js';
export {
  elementsWithoutThreats,
  openThreatsBySeverity,
  threatCountByElement,
  threatsOnDiagrams,
} from './lib/coverage.js';
export * from './lib/fragment.js';
