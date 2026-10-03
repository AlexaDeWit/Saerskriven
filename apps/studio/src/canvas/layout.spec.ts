import { drawnBounds, selectedBadgeAnchor } from '@saerskriven/canvas';
import { badgeRadius } from '@saerskriven/canvas/tokens';
import { emptyModel, type ElementId } from '@saerskriven/model';
import { Action } from '../store/actions.js';
import { reduce } from '../store/reducer.js';
import { initialState } from '../store/state.js';
import {
  actorElement,
  otherElement,
  processElement,
  secondDiagram,
  twoDiagramModel,
} from '../store/store.fixtures.js';
import { canvasModel, noteElement } from './canvas.fixtures.js';
import {
  currentLayout,
  emptyLayout,
  insideBounds,
  selectionBounds,
  selectionPosition,
} from './layout.js';

const start = initialState(canvasModel);

const moved = reduce(
  start,
  Action.MoveElement({ elementId: actorElement, offset: { x: 10, y: 0 } }),
);

describe('currentLayout', () => {
  it('lays out every element of the diagram on screen', () => {
    const layout = currentLayout(start);
    expect(layout.nodes).toHaveLength(4);
    expect(layout.edges).toHaveLength(2);
  });

  it('hands back the same layout while the model is the same object', () => {
    expect(currentLayout(start)).toBe(currentLayout(start));
  });

  it('lays the diagram out again once the model has moved', () => {
    expect(currentLayout(moved)).not.toBe(currentLayout(start));
    expect(
      currentLayout(moved).nodes.find((node) => node.id === actorElement)
        ?.position.x,
    ).toBe(10);
  });

  it('lays out the diagram chosen, and keeps each diagram of one model laid out', () => {
    const first = initialState(twoDiagramModel);
    const second = reduce(
      first,
      Action.SelectDiagram({ diagramId: secondDiagram }),
    );
    expect(currentLayout(second).nodes.map((node) => node.id)).toEqual([
      otherElement,
    ]);
    expect(currentLayout(second)).not.toBe(currentLayout(first));
    expect(currentLayout(second)).toBe(currentLayout(second));
    expect(currentLayout(first)).toBe(currentLayout(first));
  });

  it('draws nothing for a model that holds no diagram', () => {
    expect(currentLayout(initialState(emptyModel))).toBe(emptyLayout);
  });

  it('lays the diagram out the same whatever is selected', () => {
    const selecting = (elementIds: readonly ElementId[]) =>
      reduce(start, Action.Select({ elementIds }));
    const selected = currentLayout(selecting([actorElement]));

    expect(currentLayout(start)).toBe(selected);
    expect(currentLayout(selecting([processElement]))).toBe(selected);
  });
});

describe('selectionBounds', () => {
  it('spans the selected elements and leaves the others out', () => {
    const layout = currentLayout(start);
    const note = layout.nodes.find((node) => node.id === noteElement);
    const bounds = selectionBounds(layout, [actorElement, processElement]);

    expect(bounds.x).toBeLessThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeGreaterThanOrEqual(420);
    expect(bounds.y + bounds.height).toBeLessThan(note?.position.y ?? 0);
  });

  it("reaches a selected element's badge where it steps out past the corner, beyond what the layout measures", () => {
    const layout = currentLayout(start);
    const reader = layout.nodes.find((node) => node.id === actorElement);
    assert.isDefined(reader);
    const at = selectedBadgeAnchor(reader);
    const badgeTop = {
      x: reader.position.x + at.x,
      y: reader.position.y + at.y - badgeRadius.primary,
    };

    expect(
      insideBounds(badgeTop, selectionBounds(layout, [actorElement])),
    ).toBe(true);
    expect(insideBounds(badgeTop, drawnBounds([reader], []))).toBe(false);
  });
});

describe('selectionPosition', () => {
  it('takes the least x and the least y among the selected elements', () => {
    expect(
      selectionPosition(currentLayout(start), [processElement, noteElement]),
    ).toEqual({ x: 0, y: 0 });
  });

  it('gives nothing while no element is selected', () => {
    expect(selectionPosition(currentLayout(start), [])).toBeUndefined();
  });
});

describe('insideBounds', () => {
  const bounds = { x: 0, y: 0, width: 100, height: 50 };

  it('takes a point inside the bounds or within the padding around them', () => {
    expect(insideBounds({ x: 50, y: 25 }, bounds)).toBe(true);
    expect(insideBounds({ x: 100, y: 50 }, bounds)).toBe(true);
    expect(insideBounds({ x: -3, y: 53 }, bounds, 4)).toBe(true);
  });

  it('leaves a point beyond the padding out', () => {
    expect(insideBounds({ x: -3, y: 25 }, bounds)).toBe(false);
    expect(insideBounds({ x: -5, y: 25 }, bounds, 4)).toBe(false);
    expect(insideBounds({ x: 50, y: 55 }, bounds, 4)).toBe(false);
  });
});
