import {
  modelFrom,
  modelWith,
  testDataPath,
} from '@saerskriven/model/fixtures';
import { locales } from '@saerskriven/i18n';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { everyGlyphModel, twoDiagramsModel } from '../render.fixtures.js';
import { renderRegister } from './markdown-register.js';
import { markdownWithDiagrams } from './markdown-diagrams.js';
import { exportText } from '../messages/catalogues.js';

it('keeps default, explicit false and diagram-free output unchanged', () => {
  expect(
    renderRegister(twoDiagramsModel, 'en-CA', { includeDiagrams: false }),
  ).toBe(renderRegister(twoDiagramsModel, 'en-CA'));
  const empty = modelFrom({});
  expect(renderRegister(empty, 'en-CA', { includeDiagrams: true })).toBe(
    renderRegister(empty, 'en-CA'),
  );
});

it('writes the combined document as the golden file', async () => {
  await expect(
    renderRegister(twoDiagramsModel, 'en-CA', { includeDiagrams: true }),
  ).toMatchFileSnapshot(
    testDataPath('render', 'two-diagrams.mermaid.snapshot.md'),
  );
});

it.each(locales)('keeps all diagrams and register content in %s', (locale) => {
  const result = markdownWithDiagrams(twoDiagramsModel, locale, {});
  const blocks = result.children.filter((node) => node.type === 'code');
  expect(blocks).toHaveLength(twoDiagramsModel.diagrams.length);
  expect(blocks.every((node) => node.lang === 'mermaid')).toBe(true);
  const text = renderRegister(twoDiagramsModel, locale, {
    includeDiagrams: true,
  });
  expect(text).toContain(exportText(locale).t('register.diagrams'));
  for (const threat of twoDiagramsModel.threats)
    expect(text).toContain(`threat-${threat.number}`);
});

it.each([1, 4, 6] as const)(
  'respects heading level %s with and without a title',
  (headingLevel) => {
    for (const title of [true, false]) {
      const root = markdownWithDiagrams(twoDiagramsModel, 'en-CA', {
        headingLevel,
        title,
      });
      const headings = root.children.filter((node) => node.type === 'heading');
      expect(headings[0].depth).toBe(headingLevel);
      expect(
        headings.every((node) => node.depth >= headingLevel && node.depth <= 6),
      ).toBe(true);
      expect(
        root.children.filter((node) => node.type === 'table'),
      ).toHaveLength(1);
    }
  },
);

it('names an empty diagram by its id and does not write an empty Mermaid block', () => {
  const model = modelWith({
    diagrams: [{ id: 'empty-diagram', title: '  ', elements: [] }],
  });
  const text = renderRegister(model, 'en-CA', { includeDiagrams: true });
  expect(text).toContain('empty-diagram');
  expect(text).not.toContain('```');
  expect(text).toContain(exportText('en-CA').t('register.diagram-empty'));
});

it('keeps code blocks in styled Markdown and notes only structural losses', () => {
  const text = renderRegister(everyGlyphModel, 'en-CA', {
    includeDiagrams: true,
    styled: true,
  });
  const root = unified().use(remarkParse).parse(text);
  expect(root.children.filter((node) => node.type === 'code')).toHaveLength(1);
  expect(text).toContain('Trust boundaries not shown:');
  expect(text).toContain('reference placeholders:');
  const register = root.children.findIndex(
    (node, index) =>
      index > root.children.findIndex((entry) => entry.type === 'code') &&
      node.type === 'heading',
  );
  const prose = root.children
    .slice(0, register)
    .filter((node) => node.type === 'paragraph');
  expect(prose).toHaveLength(2);
  expect(JSON.stringify(prose)).not.toMatch(/layout|font|badge|waypoint/i);
});
