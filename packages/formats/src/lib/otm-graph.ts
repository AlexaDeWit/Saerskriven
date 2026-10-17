import {
  autoExtent,
  autoPlacement,
  geometryLimits,
  type DiagramInput,
  type ElementInput,
  type NodePlacement,
  type PlacementInput,
  type Point,
} from '@saerskriven/model';
import type { OtmDocument } from '@saerskriven/wire-otm';
import {
  importElement,
  labeledClause,
  type ImportContext,
} from './import-model.js';

/**
 * The OTM components, trust zones and dataflows as model elements, and each
 * diagram representation as a diagram that places them. A file with no
 * diagram representation gives one diagram, titled with the project's name.
 * A component or a trust zone is placed on each diagram it has an entry for,
 * by its first entry there, and on the first diagram where it has none. A
 * dataflow is placed on each diagram that places either of its ends. An end
 * whose component that diagram does not place is drawn away from it, level
 * with the centre of the end the diagram does place and the generated grid's
 * gutter beside it: left for a source, right for a target, held within the
 * geometry bound. It reports `otm-assets-as-descriptions` once, and only
 * where an asset a component or a dataflow references put text in that
 * element's description.
 */
export function otmGraph(document: OtmDocument, context: ImportContext) {
  const components = document.components ?? [];
  const componentIds = context.index(
    components,
    (item) => item.id,
    'components',
  );
  const assets = assetDescriptions(
    context.index(document.assets ?? [], (item) => item.id, 'assets'),
    context,
  );
  context.index(document.trustZones ?? [], (item) => item.id, 'trustZones');
  context.index(document.dataflows ?? [], (item) => item.id, 'dataflows');
  context.index(
    document.representations ?? [],
    (item) => item.id,
    'representations',
  );
  const diagrams = otmDiagrams(document, context);
  const nodes = otmComponents(components, diagrams, assets, context);
  const zones = otmZones(
    document.trustZones ?? [],
    diagrams,
    nodes.placed.length,
    context,
  );
  const flows = otmFlows(
    document.dataflows ?? [],
    componentIds,
    nodes.geometries,
    diagrams.length,
    assets,
    context,
  );
  if (assets.made) {
    context.report({ code: 'otm-assets-as-descriptions' });
  }
  const placed = [...nodes.placed, ...zones, ...flows];
  return {
    elements: placed.map(({ element }) => element),
    diagrams: diagrams.map(({ id, title }, index): DiagramInput => ({
      id,
      title,
      placements: placed.flatMap(({ placements }) => {
        const placement = placements.get(index);
        return placement === undefined ? [] : [placement];
      }),
    })),
  };
}

type Component = NonNullable<OtmDocument['components']>[number];

type Zone = NonNullable<OtmDocument['trustZones']>[number];

type Dataflow = NonNullable<OtmDocument['dataflows']>[number];

type Asset = NonNullable<OtmDocument['assets']>[number];

type Entry = NonNullable<Component['representations']>[number];

type AssetDescriptions = ReturnType<typeof assetDescriptions>;

type OtmDiagram = {
  readonly id: string;
  readonly title: string;
  readonly representation: string | undefined;
};

type Geometry = Pick<NodePlacement, 'position' | 'size'>;

type Placed = {
  readonly element: ElementInput;
  readonly placements: ReadonlyMap<number, PlacementInput>;
};

const gridGutter = autoPlacement(1).x - autoPlacement(0).x - autoExtent.width;

function otmDiagrams(
  document: OtmDocument,
  context: ImportContext,
): OtmDiagram[] {
  const drawn = (document.representations ?? []).filter(
    (item) => item.type === 'diagram',
  );
  if (drawn.length === 0) {
    return [
      {
        id: context.id('otm-diagram', document.project.id),
        title: document.project.name,
        representation: undefined,
      },
    ];
  }
  return drawn.map((representation) => {
    context.fields(representation, ['id', 'name', 'type']);
    return {
      id: context.id('otm-diagram', representation.id),
      title: representation.name,
      representation: representation.id,
    };
  });
}

function otmComponents(
  components: readonly Component[],
  diagrams: readonly OtmDiagram[],
  assets: AssetDescriptions,
  context: ImportContext,
) {
  const placed: Placed[] = [];
  const geometries = new Map<string, ReadonlyMap<number, Geometry>>();
  for (const component of components) {
    context.fields(component, [
      'id',
      'name',
      'description',
      'type',
      'representations',
      'assets',
      'threats',
    ]);
    const id = context.id('otm-component', component.id);
    const data = component.assets;
    if (data !== null && data !== undefined) {
      context.fields(data, ['processed', 'stored']);
    }
    const description = context.text([
      component.description ?? '',
      ...labeledClause('Source component type: ', component.type),
      assets.prose(data?.processed ?? [], 'components.assets.processed'),
      assets.prose(data?.stored ?? [], 'components.assets.stored'),
    ]);
    const geometry = otmGeometry(component, diagrams, placed.length, context);
    geometries.set(component.id, geometry);
    placed.push({
      element: {
        ...importElement(context, id, component.name, description),
        kind: 'process',
      },
      placements: placedBy(geometry, (at) => ({ element: id, ...at })),
    });
  }
  if (components.length > 0) {
    context.report({ code: 'otm-components-as-processes' });
  }
  return { placed, geometries };
}

function otmZones(
  zones: readonly Zone[],
  diagrams: readonly OtmDiagram[],
  offset: number,
  context: ImportContext,
): Placed[] {
  return zones.map((zone, index): Placed => {
    context.fields(zone, ['id', 'name', 'description', 'representations']);
    const id = context.id('otm-zone', zone.id);
    return {
      element: {
        ...importElement(context, id, zone.name, zone.description ?? ''),
        kind: 'trust-boundary',
      },
      placements: placedBy(
        otmGeometry(zone, diagrams, offset + index, context),
        (at) => ({ element: id, shape: { kind: 'box', ...at } }),
      ),
    };
  });
}

function otmGeometry(
  item: Component | Zone,
  diagrams: readonly OtmDiagram[],
  index: number,
  context: ImportContext,
): ReadonlyMap<number, Geometry> {
  const stated = new Map<number, Pick<Partial<Entry>, 'position' | 'size'>>();
  for (const entry of item.representations ?? []) {
    const diagram = diagrams.findIndex(
      ({ representation }) => representation === entry.representation,
    );
    if (diagram >= 0 && !stated.has(diagram)) {
      context.fields(entry, ['representation', 'id', 'position', 'size']);
      if (entry.position != null) {
        context.fields(entry.position, ['x', 'y']);
      }
      if (entry.size != null) {
        context.fields(entry.size, ['width', 'height']);
      }
      stated.set(diagram, entry);
    }
  }
  if (stated.size === 0) {
    stated.set(0, {});
  }
  const entries = [...stated];
  if (
    entries.some(([, entry]) => entry.position == null || entry.size == null)
  ) {
    context.report(
      { code: 'otm-geometry-generated', parameters: { id: item.id } },
      'overridden',
    );
  }
  return new Map(
    entries.map(([diagram, entry]) => [
      diagram,
      {
        position: entry.position ?? autoPlacement(index),
        size: entry.size ?? autoExtent,
      },
    ]),
  );
}

function placedBy(
  geometry: ReadonlyMap<number, Geometry>,
  placement: (at: Geometry) => PlacementInput,
): ReadonlyMap<number, PlacementInput> {
  return new Map(
    [...geometry].map(([diagram, at]) => [diagram, placement(at)]),
  );
}

function otmFlows(
  flows: readonly Dataflow[],
  componentIds: ReadonlyMap<string, Component>,
  geometries: ReadonlyMap<string, ReadonlyMap<number, Geometry>>,
  diagramCount: number,
  assets: AssetDescriptions,
  context: ImportContext,
): Placed[] {
  return flows.map((flow): Placed => {
    context.fields(flow, [
      'id',
      'name',
      'description',
      'source',
      'destination',
      'bidirectional',
      'assets',
      'threats',
    ]);
    for (const endpoint of [flow.source, flow.destination]) {
      if (!componentIds.has(endpoint)) {
        context.problem(['dataflows', flow.id], {
          code: 'unknown-source-reference',
          parameters: { id: endpoint, kind: 'component' },
        });
      }
    }
    const id = context.id('otm-flow', flow.id);
    const placements = new Map<number, PlacementInput>();
    for (let diagram = 0; diagram < diagramCount; diagram += 1) {
      const placement = flowPlacement(
        id,
        geometries.get(flow.source)?.get(diagram),
        geometries.get(flow.destination)?.get(diagram),
      );
      if (placement !== undefined) {
        placements.set(diagram, placement);
      }
    }
    return {
      element: {
        ...importElement(
          context,
          id,
          flow.name,
          context.text([
            flow.description ?? '',
            assets.prose(flow.assets ?? [], 'dataflows.assets'),
          ]),
        ),
        kind: 'flow',
        source: {
          kind: 'attached',
          element: context.id('otm-component', flow.source),
        },
        target: {
          kind: 'attached',
          element: context.id('otm-component', flow.destination),
        },
        bidirectional: flow.bidirectional === true,
      },
      placements,
    };
  });
}

function flowPlacement(
  element: string,
  source: Geometry | undefined,
  target: Geometry | undefined,
): PlacementInput | undefined {
  if (source === undefined) {
    return target === undefined
      ? undefined
      : {
          element,
          waypoints: [],
          source: { position: awayBeside(target, 'left') },
          target: {},
        };
  }
  return {
    element,
    waypoints: [],
    source: {},
    target:
      target === undefined ? { position: awayBeside(source, 'right') } : {},
  };
}

function awayBeside(node: Geometry, side: 'left' | 'right'): Point {
  const x =
    side === 'left'
      ? node.position.x - gridGutter
      : node.position.x + node.size.width + gridGutter;
  return {
    x: withinBound(x),
    y: withinBound(node.position.y + node.size.height / 2),
  };
}

function withinBound(coordinate: number): number {
  return Math.min(
    geometryLimits.bound,
    Math.max(-geometryLimits.bound, coordinate),
  );
}

function assetDescriptions(
  assets: ReadonlyMap<string, Asset>,
  context: ImportContext,
) {
  let made = false;
  return {
    get made() {
      return made;
    },
    prose: (ids: readonly (string | null)[], path: string): string => {
      const prose = context.text(
        ids.flatMap((id) => {
          if (id === null) {
            return [];
          }
          const asset = assets.get(id);
          if (asset === undefined) {
            context.problem([path], {
              code: 'unknown-source-reference',
              parameters: { id, kind: 'asset' },
            });
            return [];
          }
          context.fields(asset, ['id', 'name', 'description']);
          return context.text([asset.name, asset.description ?? ''], ': ');
        }),
        '\n',
      );
      made ||= prose !== '';
      return prose;
    },
  };
}
