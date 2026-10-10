import type { CanvasBounds } from '@saerskriven/canvas';
import type { Viewport } from '@xyflow/react';
import type { Platform } from '../commands/shortcuts.js';

/** How much of the page the canvas has, in its own pixels. */
export type CanvasExtent = {
  readonly width: number;
  readonly height: number;
};

/**
 * The part of the canvas a fit draws a diagram in, in the canvas's own pixels,
 * with what is kept clear at each edge already taken off.
 */
export type FitArea = CanvasExtent & {
  readonly left: number;
  readonly top: number;
};

/**
 * The chrome card's bottom edge before the card has been measured: past any
 * canvas, so no fit has room until the measurement arrives and none is made
 * against a height the card does not have.
 */
export const unmeasuredCardBottom = Number.POSITIVE_INFINITY;

const canvasPadding = 64;

/**
 * What a fit keeps clear under the chrome card, where the other three edges
 * keep the padding: room for a badge stepped out above a selected element at
 * full zoom and for the touch resize handles. A notice hanging under the card
 * can overlap a top element.
 */
export const cardGap = 32;

/** Zoom bounds shared with React Flow. */
export const zoomLimits = { minimum: 0.1, maximum: 2 } as const;

/** The keys that turn scrolling into zoom. Apple platforms add Control to React Flow's Command default, other platforms keep its Control default. */
export function zoomActivationKeysFor(platform: Platform): string | string[] {
  return platform === 'apple' ? ['Meta', 'Control'] : 'Control';
}

/** The canvas area left of the measured pane coverage. */
export function clearOfPanel(
  extent: CanvasExtent,
  panelCover: number,
): CanvasExtent {
  return {
    width: Math.max(extent.width - panelCover, 0),
    height: extent.height,
  };
}

/**
 * The area a fit draws in: left of the measured pane coverage, the padding
 * clear of each edge, and {@link cardGap} under the chrome card, whose bottom
 * edge `cardBottom` gives in the canvas's own pixels. A measured card that
 * leaves no height under it is left out, so the fit takes the whole canvas.
 * An unmeasured card leaves an area of no height.
 */
export function fitArea(
  extent: CanvasExtent,
  panelCover: number,
  cardBottom: number,
): FitArea {
  const clear = clearOfPanel(extent, panelCover);
  const whole = {
    left: canvasPadding,
    top: canvasPadding,
    width: Math.max(clear.width - canvasPadding * 2, 0),
    height: Math.max(clear.height - canvasPadding * 2, 0),
  };
  const top = Math.max(cardBottom + cardGap, canvasPadding);
  const height = clear.height - canvasPadding - top;
  return height <= 0 && cardBottom !== unmeasuredCardBottom
    ? whole
    : { ...whole, top, height: Math.max(height, 0) };
}

/**
 * Centres the diagram in `area`, within the zoom bounds. Returns nothing when
 * either has no area.
 */
export function fitViewport(
  bounds: CanvasBounds,
  area: FitArea,
): Viewport | undefined {
  if (
    area.width <= 0 ||
    area.height <= 0 ||
    bounds.width <= 0 ||
    bounds.height <= 0
  ) {
    return undefined;
  }
  const zoom = held(
    Math.min(area.width / bounds.width, area.height / bounds.height),
  );
  return {
    x: area.left + area.width / 2 - (bounds.x + bounds.width / 2) * zoom,
    y: area.top + area.height / 2 - (bounds.y + bounds.height / 2) * zoom,
    zoom,
  };
}

function held(zoom: number): number {
  return Math.min(Math.max(zoom, zoomLimits.minimum), zoomLimits.maximum);
}
