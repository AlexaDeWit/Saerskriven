import type { CanvasBounds } from '@saerskriven/canvas';
import type { Viewport } from '@xyflow/react';
import type { Platform } from '../commands/shortcuts.js';

/** How much of the page the canvas has, in its own pixels. */
export type CanvasExtent = {
  readonly width: number;
  readonly height: number;
};

/**
 * The part of the canvas a fit centres a diagram in: its size, and how far
 * below the canvas's top edge it starts.
 */
export type FitArea = CanvasExtent & { readonly top: number };

/**
 * The chrome card's bottom edge before the card has been measured: past any
 * canvas, so no fit has room until the measurement arrives and none is made
 * against a height the card does not have.
 */
export const unmeasuredCardBottom = Number.POSITIVE_INFINITY;

const canvasPadding = 64;

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
 * The canvas area a fit may use: left of the measured pane coverage and below
 * the chrome card, whose bottom edge `cardBottom` gives in the canvas's own
 * pixels. A card that reaches past the canvas leaves an area of no height.
 */
export function fitArea(
  extent: CanvasExtent,
  panelCover: number,
  cardBottom: number,
): FitArea {
  const { width, height } = clearOfPanel(extent, panelCover);
  const top = Math.min(Math.max(cardBottom, 0), height);
  return { width, height: height - top, top };
}

/**
 * Centres the diagram in `area` with the padding kept clear on every side,
 * within the zoom bounds. Returns nothing when either has no area.
 */
export function fitViewport(
  bounds: CanvasBounds,
  area: FitArea,
): Viewport | undefined {
  const room = {
    width: area.width - canvasPadding * 2,
    height: area.height - canvasPadding * 2,
  };
  if (
    room.width <= 0 ||
    room.height <= 0 ||
    bounds.width <= 0 ||
    bounds.height <= 0
  ) {
    return undefined;
  }
  const zoom = held(
    Math.min(room.width / bounds.width, room.height / bounds.height),
  );
  return {
    x: area.width / 2 - (bounds.x + bounds.width / 2) * zoom,
    y: area.top + area.height / 2 - (bounds.y + bounds.height / 2) * zoom,
    zoom,
  };
}

function held(zoom: number): number {
  return Math.min(Math.max(zoom, zoomLimits.minimum), zoomLimits.maximum);
}
