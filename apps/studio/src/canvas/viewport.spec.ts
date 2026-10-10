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

const short = { width: 1000, height: 200 };

const cardBottom = 138;

const underCard = cardBottom + 32;

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
  it('is the canvas less 64 pixels at each edge where no pane is open and no card reaches into it', () => {
    expect(whole).toEqual({
      left: 64,
      top: 64,
      width: canvas.width - 128,
      height: canvas.height - 128,
    });
  });

  it('starts 32 pixels under the card and keeps 64 at the other three edges', () => {
    expect(fitArea(canvas, 0, cardBottom)).toEqual({
      left: 64,
      top: underCard,
      width: canvas.width - 128,
      height: canvas.height - 64 - underCard,
    });
  });

  it('takes the pane off the right and the card off the top together', () => {
    expect(fitArea(canvas, panelCover, cardBottom)).toEqual({
      left: 64,
      top: underCard,
      width: canvas.width - panelCover - 128,
      height: canvas.height - 64 - underCard,
    });
  });

  it('is the whole canvas again where a measured card leaves no height under it', () => {
    expect(fitArea(short, 0, cardBottom)).toEqual(fitArea(short, 0, 0));
    expect(fitArea(short, 0, cardBottom).height).toBeGreaterThan(0);
  });

  it('has no height under a card not yet measured', () => {
    expect(fitArea(canvas, 0, unmeasuredCardBottom).height).toBe(0);
    expect(fitArea(short, 0, unmeasuredCardBottom).height).toBe(0);
  });
});

describe('fitViewport', () => {
  it('centres the diagram and leaves 64 pixels clear on the tighter axis', () => {
    const drawn = placed(diagram, whole);

    expect(drawn.left).toBeCloseTo(canvas.width - drawn.right);
    expect(drawn.top).toBeCloseTo(canvas.height - drawn.bottom);
    expect(Math.min(drawn.left, drawn.top)).toBeCloseTo(64);
  });

  it('draws a height-bound diagram from 32 pixels under the card to 64 above the bottom of the canvas', () => {
    const drawn = placed(tall, fitArea(canvas, 0, cardBottom));

    expect(drawn.top).toBeCloseTo(underCard);
    expect(canvas.height - drawn.bottom).toBeCloseTo(64);
    expect(drawn.left).toBeCloseTo(canvas.width - drawn.right);
    expect(drawn.zoom).toBeLessThan(placed(tall, whole).zoom);
  });

  it('centres a width-bound diagram in the height under the card, at the zoom the width alone decides', () => {
    const drawn = placed(wide, fitArea(canvas, 0, cardBottom));

    expect(drawn.left).toBeCloseTo(64);
    expect(canvas.width - drawn.right).toBeCloseTo(64);
    expect(drawn.top - underCard).toBeCloseTo(
      canvas.height - 64 - drawn.bottom,
    );
    expect(drawn.zoom).toBeCloseTo(placed(wide, whole).zoom);
  });

  it('centres in what is left of the pane and under the card where both are reserved', () => {
    const drawn = placed(diagram, fitArea(canvas, panelCover, cardBottom));

    expect(drawn.left).toBeCloseTo(64);
    expect(canvas.width - panelCover - drawn.right).toBeCloseTo(64);
    expect(drawn.top - underCard).toBeCloseTo(
      canvas.height - 64 - drawn.bottom,
    );
    expect(drawn.top).toBeGreaterThanOrEqual(underCard);
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

  it('fits the whole canvas, behind the card, where a measured card leaves no room under it', () => {
    const drawn = placed(diagram, fitArea(short, 0, cardBottom));

    expect(drawn.top).toBeCloseTo(64);
    expect(short.height - drawn.bottom).toBeCloseTo(64);
    expect(drawn.top).toBeLessThan(cardBottom);
  });

  it('fits nothing before the card is measured, in a canvas of any height', () => {
    expect(
      fitViewport(diagram, fitArea(canvas, 0, unmeasuredCardBottom)),
    ).toBeUndefined();
    expect(
      fitViewport(diagram, fitArea(short, 0, unmeasuredCardBottom)),
    ).toBeUndefined();
  });
});
