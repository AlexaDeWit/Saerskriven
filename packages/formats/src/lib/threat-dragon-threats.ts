import {
  elementsAcross,
  type Element,
  type Model,
  type Threat,
  type ThreatId,
} from '@saerskriven/model';
import type {
  ThreatDragonDocument,
  ThreatDragonThreat,
} from '@saerskriven/wire-threat-dragon';
import type { Divergence } from './divergence.js';
import { equivalent } from './equivalence.js';
import {
  allCells,
  hostsThreats,
  indexById,
  threatsOf,
  type ThreatDragonHost,
} from './threat-dragon-document.js';
import {
  mitigationDivergences,
  mitigationText,
} from './threat-dragon-mitigations.js';
import {
  fromSeverity,
  fromThreatCategory,
  fromThreatStatus,
  toSeverity,
  toThreatCategory,
  toThreatStatus,
  type ThreatDragonCategoryFields,
} from './threat-dragon-vocabulary.js';

/**
 * A mark a file carries so Threat Dragon issues no number twice, and what
 * set its value. `issued`: a number this write put in the file that the file
 * did not carry. `unreachable`: the model has issued above every number the
 * file holds, so the mark keeps the gap a removed threat left.
 */
export type HighWaterMark = {
  readonly value: number;
  readonly cause: 'issued' | 'unreachable';
};

/**
 * Where every threat of the model goes: the wire threats to nest under each
 * cell id, the `threatTop` the file needs, and what the format could not hold.
 */
export type ThreatPlan = {
  readonly byCell: ReadonlyMap<string, readonly ThreatDragonThreat[]>;
  readonly threatTop: HighWaterMark;
  readonly divergences: readonly Divergence[];
};

/**
 * The model's threats as Threat Dragon nests them. A threat naming several
 * elements is written under each, reported as `split` unless the source
 * already nested it under all of them. An attachment to a trust boundary or a
 * note, and a threat with no cell to go under, are `unrepresentable`. A
 * category Threat Dragon's own labels do not name, such as PLOT4ai's, is
 * `narrowed`, since the label reaches the file and reads back as custom.
 *
 * A threat the source holds under a cell is merged onto that copy in the
 * cell's own order, keeping the source's status, severity and category
 * spelling wherever it still reads back as the model's value. Its mitigation
 * text is {@link mitigationText}.
 *
 * `threatTop` never falls below the mark the file declared, or, where it
 * declared none, below the highest number it holds, which a zero mark would
 * have Threat Dragon issue again. Above that it covers every number this
 * write issued, and the model's own mark where the file's numbers fall short
 * of it.
 */
export function planThreats(
  model: Model,
  source: ThreatDragonDocument | undefined,
): ThreatPlan {
  const kinds = elementKinds(model);
  const hosts = indexById(source ? allCells(source).filter(hostsThreats) : []);
  const nested = new Map(
    [...hosts].map(([id, host]) => [id, indexById(threatsOf(host))]),
  );
  const carried = new Set<number>(
    [...hosts.values()]
      .flatMap(threatsOf)
      .flatMap((threat) =>
        threat.number === undefined ? [] : [threat.number],
      ),
  );
  const byCell = new Map<string, ThreatDragonThreat[]>();
  const divergences: Divergence[] = [];
  const issued: number[] = [];
  const written: Threat[] = [];
  for (const threat of model.threats) {
    const placed: string[] = [];
    for (const id of threat.elements) {
      if (canHost(kinds, id)) {
        placed.push(id);
      } else {
        divergences.push(strayAttachment(threat.id, id, kinds.get(id)));
      }
    }
    if (placed.length === 0) {
      divergences.push(unplaceable(threat.id));
      continue;
    }
    if (
      placed.length > 1 &&
      !placed.every((id) => nested.get(id)?.has(threat.id) === true)
    ) {
      divergences.push(split(threat.id, placed.length));
    }
    written.push(threat);
    if (!carried.has(threat.number)) {
      issued.push(threat.number);
    }
    const category = fromThreatCategory(threat.category);
    if (!equivalent(toThreatCategory(category).value, threat.category)) {
      divergences.push(unnamedCategory(threat));
    }
    const text = mitigationText(threat, model);
    for (const id of placed) {
      const list = byCell.get(id) ?? [];
      list.push(
        projectThreat(threat, nested.get(id)?.get(threat.id), category, text),
      );
      byCell.set(id, list);
    }
  }
  return {
    byCell: new Map(
      [...byCell].map(([id, list]) => [id, inSourceOrder(list, hosts.get(id))]),
    ),
    threatTop: highWaterMark(
      model,
      source,
      written.map((threat) => threat.number),
      issued,
    ),
    divergences: [...divergences, ...mitigationDivergences(model, written)],
  };
}

function elementKinds(model: Model): ReadonlyMap<string, Element['kind']> {
  return new Map(
    elementsAcross(model.diagrams).map((element): [string, Element['kind']] => [
      element.id,
      element.kind,
    ]),
  );
}

const hostKinds: ReadonlySet<Element['kind'] | undefined> = new Set<
  Element['kind'] | undefined
>(['actor', 'process', 'store', 'flow']);

function canHost(
  kinds: ReadonlyMap<string, Element['kind']>,
  id: string,
): boolean {
  return hostKinds.has(kinds.get(id));
}

function highWaterMark(
  model: Model,
  source: ThreatDragonDocument | undefined,
  written: readonly number[],
  issued: readonly number[],
): HighWaterMark {
  const held = Math.max(0, ...written);
  const floor = source?.detail.threatTop ?? held;
  const unreachable =
    Math.max(floor, held) < model.lastIssuedThreatNumber
      ? model.lastIssuedThreatNumber
      : 0;
  return {
    value: Math.max(floor, ...issued, unreachable),
    cause: unreachable > 0 ? 'unreachable' : 'issued',
  };
}

function inSourceOrder(
  threats: readonly ThreatDragonThreat[],
  host: ThreatDragonHost | undefined,
): readonly ThreatDragonThreat[] {
  if (host === undefined) {
    return threats;
  }
  const written = indexById(threats);
  const held = new Set<string>(threatsOf(host).map((threat) => threat.id));
  return [
    ...threatsOf(host).flatMap((threat) => {
      const kept = written.get(threat.id);
      return kept === undefined ? [] : [kept];
    }),
    ...threats.filter((threat) => !held.has(threat.id)),
  ];
}

function projectThreat(
  threat: Threat,
  held: ThreatDragonThreat | undefined,
  category: ThreatDragonCategoryFields,
  mitigation: string,
): ThreatDragonThreat {
  const named =
    held !== undefined &&
    equivalent(toThreatCategory(held).value, threat.category);
  return {
    ...held,
    ...(named ? {} : category),
    id: threat.id,
    number: threat.number,
    title: threat.title,
    status:
      held !== undefined && toThreatStatus(held.status).value === threat.status
        ? held.status
        : fromThreatStatus(threat.status),
    severity:
      held !== undefined && toSeverity(held.severity).value === threat.severity
        ? held.severity
        : fromSeverity(threat.severity),
    description: threat.description,
    mitigation,
  };
}

function strayAttachment(
  threat: ThreatId,
  element: string,
  kind: Element['kind'] | undefined,
): Divergence {
  return {
    subject: { kind: 'threat', id: threat },
    detail: `the attachment to the ${kind ?? 'unknown'} "${element}", which the format nests a threat under an actor, a process, a store, or a flow alone`,
    reason: 'unrepresentable',
  };
}

function unplaceable(threat: ThreatId): Divergence {
  return {
    subject: { kind: 'threat', id: threat },
    detail:
      'the threat itself, which the format holds nowhere but under a cell and this one names none it can nest under',
    reason: 'unrepresentable',
  };
}

function split(threat: ThreatId, count: number): Divergence {
  return {
    subject: { kind: 'threat', id: threat },
    detail: `the one record, written once under each of the ${count} elements it names`,
    reason: 'split',
  };
}

function unnamedCategory(threat: Threat): Divergence {
  return {
    subject: { kind: 'threat', id: threat.id },
    detail: `the ${threat.category.methodology} category "${threat.category.category}", which Threat Dragon's own labels do not name`,
    reason: 'narrowed',
  };
}
