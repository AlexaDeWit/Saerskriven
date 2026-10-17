import type {
  SaerskrivenYamlV2Document,
  SaerskrivenYamlV2Element,
  SaerskrivenYamlV2Endpoint,
} from '@saerskriven/wire-saerskriven-yaml-v2';
import type {
  SaerskrivenYamlV3Document,
  SaerskrivenYamlV3Element,
  SaerskrivenYamlV3Endpoint,
  SaerskrivenYamlV3PlacedEnd,
  SaerskrivenYamlV3Placement,
} from '@saerskriven/wire-saerskriven-yaml-v3';

/**
 * A version 2 document as version 3 holds it: each element moves to the
 * root `elements` list, in diagram order, and leaves a placement holding its
 * accent and geometry on the diagram that drew it, in the same order. Every
 * id, order and value carries over, an accent no release knows included, so
 * the step loses nothing and reports nothing.
 */
export function withElementsPlaced(
  document: SaerskrivenYamlV2Document,
): SaerskrivenYamlV3Document {
  return {
    formatVersion: 3,
    metadata: document.metadata,
    assumptions: document.assumptions,
    diagrams: document.diagrams.map(({ id, title, elements }) => ({
      id,
      title,
      placements: elements.map(placementOf),
    })),
    elements: document.diagrams.flatMap(({ elements }) =>
      elements.map(elementOf),
    ),
    mitigations: document.mitigations,
    threats: document.threats,
    lastIssuedThreatNumber: document.lastIssuedThreatNumber,
  };
}

function elementOf(
  element: SaerskrivenYamlV2Element,
): SaerskrivenYamlV3Element {
  if (element.kind === 'flow') {
    const {
      accent: _accent,
      waypoints: _waypoints,
      source,
      target,
      ...flow
    } = element;
    return { ...flow, source: endpointOf(source), target: endpointOf(target) };
  }
  if (element.kind === 'trust-boundary') {
    const { accent: _accent, shape: _shape, ...boundary } = element;
    return boundary;
  }
  const {
    accent: _accent,
    position: _position,
    size: _size,
    ...node
  } = element;
  return node;
}

function placementOf(
  element: SaerskrivenYamlV2Element,
): SaerskrivenYamlV3Placement {
  const held = {
    element: element.id,
    ...(element.accent === undefined ? {} : { accent: element.accent }),
  };
  if (element.kind === 'flow') {
    return {
      ...held,
      waypoints: element.waypoints,
      source: placedEndOf(element.source),
      target: placedEndOf(element.target),
    };
  }
  if (element.kind === 'trust-boundary') {
    return { ...held, shape: element.shape };
  }
  return { ...held, position: element.position, size: element.size };
}

function endpointOf(
  endpoint: SaerskrivenYamlV2Endpoint,
): SaerskrivenYamlV3Endpoint {
  return endpoint.kind === 'free'
    ? { kind: 'free' }
    : { kind: 'attached', element: endpoint.element };
}

function placedEndOf(
  endpoint: SaerskrivenYamlV2Endpoint,
): SaerskrivenYamlV3PlacedEnd {
  if (endpoint.kind === 'free') {
    return { position: endpoint.position };
  }
  return endpoint.side === undefined ? {} : { side: endpoint.side };
}
