import type { OtmDocument } from '@saerskriven/wire-otm';
import { Either } from 'effect';
import { importContext } from './import-model.js';
import { importModel } from './import.js';
import { otmFixture } from './import.fixtures.js';
import { otmGraph } from './otm-graph.js';

const componentElement = (document: OtmDocument) => {
  const { elements } = otmGraph(document, importContext());
  const element = elements.find((entry) => entry.kind === 'process');
  if (element === undefined) throw new Error('The fixture lacks a component');
  return element;
};

const divergencesOf = (document: OtmDocument) =>
  Either.getOrThrow(importModel(JSON.stringify(document))).divergences;

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
