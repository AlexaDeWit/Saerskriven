import {
  actorProperties,
  processProperties,
  storeProperties,
  flowProperties,
  boundaryProperties,
} from './security-properties.js';
import {
  assumptionSchema,
  boundaryShapeSchema,
  diagramSchema,
  elementSchema,
  flowEndpointSchema,
  mitigationSchema,
  modelMetadataSchema,
  parseModel,
  threatSchema,
  toParseIssues,
  type Model,
} from '@saerskriven/model';
import type {
  saerskrivenYamlV2WireSchema,
  SaerskrivenYamlV2Assumption,
  SaerskrivenYamlV2BoundaryShape,
  SaerskrivenYamlV2Diagram,
  SaerskrivenYamlV2Document,
  SaerskrivenYamlV2Element,
  SaerskrivenYamlV2Endpoint,
  SaerskrivenYamlV2Metadata,
  SaerskrivenYamlV2Mitigation,
  SaerskrivenYamlV2Threat,
} from '@saerskriven/wire-saerskriven-yaml-v2';
import { Either } from 'effect';
import type { z } from 'zod';
import { ReadFailure, type ReadResult } from './codec.js';
import {
  assumptionStatusesToModel,
  mitigationStatusesToModel,
  severitiesToModel,
  threatStatusesToModel,
  toModelCategory,
} from './saerskriven-yaml-vocabulary.js';
import { parseYaml } from './parse-yaml.js';
import {
  currentSaerskrivenYaml,
  saerskrivenYamlVersionsSchema,
  type SaerskrivenYamlVersionedDocument,
} from './saerskriven-yaml-migration.js';
import { undeclaredDivergences } from './undeclared.js';

type MetadataInput = z.input<typeof modelMetadataSchema>;
type DiagramInput = z.input<typeof diagramSchema>;
type ElementInput = z.input<typeof elementSchema>;
type EndpointInput = z.input<typeof flowEndpointSchema>;
type BoundaryShapeInput = z.input<typeof boundaryShapeSchema>;
type ThreatInput = z.input<typeof threatSchema>;
type MitigationInput = z.input<typeof mitigationSchema>;
type AssumptionInput = z.input<typeof assumptionSchema>;

/**
 * Reads native YAML of any released version, dispatching on `formatVersion`,
 * and retains the document in the current version for subsequent saves.
 */
export function readSaerskrivenYaml(
  text: string,
): Either.Either<ReadResult<typeof saerskrivenYamlV2WireSchema>, ReadFailure> {
  return Either.flatMap(parseYaml(text), mapDocument);
}

/**
 * Maps a validated document of any released version, a version 1 document
 * through the v1 to v2 migration, to the model alone: what the migration
 * reports is the text read's to return. Absent security facts remain unknown.
 */
export function readSaerskrivenYamlDocument(
  document: SaerskrivenYamlVersionedDocument,
): Either.Either<Model, ReadFailure> {
  return modelOf(currentSaerskrivenYaml(document).document);
}

function modelOf(
  document: SaerskrivenYamlV2Document,
): Either.Either<Model, ReadFailure> {
  return Either.mapLeft(parseModel(toModelInput(document)), (failure) =>
    ReadFailure.InvalidModel({ issues: failure.issues }),
  );
}

function mapDocument(
  given: unknown,
): Either.Either<ReadResult<typeof saerskrivenYamlV2WireSchema>, ReadFailure> {
  const wire = saerskrivenYamlVersionsSchema.safeParse(given);
  if (!wire.success) {
    return Either.left(
      ReadFailure.InvalidWireDocument({
        issues: toParseIssues(wire.error.issues),
      }),
    );
  }
  const current = currentSaerskrivenYaml(wire.data);
  return Either.map(modelOf(current.document), (model) => ({
    model,
    source: current.document,
    divergences: [
      ...undeclaredDivergences(given, wire.data),
      ...current.divergences,
    ],
  }));
}

function toModelInput(document: SaerskrivenYamlV2Document) {
  return {
    metadata: toMetadata(document.metadata),
    diagrams: document.diagrams.map(toDiagram),
    threats: document.threats.map(toThreat),
    lastIssuedThreatNumber: document.lastIssuedThreatNumber,
    mitigations: document.mitigations.map(toMitigation),
    assumptions: document.assumptions.map(toAssumption),
  };
}

function toMetadata(metadata: SaerskrivenYamlV2Metadata): MetadataInput {
  return {
    title: metadata.title,
    owner: metadata.owner,
    description: metadata.description,
    contributors: metadata.contributors,
  };
}

function toDiagram(diagram: SaerskrivenYamlV2Diagram): DiagramInput {
  return {
    id: diagram.id,
    title: diagram.title,
    elements: diagram.elements.map(toElement),
  };
}

function toElement(element: SaerskrivenYamlV2Element): ElementInput {
  if (element.kind === 'flow') {
    return {
      kind: 'flow',
      ...flowProperties(element),
      ...toCommon(element),
      source: toEndpoint(element.source),
      target: toEndpoint(element.target),
      waypoints: element.waypoints,
      bidirectional: element.bidirectional ?? false,
    };
  }
  if (element.kind === 'trust-boundary') {
    return {
      kind: 'trust-boundary',
      ...boundaryProperties(element),
      ...toCommon(element),
      shape: toBoundaryShape(element.shape),
    };
  }
  if (element.kind === 'text') {
    return {
      kind: 'text',
      ...toCommon(element),
      position: element.position,
      size: element.size,
      text: element.text,
    };
  }
  const node = {
    ...toCommon(element),
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

function toCommon(element: SaerskrivenYamlV2Element) {
  return {
    id: element.id,
    name: element.name,
    description: element.description,
    outOfScope: element.outOfScope,
    reasonOutOfScope: element.reasonOutOfScope,
  };
}

function toEndpoint(endpoint: SaerskrivenYamlV2Endpoint): EndpointInput {
  if (endpoint.kind === 'free') {
    return { kind: 'free', position: endpoint.position };
  }
  return endpoint.side === undefined
    ? { kind: 'attached', element: endpoint.element }
    : { kind: 'attached', element: endpoint.element, side: endpoint.side };
}

function toBoundaryShape(
  shape: SaerskrivenYamlV2BoundaryShape,
): BoundaryShapeInput {
  return shape.kind === 'box'
    ? { kind: 'box', position: shape.position, size: shape.size }
    : { kind: 'curve', waypoints: shape.waypoints };
}

function toThreat(threat: SaerskrivenYamlV2Threat): ThreatInput {
  return {
    id: threat.id,
    number: threat.number,
    title: threat.title,
    category: toModelCategory(threat.category),
    severity: severitiesToModel[threat.severity],
    status: threatStatusesToModel[threat.status],
    description: threat.description,
    elements: threat.elements,
  };
}

function toMitigation(
  mitigation: SaerskrivenYamlV2Mitigation,
): MitigationInput {
  return {
    id: mitigation.id,
    title: mitigation.title,
    prose: mitigation.prose,
    status: mitigationStatusesToModel[mitigation.status],
    threats: mitigation.threats,
  };
}

function toAssumption(
  assumption: SaerskrivenYamlV2Assumption,
): AssumptionInput {
  return {
    id: assumption.id,
    prose: assumption.prose,
    status: assumptionStatusesToModel[assumption.status],
    threats: assumption.threats,
    appliesToModel: assumption.appliesToModel,
  };
}
