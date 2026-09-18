import type {
  DiagramInput,
  ElementInput,
  FlowEndpointInput,
  MitigationInput,
  Model,
  ModelMetadataInput,
  ThreatCategory,
  ThreatInput,
} from '@saerskriven/model';
import {
  threatDragonWireSchema,
  type ThreatDragonCell,
  type ThreatDragonDiagram,
  type ThreatDragonDocument,
  type ThreatDragonEndpoint,
  type ThreatDragonThreat,
} from '@saerskriven/wire-threat-dragon';
import { Either } from 'effect';
import {
  modelFrom,
  ReadFailure,
  refusedWireDocument,
  type ReadResult,
} from './codec.js';
import type { DivergenceDetail } from './divergence-detail.js';
import type { Divergence } from './divergence.js';
import { idsHeld, mitigationsFromText } from './mitigation-text.js';
import { parseWithinLimits } from './read-limits.js';
import {
  actorProperties,
  boundaryProperties,
  flowProperties,
  processProperties,
  storeProperties,
} from './security-properties.js';
import {
  cellsOf,
  isAnchored,
  portSides,
  sideOfPort,
  threatsOf,
  type PortSides,
  type ThreatDragonBoundary,
  type ThreatDragonCurve,
  type ThreatDragonFlow,
  type ThreatDragonNode,
} from './threat-dragon-document.js';
import {
  toSeverity,
  toThreatCategory,
  toThreatStatus,
} from './threat-dragon-vocabulary.js';
import { undeclaredDivergences } from './undeclared.js';

/**
 * A Threat Dragon v2 text as the model, with its document kept for a merge.
 *
 * A category label is looked up in the language Threat Dragon wrote it in,
 * and a methodology the model does not enumerate becomes a custom category
 * with Threat Dragon's names unchanged, reported as nothing. A status,
 * severity or label the model has no value for, and an Elevation of
 * Privilege card, of which the model holds the suit alone, are reported as
 * `narrowed`. A threat the file leaves unnumbered is issued the next number
 * above the file's mark and its highest number. Each non-empty mitigation
 * text becomes a record on the terms of {@link mitigationsFromText}, and a
 * port's group becomes the pinned side of the flow end fastened to it.
 */
export function readThreatDragon(
  text: string,
): Either.Either<ReadResult<typeof threatDragonWireSchema>, ReadFailure> {
  return Either.flatMap(parseJson(text), mapDocument);
}

type ThreatEntry = {
  readonly threat: ThreatDragonThreat;
  readonly elements: readonly string[];
  readonly number: number;
};

function parseJson(text: string): Either.Either<unknown, ReadFailure> {
  return parseWithinLimits(text, (bounded) =>
    Either.try({
      try: () => JSON.parse(bounded) as unknown,
      catch: (error) => ReadFailure.MalformedText({ message: String(error) }),
    }),
  );
}

function mapDocument(
  given: unknown,
): Either.Either<ReadResult<typeof threatDragonWireSchema>, ReadFailure> {
  const wire = threatDragonWireSchema.safeParse(given);
  if (!wire.success) {
    return Either.left(refusedWireDocument(wire.error.issues));
  }
  const mapping = toMapping(wire.data);
  return Either.map(modelFrom(mapping.input), (model) => ({
    model,
    source: wire.data,
    divergences: [
      ...undeclaredDivergences(given, wire.data),
      ...narrowings(model, mapping.notes),
    ],
  }));
}

function toMapping(document: ThreatDragonDocument) {
  const { entries, lastIssued } = toThreatEntries(document);
  const threats = entries.map(toThreat);
  const diagrams = document.detail.diagrams.map(toDiagram);
  return {
    input: {
      metadata: toMetadata(document),
      diagrams,
      threats: threats.map((threat) => threat.record),
      lastIssuedThreatNumber: lastIssued,
      mitigations: toMitigations(threats, diagrams),
      assumptions: [],
    },
    notes: new Map(
      threats
        .filter((threat) => threat.notes.length > 0)
        .map((threat) => [threat.record.id, threat.notes]),
    ),
  };
}

function toMitigations(
  threats: readonly { record: ThreatInput; text: string }[],
  diagrams: readonly DiagramInput[],
): MitigationInput[] {
  return mitigationsFromText(
    threats.map(({ record, text }) => ({
      id: record.id,
      number: record.number,
      status: record.status,
      text,
    })),
    idsHeld({
      diagrams,
      threats: threats.map(({ record }) => record),
      mitigations: [],
      assumptions: [],
    }),
  );
}

function narrowings(
  model: Model,
  notes: ReadonlyMap<string, readonly DivergenceDetail[]>,
): Divergence[] {
  return model.threats.flatMap((threat) =>
    (notes.get(threat.id) ?? []).map((detail): Divergence => ({
      subject: { kind: 'threat', id: threat.id },
      detail,
      reason: 'narrowed',
    })),
  );
}

function toMetadata(document: ThreatDragonDocument): ModelMetadataInput {
  return {
    title: document.summary.title,
    owner: document.summary.owner ?? '',
    description: document.summary.description ?? '',
    contributors: (document.detail.contributors ?? []).map(
      (contributor) => contributor.name ?? '',
    ),
  };
}

function toDiagram(diagram: ThreatDragonDiagram): DiagramInput {
  const cells = cellsOf(diagram);
  const ports = portSides(cells);
  return {
    id: String(diagram.id),
    title: diagram.title,
    elements: cells.map((cell) => toElement(cell, ports)),
  };
}

function toElement(cell: ThreatDragonCell, ports: PortSides): ElementInput {
  if (cell.shape === 'actor') {
    return { kind: 'actor', ...toNode(cell), ...actorProperties(cell.data) };
  }
  if (cell.shape === 'process') {
    return {
      kind: 'process',
      ...toNode(cell),
      ...processProperties(cell.data),
    };
  }
  if (cell.shape === 'store') {
    return { kind: 'store', ...toNode(cell), ...storeProperties(cell.data) };
  }
  if (cell.shape === 'flow') {
    return {
      kind: 'flow',
      ...flowProperties(cell.data),
      ...toCommon(cell),
      source: toEndpoint(cell.source, ports),
      target: toEndpoint(cell.target, ports),
      waypoints: cell.vertices ?? [],
      bidirectional: cell.data.isBidirectional ?? false,
    };
  }
  if (cell.shape === 'td-text-block') {
    return {
      kind: 'text',
      id: cell.id,
      name: '',
      description: cell.data.description ?? '',
      outOfScope: false,
      reasonOutOfScope: '',
      position: cell.position,
      size: cell.size,
      text: cell.data.name ?? cell.attrs?.text?.text ?? '',
    };
  }
  if (cell.shape === 'trust-boundary-box') {
    return {
      kind: 'trust-boundary',
      ...toBoundaryCommon(cell),
      ...boundaryProperties(cell.data),
      shape: { kind: 'box', position: cell.position, size: cell.size },
    };
  }
  return toCurveBoundary(cell);
}

function toCurveBoundary(cell: ThreatDragonCurve): ElementInput {
  return {
    kind: 'trust-boundary',
    ...toBoundaryCommon(cell),
    ...boundaryProperties(cell.data),
    shape: {
      kind: 'curve',
      waypoints: [cell.source, ...(cell.vertices ?? []), cell.target],
    },
  };
}

function toNode(cell: ThreatDragonNode) {
  return { ...toCommon(cell), position: cell.position, size: cell.size };
}

function toCommon(cell: ThreatDragonNode | ThreatDragonFlow) {
  return {
    id: cell.id,
    name: cell.data.name ?? '',
    description: cell.data.description ?? '',
    outOfScope: cell.data.outOfScope ?? false,
    reasonOutOfScope: cell.data.reasonOutOfScope ?? '',
  };
}

function toBoundaryCommon(cell: ThreatDragonBoundary) {
  return {
    id: cell.id,
    name: cell.data.name ?? cell.attrs?.label?.text ?? '',
    description: cell.data.description ?? '',
    outOfScope: false,
    reasonOutOfScope: '',
  };
}

function toEndpoint(
  endpoint: ThreatDragonEndpoint,
  ports: PortSides,
): FlowEndpointInput {
  if (!isAnchored(endpoint)) {
    return { kind: 'free', position: endpoint };
  }
  const side = sideOfPort(ports, endpoint.cell, endpoint.port);
  return side === undefined
    ? { kind: 'attached', element: endpoint.cell }
    : { kind: 'attached', element: endpoint.cell, side };
}

function toThreatEntries(document: ThreatDragonDocument): {
  entries: ThreatEntry[];
  lastIssued: number;
} {
  const grouped = groupThreats(document.detail.diagrams);
  let issued = grouped.reduce(
    (highest, group) => Math.max(highest, group.threat.number ?? 0),
    document.detail.threatTop ?? 0,
  );
  const entries: ThreatEntry[] = [];
  for (const group of grouped) {
    if (group.threat.number === undefined) {
      issued += 1;
    }
    entries.push({ ...group, number: group.threat.number ?? issued });
  }
  return { entries, lastIssued: issued };
}

function groupThreats(
  diagrams: readonly ThreatDragonDiagram[],
): { threat: ThreatDragonThreat; elements: string[] }[] {
  const attached = new Map<
    string,
    { threat: ThreatDragonThreat; elements: string[] }
  >();
  for (const diagram of diagrams) {
    for (const cell of cellsOf(diagram)) {
      for (const threat of threatsOf(cell)) {
        const held = attached.get(threat.id);
        if (held) {
          held.elements.push(cell.id);
        } else {
          attached.set(threat.id, { threat, elements: [cell.id] });
        }
      }
    }
  }
  return [...attached.values()];
}

function toThreat(entry: ThreatEntry): {
  record: ThreatInput;
  text: string;
  notes: DivergenceDetail[];
} {
  const { threat } = entry;
  const status = toThreatStatus(threat.status);
  const severity = toSeverity(threat.severity);
  const category = toThreatCategory(threat);
  return {
    record: {
      id: threat.id,
      number: entry.number,
      title: threat.title,
      category: category.value,
      severity: severity.value,
      status: status.value,
      description: threat.description,
      elements: [...entry.elements],
    },
    text: threat.mitigation,
    notes: [
      ...(status.exact
        ? []
        : [
            {
              code: 'threat-status-unmapped' as const,
              parameters: { status: threat.status },
            },
          ]),
      ...(severity.exact
        ? []
        : [
            {
              code: 'threat-severity-unmapped' as const,
              parameters: { severity: threat.severity },
            },
          ]),
      ...(category.exact ? [] : [categoryNote(threat, category.value)]),
    ],
  };
}

function categoryNote(
  threat: ThreatDragonThreat,
  category: ThreatCategory,
): DivergenceDetail {
  return threat.modelType === 'EOP'
    ? { code: 'threat-category-eop-suit' }
    : {
        code: 'threat-category-unmapped',
        parameters: { category: category.category },
      };
}
