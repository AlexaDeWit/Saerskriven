import type { Model } from '@saerskriven/model';
import {
  boxAt,
  committedDiagrams,
  committedModel,
  modelWith,
  threatOf,
} from '@saerskriven/model/fixtures';
import { badgeAnchor, badgeBox, type BadgeMarks } from './badges.js';
import {
  boxesOverlap,
  boxMeetsCircle,
  boxOfPoints,
  shiftedBy,
  type Box,
  type Circle,
} from './geometry.js';
import { nodeBox } from './handles.js';
import {
  layoutDiagram,
  type CanvasEdge,
  type CanvasLayout,
  type CanvasNode,
} from './layout.js';
import { processCircle } from './obstacles.js';
import { nodeTextPlacement, textPlacementCorners } from './text-placement.js';

/** One diagram of a model laid out, the first by default. */
export const layoutOf = (model: Model, diagram = 0): CanvasLayout =>
  layoutDiagram(model.diagrams[diagram], model);

const square = { width: 100, height: 100 };

/**
 * A model of one diagram: `el-left` at the origin and `el-right` 400 to its
 * right, both 100 square, then the flow and any further elements.
 */
export const twoBoxDiagram = (flow: unknown, extra: unknown[] = []): Model =>
  modelWith({
    elements: [
      boxAt('el-left', 0, 0, 'actor', square),
      boxAt('el-right', 400, 0, 'actor', square),
      flow,
      ...extra,
    ],
  });

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

/** Badge marks unlike any locale's, so a spec sees the marks it passed drawn. */
export const specMarks: BadgeMarks = {
  severity: {
    undecided: 'u',
    low: 'l',
    medium: 'm',
    high: 'h',
    critical: 'c',
  },
  flag: 'f',
};

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
