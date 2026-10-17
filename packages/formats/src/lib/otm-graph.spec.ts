import {
  autoExtent,
  autoPlacement,
  diagramsOf,
  drawnElementOn,
  placementOn,
  type Diagram,
  type Model,
} from '@saerskriven/model';
import type { OtmDocument } from '@saerskriven/wire-otm';
import { Either } from 'effect';
import { importContext } from './import-model.js';
import {
  imported,
  otmFixture,
  otmMultiDiagramFixture,
} from './import.fixtures.js';
import { otmGraph } from './otm-graph.js';
import { writtenSaerskrivenYamlVersion } from './saerskriven-yaml-version.js';
import { saerskrivenYamlCodec } from './saerskriven-yaml.js';

const componentElement = (document: OtmDocument) => {
  const { elements } = otmGraph(document, importContext());
  const element = elements.find((entry) => entry.kind === 'process');
  if (element === undefined) throw new Error('The fixture lacks a component');
  return element;
};

const divergencesOf = (document: OtmDocument) => imported(document).divergences;

const assetReports = (document: OtmDocument) =>
  divergencesOf(document).filter(
    ({ detail }) => detail.code === 'otm-assets-as-descriptions',
  );

const unreferenced = (document: OtmDocument): OtmDocument => ({
  ...document,
  components: document.components?.map(
    ({ assets: _assets, ...component }) => component,
  ),
  dataflows: document.dataflows?.map(({ assets: _assets, ...flow }) => flow),
});

it('drops the Source component type line when the type is empty', () => {
  const document = otmFixture();
  const first = document.components?.[0];
  if (first === undefined) throw new Error('The fixture lacks a component');
  document.components = [
    { ...first, type: '' },
    ...(document.components?.slice(1) ?? []),
  ];
  const element = componentElement(document);
  expect(element.description.includes('Source component type:')).toBe(false);
});

it('keeps a non-empty component type on its own line of the description', () => {
  const document = otmFixture();
  const first = document.components?.[0];
  if (first === undefined) throw new Error('The fixture lacks a component');
  const element = componentElement(document);
  expect(element.description).toContain(`Source component type: ${first.type}`);
});

it('reports no assets as descriptions for a file that defines no asset', () => {
  expect(assetReports({ ...unreferenced(otmFixture()), assets: [] })).toEqual(
    [],
  );
});

it('reports no assets as descriptions where nothing references them, and names each field they hold as not retained', () => {
  const document = unreferenced(otmFixture());
  expect(assetReports(document)).toEqual([]);
  expect(divergencesOf(document)).toEqual(
    expect.arrayContaining(
      ['0', '1'].flatMap((asset) =>
        ['id', 'name', 'description', 'risk'].map((field) => ({
          subject: { kind: 'model' },
          detail: {
            code: 'field-not-retained',
            parameters: { path: ['assets', asset, field] },
          },
          reason: 'unrepresentable',
        })),
      ),
    ),
  );
});

it.each<readonly [string, (document: OtmDocument) => OtmDocument]>([
  [
    'one component stores',
    (document) => ({
      ...document,
      components: document.components?.map((component, index) =>
        index === 0
          ? { ...component, assets: { stored: ['cc-data'] } }
          : component,
      ),
    }),
  ],
  [
    'one flow carries',
    (document) => ({
      ...document,
      dataflows: document.dataflows?.map((flow, index) =>
        index === 0 ? { ...flow, assets: ['cc-data', 'public-info'] } : flow,
      ),
    }),
  ],
])(
  'reports assets as descriptions once where %s the only assets referenced',
  (_named, referenced) => {
    expect(assetReports(referenced(unreferenced(otmFixture())))).toHaveLength(
      1,
    );
  },
);

it('reports assets as descriptions once for a file that references them from a component and a flow', () => {
  expect(assetReports(otmFixture())).toHaveLength(1);
});

const idOf = (model: Model, name: string) => {
  const element = model.elements.find((entry) => entry.name === name);
  if (element === undefined) throw new Error(`No element is named ${name}`);
  return element.id;
};

const flowEnds = (model: Model, diagram: Diagram, name: string) => {
  const drawn = drawnElementOn(model, diagram, idOf(model, name));
  return drawn?.kind === 'flow' ? [drawn.source, drawn.target] : undefined;
};

const titlesOf = (model: Model, name: string) =>
  diagramsOf(model, idOf(model, name)).map(({ title }) => title);

describe('an OTM file with two diagram representations', () => {
  const read = imported(otmMultiDiagramFixture());
  const { model } = read;
  const [overview, payments] = model.diagrams;
  const attached = (name: string) => ({
    kind: 'attached',
    element: idOf(model, name),
  });
  const away = (name: string, x: number, y: number) => ({
    kind: 'away',
    element: idOf(model, name),
    position: { x, y },
  });

  it('makes a diagram of each, titled with its name, and holds each element once', () => {
    expect(model.diagrams.map(({ title }) => title)).toEqual([
      'Overview',
      'Payments',
    ]);
    expect(model.elements.map(({ name }) => name)).toEqual([
      'Web shop',
      'Order service',
      'Payment gateway',
      'Audit log',
      'Internet',
      'Cloud',
      'Checkout',
      'Payment confirmed',
      'Settle order',
      'Audit order',
    ]);
  });

  it('places a component and a trust zone by each entry they have, the first for a diagram, keeping no entry id', () => {
    const shop = idOf(model, 'Web shop');
    expect(placementOn(overview, shop)).toEqual({
      element: shop,
      position: { x: 80, y: 80 },
      size: { width: 160, height: 80 },
    });
    expect(placementOn(payments, shop)).toEqual({
      element: shop,
      position: { x: 60, y: 200 },
      size: { width: 200, height: 100 },
    });
    expect(drawnElementOn(model, payments, idOf(model, 'Internet'))).toEqual(
      expect.objectContaining({
        shape: {
          kind: 'box',
          position: { x: 0, y: 100 },
          size: { width: 320, height: 280 },
        },
      }),
    );
    expect(titlesOf(model, 'Internet')).toEqual(['Overview', 'Payments']);
    expect(titlesOf(model, 'Cloud')).toEqual(['Overview']);
    expect(titlesOf(model, 'Order service')).toEqual(['Overview']);
    expect(titlesOf(model, 'Payment gateway')).toEqual(['Payments']);
  });

  it('reports each field of a second entry for one diagram as not retained, and no field of an entry it placed by', () => {
    const entryFields = read.divergences.flatMap(({ detail }) =>
      detail.code === 'field-not-retained' &&
      detail.parameters.path.slice(0, 3).join('.') ===
        'components.0.representations'
        ? [detail.parameters.path.slice(3).join('.')]
        : [],
    );
    expect(
      new Set(entryFields.filter((path) => path.startsWith('3.'))),
    ).toEqual(new Set(['3.id', '3.position', '3.representation', '3.size']));
    expect(
      entryFields.filter(
        (path) => path.startsWith('0.') || path.startsWith('1.'),
      ),
    ).toEqual([]);
  });

  it('places a dataflow on each diagram that places either end, the other end drawn away beside it', () => {
    expect(flowEnds(model, overview, 'Checkout')).toEqual([
      attached('Web shop'),
      attached('Order service'),
    ]);
    expect(flowEnds(model, payments, 'Checkout')).toEqual([
      attached('Web shop'),
      away('Order service', 340, 250),
    ]);
    expect(flowEnds(model, overview, 'Payment confirmed')).toEqual([
      away('Payment gateway', 0, 120),
      attached('Web shop'),
    ]);
    expect(flowEnds(model, overview, 'Settle order')).toEqual([
      attached('Order service'),
      away('Payment gateway', 720, 120),
    ]);
    expect(flowEnds(model, payments, 'Settle order')).toEqual([
      away('Order service', 400, 250),
      attached('Payment gateway'),
    ]);
    expect(titlesOf(model, 'Audit order')).toEqual(['Overview']);
  });

  it('places a component with no entry on the first diagram alone, at generated geometry', () => {
    expect(titlesOf(model, 'Audit log')).toEqual(['Overview']);
    expect(placementOn(overview, idOf(model, 'Audit log'))).toMatchObject({
      position: autoPlacement(3),
      size: autoExtent,
    });
    expect(
      read.divergences.flatMap(({ detail }) =>
        detail.code === 'otm-geometry-generated' ? [detail.parameters.id] : [],
      ),
    ).toEqual(['audit-log']);
  });

  it('keeps a threat on the one element, and saves as version 3', () => {
    expect(model.threats.map(({ elements }) => elements)).toEqual([
      [idOf(model, 'Web shop')],
    ]);
    expect(writtenSaerskrivenYamlVersion(model)).toBe(3);
    const written = saerskrivenYamlCodec.write(model);
    expect(
      Either.getOrThrow(saerskrivenYamlCodec.read(written.output)).model,
    ).toEqual(model);
  });
});

it('reports generated geometry once for an element that has it on two diagrams', () => {
  const document = otmMultiDiagramFixture();
  for (const entry of document.components?.[0]?.representations ?? []) {
    entry.position = null;
  }
  expect(
    imported(document).divergences.filter(
      ({ detail }) =>
        detail.code === 'otm-geometry-generated' &&
        detail.parameters.id === 'web-shop',
    ),
  ).toHaveLength(1);
});

it('keeps an end drawn away within the geometry bound beside a component at its edge', () => {
  const document = otmMultiDiagramFixture();
  const entry = document.components?.[0]?.representations?.[1];
  if (entry?.position == null) throw new Error('The fixture places the shop');
  entry.position.x = 999_900;
  const { model } = imported(document);
  expect(flowEnds(model, model.diagrams[1], 'Checkout')?.[1]).toMatchObject({
    kind: 'away',
    position: { x: 1_000_000 },
  });
});

it('draws everything on one diagram named after the project where no representation is a diagram', () => {
  const document = otmFixture();
  document.representations = document.representations?.filter(
    ({ type }) => type !== 'diagram',
  );
  const { model } = imported(document);
  expect(model.diagrams.map(({ title }) => title)).toEqual([
    document.project.name,
  ]);
  expect(model.diagrams[0].placements).toHaveLength(model.elements.length);
});
