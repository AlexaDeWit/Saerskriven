import { layoutDiagram } from '@saerskriven/canvas';
import { diagramId, elementId, sharedModel } from '@saerskriven/model/fixtures';
import { act, render } from '@testing-library/react';
import { Action } from '../store/actions.js';
import { initialState } from '../store/state.js';
import { dispatch, modelStore } from '../store/store.js';
import { laidOutNode } from './canvas.fixtures.js';
import { DiagramCanvas } from './diagram-canvas.js';
import { SharedFlowMark } from './shared-mark.js';

const mark = '[data-shared-mark]';

const node = (id: string): Element | null =>
  document.querySelector(`.react-flow__node[data-id="${id}"]`);

const markOn = (id: string): string | null | undefined =>
  node(id)?.querySelector(`${mark} g`)?.getAttribute('transform');

describe('the mark on an element placed on more than one diagram', () => {
  beforeEach(() => {
    modelStore.setState(
      { ...initialState(sharedModel), activeDiagram: diagramId('overview') },
      true,
    );
  });

  it('is drawn on every placement of a shared element and on no other', () => {
    render(<DiagramCanvas />);

    for (const shared of ['payments-zone', 'payments-api', 'legend']) {
      expect(node(shared)?.querySelector(mark)).not.toBeNull();
    }
    for (const alone of ['customer', 'web-app']) {
      expect(node(alone)?.querySelector(mark)).toBeNull();
    }
  });

  it('hangs on the top left corner, past it while the element is selected, and is hidden from assistive technology', () => {
    render(<DiagramCanvas />);
    expect(markOn('payments-api')).toBe('translate(0 0)');
    expect(
      node('payments-api')?.querySelector(mark)?.getAttribute('aria-hidden'),
    ).toBe('true');

    act(() => {
      dispatch(Action.Select({ elementIds: [elementId('payments-api')] }));
    });

    expect(markOn('payments-api')).toBe('translate(-11 -11)');
  });

  it("draws a selected boundary box's mark in the viewport portal at the boundary's place, and in the boundary while unselected", () => {
    render(<DiagramCanvas />);
    const zone = elementId('payments-zone');
    const portal = document.querySelector('.react-flow__viewport-portal');
    expect(node(zone)?.querySelector(mark)).not.toBeNull();
    expect(portal?.querySelector(mark)).toBeNull();

    act(() => {
      dispatch(Action.Select({ elementIds: [zone] }));
    });
    const raised = portal?.querySelector<SVGElement>(mark);
    const { position } = laidOutNode(zone);

    expect(node(zone)?.querySelector(mark)).toBeNull();
    expect(raised?.style.left).toBe(`${String(position.x)}px`);
    expect(raised?.style.top).toBe(`${String(position.y)}px`);
  });

  it("stands left of a flow's name block, on the block's middle", () => {
    const charge = layoutDiagram(
      sharedModel.diagrams[0],
      sharedModel,
    ).edges.find(({ id }) => id === 'charge');
    assert.isDefined(charge);
    const { backing } = charge.label;
    assert.isDefined(backing);
    const { container } = render(
      <svg>
        <SharedFlowMark edge={charge} />
      </svg>,
    );

    expect(
      container.querySelector(`${mark} g`)?.getAttribute('transform'),
    ).toBe(
      `translate(${String(backing.minX - 11)} ${String((backing.minY + backing.maxY) / 2)})`,
    );
  });
});
