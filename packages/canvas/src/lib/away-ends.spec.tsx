import { sharedModel } from '@saerskriven/model/fixtures';
import { renderToStaticMarkup } from 'react-dom/server';
import { awayEndLabels } from './away-ends.js';
import { drawnBounds } from './bounds.js';
import { specMarks } from './canvas.fixtures.js';
import { FlowGlyph } from './glyphs.js';
import { layoutDiagram, type CanvasEdge } from './layout.js';
import { awayClassNames } from './stylesheet.js';

const overview = layoutDiagram(sharedModel.diagrams[0], sharedModel);

const edgeOf = (id: string): CanvasEdge => {
  const edge = overview.edges.find((candidate) => candidate.id === id);
  if (edge === undefined) {
    throw new Error(`Flow ${id} is not laid out.`);
  }
  return edge;
};

describe('a flow end drawn away from its element', () => {
  const charge = edgeOf('charge');

  it('is laid out at the point its placement holds, naming the element it attaches to', () => {
    expect(charge.target).toEqual({ x: 680, y: 210 });
    expect(charge.targetElement).toBeUndefined();
    expect(charge.targetAway).toEqual({
      element: 'card-vault',
      name: 'Card vault',
    });
    expect(charge.sourceAway).toBeUndefined();
    expect(overview.unplaced).toEqual([]);
  });

  it('hangs a frame beyond its point on the side its line arrives from, the name inside it', () => {
    const [label] = awayEndLabels(charge);
    expect(label.side).toBe('target');
    expect(label.frame.minX).toBe(680);
    expect((label.frame.minY + label.frame.maxY) / 2).toBe(210);
    expect(label.name).toMatchObject({ text: 'Card vault', anchor: 'centre' });
    expect(awayEndLabels(charge)).toBe(awayEndLabels(charge));
  });

  it('hangs no frame on an end attached on its diagram or free', () => {
    expect(awayEndLabels(edgeOf('card-details'))).toEqual([]);
  });

  it('draws its frame and the name, and the bounds hold the frame', () => {
    const markup = renderToStaticMarkup(
      <svg>
        <FlowGlyph edge={charge} marks={specMarks} />
      </svg>,
    );
    expect(markup).toContain(`class="${awayClassNames.frame}"`);
    expect(markup).toContain('Card vault');
    const [label] = awayEndLabels(charge);
    const bounds = drawnBounds([], [charge]);
    expect(bounds.x + bounds.width).toBeGreaterThanOrEqual(label.frame.maxX);
  });
});
