import {
  autoExtent,
  autoPlacement,
  type ElementInput,
} from '@saerskriven/model';
import type { TmbomDocument } from '@saerskriven/wire-tmbom';
import { importElement, type ImportContext } from './import-model.js';

/**
 * The TM-BOM actors, components, data stores, trust zones and data flows as
 * diagram elements, laid out in one band per trust zone. Embedded diagram
 * languages are not interpreted.
 */
export function tmbomGraph(document: TmbomDocument, context: ImportContext) {
  const indexes: NodeIndexes = {
    actor: context.index(
      document.actors,
      (node) => node.symbolic_name,
      'actors',
    ),
    process: context.index(
      document.components,
      (node) => node.symbolic_name,
      'components',
    ),
    store: context.index(
      document.data_stores,
      (node) => node.symbolic_name,
      'data_stores',
    ),
  };
  const zoneIndex = context.index(
    document.trust_zones,
    (zone) => zone.symbolic_name,
    'trust_zones',
  );
  context.index(
    document.data_flows,
    (flow) => flow.symbolic_name,
    'data_flows',
  );
  context.index(document.data_sets, (data) => data.symbolic_name, 'data_sets');
  const descriptions = dataDescriptions(document, indexes.store, context);
  const nodes: readonly PlacedNode[] = [
    ...document.actors.map((source) => ({ source, kind: 'actor' as const })),
    ...document.components.map((source) => ({
      source,
      kind: 'process' as const,
    })),
    ...document.data_stores.map((source) => ({
      source,
      kind: 'store' as const,
    })),
  ];
  const elements = [
    ...zoneLayout(document, nodes, zoneIndex, descriptions, context),
    ...tmbomFlows(document.data_flows, indexes, context),
  ];
  if (nodes.length > 0) {
    context.report(
      'The diagram receives generated geometry grouped by source trust zone. Membership becomes visual.',
      'overridden',
    );
  }
  if (document.data_flows.length > 0) {
    context.report(
      'Flow encryption and sensitivity fields remain prose in the flow descriptions.',
    );
  }
  return elements;
}

/** A node's id, kept in a separate namespace for actors, components and stores. */
export function tmbomNodeId(
  kind: NodeKind,
  id: string,
  context: ImportContext,
): string {
  return context.id(`tmbom-${kind}`, id);
}

type NodeKind = 'actor' | 'process' | 'store';

type SourceNode =
  | TmbomDocument['actors'][number]
  | TmbomDocument['components'][number]
  | TmbomDocument['data_stores'][number];

type PlacedNode = { readonly source: SourceNode; readonly kind: NodeKind };

type NodeIndexes = Readonly<Record<NodeKind, ReadonlyMap<string, SourceNode>>>;

type Zone = TmbomDocument['trust_zones'][number];

type Flow = TmbomDocument['data_flows'][number];

type Endpoint = Flow['source'];

const bandLeft = 20;

const firstBandTop = 20;

const bandWidth = 1080;

const bandPadding = 100;

const rowHeight = 160;

const nodesPerRow = 4;

const bandGap = 80;

const endpointKinds: Readonly<Record<string, NodeKind>> = {
  actor: 'actor',
  component: 'process',
  'data-store': 'store',
};

function zoneLayout(
  document: TmbomDocument,
  nodes: readonly PlacedNode[],
  zoneIndex: ReadonlyMap<string, Zone>,
  descriptions: ReadonlyMap<string, readonly string[]>,
  context: ImportContext,
): ElementInput[] {
  const groups = new Map<string | undefined, PlacedNode[]>();
  for (const node of nodes) {
    const zone =
      'trust_zone' in node.source ? node.source.trust_zone : undefined;
    if (zone !== undefined && !zoneIndex.has(zone)) {
      context.problem(
        ['trust_zone'],
        `Unknown trust zone ${JSON.stringify(zone)}`,
      );
    }
    const group = groups.get(zone) ?? [];
    group.push(node);
    groups.set(zone, group);
  }
  for (const zone of document.trust_zones) {
    if (!groups.has(zone.symbolic_name)) {
      groups.set(zone.symbolic_name, []);
    }
  }
  const elements: ElementInput[] = [];
  let top = firstBandTop;
  for (const [zoneName, members] of groups) {
    const height =
      bandPadding +
      Math.max(1, Math.ceil(members.length / nodesPerRow)) * rowHeight;
    const zone = zoneName === undefined ? undefined : zoneIndex.get(zoneName);
    if (zone !== undefined) {
      context.fields(zone, ['symbolic_name', 'title', 'description']);
      elements.push({
        ...importElement(
          context,
          context.id('tmbom-zone', zone.symbolic_name),
          zone.title,
          zone.description,
        ),
        kind: 'trust-boundary',
        shape: {
          kind: 'box',
          position: { x: bandLeft, y: top },
          size: { width: bandWidth, height },
        },
      });
    }
    for (const [index, { source, kind }] of members.entries()) {
      const placed = autoPlacement(index);
      context.fields(source, ['symbolic_name', 'title', 'description']);
      if ('trust_zone' in source) {
        context.fields(source, ['trust_zone']);
      }
      elements.push({
        ...importElement(
          context,
          tmbomNodeId(kind, source.symbolic_name, context),
          source.title,
          context.text([
            source.description,
            ...(kind === 'store'
              ? (descriptions.get(source.symbolic_name) ?? [])
              : []),
          ]),
        ),
        kind,
        position: { x: placed.x, y: top + placed.y },
        size: autoExtent,
      });
    }
    top += height + bandGap;
  }
  return elements;
}

function tmbomFlows(
  flows: readonly Flow[],
  indexes: NodeIndexes,
  context: ImportContext,
): ElementInput[] {
  return flows.map((flow): ElementInput => {
    context.fields(flow, [
      'symbolic_name',
      'title',
      'description',
      'source',
      'destination',
      'encrypted',
      'has_sensitive_data',
    ]);
    return {
      ...importElement(
        context,
        context.id('tmbom-flow', flow.symbolic_name),
        flow.title,
        `${flow.description}\n\nEncrypted: ${String(flow.encrypted)}\nCarries sensitive data: ${String(flow.has_sensitive_data)}`,
      ),
      kind: 'flow',
      source: {
        kind: 'attached',
        element: endpointId(flow.source, indexes, context),
      },
      target: {
        kind: 'attached',
        element: endpointId(flow.destination, indexes, context),
      },
      waypoints: [],
      bidirectional: false,
    };
  });
}

function endpointId(
  given: Endpoint,
  indexes: NodeIndexes,
  context: ImportContext,
): string {
  context.fields(given, ['type', 'object']);
  const type = given.type.replace(/^#\/\$defs\//u, '').replaceAll('_', '-');
  const kind = Object.hasOwn(endpointKinds, type)
    ? endpointKinds[type]
    : undefined;
  if (kind === undefined || !indexes[kind].has(given.object)) {
    context.problem(
      ['data_flows'],
      `Unknown endpoint ${JSON.stringify(given)}`,
    );
  }
  return tmbomNodeId(kind ?? 'process', given.object, context);
}

function dataDescriptions(
  document: TmbomDocument,
  stores: ReadonlyMap<string, SourceNode>,
  context: ImportContext,
) {
  const descriptions = new Map<string, string[]>();
  for (const data of document.data_sets) {
    context.fields(data, [
      'symbolic_name',
      'title',
      'description',
      'placements',
    ]);
    let placements = 0;
    for (const placement of data.placements) {
      if (placement.data_store === undefined) {
        continue;
      }
      context.fields(placement, ['data_store']);
      if (!stores.has(placement.data_store)) {
        context.problem(
          ['data_sets', data.symbolic_name, 'placements'],
          `Unknown data store ${JSON.stringify(placement.data_store)}`,
        );
      }
      const prose = descriptions.get(placement.data_store) ?? [];
      prose.push(context.text([data.title, data.description], ': '));
      descriptions.set(placement.data_store, prose);
      placements += 1;
    }
    context.report(
      placements > 0
        ? `Data set ${JSON.stringify(data.symbolic_name)} becomes prose on its stores. Shared data identity is not retained.`
        : `Data set ${JSON.stringify(data.symbolic_name)} has no store placement and is not retained.`,
      'unrepresentable',
    );
  }
  return descriptions;
}
