import type { Model } from '@saerskriven/model';
import { boxAt, modelWith } from '@saerskriven/model/fixtures';
import { layoutDiagram, type CanvasLayout } from './layout.js';

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
