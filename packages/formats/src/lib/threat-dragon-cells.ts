import type {
  Actor,
  BoxBoundaryShape,
  CurveBoundaryShape,
  Element,
  ElementId,
  Flow,
  FlowEndpoint,
  Point,
  Process,
  Side,
  Size,
  Store,
  TextElement,
  TrustBoundary,
} from '@saerskriven/model';
import type {
  ThreatDragonCell,
  ThreatDragonElementData,
  ThreatDragonEndpoint,
  ThreatDragonThreat,
} from '@saerskriven/wire-threat-dragon';
import type { Divergence } from './divergence.js';
import { equivalent } from './equivalence.js';
import {
  isAnchored,
  isNodeCell,
  portOnSide,
  sideOfPort,
  type PortSides,
  type ThreatDragonBoundary,
  type ThreatDragonCurve,
  type ThreatDragonNode,
} from './threat-dragon-document.js';
import {
  preservedFlag,
  preservedList,
  preservedText,
} from './threat-dragon-preservation.js';
import { fromThreatStatus } from './threat-dragon-vocabulary.js';

/** A port a flow's pinned end needs on a node cell that declares none on that side. */
export type NeededPort = {
  readonly cell: string;
  readonly side: Side;
};

/**
 * A cell as a merge produced it, what producing it cost, and the ports it
 * needs on other cells.
 */
export type MergedCell = {
  readonly cell: ThreatDragonCell;
  readonly divergences: readonly Divergence[];
  readonly ports: readonly NeededPort[];
};

/**
 * One element merged onto the source cell of its id where that cell has the
 * same shape. A source cell of another shape is discarded and reported.
 */
export function mergeCell(
  element: Element,
  held: ThreatDragonCell | undefined,
  threats: readonly ThreatDragonThreat[],
  index: number,
  ports: PortSides,
): MergedCell {
  if (element.kind === 'actor') {
    return actorCell(element, held, threats, index);
  }
  if (element.kind === 'process') {
    return processCell(element, held, threats, index);
  }
  if (element.kind === 'store') {
    return storeCell(element, held, threats, index);
  }
  if (element.kind === 'flow') {
    return flowCell(element, held, threats, index, ports);
  }
  if (element.kind === 'text') {
    return textCell(element, held, index);
  }
  return element.shape.kind === 'box'
    ? boxBoundary(element, element.shape, held, index)
    : curveBoundary(element, element.shape, held, index);
}

/**
 * The cells with every port {@link mergeCell} asked for declared: a group
 * for the side where the cell declares none, and an item named for the side
 * in it. A port asked of a cell that is not a node is left undeclared, a flow
 * end the model's own parse refuses.
 */
export function withNeededPorts(
  cells: readonly ThreatDragonCell[],
  needed: readonly NeededPort[],
): ThreatDragonCell[] {
  const sides = new Map<string, Set<Side>>();
  for (const port of needed) {
    sides.set(port.cell, (sides.get(port.cell) ?? new Set()).add(port.side));
  }
  return cells.map((cell) => {
    const wanted = sides.get(cell.id);
    if (wanted === undefined || !isNodeCell(cell)) {
      return cell;
    }
    const groups: NonNullable<NodePorts['groups']> = { ...cell.ports?.groups };
    const items: NonNullable<NodePorts['items']> = [
      ...(cell.ports?.items ?? []),
    ];
    for (const side of wanted) {
      groups[side] ??= { position: side };
      if (!items.some((item) => item.group === side && item.id === side)) {
        items.push({ group: side, id: side });
      }
    }
    return { ...cell, ports: { ...cell.ports, groups, items } };
  });
}

type ProjectedEndpoint = {
  readonly endpoint: ThreatDragonEndpoint;
  readonly ports: readonly NeededPort[];
};

type NodePorts = NonNullable<ThreatDragonNode['ports']>;

const noPorts: readonly NeededPort[] = [];

const openStatus = fromThreatStatus('open');

function actorCell(
  element: Actor,
  held: ThreatDragonCell | undefined,
  threats: readonly ThreatDragonThreat[],
  index: number,
): MergedCell {
  const from = held?.shape === 'actor' ? held : undefined;
  return {
    cell: {
      ...from,
      ...nodeParts(element, from, index),
      shape: 'actor',
      data: {
        ...from?.data,
        ...elementData(element, from?.data, threats),
        providesAuthentication: element.providesAuthentication,
        type: 'tm.Actor',
      },
    },
    divergences: reshaped(element, held, from),
    ports: noPorts,
  };
}

function processCell(
  element: Process,
  held: ThreatDragonCell | undefined,
  threats: readonly ThreatDragonThreat[],
  index: number,
): MergedCell {
  const from = held?.shape === 'process' ? held : undefined;
  return {
    cell: {
      ...from,
      ...nodeParts(element, from, index),
      shape: 'process',
      data: {
        ...from?.data,
        ...elementData(element, from?.data, threats),
        handlesCardPayment: element.handlesCardPayment,
        handlesGoodsOrServices: element.handlesGoodsOrServices,
        isWebApplication: element.isWebApplication,
        privilegeLevel: element.privilegeLevel,
        type: 'tm.Process',
      },
    },
    divergences: reshaped(element, held, from),
    ports: noPorts,
  };
}

function storeCell(
  element: Store,
  held: ThreatDragonCell | undefined,
  threats: readonly ThreatDragonThreat[],
  index: number,
): MergedCell {
  const from = held?.shape === 'store' ? held : undefined;
  return {
    cell: {
      ...from,
      ...nodeParts(element, from, index),
      shape: 'store',
      data: {
        ...from?.data,
        ...elementData(element, from?.data, threats),
        isALog: element.isALog,
        isEncrypted: element.isEncrypted,
        isSigned: element.isSigned,
        storesCredentials: element.storesCredentials,
        storesInventory: element.storesInventory,
        type: 'tm.Store',
      },
    },
    divergences: reshaped(element, held, from),
    ports: noPorts,
  };
}

function flowCell(
  element: Flow,
  held: ThreatDragonCell | undefined,
  threats: readonly ThreatDragonThreat[],
  index: number,
  ports: PortSides,
): MergedCell {
  const from = held?.shape === 'flow' ? held : undefined;
  const source = preservedEndpoint(from?.source, element.source, ports);
  const target = preservedEndpoint(from?.target, element.target, ports);
  return {
    cell: {
      ...from,
      id: element.id,
      zIndex: zIndexOf(from, index),
      shape: 'flow',
      source: source.endpoint,
      target: target.endpoint,
      vertices: preservedList(from?.vertices, element.waypoints),
      data: {
        ...from?.data,
        ...elementData(element, from?.data, threats),
        isBidirectional: preservedFlag(
          from?.data.isBidirectional,
          element.bidirectional,
        ),
        protocol: element.protocol,
        isEncrypted: element.isEncrypted,
        isPublicNetwork: element.isPublicNetwork,
        trustBoundaryIds: element.trustBoundaryIds,
        type: 'tm.Flow',
      },
    },
    divergences: reshaped(element, held, from),
    ports: [...source.ports, ...target.ports],
  };
}

function textCell(
  element: TextElement,
  held: ThreatDragonCell | undefined,
  index: number,
): MergedCell {
  const from = held?.shape === 'td-text-block' ? held : undefined;
  const shown = from?.data.name ?? from?.attrs?.text?.text ?? '';
  return {
    cell: {
      ...from,
      id: element.id,
      zIndex: zIndexOf(from, index),
      shape: 'td-text-block',
      position: element.position,
      size: element.size,
      data: {
        ...from?.data,
        name: shown === element.text ? from?.data.name : element.text,
        description: preservedText(from?.data.description, element.description),
        hasOpenThreats: from?.data.hasOpenThreats ?? false,
        type: 'tm.Text',
      },
    },
    divergences: [
      ...reshaped(element, held, from),
      ...unlabelled(element),
      ...unscoped(element),
    ],
    ports: noPorts,
  };
}

function boxBoundary(
  element: TrustBoundary,
  shape: BoxBoundaryShape,
  held: ThreatDragonCell | undefined,
  index: number,
): MergedCell {
  const from = held?.shape === 'trust-boundary-box' ? held : undefined;
  return {
    cell: {
      ...from,
      id: element.id,
      zIndex: zIndexOf(from, index),
      shape: 'trust-boundary-box',
      position: shape.position,
      size: shape.size,
      data: {
        ...from?.data,
        ...boundaryData(element, from),
        type: 'tm.BoundaryBox',
      },
    },
    divergences: [...reshaped(element, held, from), ...unscoped(element)],
    ports: noPorts,
  };
}

function curveBoundary(
  element: TrustBoundary,
  shape: CurveBoundaryShape,
  held: ThreatDragonCell | undefined,
  index: number,
): MergedCell {
  const from =
    held?.shape === 'trust-boundary-curve' ||
    held?.shape === 'trust-broundary-curve'
      ? held
      : undefined;
  const data: ThreatDragonCurve['data'] = {
    ...from?.data,
    ...boundaryData(element, from),
    type: 'tm.Boundary',
  };
  const body = {
    id: element.id,
    zIndex: zIndexOf(from, index),
    ...curvePoints(from, shape),
    data,
  };
  return {
    cell:
      from?.shape === 'trust-broundary-curve'
        ? { ...from, ...body, shape: 'trust-broundary-curve' }
        : { ...from, ...body, shape: 'trust-boundary-curve' },
    divergences: [...reshaped(element, held, from), ...unscoped(element)],
    ports: noPorts,
  };
}

function curvePoints(
  from: ThreatDragonCurve | undefined,
  shape: CurveBoundaryShape,
): { source: Point; target: Point; vertices: Point[] | undefined } {
  const waypoints = shape.waypoints;
  const drawn =
    from === undefined
      ? undefined
      : [from.source, ...(from.vertices ?? []), from.target];
  return from !== undefined && equivalent(drawn, waypoints)
    ? { source: from.source, target: from.target, vertices: from.vertices }
    : {
        source: { ...waypoints[0] },
        target: { ...waypoints[waypoints.length - 1] },
        vertices: waypoints.slice(1, -1),
      };
}

function zIndexOf(
  from: { readonly zIndex?: number } | undefined,
  index: number,
): number {
  return from?.zIndex ?? index + 1;
}

function nodeParts(
  element: Actor | Process | Store,
  from: ThreatDragonNode | undefined,
  index: number,
): { id: ElementId; zIndex: number; position: Point; size: Size } {
  return {
    id: element.id,
    zIndex: zIndexOf(from, index),
    position: element.position,
    size: element.size,
  };
}

function elementData(
  element: Actor | Process | Store | Flow,
  from: ThreatDragonElementData | undefined,
  threats: readonly ThreatDragonThreat[],
): ThreatDragonElementData {
  return {
    name: preservedText(from?.name, element.name),
    description: preservedText(from?.description, element.description),
    outOfScope: preservedFlag(from?.outOfScope, element.outOfScope),
    reasonOutOfScope: preservedText(
      from?.reasonOutOfScope,
      element.reasonOutOfScope,
    ),
    hasOpenThreats:
      from?.hasOpenThreats ??
      threats.some((threat) => threat.status === openStatus),
    threats: preservedList(from?.threats, threats),
  };
}

function boundaryData(
  element: TrustBoundary,
  from: ThreatDragonBoundary | undefined,
): Omit<ThreatDragonBoundary['data'], 'type'> {
  const shown = from?.data.name ?? from?.attrs?.label?.text ?? '';
  return {
    name: shown === element.name ? from?.data.name : element.name,
    description: preservedText(from?.data.description, element.description),
    hasOpenThreats: from?.data.hasOpenThreats ?? false,
    isTrustBoundary: from?.data.isTrustBoundary ?? true,
    containedElements: element.containedElements,
    crossingFlows: element.crossingFlows,
  };
}

function preservedEndpoint(
  from: ThreatDragonEndpoint | undefined,
  wanted: FlowEndpoint,
  ports: PortSides,
): ProjectedEndpoint {
  if (wanted.kind === 'free') {
    return {
      endpoint:
        from !== undefined &&
        !isAnchored(from) &&
        equivalent(from, wanted.position)
          ? from
          : { ...wanted.position },
      ports: noPorts,
    };
  }
  if (
    from !== undefined &&
    isAnchored(from) &&
    from.cell === wanted.element &&
    sideOfPort(ports, from.cell, from.port) === wanted.side
  ) {
    return { endpoint: from, ports: noPorts };
  }
  if (wanted.side === undefined) {
    return { endpoint: { cell: wanted.element }, ports: noPorts };
  }
  const port = portOnSide(ports, wanted.element, wanted.side);
  return port === undefined
    ? {
        endpoint: { cell: wanted.element, port: wanted.side },
        ports: [{ cell: wanted.element, side: wanted.side }],
      }
    : { endpoint: { cell: wanted.element, port }, ports: noPorts };
}

function unlabelled(element: TextElement): readonly Divergence[] {
  return element.name === ''
    ? []
    : [
        {
          subject: { kind: 'element', id: element.id },
          detail: `the name "${element.name}", which the format has one text for a note and no name beside it`,
          reason: 'unrepresentable',
        },
      ];
}

function unscoped(element: TextElement | TrustBoundary): readonly Divergence[] {
  return element.outOfScope || element.reasonOutOfScope !== ''
    ? [
        {
          subject: { kind: 'element', id: element.id },
          detail:
            'the out-of-scope marking, which the format records on the elements a threat attaches to alone',
          reason: 'unrepresentable',
        },
      ]
    : [];
}

function reshaped(
  element: Element,
  held: ThreatDragonCell | undefined,
  from: ThreatDragonCell | undefined,
): readonly Divergence[] {
  return held !== undefined && from === undefined
    ? [
        {
          subject: { kind: 'element', id: element.id },
          detail: `what the source held on the ${held.shape} cell of this id, which now draws a ${element.kind}`,
          reason: 'discarded-by-edit',
        },
      ]
    : [];
}
