import {
  diagramIdSchema,
  elementIdsAcross,
  threatIdSchema,
  type Model,
} from '@saerskriven/model';
import type {
  ThreatDragonCell,
  ThreatDragonDiagram,
  ThreatDragonDocument,
  ThreatDragonThreat,
} from '@saerskriven/wire-threat-dragon';
import type { WriteResult } from './codec.js';
import type { Divergence } from './divergence.js';
import { equivalent } from './equivalence.js';
import {
  diagramsById,
  mergeDiagram,
  numberDiagrams,
} from './threat-dragon-diagrams.js';
import { allCells, indexById, threatsOf } from './threat-dragon-document.js';
import { preservedText } from './threat-dragon-preservation.js';
import { planThreats, type HighWaterMark } from './threat-dragon-threats.js';

/**
 * The model as a Threat Dragon v2 file, merged onto `source` where one is
 * given and projected into Threat Dragon's canonical form where none is.
 *
 * A merge writes over the mapped fields and leaves the rest of the document,
 * `attrs` styling, `zIndex` and `tools` among it, as it was. A mapped field is
 * rewritten only where the source no longer reads back as the model, because
 * a German category label and the severity `TBA` read as the model's value
 * too. An absent optional model property clears its mapped source property.
 * A pinned flow end is fastened to a port on its side: the source's own,
 * else one the cell declares there, else one this write declares and names
 * for the side. An end the model leaves unpinned is written with no port.
 *
 * The codec stamps release 2.6.2 and reports a different source stamp as
 * `overridden`. Threat and diagram numbers, and the `threatTop` and
 * `diagramTop` marks, follow `planThreats` and `numberDiagrams`, and a mark
 * this write moves is reported as `overridden`. Issuing a number is not a
 * divergence. What the format cannot hold is reported as `unrepresentable`:
 * an assumption, a threat on a trust boundary or a note, a note's name, an
 * out-of-scope boundary or note, and a diagram's name. A diagram, cell or
 * threat the source held and the model no longer does is reported as
 * `discarded-by-edit`. Mitigation texts follow `mitigationDivergences`.
 */
export function writeThreatDragon(
  model: Model,
  source?: ThreatDragonDocument,
): WriteResult {
  const held = diagramsById(source);
  const numbering = numberDiagrams(model, held, source?.detail.diagramTop);
  const plan = planThreats(model, source);
  const merged = model.diagrams.map((diagram, index) => ({
    ...mergeDiagram(
      diagram,
      held.get(diagram.id),
      numbering.numbers[index],
      plan.byCell,
    ),
    stamp: restamped(held.get(diagram.id)?.version, {
      kind: 'diagram',
      id: diagram.id,
    }),
  }));
  const document: ThreatDragonDocument = {
    version: writtenVersion,
    summary: {
      ...source?.summary,
      title: model.metadata.title,
      owner: preservedText(source?.summary.owner, model.metadata.owner),
      description: preservedText(
        source?.summary.description,
        model.metadata.description,
      ),
    },
    detail: {
      ...source?.detail,
      contributors: mergedContributors(model, source),
      diagrams: merged.map((entry) => ({
        ...entry.diagram,
        version: writtenVersion,
      })),
      diagramTop: numbering.diagramTop.value,
      reviewer: source?.detail.reviewer ?? '',
      threatTop: plan.threatTop.value,
    },
  };
  return {
    output: `${JSON.stringify(document, null, 2)}\n`,
    divergences: [
      ...restamped(source?.version, { kind: 'model' }),
      ...overriddenMark(
        threatMarkCodes,
        source?.detail.threatTop,
        plan.threatTop,
      ),
      ...overriddenMark(
        diagramMarkCodes,
        source?.detail.diagramTop,
        numbering.diagramTop,
      ),
      ...numbering.divergences,
      ...merged.flatMap((entry) => [...entry.stamp, ...entry.divergences]),
      ...plan.divergences,
      ...unrecordedAssumptions(model),
      ...discarded(model, source),
    ],
  };
}

const writtenVersion = '2.6.2';

function mergedContributors(
  model: Model,
  source: ThreatDragonDocument | undefined,
): NonNullable<ThreatDragonDocument['detail']['contributors']> {
  const held = source?.detail.contributors;
  const names = held?.map((contributor) => contributor.name ?? '') ?? [];
  return held !== undefined && equivalent(names, model.metadata.contributors)
    ? [...held]
    : model.metadata.contributors.map((name) => ({ name }));
}

function restamped(
  from: string | undefined,
  subject: Divergence['subject'],
): readonly Divergence[] {
  return from === undefined || from === writtenVersion
    ? []
    : [
        {
          subject,
          detail: {
            code: 'release-restamped',
            parameters: { from, written: writtenVersion },
          },
          reason: 'overridden',
        },
      ];
}

const threatMarkCodes = {
  issued: 'threat-mark-raised-by-issue',
  held: 'threat-mark-raised-to-issued',
} as const;

const diagramMarkCodes = {
  issued: 'diagram-mark-raised-by-issue',
  held: 'diagram-mark-raised-to-issued',
} as const;

function overriddenMark(
  codes: typeof threatMarkCodes | typeof diagramMarkCodes,
  from: number | undefined,
  mark: HighWaterMark,
): readonly Divergence[] {
  return from === undefined || from === mark.value
    ? []
    : [
        {
          subject: { kind: 'model' },
          detail: {
            code: mark.cause === 'issued' ? codes.issued : codes.held,
            parameters: { from, raised: mark.value },
          },
          reason: 'overridden',
        },
      ];
}

function unrecordedAssumptions(model: Model): readonly Divergence[] {
  return model.assumptions.map((assumption): Divergence => ({
    subject: { kind: 'assumption', id: assumption.id },
    detail: { code: 'assumption-unrecorded' },
    reason: 'unrepresentable',
  }));
}

function discarded(
  model: Model,
  source: ThreatDragonDocument | undefined,
): readonly Divergence[] {
  if (source === undefined) {
    return [];
  }
  const kept = new Set<string>(model.diagrams.map((diagram) => diagram.id));
  const elements = elementIdsAcross(model.diagrams);
  const attached = new Map<string, ReadonlySet<string>>(
    model.threats.map((threat) => [
      threat.id,
      new Set<string>(threat.elements),
    ]),
  );
  const nested = allCells(source)
    .filter((cell) => elements.has(cell.id))
    .flatMap((cell) => threatsOf(cell).map((threat) => ({ cell, threat })));
  return [
    ...source.detail.diagrams
      .filter((diagram) => !kept.has(String(diagram.id)))
      .map(discardedDiagram),
    ...[...indexById(nested.map((held) => held.threat)).values()]
      .filter((threat) => !attached.has(threat.id))
      .map(discardedThreat),
    ...nested
      .filter(
        (held) => attached.get(held.threat.id)?.has(held.cell.id) === false,
      )
      .map((held) => detachedThreat(held.threat, held.cell)),
  ];
}

function discardedDiagram(diagram: ThreatDragonDiagram): Divergence {
  const id = diagramIdSchema.safeParse(String(diagram.id));
  return {
    subject: id.success ? { kind: 'diagram', id: id.data } : { kind: 'model' },
    detail: {
      code: 'diagram-discarded',
      parameters: { title: diagram.title },
    },
    reason: 'discarded-by-edit',
  };
}

function detachedThreat(
  threat: ThreatDragonThreat,
  cell: ThreatDragonCell,
): Divergence {
  return {
    subject: threatSubject(threat),
    detail: {
      code: 'threat-copy-detached',
      parameters: { cell: cell.id },
    },
    reason: 'discarded-by-edit',
  };
}

function discardedThreat(threat: ThreatDragonThreat): Divergence {
  return {
    subject: threatSubject(threat),
    detail: {
      code: 'threat-discarded',
      parameters: { title: threat.title },
    },
    reason: 'discarded-by-edit',
  };
}

function threatSubject(threat: ThreatDragonThreat): Divergence['subject'] {
  const id = threatIdSchema.safeParse(threat.id);
  return id.success ? { kind: 'threat', id: id.data } : { kind: 'model' };
}
