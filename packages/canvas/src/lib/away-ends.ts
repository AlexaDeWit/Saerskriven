import type { ElementId, Point } from '@saerskriven/model';
import { edgePoints } from './flow-anchors.js';
import type { Box } from './geometry.js';
import type { CanvasEdgeGeometry } from './layout.js';
import { memoizedByIdentity } from './memoized.js';
import { wrappedTextStyles } from './stylesheet.js';
import type { TextPlacement } from './text-placement.js';
import {
  looseLabelWidth,
  textExtent,
  textPadding,
  wrapText,
} from './typography.js';

/**
 * A flow end attached to an element its diagram does not place, drawn at a
 * point of its own: the element's id, and the name it is labelled with.
 */
export type AwayEnd = {
  readonly element: ElementId;
  readonly name: string;
};

/**
 * The label of a flow end drawn away from its element: a frame hung beyond
 * the end's point on the side the line arrives from, so the line meets the
 * frame there, and the element's name centred inside it.
 */
export type AwayEndLabel = {
  readonly side: 'source' | 'target';
  readonly element: ElementId;
  readonly frame: Box;
  readonly name: TextPlacement;
};

/**
 * The labels of a laid-out flow's ends drawn away from their elements,
 * source first, worked out from the flow's own points so a label follows its
 * end through a gesture. The same flow gives the same list.
 */
export const awayEndLabels = memoizedByIdentity(
  (edge: CanvasEdgeGeometry): readonly AwayEndLabel[] => {
    const points = edgePoints(edge);
    const last = points.length - 1;
    return [
      ...labelOf('source', edge.sourceAway, points[0], points[1]),
      ...labelOf('target', edge.targetAway, points[last], points[last - 1]),
    ];
  },
);

function labelOf(
  side: 'source' | 'target',
  away: AwayEnd | undefined,
  at: Point,
  from: Point,
): AwayEndLabel[] {
  if (away === undefined) {
    return [];
  }
  const { fontSize } = wrappedTextStyles.label;
  const extent = textExtent(
    wrapText(away.name, fontSize, looseLabelWidth),
    fontSize,
  );
  const frame = frameBeyond(
    at,
    from,
    extent.width + textPadding * 2,
    extent.height + textPadding * 2,
  );
  return [
    {
      side,
      element: away.element,
      frame,
      name: {
        text: away.name,
        at: {
          x: (frame.minX + frame.maxX) / 2,
          y: (frame.minY + frame.maxY) / 2,
        },
        anchor: 'centre',
        width: looseLabelWidth,
        textStyle: 'label',
      },
    },
  ];
}

function frameBeyond(
  at: Point,
  from: Point,
  width: number,
  height: number,
): Box {
  const across = at.x - from.x;
  const down = at.y - from.y;
  if (Math.abs(across) >= Math.abs(down)) {
    const minX = across >= 0 ? at.x : at.x - width;
    const minY = at.y - height / 2;
    return { minX, minY, maxX: minX + width, maxY: minY + height };
  }
  const minX = at.x - width / 2;
  const minY = down >= 0 ? at.y : at.y - height;
  return { minX, minY, maxX: minX + width, maxY: minY + height };
}
