import {
  drawnBounds,
  layoutDiagram,
  type CanvasBounds,
  type CanvasLayout,
} from '@saerskriven/canvas';
import type { DiagramId, ElementId, Model, Point } from '@saerskriven/model';
import { activeDiagram } from '../store/selectors.js';
import type { State } from '../store/state.js';

const laidOut = new WeakMap<Model, Map<DiagramId, CanvasLayout>>();

/** The layout of a model that holds no diagram to draw. */
export const emptyLayout: CanvasLayout = {
  nodes: [],
  edges: [],
  unplaced: [],
  bounds: { x: 0, y: 0, width: 0, height: 0 },
};

/**
 * The layout of the diagram on screen, cached by model identity and diagram
 * id, so a store selector reading it returns a stable snapshot.
 */
export function currentLayout(
  state: Pick<State, 'present' | 'activeDiagram'>,
): CanvasLayout {
  const diagram = activeDiagram(state);
  if (diagram === undefined) {
    return emptyLayout;
  }
  const layouts =
    laidOut.get(state.present) ?? new Map<DiagramId, CanvasLayout>();
  const cached = layouts.get(diagram.id);
  if (cached !== undefined) {
    return cached;
  }
  const layout = layoutDiagram(diagram, state.present);
  layouts.set(diagram.id, layout);
  laidOut.set(state.present, layouts);
  return layout;
}

/** The drawn extent of the selected elements and flows, as `drawnBounds` measures it. */
export function selectionBounds(
  layout: CanvasLayout,
  selection: readonly ElementId[],
): CanvasBounds {
  const selected = new Set(selection);
  return drawnBounds(
    layout.nodes.filter((node) => selected.has(node.id)),
    layout.edges.filter((edge) => selected.has(edge.id)),
  );
}

/** Whether `point` lies inside `bounds`, grown by `padding` on every side. */
export function insideBounds(
  point: Point,
  bounds: CanvasBounds,
  padding = 0,
): boolean {
  return (
    point.x >= bounds.x - padding &&
    point.x <= bounds.x + bounds.width + padding &&
    point.y >= bounds.y - padding &&
    point.y <= bounds.y + bounds.height + padding
  );
}
