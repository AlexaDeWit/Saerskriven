// @vitest-environment jsdom
import mermaid from 'mermaid';
import {
  boxAt,
  curveBoundary,
  flowBetween,
  flowFrom,
  modelWith,
} from '@saerskriven/model/fixtures';
import { mermaidDiagram } from './mermaid-diagram.js';
import { everyGlyphModel, twoDiagramsModel } from '../render.fixtures.js';

const boundary = (id: string, containedElements?: string[]) => ({
  ...curveBoundary(
    id,
    [
      { x: 0, y: 0 },
      { x: 50, y: 50 },
    ],
    id,
  ),
  ...(containedElements === undefined ? {} : { containedElements }),
});

beforeAll(() => {
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
});

it('parses the committed diagrams with all glyphs and structural placeholders', async () => {
  for (const model of [everyGlyphModel, twoDiagramsModel]) {
    for (const diagram of model.diagrams) {
      const result = mermaidDiagram(diagram, 'en-CA');
      expect(await mermaid.parse(result.source)).toBeTruthy();
      expect(result).toEqual(mermaidDiagram(diagram, 'en-CA'));
    }
  }
});

it('retains nested declared groups and links across them without geometry notes', async () => {
  const diagram = modelWith({
    elements: [
      boundary('outer', ['inner']),
      boundary('inner', ['api']),
      boxAt('api', 0, 0, 'process'),
      boxAt('user', 0, 0),
      flowFrom('request', 'user', 'api'),
    ],
  }).diagrams[0];
  const result = mermaidDiagram(diagram, 'en-CA');
  expect(result.source.match(/^subgraph /gm)).toHaveLength(2);
  expect(result.source).toContain('["outer"]\nsubgraph');
  expect(result.notes).toEqual({ boundaries: [], references: [] });
  expect(await mermaid.parse(result.source)).toBeTruthy();
});

it.each([
  [boundary('zone-a', ['api']), boundary('zone-b', ['api'])],
  [boundary('zone-a', ['zone-b']), boundary('zone-b', ['zone-a'])],
  [boundary('zone-a'), boundary('zone-b', ['zone-a'])],
  [boundary('zone-a', ['request']), boundary('zone-b', [])],
])(
  'flattens unsupported groups and keeps ordinary nodes and flows',
  async (...boundaries) => {
    const diagram = modelWith({
      elements: [
        ...boundaries,
        boxAt('api', 0, 0),
        boxAt('user', 0, 0),
        flowFrom('request', 'user', 'api'),
      ],
    }).diagrams[0];
    const result = mermaidDiagram(diagram, 'en-CA');
    expect(result.source).not.toContain('subgraph');
    expect(result.source).toContain('["api"]');
    expect(result.source).toContain('["user"]');
    expect(result.source).toContain('-->|"request"|');
    expect(result.notes.boundaries).toEqual(['zone-a', 'zone-b']);
    expect(await mermaid.parse(result.source)).toBeTruthy();
  },
);

it('uses distinct free ends and one placeholder per referenced element', async () => {
  const diagram = modelWith({
    elements: [
      boxAt('api', 0, 0),
      flowFrom('request', 'api', 'api'),
      flowFrom('ref-one', 'api', 'request'),
      flowFrom('ref-two', 'api', 'request'),
      {
        ...flowBetween(
          { kind: 'free', position: { x: 0, y: 0 } },
          { kind: 'free', position: { x: 0, y: 0 } },
          [],
        ),
        bidirectional: true,
        name: '',
      },
    ],
  }).diagrams[0];
  const result = mermaidDiagram(diagram, 'en-CA');
  expect(result.source.match(/\["Free endpoint"\]/g)).toHaveLength(2);
  expect(result.source.match(/\["Reference#58; request"\]/g)).toHaveLength(1);
  expect(result.source).toContain('<-->');
  expect(result.notes).toEqual({ boundaries: [], references: ['request'] });
  expect(await mermaid.parse(result.source)).toBeTruthy();
});

it('quotes hostile labels as data without adding graph statements', async () => {
  const hostile =
    'end " ] --> injected [ | ` ``` <script> & #35; %%{init: {}}%%\n新しい Ω';
  const diagram = modelWith({
    elements: [
      boxAt('end', 0, 0, 'actor', undefined, hostile),
      {
        ...boxAt('unicode-😀', 0, 0, 'store', undefined, 'Store'),
        outOfScope: true,
      },
      { ...boxAt('note', 0, 0, 'text'), text: hostile },
      {
        ...flowFrom('edge', 'end', 'unicode-😀', hostile),
        bidirectional: true,
      },
      {
        ...flowFrom('other-edge', 'end', 'unicode-😀', 'second'),
        outOfScope: true,
      },
    ],
  }).diagrams[0];
  const result = mermaidDiagram(diagram, 'en-CA');
  expect(result.source.split('\n')).toHaveLength(7);
  expect(result.source).not.toMatch(/<script>|%%\{|```|\| `|^end$/m);
  expect(result.source).toContain('out of scope');
  expect(result.notes).toEqual({ boundaries: [], references: [] });
  expect(await mermaid.parse(result.source)).toBeTruthy();
});
