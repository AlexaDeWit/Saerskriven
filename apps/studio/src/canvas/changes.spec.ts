import {
  flowEndNodeId,
  layoutAtReactFlowNodes,
  layoutDiagram,
  toReactFlowNodes,
} from '@saerskriven/canvas';
import type { ElementId, Flow } from '@saerskriven/model';
import { Action } from '../store/actions.js';
import {
  canvasModel,
  openCanvas,
  probeFlow,
  requestFlow,
} from './canvas.fixtures.js';
import { modelStore } from '../store/store.js';
import {
  applyChanges,
  applyConnection,
  betweenTwoElements,
  gestureSelection,
  moveActions,
  selectionActions,
  type DiagramChange,
} from './changes.js';
import { elementIds, nodesById } from './nodes.js';
import { actorElement, processElement } from '../store/store.fixtures.js';

const layout = layoutDiagram(canvasModel.diagrams[0], canvasModel);

const elements = elementIds(layout);

const nodes = nodesById(layout);

const selecting = (id: string, selected: boolean): DiagramChange => ({
  id,
  type: 'select',
  selected,
});

const moving = (
  id: string,
  position: { x: number; y: number },
  dragging: boolean | undefined,
): DiagramChange => ({ id, type: 'position', position, dragging });

const sizing = (
  id: string,
  dimensions: { width: number; height: number },
  resizing: boolean | undefined,
): DiagramChange => ({ id, type: 'dimensions', dimensions, resizing });

const anchor = flowEndNodeId(probeFlow, 'target');

const selectionHeld = (): readonly ElementId[] =>
  modelStore.getState().selection;

const flowDrawn = (): Flow | undefined => {
  const drawn = modelStore.getState().present.diagrams[0].elements.at(-1);
  return drawn?.kind === 'flow' ? drawn : undefined;
};

describe('selectionActions', () => {
  it('selects the element the changes chose', () => {
    expect(
      selectionActions([selecting(actorElement, true)], elements, []),
    ).toEqual([Action.Select({ elementIds: [actorElement] })]);
  });

  it('asks for nothing where the chosen element is the one already selected', () => {
    expect(
      selectionActions([selecting(actorElement, true)], elements, [
        actorElement,
      ]),
    ).toEqual([]);
  });

  it('clears the selection where the element holding it was dropped', () => {
    expect(
      selectionActions([selecting(actorElement, false)], elements, [
        actorElement,
      ]),
    ).toEqual([Action.Select({ elementIds: [] })]);
  });

  it('leaves a selection alone where another element was dropped', () => {
    expect(
      selectionActions([selecting(processElement, false)], elements, [
        requestFlow,
      ]),
    ).toEqual([]);
  });

  it('takes the selection over the deselection that comes with it', () => {
    expect(
      selectionActions(
        [selecting(actorElement, false), selecting(requestFlow, true)],
        elements,
        [actorElement],
      ),
    ).toEqual([Action.Select({ elementIds: [requestFlow] })]);
  });

  it('selects nothing for an id that names no element', () => {
    expect(selectionActions([selecting(anchor, true)], elements, [])).toEqual(
      [],
    );
  });
});

describe('moveActions', () => {
  it('moves an element by the offset from where the model has it', () => {
    expect(
      moveActions([moving(actorElement, { x: 40, y: 25 }, false)], nodes, []),
    ).toEqual([
      Action.MoveElement({
        elementId: actorElement,
        offset: { x: 40, y: 25 },
      }),
    ]);
  });

  it('leaves a gesture still in flight to the canvas', () => {
    expect(
      moveActions([moving(actorElement, { x: 40, y: 25 }, true)], nodes, [
        actorElement,
      ]),
    ).toEqual([]);
  });

  it('leaves the position change of an active resize to its control', () => {
    expect(
      moveActions(
        [
          sizing(actorElement, { width: 110, height: 60 }, true),
          moving(actorElement, { x: 10, y: 0 }, undefined),
        ],
        nodes,
        [actorElement],
      ),
    ).toEqual([]);
  });

  it('asks for nothing where the element ended up where it started', () => {
    expect(
      moveActions([moving(actorElement, { x: 0, y: 0 }, false)], nodes, [
        actorElement,
      ]),
    ).toEqual([]);
  });

  it('moves nothing for an id that names no drawn node', () => {
    expect(
      moveActions([moving(anchor, { x: 9, y: 9 }, false)], nodes, []),
    ).toEqual([]);
  });

  it('moves a multi-selection through one plural action', () => {
    expect(
      moveActions([moving(actorElement, { x: 40, y: 25 }, false)], nodes, [
        actorElement,
        processElement,
        requestFlow,
      ]),
    ).toEqual([
      Action.MoveElements({
        elementIds: [actorElement, processElement, requestFlow],
        offset: { x: 40, y: 25 },
      }),
    ]);
  });
});

describe('gestureSelection', () => {
  const selection = [actorElement, processElement, requestFlow];

  it('keeps the full selection for a group move', () => {
    expect(
      gestureSelection(
        [moving(actorElement, { x: 40, y: 25 }, true)],
        nodes,
        selection,
      ),
    ).toBe(selection);
  });

  it('keeps only the resized node during a multi-selection resize', () => {
    expect(
      gestureSelection(
        [sizing(actorElement, { width: 120, height: 80 }, true)],
        nodes,
        selection,
      ),
    ).toEqual([actorElement]);
  });

  it('keeps flows on untouched nodes fixed during a multi-selection resize', () => {
    const group = [actorElement, processElement, requestFlow];
    const changes = [sizing(actorElement, { width: 120, height: 80 }, true)];
    const onScreen = toReactFlowNodes(layout).map((node) =>
      node.id === actorElement
        ? {
            ...node,
            position: { x: node.position.x, y: node.position.y - 20 },
            height: 80,
          }
        : node,
    );

    const transient = layoutAtReactFlowNodes(
      layout,
      onScreen,
      gestureSelection(changes, nodes, group),
    );

    expect(
      transient.nodes.find((node) => node.id === processElement)?.position,
    ).toEqual(nodes.get(processElement)?.position);
    expect(
      transient.edges.find((edge) => edge.id === requestFlow)?.target,
    ).toEqual(layout.edges.find((edge) => edge.id === requestFlow)?.target);
  });
});

describe('betweenTwoElements', () => {
  it('allows a connection between two elements', () => {
    expect(
      betweenTwoElements({
        source: actorElement,
        target: processElement,
        sourceHandle: 'right',
        targetHandle: 'left',
      }),
    ).toBe(true);
  });

  it('refuses one that ends where it started, which draws no line', () => {
    expect(
      betweenTwoElements({
        source: actorElement,
        target: actorElement,
        sourceHandle: 'right',
        targetHandle: 'left',
      }),
    ).toBe(false);
  });
});

describe('applyConnection', () => {
  it('draws the flow a settled connection asks for', () => {
    openCanvas();

    applyConnection(
      {
        source: actorElement,
        target: processElement,
        sourceHandle: 'right',
        targetHandle: 'left',
      },
      elements,
    );

    expect(modelStore.getState().past).toHaveLength(1);
    expect(flowDrawn()?.source).toEqual({
      kind: 'attached',
      element: actorElement,
    });
    expect(flowDrawn()?.target).toEqual({
      kind: 'attached',
      element: processElement,
    });
  });

  it('draws nothing for an end that names no element of the diagram', () => {
    openCanvas();

    applyConnection(
      {
        source: actorElement,
        target: anchor,
        sourceHandle: 'right',
        targetHandle: null,
      },
      elements,
    );

    expect(modelStore.getState().past).toHaveLength(0);
  });
});

describe('applyChanges', () => {
  it('selects the element a click chose', () => {
    openCanvas();

    applyChanges([selecting(actorElement, true)], elements, nodes);

    expect(selectionHeld()).toEqual([actorElement]);
  });

  it('moves the selection from an element to a flow, deselection last', () => {
    openCanvas([actorElement]);

    applyChanges([selecting(requestFlow, true)], elements, nodes);
    applyChanges([selecting(actorElement, false)], elements, nodes);

    expect(selectionHeld()).toEqual([requestFlow]);
  });

  it('moves the selection from a flow to an element, deselection last', () => {
    openCanvas([requestFlow]);

    applyChanges([selecting(actorElement, true)], elements, nodes);
    applyChanges([selecting(requestFlow, false)], elements, nodes);

    expect(selectionHeld()).toEqual([actorElement]);
  });

  it('clears the selection where nothing was chosen in its place', () => {
    openCanvas([actorElement]);

    applyChanges([selecting(actorElement, false)], elements, nodes);

    expect(selectionHeld()).toEqual([]);
  });

  it('moves an element the model holds, so undo has something to take back', () => {
    openCanvas();

    applyChanges(
      [moving(actorElement, { x: 40, y: 25 }, false)],
      elements,
      nodes,
    );

    expect(modelStore.getState().past).toHaveLength(1);
    expect(
      modelStore
        .getState()
        .present.diagrams[0].elements.find(
          (element) => element.id === actorElement,
        ),
    ).toMatchObject({ position: { x: 40, y: 25 } });
  });
});
