import {
  accentSchema,
  elementIdSchema,
  type Accent,
  type AssumptionInput,
  type BoundaryShapeInput,
  type DiagramInput,
  type ElementInput,
  type FlowEndpointInput,
  type MitigationInput,
  type Model,
  type ModelInput,
  type ModelMetadataInput,
  type ThreatInput,
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
import {
  modelFrom,
  parseWire,
  type ReadFailure,
  type ReadResult,
} from './codec.js';
import type { Divergence } from './divergence.js';
import { parseYaml } from './parse-yaml.js';
import {
  currentSaerskrivenYaml,
  saerskrivenYamlVersionsSchema,
  type SaerskrivenYamlVersionedDocument,
} from './saerskriven-yaml-migration.js';
import {
  assumptionStatusesToModel,
  mitigationStatusesToModel,
  severitiesToModel,
  threatStatusesToModel,
  toModelCategory,
} from './saerskriven-yaml-vocabulary.js';
import {
  actorProperties,
  boundaryProperties,
  flowProperties,
  processProperties,
  storeProperties,
} from './security-properties.js';
import { undeclaredDivergences } from './undeclared.js';

/**
 * A native text of any released version, told apart by `formatVersion`,
 * with its document brought to the current version for a later save. A key
 * the version's schema does not declare is dropped and reported, so a file
 * from a later release still reads. Records are mapped field by field onto
 * the model's input types, mirroring `saerskriven-yaml-write.ts`, and ids
 * cross as plain strings for `parseModel` to brand. A threat that leaves
 * `appliesToModel` out does not apply to the model. An element whose
 * `accent` is none of the model's keys is read with no accent and reported
 * as `narrowed`.
 */
export function readSaerskrivenYaml(
  text: string,
): Either.Either<ReadResult<typeof saerskrivenYamlV2WireSchema>, ReadFailure> {
  return Either.flatMap(parseYaml(text), readSaerskrivenYamlValue);
}

/**
 * A validated document of any released version as the model alone, without
 * the migration's divergences.
 */
export function readSaerskrivenYamlDocument(
  document: SaerskrivenYamlVersionedDocument,
): Either.Either<Model, ReadFailure> {
  return modelFrom(toModelInput(currentSaerskrivenYaml(document).document));
}

/** An already bounded value through native migration, validation, and divergence reporting. */
export function readSaerskrivenYamlValue(
  given: unknown,
): Either.Either<ReadResult<typeof saerskrivenYamlV2WireSchema>, ReadFailure> {
  return Either.flatMap(
    parseWire(saerskrivenYamlVersionsSchema, given),
    (wire) => {
      const current = currentSaerskrivenYaml(wire);
      return Either.map(modelFrom(toModelInput(current.document)), (model) => ({
        model,
        source: current.document,
        divergences: [
          ...undeclaredDivergences(given, wire),
          ...current.divergences,
          ...unknownAccents(current.document),
        ],
      }));
    },
  );
}

function toModelInput(document: SaerskrivenYamlV2Document): ModelInput {
  return {
    metadata: toMetadata(document.metadata),
    diagrams: document.diagrams.map(toDiagram),
    threats: document.threats.map(toThreat),
    lastIssuedThreatNumber: document.lastIssuedThreatNumber,
    mitigations: document.mitigations.map(toMitigation),
    assumptions: document.assumptions.map(toAssumption),
  };
}

function toMetadata(metadata: SaerskrivenYamlV2Metadata): ModelMetadataInput {
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
      ...toAccent(element),
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
      ...toAccent(element),
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
    ...toAccent(element),
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

function toAccent(element: AccentableWireElement): { accent?: Accent } {
  const accent = accentSchema.safeParse(element.accent);
  return accent.success ? { accent: accent.data } : {};
}

function unknownAccents(document: SaerskrivenYamlV2Document): Divergence[] {
  return document.diagrams
    .flatMap((diagram) => diagram.elements)
    .flatMap((element): Divergence[] => {
      if (
        element.kind === 'text' ||
        element.accent === undefined ||
        accentSchema.safeParse(element.accent).success
      ) {
        return [];
      }
      const id = elementIdSchema.safeParse(element.id);
      return id.success
        ? [
            {
              subject: { kind: 'element', id: id.data },
              detail: {
                code: 'accent-unknown',
                parameters: { accent: element.accent },
              },
              reason: 'narrowed',
            },
          ]
        : [];
    });
}

type AccentableWireElement = Exclude<
  SaerskrivenYamlV2Element,
  { readonly kind: 'text' }
>;

function toEndpoint(endpoint: SaerskrivenYamlV2Endpoint): FlowEndpointInput {
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
    appliesToModel: threat.appliesToModel ?? false,
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
