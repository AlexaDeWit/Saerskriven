import {
  autoExtent,
  autoPlacement,
  type ElementInput,
} from '@saerskriven/model';
import type { OtmDocument } from '@saerskriven/wire-otm';
import { importElement, type ImportContext } from './import-model.js';

/**
 * The OTM components, trust zones and dataflows as diagram elements, placed
 * by the first diagram representation where the source has one.
 */
export function otmGraph(document: OtmDocument, context: ImportContext) {
  const components = document.components ?? [];
  const componentIds = context.index(
    components,
    (item) => item.id,
    'components',
  );
  const assets = context.index(
    document.assets ?? [],
    (item) => item.id,
    'assets',
  );
  context.index(document.trustZones ?? [], (item) => item.id, 'trustZones');
  context.index(document.dataflows ?? [], (item) => item.id, 'dataflows');
  context.index(
    document.representations ?? [],
    (item) => item.id,
    'representations',
  );
  const representation = document.representations?.find(
    (item) => item.type === 'diagram',
  );
  if (representation !== undefined) {
    context.fields(representation, ['id', 'name', 'type']);
  }
  const nodes = otmComponents(components, representation?.id, assets, context);
  const zones = otmZones(
    document.trustZones ?? [],
    representation?.id,
    nodes.length,
    context,
  );
  const flows = otmFlows(
    document.dataflows ?? [],
    componentIds,
    assets,
    context,
  );
  if (assets.size > 0) {
    context.report(
      'Referenced asset names become descriptions on flows and components. Shared data identity is not retained.',
    );
  }
  return {
    elements: [...nodes, ...zones, ...flows],
    title: representation?.name ?? document.project.name,
  };
}

type Component = NonNullable<OtmDocument['components']>[number];

type Zone = NonNullable<OtmDocument['trustZones']>[number];

type Dataflow = NonNullable<OtmDocument['dataflows']>[number];

type Asset = NonNullable<OtmDocument['assets']>[number];

function otmComponents(
  components: readonly Component[],
  representation: string | undefined,
  assets: ReadonlyMap<string, Asset>,
  context: ImportContext,
): ElementInput[] {
  const elements: ElementInput[] = [];
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
      `Source component type: ${component.type}`,
      dataProse(
        data?.processed ?? [],
        'components.assets.processed',
        assets,
        context,
      ),
      dataProse(
        data?.stored ?? [],
        'components.assets.stored',
        assets,
        context,
      ),
    ]);
    elements.push({
      ...importElement(context, id, component.name, description),
      kind: 'process',
      ...otmGeometry(component, representation, elements.length, context),
    });
  }
  if (components.length > 0) {
    context.report(
      'OTM component types become process nodes. Their original types remain in the descriptions.',
    );
  }
  return elements;
}

function otmZones(
  zones: readonly Zone[],
  representation: string | undefined,
  offset: number,
  context: ImportContext,
): ElementInput[] {
  return zones.map((zone, index): ElementInput => {
    context.fields(zone, ['id', 'name', 'description', 'representations']);
    return {
      ...importElement(
        context,
        context.id('otm-zone', zone.id),
        zone.name,
        zone.description ?? '',
      ),
      kind: 'trust-boundary',
      shape: {
        kind: 'box',
        ...otmGeometry(zone, representation, offset + index, context),
      },
    };
  });
}

function otmFlows(
  flows: readonly Dataflow[],
  componentIds: ReadonlyMap<string, Component>,
  assets: ReadonlyMap<string, Asset>,
  context: ImportContext,
): ElementInput[] {
  return flows.map((flow): ElementInput => {
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
        context.problem(
          ['dataflows', flow.id],
          `Unknown component ${JSON.stringify(endpoint)}`,
        );
      }
    }
    return {
      ...importElement(
        context,
        context.id('otm-flow', flow.id),
        flow.name,
        context.text([
          flow.description ?? '',
          dataProse(flow.assets ?? [], 'dataflows.assets', assets, context),
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
      waypoints: [],
      bidirectional: flow.bidirectional === true,
    };
  });
}

function dataProse(
  ids: readonly (string | null)[],
  path: string,
  assets: ReadonlyMap<string, Asset>,
  context: ImportContext,
): string {
  return context.text(
    ids.flatMap((id) => {
      if (id === null) {
        return [];
      }
      const asset = assets.get(id);
      if (asset === undefined) {
        context.problem([path], `Unknown asset ${JSON.stringify(id)}`);
        return [];
      }
      context.fields(asset, ['id', 'name', 'description']);
      return context.text([asset.name, asset.description ?? ''], ': ');
    }),
    '\n',
  );
}

function otmGeometry(
  item: Component | Zone,
  representation: string | undefined,
  index: number,
  context: ImportContext,
) {
  const appearance = item.representations?.find(
    (entry) => entry.representation === representation,
  );
  if (appearance !== undefined) {
    context.fields(appearance, ['representation', 'id', 'position', 'size']);
    if (appearance.position != null) {
      context.fields(appearance.position, ['x', 'y']);
    }
    if (appearance.size != null) {
      context.fields(appearance.size, ['width', 'height']);
    }
  }
  if (appearance?.position == null || appearance.size == null) {
    context.report(
      `Element ${JSON.stringify(item.id)} receives generated geometry where the source has none.`,
      'overridden',
    );
  }
  return {
    position: appearance?.position ?? autoPlacement(index),
    size: appearance?.size ?? autoExtent,
  };
}
