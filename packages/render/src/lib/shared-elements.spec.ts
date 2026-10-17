// @vitest-environment jsdom
import { awayClassNames } from '@saerskriven/canvas';
import mermaid from 'mermaid';
import { sharedModel } from '@saerskriven/model/fixtures';
import { twoDiagramsModel } from '../render.fixtures.js';
import { renderRegister } from './markdown-register.js';
import { mermaidDiagram } from './mermaid-diagram.js';
import { renderSvg } from './svg-document.js';

const [overview, payments] = sharedModel.diagrams;

beforeAll(() => {
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
});

describe("the register's Elements field", () => {
  it.each([
    ['en-CA', 'Payments API (on High level, Payments)'],
    ['fr-CA', 'Payments API (sur High level, Payments)'],
    ['sv', 'Payments API (på High level, Payments)'],
  ] as const)(
    'follows an element on more than one diagram with their titles in %s',
    (locale, named) => {
      expect(renderRegister(sharedModel, locale)).toContain(named);
    },
  );

  it('names an element on one diagram alone', () => {
    const register = renderRegister(twoDiagramsModel, 'en-CA');
    expect(register).not.toMatch(/\(on [^)]*\)/u);
  });
});

describe('Mermaid', () => {
  it('groups only the members a boundary has on its diagram', async () => {
    const drawn = mermaidDiagram(sharedModel, overview, 'en-CA');
    const group = /subgraph [^\n]*\n(?<members>[\s\S]*?)\nend/u.exec(
      drawn.source,
    )?.groups?.members;
    expect(group).toContain('Payments API');
    expect(group).not.toContain('Card vault');
    expect(await mermaid.parse(drawn.source)).toBeTruthy();
  });

  it('draws an end whose element is on another diagram as a reference to it', async () => {
    const drawn = mermaidDiagram(sharedModel, overview, 'en-CA');
    expect(drawn.source).toContain('["Reference#58; Card vault"]');
    expect(drawn.notes.references).toEqual(['Card vault']);
    const other = mermaidDiagram(sharedModel, payments, 'en-CA');
    expect(other.notes.references).toEqual([]);
    expect(await mermaid.parse(drawn.source)).toBeTruthy();
  });
});

describe('the SVG of a diagram holding an end drawn away', () => {
  it("draws the end's frame and its element's name, with the frame's rule", () => {
    const { svg } = renderSvg(overview, sharedModel, 'en-CA');
    expect(svg).toContain(`class="${awayClassNames.frame}"`);
    expect(svg).toContain(`.${awayClassNames.frame} {`);
    expect(svg).toContain('Card vault');
  });

  it('writes no frame rule where no end is drawn away', () => {
    const { svg } = renderSvg(payments, sharedModel, 'en-CA');
    expect(svg).not.toContain(awayClassNames.frame);
  });
});
