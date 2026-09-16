import { layoutDiagram, type CanvasLayout } from '@saerskriven/canvas';
import type { DiagramId, Model } from '@saerskriven/model';
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
