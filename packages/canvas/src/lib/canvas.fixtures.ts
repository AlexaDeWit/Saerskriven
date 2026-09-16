import type { Model } from '@saerskriven/model';
import { committedModel } from '@saerskriven/model/fixtures';
import { layoutOf } from './layout.fixtures.js';
import type { CanvasEdge, CanvasNode } from './layout.js';

/**
 * The model that draws every glyph and every badge tone: the six element
 * kinds, a trust boundary in both shapes, an out-of-scope element, a flow
 * with a waypoint, a flow with a free end, a flow the layout refuses, and
 * open threats spread so that one element carries the stacked pair of
 * badges and another carries the neutral badge alone, a flow whose open
 * threat is flagged, and a boundary curve named only by a flagged
 * `mitigated` threat, which carries the flag-only badge. It lives under
 * test-data because `packages/render` draws it too, and render cannot import
 * canvas's spec fixtures, which no entry point exports.
 */
export const everyGlyphModel: Model = committedModel('every-glyph.model.json');

/** The every-glyph diagram laid out. */
export const everyGlyphLayout = layoutOf(everyGlyphModel);

/** The every-glyph node under the id, throwing where the layout has none. */
export const nodeNamed = (value: string): CanvasNode => {
  const found = everyGlyphLayout.nodes.find((node) => node.id === value);
  if (found === undefined) {
    throw new Error(`No node ${value} in the layout`);
  }
  return found;
};

/** The every-glyph edge under the id, throwing where the layout has none. */
export const edgeNamed = (value: string): CanvasEdge => {
  const found = everyGlyphLayout.edges.find((edge) => edge.id === value);
  if (found === undefined) {
    throw new Error(`No edge ${value} in the layout`);
  }
  return found;
};
