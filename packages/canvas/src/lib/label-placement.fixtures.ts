import type { Model } from '@saerskriven/model';
import { parsedFixture } from '@saerskriven/model/fixtures';
import { badgeAnchor, badgeBox } from './badges.js';
import {
  ecluseModel,
  everyGlyphModel,
  saerskrivenModel,
} from './canvas.fixtures.js';
import {
  boxesOverlap,
  boxMeetsCircle,
  boxOfPoints,
  shiftedBy,
  type Box,
  type Circle,
} from './geometry.js';
import { layoutDiagram, type CanvasLayout, type CanvasNode } from './layout.js';
import { processCircle } from './obstacles.js';
import { nodeTextPlacement, textPlacementCorners } from './text-placement.js';

/** One diagram of a model laid out, the first by default. */
export const layoutOf = (model: Model, diagram = 0): CanvasLayout =>
  layoutDiagram(model.diagrams[diagram], model);

/** Whether a node is a trust boundary, which a label may sit inside. */
export const isEnclosure = (node: CanvasNode): boolean =>
  node.kind === 'boundary-box' || node.kind === 'boundary-curve';

/** A node's box in diagram coordinates. */
export const boxOf = (node: CanvasNode): Box => ({
  minX: node.position.x,
  minY: node.position.y,
  maxX: node.position.x + node.size.width,
  maxY: node.position.y + node.size.height,
});

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
    : asSolid({ of: node.name, box: boxOf(node) });

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
export const elementSolids = (layout: CanvasLayout): Solid[] => [
  ...layout.nodes.flatMap((node) =>
    isEnclosure(node) ? [] : [outlineSolid(node)],
  ),
  ...elementBadges(layout).map(asSolid),
];

/** An actor, or another box element, at a position. */
export const boxAt = (
  value: string,
  x: number,
  y: number,
  kind = 'actor',
  size = { width: 120, height: 80 },
) => ({
  kind,
  id: value,
  name: value,
  description: '',
  outOfScope: false,
  reasonOutOfScope: '',
  position: { x, y },
  size,
});

/** An open, high threat on one element. */
export const openThreatOn = (element: string, number = 1) => ({
  id: `th-${element}`,
  number,
  title: 'Session theft',
  category: { methodology: 'STRIDE', category: 'spoofing' },
  severity: 'high',
  status: 'open',
  description: '',
  elements: [element],
});

/** A model of one diagram holding the given elements. */
export const diagramOf = (
  elements: unknown[],
  threats: unknown[] = [],
  assumptions: unknown[] = [],
): Model =>
  parsedFixture({
    metadata: { title: 't', owner: '', description: '', contributors: [] },
    diagrams: [{ id: 'd', title: 'Diagram', elements }],
    threats,
    lastIssuedThreatNumber: threats.length,
    mitigations: [],
    assumptions,
  });

/** The Écluse diagram laid out. */
export const ecluseLayout = layoutOf(ecluseModel);

/** Every committed diagram laid out, named for a test title. */
export const scenes: readonly {
  readonly name: string;
  readonly layout: CanvasLayout;
}[] = [
  { name: 'the Écluse diagram', layout: ecluseLayout },
  { name: 'every glyph', layout: layoutOf(everyGlyphModel) },
  {
    name: 'the Saerskriven read and render diagram',
    layout: layoutOf(saerskrivenModel, 0),
  },
  {
    name: 'the Saerskriven agent and desktop diagram',
    layout: layoutOf(saerskrivenModel, 1),
  },
];
