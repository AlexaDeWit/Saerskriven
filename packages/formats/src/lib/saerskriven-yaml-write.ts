import {
  accentField,
  drawnElements,
  inNumberOrder,
  type Assumption,
  type BoundaryShape,
  type Diagram,
  type DrawnElement,
  type DrawnFlowEndpoint,
  type Element,
  type FlowEndpoint,
  type Mitigation,
  type Model,
  type ModelMetadata,
  type PlacedFlowEnd,
  type Placement,
  type Threat,
} from '@saerskriven/model';
import {
  saerskrivenYamlV2WireSchema,
  type SaerskrivenYamlV2Diagram,
  type SaerskrivenYamlV2Document,
  type SaerskrivenYamlV2Element,
  type SaerskrivenYamlV2Endpoint,
} from '@saerskriven/wire-saerskriven-yaml-v2';
import {
  saerskrivenYamlV3WireSchema,
  type SaerskrivenYamlV3Assumption,
  type SaerskrivenYamlV3BoundaryShape,
  type SaerskrivenYamlV3Diagram,
  type SaerskrivenYamlV3Document,
  type SaerskrivenYamlV3Element,
  type SaerskrivenYamlV3Endpoint,
  type SaerskrivenYamlV3Metadata,
  type SaerskrivenYamlV3Mitigation,
  type SaerskrivenYamlV3PlacedEnd,
  type SaerskrivenYamlV3Placement,
  type SaerskrivenYamlV3Threat,
} from '@saerskriven/wire-saerskriven-yaml-v3';
import { stringify } from 'yaml';
import { canonicalOrder } from './canonical-order.js';
import type { WriteResult } from './codec.js';
import { writtenSaerskrivenYamlVersion } from './saerskriven-yaml-version.js';
import {
  assumptionStatusesToWire,
  mitigationStatusesToWire,
  severitiesToWire,
  threatStatusesToWire,
  toWireCategory,
} from './saerskriven-yaml-vocabulary.js';
import {
  actorProperties,
  boundaryProperties,
  flowProperties,
  processProperties,
  storeProperties,
} from './security-properties.js';

/** A document a save writes: version 2, or version 3 for a model version 2 cannot hold. */
export type WrittenSaerskrivenYamlDocument =
  | SaerskrivenYamlV2Document
  | SaerskrivenYamlV3Document;

/**
 * The model as native YAML, reporting nothing: version 2 while version 2
 * holds the model, and version 3 once it does not
 * ({@link writtenSaerskrivenYamlVersion}). Two writes of one model are
 * byte-identical: keys follow {@link canonicalOrder}, threats follow
 * {@link writeSaerskrivenYamlDocument}, and no line is wrapped, so an edited
 * sentence changes only its own line. The source is ignored, since the
 * format holds the whole model.
 */
export function writeSaerskrivenYaml(
  model: Model,
  _source?: SaerskrivenYamlV3Document,
): WriteResult {
  return {
    output: saerskrivenYamlText(writeSaerskrivenYamlDocument(model)),
    divergences: [],
  };
}

/**
 * The document a save of the model writes, in the version
 * {@link writtenSaerskrivenYamlVersion} names, threats in number order and
 * every other list in the model's order. Records are mapped field by field,
 * mirroring `saerskriven-yaml-read.ts`. A threat's `appliesToModel` is stated
 * only where it is true and an accent only where one is held, so a model
 * that never used either writes the bytes it wrote before the key existed.
 * A version 2 document holds each element on the one diagram drawing it, so
 * only a model version 2 holds is written that way.
 */
export function writeSaerskrivenYamlDocument(
  model: Model,
): WrittenSaerskrivenYamlDocument {
  return writtenSaerskrivenYamlVersion(model) === 2
    ? version2Document(model)
    : saerskrivenYamlV3Document(model);
}

/**
 * The model as a version 3 document, whichever version a save of it
 * writes: each element once at the root in the model's order, and each
 * diagram's placements in draw order.
 */
export function saerskrivenYamlV3Document(
  model: Model,
): SaerskrivenYamlV3Document {
  return {
    formatVersion: 3,
    metadata: toWireMetadata(model.metadata),
    assumptions: model.assumptions.map(toWireAssumption),
    diagrams: model.diagrams.map(toPlacedDiagram),
    elements: model.elements.map(toWireElement),
    mitigations: model.mitigations.map(toWireMitigation),
    threats: inNumberOrder(model.threats).map(toWireThreat),
    lastIssuedThreatNumber: model.lastIssuedThreatNumber,
  };
}

/** A written document as its text, keys in the order its version's schema declares them. */
export function saerskrivenYamlText(
  document: WrittenSaerskrivenYamlDocument,
): string {
  return stringify(
    document.formatVersion === 2
      ? canonicalOrder(saerskrivenYamlV2WireSchema, document)
      : canonicalOrder(saerskrivenYamlV3WireSchema, document),
    stringifyOptions,
  );
}

const stringifyOptions = { lineWidth: 0 };

function version2Document(model: Model): SaerskrivenYamlV2Document {
  return {
    formatVersion: 2,
    metadata: toWireMetadata(model.metadata),
    assumptions: model.assumptions.map(toWireAssumption),
    diagrams: model.diagrams.map((diagram) => toDrawnDiagram(model, diagram)),
    mitigations: model.mitigations.map(toWireMitigation),
    threats: inNumberOrder(model.threats).map(toWireThreat),
    lastIssuedThreatNumber: model.lastIssuedThreatNumber,
  };
}

function toDrawnDiagram(
  model: Model,
  diagram: Diagram,
): SaerskrivenYamlV2Diagram {
  return {
    id: diagram.id,
    title: diagram.title,
    elements: drawnElements(model, diagram).map(toDrawnElement),
  };
}

function toDrawnElement(element: DrawnElement): SaerskrivenYamlV2Element {
  const common = { ...toWireCommon(element), ...accentField(element) };
  if (element.kind === 'flow') {
    return {
      kind: 'flow',
      ...flowProperties(element),
      ...common,
      source: toDrawnEndpoint(element.source),
      target: toDrawnEndpoint(element.target),
      waypoints: element.waypoints,
      bidirectional: element.bidirectional,
    };
  }
  if (element.kind === 'trust-boundary') {
    return {
      kind: 'trust-boundary',
      ...boundaryProperties(element),
      ...common,
      shape: toWireBoundaryShape(element.shape),
    };
  }
  const node = { ...common, position: element.position, size: element.size };
  if (element.kind === 'text') {
    return { kind: 'text', ...node, text: element.text };
  }
  if (element.kind === 'actor') {
    return { kind: 'actor', ...node, ...actorProperties(element) };
  }
  if (element.kind === 'process') {
    return { kind: 'process', ...node, ...processProperties(element) };
  }
  return { kind: 'store', ...node, ...storeProperties(element) };
}

function toDrawnEndpoint(
  endpoint: DrawnFlowEndpoint,
): SaerskrivenYamlV2Endpoint {
  if (endpoint.kind === 'free') {
    return { kind: 'free', position: endpoint.position };
  }
  return endpoint.side === undefined
    ? { kind: 'attached', element: endpoint.element }
    : { kind: 'attached', element: endpoint.element, side: endpoint.side };
}

function toPlacedDiagram(diagram: Diagram): SaerskrivenYamlV3Diagram {
  return {
    id: diagram.id,
    title: diagram.title,
    placements: diagram.placements.map(toWirePlacement),
  };
}

function toWirePlacement(placement: Placement): SaerskrivenYamlV3Placement {
  const held = { element: placement.element, ...accentField(placement) };
  if ('waypoints' in placement) {
    return {
      ...held,
      waypoints: placement.waypoints,
      source: toPlacedEnd(placement.source),
      target: toPlacedEnd(placement.target),
    };
  }
  if ('shape' in placement) {
    return { ...held, shape: toWireBoundaryShape(placement.shape) };
  }
  return { ...held, position: placement.position, size: placement.size };
}

function toPlacedEnd(end: PlacedFlowEnd): SaerskrivenYamlV3PlacedEnd {
  return {
    ...(end.side === undefined ? {} : { side: end.side }),
    ...(end.position === undefined ? {} : { position: end.position }),
  };
}

function toWireElement(element: Element): SaerskrivenYamlV3Element {
  if (element.kind === 'flow') {
    return {
      kind: 'flow',
      ...flowProperties(element),
      ...toWireCommon(element),
      source: toWireEndpoint(element.source),
      target: toWireEndpoint(element.target),
      bidirectional: element.bidirectional,
    };
  }
  if (element.kind === 'trust-boundary') {
    return {
      kind: 'trust-boundary',
      ...boundaryProperties(element),
      ...toWireCommon(element),
    };
  }
  if (element.kind === 'text') {
    return { kind: 'text', ...toWireCommon(element), text: element.text };
  }
  if (element.kind === 'actor') {
    return {
      kind: 'actor',
      ...toWireCommon(element),
      ...actorProperties(element),
    };
  }
  if (element.kind === 'process') {
    return {
      kind: 'process',
      ...toWireCommon(element),
      ...processProperties(element),
    };
  }
  return {
    kind: 'store',
    ...toWireCommon(element),
    ...storeProperties(element),
  };
}

function toWireEndpoint(endpoint: FlowEndpoint): SaerskrivenYamlV3Endpoint {
  return endpoint.kind === 'free'
    ? { kind: 'free' }
    : { kind: 'attached', element: endpoint.element };
}

function toWireCommon(
  element: Pick<
    Element,
    'id' | 'name' | 'description' | 'outOfScope' | 'reasonOutOfScope'
  >,
) {
  return {
    id: element.id,
    name: element.name,
    description: element.description,
    outOfScope: element.outOfScope,
    reasonOutOfScope: element.reasonOutOfScope,
  };
}

function toWireBoundaryShape(
  shape: BoundaryShape,
): SaerskrivenYamlV3BoundaryShape {
  return shape.kind === 'box'
    ? { kind: 'box', position: shape.position, size: shape.size }
    : { kind: 'curve', waypoints: shape.waypoints };
}

function toWireMetadata(metadata: ModelMetadata): SaerskrivenYamlV3Metadata {
  return {
    title: metadata.title,
    owner: metadata.owner,
    description: metadata.description,
    contributors: metadata.contributors,
  };
}

function toWireThreat(threat: Threat): SaerskrivenYamlV3Threat {
  return {
    id: threat.id,
    number: threat.number,
    title: threat.title,
    category: toWireCategory(threat.category),
    severity: severitiesToWire[threat.severity],
    status: threatStatusesToWire[threat.status],
    description: threat.description,
    elements: threat.elements,
    ...(threat.appliesToModel ? { appliesToModel: true } : {}),
  };
}

function toWireMitigation(mitigation: Mitigation): SaerskrivenYamlV3Mitigation {
  return {
    id: mitigation.id,
    title: mitigation.title,
    prose: mitigation.prose,
    status: mitigationStatusesToWire[mitigation.status],
    threats: mitigation.threats,
  };
}

function toWireAssumption(assumption: Assumption): SaerskrivenYamlV3Assumption {
  return {
    id: assumption.id,
    prose: assumption.prose,
    status: assumptionStatusesToWire[assumption.status],
    threats: assumption.threats,
    appliesToModel: assumption.appliesToModel,
  };
}
