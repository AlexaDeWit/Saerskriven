import type { Model } from '@saerskriven/model';
import { parsedFixture } from '@saerskriven/model/fixtures';
import { layoutDiagram } from './layout.js';

/** The first diagram of a model laid out. */
export const layoutOf = (model: Model) =>
  layoutDiagram(model.diagrams[0], model);

/** A flow named `el-flow` between the given ends. */
export const flowBetween = (
  source: unknown,
  target: unknown,
  waypoints: unknown[],
) => ({
  kind: 'flow',
  id: 'el-flow',
  name: 'Flow',
  description: '',
  outOfScope: false,
  reasonOutOfScope: '',
  source,
  target,
  waypoints,
  bidirectional: false,
});

const boxAt = (value: string, x: number, y: number) => ({
  kind: 'actor',
  id: value,
  name: value,
  description: '',
  outOfScope: false,
  reasonOutOfScope: '',
  position: { x, y },
  size: { width: 100, height: 100 },
});

/**
 * A model of one diagram: `el-left` at the origin and `el-right` 400 to its
 * right, both 100 square, then the flow and any further elements.
 */
export const twoBoxDiagram = (flow: unknown, extra: unknown[] = []) =>
  parsedFixture({
    metadata: { title: 't', owner: '', description: '', contributors: [] },
    diagrams: [
      {
        id: 'd',
        title: 'Diagram',
        elements: [
          boxAt('el-left', 0, 0),
          boxAt('el-right', 400, 0),
          flow,
          ...extra,
        ],
      },
    ],
    threats: [],
    lastIssuedThreatNumber: 0,
    mitigations: [],
    assumptions: [],
  });

/** A flow end attached to an element on no pinned side. */
export const attached = (element: string) => ({ kind: 'attached', element });
