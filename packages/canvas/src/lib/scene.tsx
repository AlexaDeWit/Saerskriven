import type { ReactElement } from 'react';
import type { BadgeMarks } from './badges.js';
import { FlowGlyph, PlacedElementGlyph } from './glyphs.js';
import type { CanvasLayout } from './layout.js';

/**
 * Every glyph of one laid-out diagram, in painting order and in the
 * diagram's own coordinates, with no root element of its own. The headless
 * renderer puts this inside the `<svg>` it sizes and styles; the interactive
 * canvas does not use it, because React Flow places each node itself.
 * `marks` are the letters every threat badge draws.
 */
export function DiagramGlyphs({
  layout,
  marks,
}: {
  readonly layout: CanvasLayout;
  readonly marks: BadgeMarks;
}): ReactElement {
  return (
    <>
      {layout.nodes.map((node) => (
        <PlacedElementGlyph key={node.id} marks={marks} node={node} />
      ))}
      {layout.edges.map((edge) => (
        <FlowGlyph key={edge.id} edge={edge} marks={marks} />
      ))}
    </>
  );
}
