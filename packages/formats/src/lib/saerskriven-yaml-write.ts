import {
  actorProperties,
  processProperties,
  storeProperties,
  flowProperties,
  boundaryProperties,
} from './security-properties.js';
import {
  inNumberOrder,
  type Assumption,
  type BoundaryShape,
  type Diagram,
  type Element,
  type FlowEndpoint,
  type Mitigation,
  type Model,
  type ModelMetadata,
  type Threat,
} from '@saerskriven/model';
import {
  saerskrivenYamlV2WireSchema,
  type SaerskrivenYamlV2Assumption,
  type SaerskrivenYamlV2BoundaryShape,
  type SaerskrivenYamlV2Diagram,
  type SaerskrivenYamlV2Document,
  type SaerskrivenYamlV2Element,
  type SaerskrivenYamlV2Endpoint,
  type SaerskrivenYamlV2Metadata,
  type SaerskrivenYamlV2Mitigation,
  type SaerskrivenYamlV2Threat,
} from '@saerskriven/wire-saerskriven-yaml-v2';
import { stringify } from 'yaml';
import { canonicalOrder } from './canonical-order.js';
import type { WriteResult } from './codec.js';
import {
  assumptionStatusesToWire,
  mitigationStatusesToWire,
  severitiesToWire,
  threatStatusesToWire,
  toWireCategory,
} from './saerskriven-yaml-vocabulary.js';

const stringifyOptions = { lineWidth: 0, aliasDuplicateObjects: false };

/**
 * Writes canonical native YAML in the current version, without wrapping
 * prose. A non-empty list is a block sequence, one item a line, so a long
 * link list never makes a long line. A list several elements hold is written
 * out in full each time, never as an anchor and alias. The source cannot
 * override the model, and nothing is reported, since the format holds the
 * whole model.
 */
export function writeSaerskrivenYaml(
  model: Model,
  _source?: SaerskrivenYamlV2Document,
): WriteResult {
  return {
    output: stringify(
      canonicalOrder(
        saerskrivenYamlV2WireSchema,
        writeSaerskrivenYamlDocument(model),
      ),
      stringifyOptions,
    ),
    divergences: [],
  };
}

/** Projects model fields explicitly and orders threats by number. Other lists retain their order. */
export function writeSaerskrivenYamlDocument(
  model: Model,
): SaerskrivenYamlV2Document {
  return {
    formatVersion: 2,
    metadata: toWireMetadata(model.metadata),
    assumptions: model.assumptions.map(toWireAssumption),
    diagrams: model.diagrams.map(toWireDiagram),
    mitigations: model.mitigations.map(toWireMitigation),
    threats: inNumberOrder(model.threats).map(toWireThreat),
    lastIssuedThreatNumber: model.lastIssuedThreatNumber,
  };
}

function toWireMetadata(metadata: ModelMetadata): SaerskrivenYamlV2Metadata {
  return {
    title: metadata.title,
    owner: metadata.owner,
    description: metadata.description,
    contributors: metadata.contributors,
  };
}

function toWireDiagram(diagram: Diagram): SaerskrivenYamlV2Diagram {
  return {
    id: diagram.id,
    title: diagram.title,
    elements: diagram.elements.map(toWireElement),
  };
}

function toWireElement(element: Element): SaerskrivenYamlV2Element {
  if (element.kind === 'flow') {
    return {
      kind: 'flow',
      ...flowProperties(element),
      ...toWireCommon(element),
      source: toWireEndpoint(element.source),
      target: toWireEndpoint(element.target),
      waypoints: element.waypoints,
      bidirectional: element.bidirectional,
    };
  }
  if (element.kind === 'trust-boundary') {
    return {
      kind: 'trust-boundary',
      ...boundaryProperties(element),
      ...toWireCommon(element),
      shape: toWireBoundaryShape(element.shape),
    };
  }
  if (element.kind === 'text') {
    return {
      kind: 'text',
      ...toWireCommon(element),
      position: element.position,
      size: element.size,
      text: element.text,
    };
  }
  const node = {
    ...toWireCommon(element),
    position: element.position,
    size: element.size,
  };
  if (element.kind === 'actor') {
    return { kind: 'actor', ...node, ...actorProperties(element) };
  }
  if (element.kind === 'process') {
    return { kind: 'process', ...node, ...processProperties(element) };
  }
  return { kind: 'store', ...node, ...storeProperties(element) };
}

function toWireCommon(element: Element) {
  return {
    id: element.id,
    name: element.name,
    description: element.description,
    outOfScope: element.outOfScope,
    reasonOutOfScope: element.reasonOutOfScope,
  };
}

function toWireEndpoint(endpoint: FlowEndpoint): SaerskrivenYamlV2Endpoint {
  if (endpoint.kind === 'free') {
    return { kind: 'free', position: endpoint.position };
  }
  return endpoint.side === undefined
    ? { kind: 'attached', element: endpoint.element }
    : { kind: 'attached', element: endpoint.element, side: endpoint.side };
}

function toWireBoundaryShape(
  shape: BoundaryShape,
): SaerskrivenYamlV2BoundaryShape {
  return shape.kind === 'box'
    ? { kind: 'box', position: shape.position, size: shape.size }
    : { kind: 'curve', waypoints: shape.waypoints };
}

function toWireThreat(threat: Threat): SaerskrivenYamlV2Threat {
  return {
    id: threat.id,
    number: threat.number,
    title: threat.title,
    category: toWireCategory(threat.category),
    severity: severitiesToWire[threat.severity],
    status: threatStatusesToWire[threat.status],
    description: threat.description,
    elements: threat.elements,
  };
}

function toWireMitigation(mitigation: Mitigation): SaerskrivenYamlV2Mitigation {
  return {
    id: mitigation.id,
    title: mitigation.title,
    prose: mitigation.prose,
    status: mitigationStatusesToWire[mitigation.status],
    threats: mitigation.threats,
  };
}

function toWireAssumption(assumption: Assumption): SaerskrivenYamlV2Assumption {
  return {
    id: assumption.id,
    prose: assumption.prose,
    status: assumptionStatusesToWire[assumption.status],
    threats: assumption.threats,
    appliesToModel: assumption.appliesToModel,
  };
}
