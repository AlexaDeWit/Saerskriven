import type { TmbomDocument } from '@saerskriven/wire-tmbom';
import { importContext } from './import-model.js';
import { tmbomFixture } from './import.fixtures.js';
import { tmbomGraph } from './tmbom-graph.js';

const flowElement = (document: TmbomDocument) => {
  const elements = tmbomGraph(document, importContext());
  const element = elements.find((entry) => entry.kind === 'flow');
  if (element === undefined) throw new Error('The fixture lacks a flow');
  return element;
};

it('opens a flow element description with the Encrypted line when the source description is empty', () => {
  const document = tmbomFixture();
  const first = document.data_flows[0];
  document.data_flows = [
    { ...first, description: '' },
    ...document.data_flows.slice(1),
  ];
  const element = flowElement(document);
  expect(element.description.startsWith('Encrypted:')).toBe(true);
});

it('keeps a non-empty flow description ahead of the Encrypted line', () => {
  const document = tmbomFixture();
  const first = document.data_flows[0];
  const element = flowElement(document);
  expect(element.description).toBe(
    `${first.description}\n\nEncrypted: ${String(first.encrypted)}\nCarries sensitive data: ${String(first.has_sensitive_data)}`,
  );
});
