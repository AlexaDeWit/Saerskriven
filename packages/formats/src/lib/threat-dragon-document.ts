import type { Side } from '@saerskriven/model';
import type {
  ThreatDragonCell,
  ThreatDragonDiagram,
  ThreatDragonDocument,
  ThreatDragonEndpoint,
  ThreatDragonThreat,
} from '@saerskriven/wire-threat-dragon';

/** A cell drawn as a box on the canvas: an actor, a process, or a store. */
export type ThreatDragonNode = Extract<
  ThreatDragonCell,
  { shape: 'actor' | 'process' | 'store' }
>;

/** A data flow, the one cell drawn as an edge between two endpoints. */
export type ThreatDragonFlow = Extract<ThreatDragonCell, { shape: 'flow' }>;

/**
 * A trust boundary, in either shape and under either spelling of the curve.
 */
export type ThreatDragonBoundary = Extract<
  ThreatDragonCell,
  {
    shape:
      | 'trust-boundary-box'
      | 'trust-boundary-curve'
      | 'trust-broundary-curve';
  }
>;

/** A trust boundary drawn as a curve, under either spelling. */
export type ThreatDragonCurve = Extract<
  ThreatDragonCell,
  { shape: 'trust-boundary-curve' | 'trust-broundary-curve' }
>;

/** A cell Threat Dragon nests threats under: a node or a flow. */
export type ThreatDragonHost = ThreatDragonNode | ThreatDragonFlow;

/** Whether a cell is drawn as a box: an actor, a process, or a store. */
export function isNodeCell(cell: ThreatDragonCell): cell is ThreatDragonNode {
  return (
    cell.shape === 'actor' || cell.shape === 'process' || cell.shape === 'store'
  );
}

/**
 * Whether a cell is one Threat Dragon nests threats under, narrowed so the
 * path down to `data.threats` needs no cast.
 */
export function hostsThreats(cell: ThreatDragonCell): cell is ThreatDragonHost {
  return isNodeCell(cell) || cell.shape === 'flow';
}

/**
 * Whether an endpoint is fastened to a cell rather than left on empty
 * canvas, tested with `Object.hasOwn` so an inherited key does not count.
 */
export function isAnchored(
  endpoint: ThreatDragonEndpoint,
): endpoint is Extract<ThreatDragonEndpoint, { cell: string }> {
  return Object.hasOwn(endpoint, 'cell');
}

/** The side each port of each node cell sits on, by cell id and then port id. */
export type PortSides = ReadonlyMap<string, ReadonlyMap<string, Side>>;

/**
 * The side every port of the given cells sits on. Threat Dragon fastens a
 * flow to a port, and a port's group is named for the side of its cell.
 */
export function portSides(cells: readonly ThreatDragonCell[]): PortSides {
  return new Map(
    cells.flatMap((cell) =>
      'ports' in cell && cell.ports?.items !== undefined
        ? [
            [
              cell.id,
              new Map(cell.ports.items.map((item) => [item.id, item.group])),
            ] as const,
          ]
        : [],
    ),
  );
}

/** The side a port of a cell sits on, none for no port or a port the cell does not declare. */
export function sideOfPort(
  ports: PortSides,
  cell: string,
  port: string | undefined,
): Side | undefined {
  return port === undefined ? undefined : ports.get(cell)?.get(port);
}

/** The id of a port of a cell on the given side, none where the cell declares none there. */
export function portOnSide(
  ports: PortSides,
  cell: string,
  side: Side,
): string | undefined {
  for (const [port, at] of ports.get(cell) ?? []) {
    if (at === side) {
      return port;
    }
  }
  return undefined;
}

/** The cells of one diagram, none where the diagram holds none. */
export function cellsOf(
  diagram: ThreatDragonDiagram,
): readonly ThreatDragonCell[] {
  return diagram.cells ?? [];
}

/** The threats nested under one cell, none where the cell hosts none. */
export function threatsOf(
  cell: ThreatDragonCell,
): readonly ThreatDragonThreat[] {
  return hostsThreats(cell) ? (cell.data.threats ?? []) : [];
}

/** Every cell of a document, in the order its diagrams hold them. */
export function allCells(
  document: ThreatDragonDocument,
): readonly ThreatDragonCell[] {
  return document.detail.diagrams.flatMap(cellsOf);
}

/**
 * The records keyed by their own id, the first of a repeated id winning, as
 * a document Threat Dragon wrote holds cell and threat ids unique.
 */
export function indexById<Record extends { id: string }>(
  records: readonly Record[],
): ReadonlyMap<string, Record> {
  const held = new Map<string, Record>();
  for (const record of records) {
    if (!held.has(record.id)) {
      held.set(record.id, record);
    }
  }
  return held;
}
