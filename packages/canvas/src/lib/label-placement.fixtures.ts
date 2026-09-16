import type { Model } from '@saerskriven/model';
import {
  committedDiagrams,
  committedModel,
  threatOf,
} from '@saerskriven/model/fixtures';
import { badgeAnchor, badgeBox } from './badges.js';
import {
  boxesOverlap,
  boxMeetsCircle,
  boxOfPoints,
  shiftedBy,
  type Box,
  type Circle,
} from './geometry.js';
import { nodeBox } from './handles.js';
import { layoutOf } from './layout.fixtures.js';
import type { CanvasLayout, CanvasNode } from './layout.js';
import { processCircle } from './obstacles.js';
import { nodeTextPlacement, textPlacementCorners } from './text-placement.js';

/** Whether a node is a trust boundary, which a label may sit inside. */
export const isEnclosure = (node: CanvasNode): boolean =>
  node.kind === 'boundary-box' || node.kind === 'boundary-curve';

/** Something drawn, named for a failure message, and the box it fills. */
export type Drawn = { readonly of: string; readonly box: Box };

/** Something drawn, named for a failure message, and how a box meets it. */
export type Solid = {
  readonly of: string;
  readonly meets: (box: Box) => boolean;
};

/** A drawn box as a solid a box meets by overlapping it. */
export const asSolid = (drawn: Drawn): Solid => ({
  of: drawn.of,
  meets: (box) => boxesOverlap(box, drawn.box),
});

/** A process's circle in diagram coordinates. */
export const circleOf = (node: CanvasNode): Circle => {
  const circle = processCircle(node.size);
  return {
    centre: shiftedBy(circle.centre, node.position),
    radius: circle.radius,
  };
};

const outlineSolid = (node: CanvasNode): Solid =>
  node.kind === 'process'
    ? { of: node.name, meets: (box) => boxMeetsCircle(box, circleOf(node)) }
    : asSolid({ of: node.name, box: nodeBox(node) });

/** The box a node's own text fills, in diagram coordinates. */
export const textBoxOf = (node: CanvasNode): Box | undefined =>
  boxOfPoints(
    textPlacementCorners(nodeTextPlacement(node)).map((corner) =>
      shiftedBy(corner, node.position),
    ),
  );

/** Every element badge a layout draws. */
export const elementBadges = (layout: CanvasLayout): Drawn[] =>
  layout.nodes.flatMap((node) =>
    node.badge === undefined
      ? []
      : [
          {
            of: `${node.name} badge`,
            box: badgeBox(
              shiftedBy(badgeAnchor(node.size), node.position),
              node.badge,
            ),
          },
        ],
  );

/** Every element shape other than a boundary, and every element badge. */
export const drawnSolids = (layout: CanvasLayout): Solid[] => [
  ...layout.nodes.flatMap((node) =>
    isEnclosure(node) ? [] : [outlineSolid(node)],
  ),
  ...elementBadges(layout).map(asSolid),
];

/** An open, high threat on one element, under `th-<element>`. */
export const openThreatOn = (element: string, number = 1) =>
  threatOf({
    id: `th-${element}`,
    number,
    severity: 'high',
    elements: [element],
  });

/**
 * Every committed diagram laid out, named for a test title, beside the model
 * and the index of the diagram it lays out.
 */
export const scenes: readonly {
  readonly name: string;
  readonly model: Model;
  readonly diagram: number;
  readonly layout: CanvasLayout;
}[] = committedDiagrams.map(({ name, file, diagram }) => {
  const model = committedModel(file);
  return { name, model, diagram, layout: layoutOf(model, diagram) };
});
