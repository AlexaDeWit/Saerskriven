import { panelCover } from '@saerskriven/canvas';
import type { CanvasBounds } from '@saerskriven/canvas';
import {
  clearOfPanel,
  fitArea,
  fitViewport,
  unmeasuredCardBottom,
  zoomActivationKeysFor,
  zoomLimits,
  type FitArea,
} from './viewport.js';

describe('zoomActivationKeysFor', () => {
  it('adds Control to Command on Apple platforms', () => {
    expect(zoomActivationKeysFor('apple')).toEqual(['Meta', 'Control']);
  });

  it('keeps Control alone elsewhere', () => {
    expect(zoomActivationKeysFor('other')).toBe('Control');
  });
});

describe('clearOfPanel', () => {
  it('takes what the panel covers off the right of the canvas', () => {
    expect(clearOfPanel({ width: 1000, height: 600 }, panelCover)).toEqual({
      width: 1000 - panelCover,
      height: 600,
    });
  });

  it('leaves nothing clear in a canvas narrower than the panel', () => {
    expect(clearOfPanel({ width: 100, height: 600 }, panelCover).width).toBe(0);
  });
});

const canvas = { width: 1000, height: 600 };

const cardBottom = 138;

const whole = fitArea(canvas, 0, 0);

const diagram = { x: 100, y: 50, width: 800, height: 400 };

const tall = { x: 100, y: 50, width: 100, height: 800 };

const wide = { x: 100, y: 50, width: 2000, height: 100 };

const placed = (bounds: CanvasBounds, area: FitArea) => {
  const view = fitViewport(bounds, area) ?? { x: 0, y: 0, zoom: 0 };
  return {
    zoom: view.zoom,
    left: bounds.x * view.zoom + view.x,
    top: bounds.y * view.zoom + view.y,
    right: (bounds.x + bounds.width) * view.zoom + view.x,
    bottom: (bounds.y + bounds.height) * view.zoom + view.y,
  };
};

describe('fitArea', () => {
  it('is the whole canvas where no pane is open and no card reaches into it', () => {
    expect(whole).toEqual({ ...canvas, top: 0 });
  });

  it('starts at the bottom edge of the card and keeps the width', () => {
    expect(fitArea(canvas, 0, cardBottom)).toEqual({
      width: canvas.width,
      height: canvas.height - cardBottom,
      top: cardBottom,
    });
  });

  it('takes the pane off the right and the card off the top together', () => {
    expect(fitArea(canvas, panelCover, cardBottom)).toEqual({
      width: canvas.width - panelCover,
      height: canvas.height - cardBottom,
      top: cardBottom,
    });
  });

  it('has no height under a card that reaches past the canvas, or one not yet measured', () => {
    expect(fitArea({ width: 1000, height: 100 }, 0, cardBottom).height).toBe(0);
    expect(fitArea(canvas, 0, unmeasuredCardBottom).height).toBe(0);
  });
});

describe('fitViewport', () => {
  it('centres the diagram and leaves 64 pixels clear on the tighter axis', () => {
    const drawn = placed(diagram, whole);

    expect(drawn.left).toBeCloseTo(canvas.width - drawn.right);
    expect(drawn.top).toBeCloseTo(canvas.height - drawn.bottom);
    expect(Math.min(drawn.left, drawn.top)).toBeCloseTo(64);
  });

  it('centres a height-bound diagram between the card and the bottom of the canvas, 64 pixels clear of each', () => {
    const drawn = placed(tall, fitArea(canvas, 0, cardBottom));

    expect(drawn.top).toBeCloseTo(cardBottom + 64);
    expect(canvas.height - drawn.bottom).toBeCloseTo(64);
    expect(drawn.left).toBeCloseTo(canvas.width - drawn.right);
    expect(drawn.zoom).toBeLessThan(placed(tall, whole).zoom);
  });

  it('centres a width-bound diagram in the height below the card, at the zoom the width alone decides', () => {
    const drawn = placed(wide, fitArea(canvas, 0, cardBottom));

    expect(drawn.left).toBeCloseTo(64);
    expect(canvas.width - drawn.right).toBeCloseTo(64);
    expect(drawn.top - cardBottom).toBeCloseTo(canvas.height - drawn.bottom);
    expect(drawn.zoom).toBeCloseTo(placed(wide, whole).zoom);
  });

  it('centres in what is left of the pane and below the card where both are reserved', () => {
    const drawn = placed(diagram, fitArea(canvas, panelCover, cardBottom));

    expect(drawn.left).toBeCloseTo(canvas.width - panelCover - drawn.right);
    expect(drawn.top - cardBottom).toBeCloseTo(canvas.height - drawn.bottom);
    expect(drawn.left).toBeCloseTo(64);
    expect(drawn.top).toBeGreaterThanOrEqual(cardBottom + 64);
  });

  it('draws a diagram far smaller than the canvas no larger than the zoom limit', () => {
    const view = fitViewport({ x: 0, y: 0, width: 10, height: 10 }, whole);

    expect(view?.zoom).toBe(zoomLimits.maximum);
  });

  it('draws a diagram far larger than the canvas no smaller than the zoom limit', () => {
    const view = fitViewport(
      { x: 0, y: 0, width: 100_000, height: 100_000 },
      whole,
    );

    expect(view?.zoom).toBe(zoomLimits.minimum);
  });

  it('fits nothing where the diagram lays down no ink', () => {
    expect(
      fitViewport({ x: 0, y: 0, width: 0, height: 0 }, whole),
    ).toBeUndefined();
  });

  it('fits nothing where the padding would take the whole canvas', () => {
    expect(
      fitViewport(diagram, fitArea({ width: 100, height: 100 }, 0, 0)),
    ).toBeUndefined();
  });

  it('fits nothing where the card leaves no room under it for the padding, or has not been measured', () => {
    expect(
      fitViewport(
        diagram,
        fitArea({ width: 1000, height: 250 }, 0, cardBottom),
      ),
    ).toBeUndefined();
    expect(
      fitViewport(diagram, fitArea(canvas, 0, unmeasuredCardBottom)),
    ).toBeUndefined();
  });
});
