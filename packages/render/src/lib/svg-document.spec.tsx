import {
  canvasClassNames,
  renderCanvasStylesheet,
  svgNumber,
  textExtent,
  wrappedTextStyles,
  type TextStyleRule,
} from '@saerskriven/canvas';
import {
  type Diagram,
  type Element as DiagramElement,
  type Model,
} from '@saerskriven/model';
import {
  boxAt,
  curveBoundary,
  flowFrom,
  modelWith,
  repositoryRoot,
} from '@saerskriven/model/fixtures';
import { JSDOM } from 'jsdom';
import { join } from 'node:path';
import {
  diagramOf,
  everyGlyphModel,
  goldenDocuments,
  type GoldenDocument,
} from '../render.fixtures.js';
import { renderSvg } from './svg-document.js';

const svgNamespace = 'http://www.w3.org/2000/svg';

const { DOMParser } = new JSDOM().window;

const square = { width: 100, height: 100 };

const shortBoxHeight = 40;

const shortBox = { width: 100, height: shortBoxHeight };

const bottomEdgeModel = modelWith({
  elements: [
    boxAt('el-left', 0, 0, 'actor', shortBox, 'Left'),
    boxAt('el-right', 400, 0, 'actor', shortBox, 'Right'),
    flowFrom(
      'el-flow',
      'el-left',
      'el-right',
      'publish the mirrored artifact to the registry under a minted write token',
    ),
  ],
});

const padlock = '\u{1F510}';

const brokenWordName = `payments-gateway-edge${padlock}authentication-service`;

const surrogatePairModel = modelWith({
  elements: [
    boxAt('el-wide', 0, 0, 'actor', { width: 160, height: 80 }, brokenWordName),
  ],
});

const sharpCurveModel = modelWith({
  elements: [
    curveBoundary('el-turn', [
      { x: 0, y: 0 },
      { x: 400, y: 0 },
      { x: 400, y: 400 },
    ]),
  ],
});

const forbiddenCharacters = ['\u0000', '\u000B', '\u001B', '\uD800', '\uFFFF'];

const forbidden = forbiddenCharacters.join('');

const replaced = '\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD';

const cleanCharacterModel = modelWith({
  title: 'title',
  diagrams: [
    {
      id: 'd',
      title: 'title',
      elements: [
        boxAt('el-left', 0, 0, 'actor', square, 'name'),
        boxAt('el-right', 400, 0, 'actor', square, 'Right'),
        flowFrom('el-flow', 'el-left', 'el-right', 'flow'),
        {
          kind: 'text',
          id: 'el-note',
          name: 'Note',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          position: { x: 0, y: 200 },
          size: { width: 200, height: 90 },
          text: 'note',
        },
      ],
    },
  ],
});

const carryingForbidden = (element: DiagramElement): DiagramElement =>
  element.kind === 'text'
    ? { ...element, text: `${element.text}${forbidden}` }
    : element.name === 'Right'
      ? element
      : { ...element, name: `${element.name}${forbidden}` };

const forbiddenCharacterModel: Model = {
  ...cleanCharacterModel,
  metadata: {
    ...cleanCharacterModel.metadata,
    title: `${cleanCharacterModel.metadata.title}${forbidden}`,
  },
  diagrams: cleanCharacterModel.diagrams.map((diagram) => ({
    ...diagram,
    title: `${diagram.title}${forbidden}`,
    elements: diagram.elements.map(carryingForbidden),
  })),
};

const twoDiagramModel = modelWith({
  title: 'Two diagrams',
  diagrams: [
    {
      id: 'diagram-front',
      title: 'Front of house',
      elements: [boxAt('el-guest', 0, 0, 'actor', square, 'Guest')],
    },
    {
      id: 'diagram-back',
      title: 'Back of house',
      elements: [boxAt('el-ledger', 0, 0, 'actor', square, 'Ledger')],
    },
  ],
});

function firstDiagram(model: Model): Diagram {
  return model.diagrams[0];
}

function svgOf(model: Model): string {
  return renderSvg(firstDiagram(model), model).svg;
}

function documentOf(svg: string): Document {
  return new DOMParser().parseFromString(svg, 'image/svg+xml');
}

function elementsOf(svg: string): readonly Element[] {
  return [...documentOf(svg).getElementsByTagName('*')];
}

function attributeValues(svg: string, name: string): readonly string[] {
  return elementsOf(svg).flatMap((element) => {
    const value = element.getAttribute(name);
    return value === null ? [] : [value];
  });
}

function titleOf(svg: string): string {
  const root = documentOf(svg).documentElement;
  const titles = [...root.children].filter(
    (child) => child.tagName === 'title',
  );
  if (titles.length !== 1) {
    throw new Error(`The root owns ${titles.length} title elements`);
  }
  return titles[0].textContent ?? '';
}

function textsOf(svg: string): readonly Element[] {
  return [...documentOf(svg).getElementsByTagName('text')];
}

function textStarting(svg: string, prefix: string): Element {
  const found = textsOf(svg).find((text) =>
    (text.textContent ?? '').startsWith(prefix),
  );
  if (found === undefined) {
    throw new Error(`No text starting "${prefix}" in the document`);
  }
  return found;
}

type Box = {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
};

function boxOfPoints(points: readonly (readonly number[])[]): Box {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

function numbersIn(value: string): number[] {
  return (value.match(/-?\d+(?:\.\d+)?/gu) ?? []).map(Number);
}

function pairsIn(value: string): number[][] {
  const numbers = numbersIn(value);
  const pairs: number[][] = [];
  for (let at = 0; at + 1 < numbers.length; at += 2) {
    pairs.push([numbers[at], numbers[at + 1]]);
  }
  return pairs;
}

function attribute(element: Element, name: string): number {
  return Number(element.getAttribute(name) ?? 0);
}

function textRuleOf(element: Element): TextStyleRule | undefined {
  const classes = new Set((element.getAttribute('class') ?? '').split(' '));
  return Object.values(wrappedTextStyles).find((rule) =>
    classes.has(rule.className),
  );
}

function textBox(element: Element): Box | undefined {
  const rule = textRuleOf(element);
  if (rule === undefined) {
    return undefined;
  }
  const lines = [...element.children].map((line) => line.textContent ?? '');
  const extent = textExtent(lines, rule.fontSize);
  const x = attribute(element, 'x');
  const top = attribute(element, 'y') - rule.fontSize / 2;
  return {
    minX: x - extent.width / 2,
    minY: top,
    maxX: x + extent.width / 2,
    maxY: top + extent.height,
  };
}

function ownBox(element: Element): Box | undefined {
  if (element.tagName === 'rect') {
    const x = attribute(element, 'x');
    const y = attribute(element, 'y');
    return boxOfPoints([
      [x, y],
      [x + attribute(element, 'width'), y + attribute(element, 'height')],
    ]);
  }
  if (element.tagName === 'circle') {
    const radius = attribute(element, 'r');
    const cx = attribute(element, 'cx');
    const cy = attribute(element, 'cy');
    return boxOfPoints([
      [cx - radius, cy - radius],
      [cx + radius, cy + radius],
    ]);
  }
  if (element.tagName === 'line') {
    return boxOfPoints([
      [attribute(element, 'x1'), attribute(element, 'y1')],
      [attribute(element, 'x2'), attribute(element, 'y2')],
    ]);
  }
  if (element.tagName === 'path') {
    return boxOfPoints(pairsIn(element.getAttribute('d') ?? ''));
  }
  if (element.tagName === 'text') {
    return textBox(element);
  }
  return undefined;
}

function translationOf(element: Element): number[] {
  const transform = element.getAttribute('transform');
  const [x, y] = transform === null ? [] : numbersIn(transform);
  return [x ?? 0, y ?? 0];
}

function drawnBoxes(svg: string): Box[] {
  const found: Box[] = [];
  const visit = (element: Element, dx: number, dy: number): void => {
    const [shiftX, shiftY] = translationOf(element);
    const x = dx + shiftX;
    const y = dy + shiftY;
    const own = ownBox(element);
    if (own !== undefined) {
      found.push({
        minX: own.minX + x,
        minY: own.minY + y,
        maxX: own.maxX + x,
        maxY: own.maxY + y,
      });
    }
    for (const child of element.children) {
      visit(child, x, y);
    }
  };
  visit(documentOf(svg).documentElement, 0, 0);
  return found;
}

function offsetOf(element: Element): number[] {
  let x = 0;
  let y = 0;
  let at: Element | null = element;
  while (at !== null) {
    const [dx, dy] = translationOf(at);
    x += dx;
    y += dy;
    at = at.parentElement;
  }
  return [x, y];
}

function elementOfClass(svg: string, className: string): Element {
  const found = elementsOf(svg).find((element) =>
    (element.getAttribute('class') ?? '').split(' ').includes(className),
  );
  if (found === undefined) {
    throw new Error(`No element of class ${className} in the document`);
  }
  return found;
}

function cubicAt(
  from: number[],
  first: number[],
  second: number[],
  to: number[],
  at: number,
): number[] {
  const rest = 1 - at;
  return [0, 1].map(
    (axis) =>
      rest ** 3 * from[axis] +
      3 * rest ** 2 * at * first[axis] +
      3 * rest * at ** 2 * second[axis] +
      at ** 3 * to[axis],
  );
}

function curveSamples(element: Element): number[][] {
  const [dx, dy] = offsetOf(element);
  const points = pairsIn(element.getAttribute('d') ?? '');
  const samples: number[][] = [];
  for (let at = 0; at + 3 < points.length; at += 3) {
    for (let step = 0; step <= 40; step += 1) {
      const [x, y] = cubicAt(
        points[at],
        points[at + 1],
        points[at + 2],
        points[at + 3],
        step / 40,
      );
      samples.push([x + dx, y + dy]);
    }
  }
  return samples;
}

function viewBoxOf(svg: string): Box {
  const [x, y, width, height] = numbersIn(
    documentOf(svg).documentElement.getAttribute('viewBox') ?? '',
  );
  return { minX: x, minY: y, maxX: x + width, maxY: y + height };
}

function drawnOutsideTheViewBox(svg: string): Box[] {
  const view = viewBoxOf(svg);
  return drawnBoxes(svg).filter(
    (box) =>
      box.minX < view.minX ||
      box.minY < view.minY ||
      box.maxX > view.maxX ||
      box.maxY > view.maxY,
  );
}

const svgOfEntry = (entry: GoldenDocument): string =>
  renderSvg(diagramOf(entry), entry.model).svg;

const forbiddenCharacterSvg = svgOf(forbiddenCharacterModel);

describe('a diagram as a standalone SVG document', () => {
  it.each(goldenDocuments)(
    'writes $name as the committed golden file, on a second run too',
    async (entry) => {
      const first = svgOfEntry(entry);
      const second = svgOfEntry(entry);
      expect(second).toBe(first);
      await expect(second).toMatchFileSnapshot(join(repositoryRoot, entry.svg));
    },
  );

  it.each(goldenDocuments)('ends $name with a newline', (entry) => {
    expect(svgOfEntry(entry).endsWith('</svg>\n')).toBe(true);
  });

  it('renders each diagram of a model as a document of its own', () => {
    const [front, back] = twoDiagramModel.diagrams.map(
      (diagram) => renderSvg(diagram, twoDiagramModel).svg,
    );
    expect(front).toContain('<title>Front of house</title>');
    expect(front).toContain('Guest');
    expect(front).not.toContain('Ledger');
    expect(back).toContain('<title>Back of house</title>');
    expect(back).toContain('Ledger');
    expect(back).not.toContain('Guest');
  });

  it('leaves a flow whose endpoint names another flow out of the drawing', () => {
    const rendered = renderSvg(firstDiagram(everyGlyphModel), everyGlyphModel);
    expect(rendered.svg).not.toContain('Replayed submission');
    expect(rendered.unplaced).toEqual([
      { flow: 'el-replay', side: 'source', element: 'el-request' },
    ]);
  });
});

describe('the viewBox around what a diagram draws', () => {
  it('holds a flow name wrapping to four lines below the boxes it runs between', () => {
    const svg = svgOf(bottomEdgeModel);
    const name = textStarting(svg, 'publish');
    const box = textBox(name);
    expect(name.children).toHaveLength(4);
    expect(box?.maxY).toBeGreaterThan(shortBoxHeight);
    expect(viewBoxOf(svg).maxY).toBeGreaterThan(box?.maxY ?? 0);
    expect(drawnOutsideTheViewBox(svg)).toEqual([]);
  });

  it('holds a boundary curve whose cubics turn outside the box its waypoints span', () => {
    const svg = svgOf(sharpCurveModel);
    const samples = curveSamples(
      elementOfClass(svg, canvasClassNames.boundaryCurve),
    );
    const view = viewBoxOf(svg);
    expect(Math.max(...samples.map(([x]) => x))).toBeGreaterThan(400);
    expect(
      samples.filter(
        ([x, y]) =>
          x < view.minX || y < view.minY || x > view.maxX || y > view.maxY,
      ),
    ).toEqual([]);
    expect(drawnOutsideTheViewBox(svg)).toEqual([]);
  });

  it.each(goldenDocuments)('holds everything $name draws', (entry) => {
    expect(drawnOutsideTheViewBox(svgOfEntry(entry))).toEqual([]);
  });
});

describe('a word longer than the line it wraps to', () => {
  it('breaks between characters, never through a surrogate pair', () => {
    const svg = svgOf(surrogatePairModel);
    const lines = [...textStarting(svg, 'payments').children].map(
      (line) => line.textContent ?? '',
    );
    expect(documentOf(svg).getElementsByTagName('parsererror')).toHaveLength(0);
    expect(lines.filter((line) => line.includes(padlock))).toHaveLength(1);
    expect(lines.join('')).toBe(brokenWordName);
  });
});

describe('free text carrying what XML forbids, never parsed', () => {
  it('draws the replacement character in the title and in every run of text', () => {
    expect(titleOf(forbiddenCharacterSvg)).toBe(`title${replaced}`);
    const drawn = textsOf(forbiddenCharacterSvg).map(
      (text) => text.textContent,
    );
    expect(drawn).toContain(`name${replaced}`);
    expect(drawn).toContain(`flow${replaced}`);
    expect(drawn).toContain(`note${replaced}`);
  });

  it('carries none of the characters it replaced', () => {
    expect(
      forbiddenCharacters.filter((character) =>
        forbiddenCharacterSvg.includes(character),
      ),
    ).toEqual([]);
  });
});

describe.each([
  ...goldenDocuments.map((entry) => ({
    name: entry.name,
    drawn: renderSvg(diagramOf(entry), entry.model),
  })),
  {
    name: 'text XML forbids',
    drawn: renderSvg(
      firstDiagram(forbiddenCharacterModel),
      forbiddenCharacterModel,
    ),
  },
])('$name as a document a reader can open', ({ drawn }) => {
  const { svg } = drawn;

  it('parses as well-formed XML with one svg root in the SVG namespace', () => {
    const parsed = documentOf(svg);
    expect(parsed.getElementsByTagName('parsererror')).toHaveLength(0);
    expect(parsed.documentElement.tagName).toBe('svg');
    expect(parsed.documentElement.namespaceURI).toBe(svgNamespace);
  });

  it('sizes the document as the viewBox it declares and the size the render reports', () => {
    const root = documentOf(svg).documentElement;
    const box = (root.getAttribute('viewBox') ?? '').split(' ');
    expect(box).toHaveLength(4);
    expect([root.getAttribute('width'), root.getAttribute('height')]).toEqual([
      box[2],
      box[3],
    ]);
    expect([box[2], box[3]]).toEqual([
      svgNumber(drawn.width),
      svgNumber(drawn.height),
    ]);
  });

  it('carries the stylesheet in a style element, verbatim', () => {
    const styles = [...documentOf(svg).getElementsByTagName('style')];
    expect(styles.map((style) => style.textContent)).toEqual([
      renderCanvasStylesheet(),
    ]);
  });

  it('names the diagram in a title element the root owns', () => {
    expect(titleOf(svg)).not.toBe('');
  });

  it('gives no two elements the same id', () => {
    const ids = attributeValues(svg, 'id');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('runs no script and reaches outside itself for nothing', () => {
    for (const tag of ['script', 'image', 'use', 'foreignObject']) {
      expect(documentOf(svg).getElementsByTagName(tag)).toHaveLength(0);
    }
    expect(attributeValues(svg, 'xlink:href')).toEqual([]);
    expect(
      attributeValues(svg, 'href').filter((href) => !href.startsWith('#')),
    ).toEqual([]);
    expect(svg).not.toContain('url(');
    expect(svg).not.toContain('@import');
  });
});
