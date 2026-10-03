import { emptyModel, type Flow, type Model } from '@saerskriven/model';
import { elementId, elementIn } from '@saerskriven/model/fixtures';
import { Action } from '../store/actions.js';
import { initialState } from '../store/state.js';
import {
  actorElement,
  otherElement,
  processElement,
  sampleThreat,
  secondDiagram,
  twoDiagramModel,
} from '../store/store.fixtures.js';
import { dispatch, modelStore } from '../store/store.js';
import {
  currentAnnouncement,
  nameQuoteLength,
  resetAnnouncements,
} from './announcements.js';
import { activeTranslator } from '../messages/locale.js';
import { currentLayout } from './layout.js';
import {
  boundaryCurve,
  boundaryElement,
  canvasModel,
  curvedCanvasModel,
  flaggedCanvasModel,
  laidOutNode,
  lastPlaced,
  openCanvas,
  probeFlow,
  requestFlow,
} from './canvas.fixtures.js';
import {
  connectElements,
  describeRemoval,
  focusElement,
  placeBoundaryCurve,
  placeElement,
  removalCascade,
  removeSelected,
  resizeNode,
  reverseSelectedFlow,
  selectAll,
  toggleBoundaryShape,
} from './edits.js';
import { freshElement } from './elements.js';
import { numbersIn } from '../ui/ui.fixtures.js';

const emptied = (): void => {
  modelStore.setState(initialState(emptyModel), true);
  resetAnnouncements();
};

describe('focusElement', () => {
  const drawn = document.createElement('button');
  const field = document.createElement('input');
  drawn.className = 'react-flow__node';
  drawn.dataset['id'] = actorElement;

  beforeEach(() => {
    openCanvas([actorElement]);
    vi.useFakeTimers();
    document.body.append(drawn, field);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    drawn.remove();
    field.remove();
  });

  it('waits for an element that has not rendered yet', () => {
    drawn.remove();
    focusElement(actorElement);
    document.body.append(drawn);

    vi.advanceTimersByTime(50);

    expect(document.activeElement).toBe(drawn);
  });

  it('retries when rendering removes the focused element', () => {
    focusElement(actorElement);
    drawn.remove();
    document.body.append(drawn);

    vi.advanceTimersByTime(50);

    expect(document.activeElement).toBe(drawn);
  });

  it('leaves a field focused when the user moves there before a retry', () => {
    focusElement(actorElement);
    field.focus();

    vi.advanceTimersByTime(50);

    expect(document.activeElement).toBe(field);
  });

  it('abandons a pending render retry after selection changes', () => {
    drawn.remove();
    focusElement(actorElement);
    modelStore.setState({ selection: [processElement] });
    document.body.append(drawn);

    vi.advanceTimersByTime(50);

    expect(document.activeElement).not.toBe(drawn);
  });
});

describe('removalCascade', () => {
  it('counts the flows an element holds and the threats that name it', () => {
    expect(removalCascade(canvasModel, actorElement)).toEqual({
      flows: 1,
      threatLinks: 0,
      threats: 1,
    });
  });

  it('counts nothing for a flow, which no other element holds', () => {
    expect(removalCascade(canvasModel, probeFlow)).toEqual({
      flows: 0,
      threatLinks: 0,
      threats: 0,
    });
  });

  it('counts a threat the removal takes the last attachment of', () => {
    expect(removalCascade(canvasModel, requestFlow)).toEqual({
      flows: 0,
      threatLinks: 0,
      threats: 2,
    });
  });

  it('counts a threat once for a selection that holds every element of it', () => {
    expect(removalCascade(canvasModel, [actorElement, requestFlow])).toEqual({
      flows: 0,
      threatLinks: 0,
      threats: 3,
    });
  });

  it('counts the link a surviving threat drops, and the threat that goes, once each', () => {
    const shared = flaggedCanvasModel({
      'threat-path-disclosure': { elements: [requestFlow, processElement] },
    });
    expect(removalCascade(shared, requestFlow)).toEqual({
      flows: 0,
      threatLinks: 1,
      threats: 1,
    });
  });
});

describe('describeRemoval', () => {
  it('says what went and what the model changed around it', () => {
    const description = describeRemoval(
      activeTranslator().t,
      { name: 'Reader', kind: 'actor' },
      { flows: 2, threatLinks: 1, threats: 1 },
    );

    expect(description).toContain('Reader');
    expect(numbersIn(description)).toEqual([2, 1, 1]);
  });

  it('says a count of none rather than leaving it out', () => {
    const description = describeRemoval(
      activeTranslator().t,
      { count: 2 },
      { flows: 0, threatLinks: 0, threats: 0 },
    );

    expect(numbersIn(description)).toEqual([2, 0, 0, 0]);
  });
});

describe('placing an element', () => {
  beforeEach(() => {
    openCanvas();
  });

  it('adds the element, selects it and opens its name without repeating it', () => {
    placeElement(
      freshElement('actor', { x: 10, y: 20 }, { width: 100, height: 50 }),
      'pointer',
    );

    const state = modelStore.getState();
    expect(state.present.diagrams[0].elements).toHaveLength(7);
    expect(state.selection).toHaveLength(1);
    expect(state.inlineEditor).toEqual({
      kind: 'name',
      elementId: state.selection.at(0),
    });
    expect(currentAnnouncement().message).toBe('');
  });

  it('costs one step of the undo stack, the selection beside it costing none', () => {
    placeElement(
      freshElement('process', { x: 10, y: 20 }, { width: 80, height: 80 }),
      'pointer',
    );

    expect(modelStore.getState().past).toHaveLength(1);
  });

  it('does not open a name field where the placed box cannot hold it', () => {
    placeElement(
      freshElement('actor', { x: 10, y: 20 }, { width: 100, height: 5 }),
      'pointer',
      false,
    );

    const state = modelStore.getState();
    expect(state.selection).toHaveLength(1);
    expect(state.inlineEditor).toBeUndefined();
  });

  it('places a curve as one edit through the clicked waypoints', () => {
    placeBoundaryCurve(
      [
        { x: 10, y: 20 },
        { x: 80, y: 60 },
        { x: 120, y: 20 },
      ],
      'pointer',
    );

    expect(modelStore.getState().past).toHaveLength(1);
    expect(lastPlaced()).toMatchObject({
      kind: 'trust-boundary',
      shape: {
        kind: 'curve',
        waypoints: [
          { x: 10, y: 20 },
          { x: 80, y: 60 },
          { x: 120, y: 20 },
        ],
      },
    });
  });

  it.each([
    [
      'pointer',
      {
        position: { x: 10.123, y: 20.988 },
        size: { width: 100.556, height: 50.444 },
      },
      [
        { x: 10.123, y: 20.988 },
        { x: 80.556, y: 60.444 },
      ],
    ],
    [
      'keyboard',
      {
        position: { x: 10.1, y: 21 },
        size: { width: 100.6, height: 50.4 },
      },
      [
        { x: 10.1, y: 21 },
        { x: 80.6, y: 60.4 },
      ],
    ],
  ] as const)(
    'stores an element and a curve placed with the %s at the decimals that input keeps',
    (input, box, waypoints) => {
      placeElement(
        freshElement(
          'actor',
          { x: 10.123456, y: 20.98765 },
          { width: 100.5558, height: 50.4444 },
        ),
        input,
      );
      expect(lastPlaced()).toMatchObject(box);

      placeBoundaryCurve(
        [
          { x: 10.123456, y: 20.98765 },
          { x: 80.5558, y: 60.4444 },
        ],
        input,
      );
      expect(lastPlaced()).toMatchObject({ shape: { waypoints } });
    },
  );

  it('refuses an unfinished curve without an undo step', () => {
    expect(placeBoundaryCurve([{ x: 10, y: 20 }], 'pointer')).toBe(false);

    expect(modelStore.getState().past).toHaveLength(0);
  });

  it('adds nothing while the model holds no diagram to add to', () => {
    emptied();

    placeElement(
      freshElement('actor', { x: 10, y: 20 }, { width: 100, height: 50 }),
      'pointer',
    );

    expect(modelStore.getState().past).toHaveLength(0);
    expect(currentAnnouncement().message).toBe('');
  });
});

describe('connectElements', () => {
  beforeEach(() => {
    openCanvas();
  });

  it('adds one flow between the two elements without repeating its focused name', () => {
    connectElements(actorElement, processElement);

    expect(currentAnnouncement().message).toBe('');
    expect(modelStore.getState().past).toHaveLength(1);
  });

  it('refuses a flow as an end, which the layout could place nowhere', () => {
    connectElements(actorElement, requestFlow);

    expect(modelStore.getState().past).toHaveLength(0);
    expect(currentAnnouncement().message).toBe('');
  });

  it('refuses a trust boundary as an end, which a flow crosses rather than ends on', () => {
    connectElements(boundaryElement, processElement);

    expect(modelStore.getState().past).toHaveLength(0);
    expect(currentAnnouncement().message).toBe('');
  });

  it('draws nothing while the model holds no diagram to draw on', () => {
    emptied();

    connectElements(actorElement, processElement);

    expect(modelStore.getState().past).toHaveLength(0);
    expect(currentAnnouncement().message).toBe('');
  });
});

describe('reverseSelectedFlow', () => {
  it('swaps the ends of the selected flow as one undo step and names it', () => {
    openCanvas([probeFlow]);

    reverseSelectedFlow();

    expect(elementIn(modelStore.getState().present, probeFlow)).toMatchObject({
      source: { kind: 'free', position: { x: 500, y: 200 } },
      target: { kind: 'attached', element: processElement },
    });
    expect(modelStore.getState().past).toEqual([canvasModel]);
    expect(currentAnnouncement().message).toContain('Reads a file');
  });

  it('leaves a selection that is not one flow alone', () => {
    openCanvas([actorElement]);

    reverseSelectedFlow();

    expect(modelStore.getState().past).toHaveLength(0);
    expect(currentAnnouncement().message).toBe('');
  });
});

describe('toggleBoundaryShape', () => {
  it('turns the selected box into the arch the curve tool draws in it, and back, one undo step each', () => {
    openCanvas([boundaryElement]);

    toggleBoundaryShape();

    expect(
      elementIn(modelStore.getState().present, boundaryElement),
    ).toMatchObject({
      shape: {
        kind: 'curve',
        waypoints: [
          { x: -20, y: 80 },
          { x: 210, y: -20 },
          { x: 440, y: 80 },
        ],
      },
    });
    expect(currentAnnouncement().message).toContain('Perimeter');

    toggleBoundaryShape();

    expect(modelStore.getState().present).toStrictEqual(canvasModel);
    expect(modelStore.getState().past).toHaveLength(2);
  });

  it('turns a curve into the box around its points', () => {
    openCanvas([boundaryElement], curvedCanvasModel);

    toggleBoundaryShape();

    expect(
      elementIn(modelStore.getState().present, boundaryElement),
    ).toMatchObject({
      shape: {
        kind: 'box',
        position: { x: boundaryCurve[0].x, y: boundaryCurve[1].y },
        size: { width: 460, height: 100 },
      },
    });
  });

  it('stores the shape it works out at three decimals', () => {
    openCanvas([boundaryElement]);
    dispatch(
      Action.SetBoundaryShape({
        elementId: boundaryElement,
        shape: {
          kind: 'box',
          position: { x: -20.123456, y: -20.98765 },
          size: { width: 460.5558, height: 100.4444 },
        },
      }),
    );

    toggleBoundaryShape();

    expect(
      elementIn(modelStore.getState().present, boundaryElement),
    ).toMatchObject({
      shape: {
        waypoints: [
          { x: -20.123, y: 79.457 },
          { x: 210.154, y: -20.988 },
          { x: 440.432, y: 79.457 },
        ],
      },
    });
  });

  it('leaves a selection that is not one trust boundary alone', () => {
    openCanvas([requestFlow]);

    toggleBoundaryShape();

    expect(modelStore.getState().past).toHaveLength(0);
  });
});

describe('removeSelected', () => {
  it('does nothing at all while nothing is selected', () => {
    openCanvas();

    expect(removeSelected()).toBe(false);
    expect(modelStore.getState().past).toHaveLength(0);
    expect(currentAnnouncement().message).toBe('');
  });

  it('says nothing where the model refuses the removal', () => {
    openCanvas([elementId('ghost-element')]);

    expect(removeSelected()).toBe(false);
    expect(modelStore.getState().past).toHaveLength(0);
    expect(currentAnnouncement().message).toBe('');
  });

  it('frees the flow ends a removal detaches at three decimals', () => {
    openCanvas([processElement]);
    dispatch(
      Action.ResizeElement({
        elementId: processElement,
        offset: { x: 0.123456, y: 0 },
        size: { width: 120.5558, height: 60.4444 },
      }),
    );

    expect(removeSelected()).toBe(true);

    expect(elementIn(modelStore.getState().present, requestFlow)).toMatchObject(
      { target: { kind: 'free', position: { x: 360.401, y: 30.222 } } },
    );
  });

  it('removes the selection and says what the cascade took with it', () => {
    openCanvas([actorElement]);

    expect(removeSelected()).toBe(true);
    expect(currentAnnouncement().message).toContain('Reader');
    expect(numbersIn(currentAnnouncement().message)).toEqual([1, 0, 1]);
  });

  it('removes a threat the selection was the last attachment of, one undo bringing it back', () => {
    openCanvas([actorElement]);

    removeSelected();

    expect(
      modelStore.getState().present.threats.map((threat) => threat.id),
    ).not.toContain(sampleThreat.id);
    dispatch(Action.Undo());
    expect(modelStore.getState().present.threats).toEqual(canvasModel.threats);
    expect(modelStore.getState().past).toHaveLength(0);
  });

  it('names an element with a long name by a bounded prefix', () => {
    const long = 'Reader of every shared model '.repeat(10).trim();
    openCanvas([actorElement]);
    dispatch(Action.RenameElement({ elementId: actorElement, name: long }));

    removeSelected();

    expect(currentAnnouncement().message).toContain(
      long.slice(0, nameQuoteLength / 2),
    );
    expect(currentAnnouncement().message).not.toContain(long);
  });

  it('leaves the removed element out of the model and its flow attached to nothing', () => {
    openCanvas([actorElement]);

    removeSelected();

    const elements = modelStore.getState().present.diagrams[0].elements;
    expect(
      elements.find((element) => element.id === actorElement),
    ).toBeUndefined();
    expect(
      elements.find((element) => element.id === requestFlow),
    ).toMatchObject({ source: { kind: 'free' } });
  });

  it('removes several selected elements in one undo step', () => {
    openCanvas([actorElement, processElement]);

    expect(removeSelected()).toBe(true);

    expect(modelStore.getState().past).toHaveLength(1);
    expect(modelStore.getState().selection).toEqual([]);
    expect(numbersIn(currentAnnouncement().message)).toEqual([2, 2, 0, 1]);
  });
});

describe('resizeNode', () => {
  beforeEach(() => {
    openCanvas([actorElement]);
  });

  it('commits position and size as one undo step', () => {
    const node = currentLayout(modelStore.getState()).nodes.find(
      (candidate) => candidate.id === actorElement,
    );
    expect(node).toBeDefined();
    if (node === undefined) {
      return;
    }

    resizeNode(
      node,
      { position: { x: -20, y: -10 }, size: { width: 140, height: 70 } },
      3,
    );

    const state = modelStore.getState();
    expect(state.past).toHaveLength(1);
    expect(
      state.present.diagrams[0].elements.find(
        (element) => element.id === actorElement,
      ),
    ).toMatchObject({
      position: { x: -20, y: -10 },
      size: { width: 140, height: 70 },
    });
  });

  it.each([
    [
      3,
      {
        position: { x: -20.123, y: -10.988 },
        size: { width: 140.556, height: 70.444 },
      },
    ],
    [
      1,
      {
        position: { x: -20.1, y: -11 },
        size: { width: 140.6, height: 70.4 },
      },
    ],
  ])(
    'stores the position and size of a resize at the %d decimals it names',
    (decimals, stored) => {
      resizeNode(
        laidOutNode(actorElement),
        {
          position: { x: -20.123456, y: -10.98765 },
          size: { width: 140.5558, height: 70.4444 },
        },
        decimals,
      );

      expect(
        elementIn(modelStore.getState().present, actorElement),
      ).toMatchObject(stored);
      expect(modelStore.getState().past).toHaveLength(1);
    },
  );

  it('does not commit unchanged geometry', () => {
    const node = currentLayout(modelStore.getState()).nodes.find(
      (candidate) => candidate.id === actorElement,
    );
    expect(node).toBeDefined();
    if (node !== undefined) {
      resizeNode(node, { position: node.position, size: node.size }, 3);
    }

    expect(modelStore.getState().past).toHaveLength(0);
  });

  it("scales a trust boundary curve's points against the side left in place, as one undo step that changes nothing else", () => {
    openCanvas([boundaryElement], curvedCanvasModel);
    const node = laidOutNode(boundaryElement);

    resizeNode(
      node,
      {
        position: node.position,
        size: { width: node.size.width + 460, height: node.size.height },
      },
      3,
    );

    const state = modelStore.getState();
    expect(state.past).toEqual([curvedCanvasModel]);
    expect(elementIn(state.present, boundaryElement)).toStrictEqual({
      ...elementIn(curvedCanvasModel, boundaryElement),
      shape: {
        kind: 'curve',
        waypoints: [
          { x: -20, y: 80 },
          { x: 420, y: -20 },
          { x: 900, y: 80 },
        ],
      },
    });
  });
});

describe('on the diagram switched to', () => {
  beforeEach(() => {
    modelStore.setState(
      { ...initialState(twoDiagramModel), activeDiagram: secondDiagram },
      true,
    );
    resetAnnouncements();
  });

  it('places, connects and selects all within that diagram alone', () => {
    const process = freshElement('process', { x: 300, y: 0 });
    expect(placeElement(process, 'pointer', false)).toBe(true);
    connectElements(otherElement, process.id);

    const [first, second] = modelStore.getState().present.diagrams;
    expect(first.elements).toHaveLength(3);
    expect(second.elements.map((element) => element.kind)).toEqual([
      'actor',
      'process',
      'flow',
    ]);

    selectAll();

    expect(modelStore.getState().selection).toEqual(
      second.elements.map((element) => element.id),
    );
  });
});

describe('selectAll', () => {
  it('selects every element in the diagram on screen', () => {
    openCanvas([actorElement]);

    selectAll();

    expect(modelStore.getState().selection).toEqual(
      canvasModel.diagrams[0].elements.map((element) => element.id),
    );
    expect(modelStore.getState().past).toEqual([]);
  });

  it('leaves an unplaced flow out of the selection', () => {
    const hiddenFlow: Flow = {
      kind: 'flow',
      id: elementId('flow-hidden'),
      name: 'Hidden flow',
      description: '',
      outOfScope: false,
      reasonOutOfScope: '',
      source: { kind: 'attached', element: requestFlow },
      target: { kind: 'attached', element: actorElement },
      waypoints: [],
      bidirectional: false,
    };
    const model: Model = {
      ...canvasModel,
      diagrams: [
        {
          ...canvasModel.diagrams[0],
          elements: [...canvasModel.diagrams[0].elements, hiddenFlow],
        },
      ],
    };
    modelStore.setState(initialState(model), true);

    selectAll();

    expect(modelStore.getState().selection).not.toContain(hiddenFlow.id);
  });
});
