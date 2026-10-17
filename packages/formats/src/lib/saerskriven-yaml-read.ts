import {
  accentSchema,
  atDrawnPaths,
  elementIdSchema,
  parseModel,
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
  type PlacementInput,
  type RelationshipScope,
  type ThreatInput,
} from '@saerskriven/model';
import type {
  saerskrivenYamlV3WireSchema,
  SaerskrivenYamlV3Assumption,
  SaerskrivenYamlV3BoundaryShape,
  SaerskrivenYamlV3Diagram,
  SaerskrivenYamlV3Document,
  SaerskrivenYamlV3Element,
  SaerskrivenYamlV3Endpoint,
  SaerskrivenYamlV3Metadata,
  SaerskrivenYamlV3Mitigation,
  SaerskrivenYamlV3Placement,
  SaerskrivenYamlV3Threat,
} from '@saerskriven/wire-saerskriven-yaml-v3';
import { Either } from 'effect';
import { z } from 'zod';
import { parseWire, ReadFailure, type ReadResult } from './codec.js';
import type { Divergence } from './divergence.js';
import { parseYaml } from './parse-yaml.js';
import {
  currentSaerskrivenYaml,
  saerskrivenYamlVersionsRead,
  saerskrivenYamlVersionsSchema,
  type SaerskrivenYamlVersion,
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
 * Where a version 1 or 2 file's relationship lists resolve: inside the
 * diagram drawing the element that holds the list, as they always have, so
 * every such file reads as it did. A ruling to widen it changes this line.
 */
export const version2RelationshipScope: RelationshipScope = 'diagram';

/** A native read, and the version the file states. */
export type SaerskrivenYamlRead = ReadResult<
  typeof saerskrivenYamlV3WireSchema
> & { readonly statedVersion: SaerskrivenYamlVersion };

/**
 * A native text of any released version, told apart by `formatVersion`,
 * with its document brought to the current version, 3, for a later save. A
 * whole-number `formatVersion` above every version this release reads is
 * refused as `LaterFormatVersion` before any schema reads the document. A
 * key the version's schema does not declare is dropped and reported, so a
 * file from a later release still reads. Records are mapped field by field
 * onto the model's input types, mirroring `saerskriven-yaml-write.ts`, and
 * ids cross as plain strings for `parseModel` to brand. A refusal of the
 * model is pathed into the file as its own version holds it: a file below
 * version 3 has its diagrams own their elements, and keeps each relationship
 * list inside its element's diagram ({@link version2RelationshipScope}). A
 * threat that leaves `appliesToModel` out does not apply to the model. A
 * placement whose `accent` is none of the model's keys is read with no
 * accent and reported as `narrowed`, once for each element and key however
 * many placements of the element hold it.
 */
export function readSaerskrivenYaml(
  text: string,
): Either.Either<SaerskrivenYamlRead, ReadFailure> {
  return Either.flatMap(parseYaml(text), mapDocument);
}

/**
 * A validated document of any released version as the model alone, without
 * the migration's divergences.
 */
export function readSaerskrivenYamlDocument(
  document: SaerskrivenYamlVersionedDocument,
): Either.Either<Model, ReadFailure> {
  return modelOf(document, currentSaerskrivenYaml(document).document);
}

function mapDocument(
  given: unknown,
): Either.Either<SaerskrivenYamlRead, ReadFailure> {
  const later = laterVersionSchema.safeParse(given);
  if (later.success) {
    return Either.left(
      ReadFailure.LaterFormatVersion({
        stated: later.data.formatVersion,
        read: saerskrivenYamlVersionsRead,
      }),
    );
  }
  return Either.flatMap(
    parseWire(saerskrivenYamlVersionsSchema, given),
    (wire) => {
      const current = currentSaerskrivenYaml(wire);
      return Either.map(modelOf(wire, current.document), (model) => ({
        model,
        source: current.document,
        divergences: [
          ...undeclaredDivergences(given, wire),
          ...current.divergences,
          ...unknownAccents(current.document),
        ],
        statedVersion: wire.formatVersion,
      }));
    },
  );
}

const laterVersionSchema = z.object({
  formatVersion: z.int().gt(Math.max(...saerskrivenYamlVersionsRead)),
});

function modelOf(
  stated: SaerskrivenYamlVersionedDocument,
  current: SaerskrivenYamlV3Document,
): Either.Either<Model, ReadFailure> {
  return Either.mapLeft(
    parseModel(
      toModelInput(current),
      stated.formatVersion === 3 ? 'model' : version2RelationshipScope,
    ),
    ({ issues }) =>
      ReadFailure.InvalidModel({
        issues:
          stated.formatVersion === 3
            ? issues
            : atDrawnPaths(issues, stated.diagrams),
      }),
  );
}

function toModelInput(document: SaerskrivenYamlV3Document): ModelInput {
  return {
    metadata: toMetadata(document.metadata),
    elements: document.elements.map(toElement),
    diagrams: document.diagrams.map(toDiagram),
    threats: document.threats.map(toThreat),
    lastIssuedThreatNumber: document.lastIssuedThreatNumber,
    mitigations: document.mitigations.map(toMitigation),
    assumptions: document.assumptions.map(toAssumption),
  };
}

function toMetadata(metadata: SaerskrivenYamlV3Metadata): ModelMetadataInput {
  return {
    title: metadata.title,
    owner: metadata.owner,
    description: metadata.description,
    contributors: metadata.contributors,
  };
}

function toDiagram(diagram: SaerskrivenYamlV3Diagram): DiagramInput {
  return {
    id: diagram.id,
    title: diagram.title,
    placements: diagram.placements.map(toPlacement),
  };
}

function toPlacement(placement: SaerskrivenYamlV3Placement): PlacementInput {
  const held = { element: placement.element, ...toAccent(placement) };
  if ('waypoints' in placement) {
    return {
      ...held,
      waypoints: placement.waypoints,
      source: placement.source,
      target: placement.target,
    };
  }
  if ('shape' in placement) {
    return { ...held, shape: toBoundaryShape(placement.shape) };
  }
  return { ...held, position: placement.position, size: placement.size };
}

function toElement(element: SaerskrivenYamlV3Element): ElementInput {
  if (element.kind === 'flow') {
    return {
      kind: 'flow',
      ...flowProperties(element),
      ...toCommon(element),
      source: toEndpoint(element.source),
      target: toEndpoint(element.target),
      bidirectional: element.bidirectional ?? false,
    };
  }
  if (element.kind === 'trust-boundary') {
    return {
      kind: 'trust-boundary',
      ...boundaryProperties(element),
      ...toCommon(element),
    };
  }
  if (element.kind === 'text') {
    return { kind: 'text', ...toCommon(element), text: element.text };
  }
  if (element.kind === 'actor') {
    return { kind: 'actor', ...toCommon(element), ...actorProperties(element) };
  }
  if (element.kind === 'process') {
    return {
      kind: 'process',
      ...toCommon(element),
      ...processProperties(element),
    };
  }
  return { kind: 'store', ...toCommon(element), ...storeProperties(element) };
}

function toCommon(element: SaerskrivenYamlV3Element) {
  return {
    id: element.id,
    name: element.name,
    description: element.description,
    outOfScope: element.outOfScope,
    reasonOutOfScope: element.reasonOutOfScope,
  };
}

function toAccent(placement: SaerskrivenYamlV3Placement): {
  accent?: Accent;
} {
  const accent = accentSchema.safeParse(placement.accent);
  return accent.success ? { accent: accent.data } : {};
}

function unknownAccents(document: SaerskrivenYamlV3Document): Divergence[] {
  const unknown = new Map<string, Divergence>();
  for (const placement of document.diagrams.flatMap(
    (diagram) => diagram.placements,
  )) {
    const id = elementIdSchema.safeParse(placement.element);
    if (
      placement.accent !== undefined &&
      id.success &&
      !accentSchema.safeParse(placement.accent).success
    ) {
      unknown.set(JSON.stringify([id.data, placement.accent]), {
        subject: { kind: 'element', id: id.data },
        detail: {
          code: 'accent-unknown',
          parameters: { accent: placement.accent },
        },
        reason: 'narrowed',
      });
    }
  }
  return [...unknown.values()];
}

function toEndpoint(endpoint: SaerskrivenYamlV3Endpoint): FlowEndpointInput {
  return endpoint.kind === 'free'
    ? { kind: 'free' }
    : { kind: 'attached', element: endpoint.element };
}

function toBoundaryShape(
  shape: SaerskrivenYamlV3BoundaryShape,
): BoundaryShapeInput {
  return shape.kind === 'box'
    ? { kind: 'box', position: shape.position, size: shape.size }
    : { kind: 'curve', waypoints: shape.waypoints };
}

function toThreat(threat: SaerskrivenYamlV3Threat): ThreatInput {
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
  mitigation: SaerskrivenYamlV3Mitigation,
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
  assumption: SaerskrivenYamlV3Assumption,
): AssumptionInput {
  return {
    id: assumption.id,
    prose: assumption.prose,
    status: assumptionStatusesToModel[assumption.status],
    threats: assumption.threats,
    appliesToModel: assumption.appliesToModel,
  };
}
