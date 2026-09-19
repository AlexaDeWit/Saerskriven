import type { OtmDocument } from '@saerskriven/wire-otm';
import { importContext } from './import-model.js';
import { otmFixture } from './import.fixtures.js';
import { otmGraph } from './otm-graph.js';

const componentElement = (document: OtmDocument) => {
  const { elements } = otmGraph(document, importContext());
  const element = elements.find((entry) => entry.kind === 'process');
  if (element === undefined) throw new Error('The fixture lacks a component');
  return element;
};

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
