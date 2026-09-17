import { act, fireEvent, render, screen } from '@testing-library/react';
import { Action } from '../store/actions.js';
import { dispatch, modelStore } from '../store/store.js';
import { laidOutNode, openCanvas, requestFlow } from './canvas.fixtures.js';
import { DiagramCanvas } from './diagram-canvas.js';
import { currentLayout } from './layout.js';
import { actorElement } from '../store/store.fixtures.js';

const press = (key: string, shiftKey = false): void => {
  fireEvent.keyDown(document.activeElement ?? document.body, { key, shiftKey });
};

const points = () =>
  currentLayout(modelStore.getState()).edges.find(
    (edge) => edge.id === requestFlow,
  )?.waypoints;

const add = (): void => {
  fireEvent.click(screen.getByRole('button', { name: 'Add bend' }));
};

function pointerOn(element: Element, type: string, x: number, y: number): void {
  const event = new MouseEvent(type, {
    bubbles: true,
    clientX: x,
    clientY: y,
    button: 0,
  });
  Object.defineProperties(event, {
    isPrimary: { value: true },
    pointerId: { value: 1 },
  });
  fireEvent(element, event);
}

const bend = () => screen.getByRole('button', { name: 'Bend 1' });

const sourceEnd = () => screen.getByRole('button', { name: 'Flow source end' });

const source = () => {
  const flow = modelStore
    .getState()
    .present.diagrams[0].elements.find((element) => element.id === requestFlow);
  return flow?.kind === 'flow' ? flow.source : undefined;
};

beforeEach(() => {
  openCanvas([requestFlow]);
});

describe('DiagramCanvas, adding a bend to a flow', () => {
  it('keeps insertion keys and clicks separate from typing and unrelated controls', () => {
    render(<DiagramCanvas />);
    add();
    press('x');
    fireEvent.click(
      document.querySelector('.react-flow__pane') ?? document.body,
    );
    fireEvent.click(document.body);
    expect(document.querySelector('[data-chosen="true"]')).not.toBeNull();
    press('Enter');
    press('x');
    const before = modelStore.getState();
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: 'ArrowRight',
      ctrlKey: true,
    });
    const input = document.createElement('input');
    document.body.append(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(document.body, { key: 'ArrowDown' });
    input.remove();
    pointerOn(
      screen.getByRole('button', { name: 'Add bend' }),
      'pointerdown',
      0,
      0,
    );
    expect(modelStore.getState()).toBe(before);
    press('Enter');
    expect(points()).toEqual([{ x: 210, y: 30 }]);
    fireEvent.click(bend());
    fireEvent.click(
      document.querySelector('.react-flow__pane') ?? document.body,
    );
    expect(screen.getByRole('button', { name: 'Remove bend' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    add();
    fireEvent.click(bend());
    expect(document.querySelector('[data-chosen="true"]')).not.toBeNull();
    press('Escape');
    expect(modelStore.getState().past).toHaveLength(1);
  });

  it('confirms a clicked preview without treating its index as a stored bend', () => {
    render(<DiagramCanvas />);
    add();
    press('Enter');
    press('ArrowDown');
    fireEvent.click(bend());
    expect(points()).toEqual([{ x: 210, y: 35 }]);
    expect(modelStore.getState().past).toHaveLength(1);
    add();
    press('Enter');
    press('ArrowDown');
    fireEvent.click(screen.getByRole('button', { name: 'Bend 2' }));
    expect(points()).toHaveLength(2);
    expect(points()?.[1]).toEqual({ x: 210, y: 35 });
    expect(modelStore.getState().past).toHaveLength(2);
    expect(screen.queryByRole('group', { name: 'Bend actions' })).toBeNull();
  });

  it('inserts at the chosen segment with keyboard preview, cancellation, and one commit', () => {
    render(<DiagramCanvas />);
    add();
    press('ArrowLeft');
    press('Enter');
    press('ArrowUp');
    press('ArrowRight', true);
    press('ArrowLeft');
    expect(points()).toEqual([]);
    expect(screen.getByRole('button', { name: 'Bend 1' })).toBeTruthy();
    press('Enter');
    expect(points()).toEqual([{ x: 225, y: 25 }]);
    expect(modelStore.getState().past).toHaveLength(1);
    add();
    press('ArrowRight');
    press('Enter');
    press('ArrowDown', true);
    press('Escape');
    expect(points()).toEqual([{ x: 225, y: 25 }]);
    expect(modelStore.getState().past).toHaveLength(1);
    add();
    press('Tab');
    expect(document.querySelector('[data-chosen]')).toBeNull();
  });

  it('wires line and handle pointer gestures and preserves Shift-click deselection', () => {
    render(<DiagramCanvas />);
    const segment =
      document.querySelector('[data-bend-segment="0"]') ?? document.body;
    pointerOn(segment, 'pointerdown', 200, 30);
    pointerOn(segment, 'pointermove', 220, 60);
    expect(points()).toEqual([]);
    pointerOn(segment, 'pointercancel', 220, 60);
    expect(screen.queryByRole('button', { name: 'Bend 1' })).toBeNull();
    pointerOn(segment, 'pointerdown', 200, 30);
    pointerOn(segment, 'pointermove', 220, 60);
    pointerOn(segment, 'pointerup', 220, 60);
    const committed = points();
    expect(committed).toHaveLength(1);
    const handle = bend();
    pointerOn(handle, 'pointerdown', 220, 60);
    pointerOn(handle, 'pointermove', 230, 80);
    pointerOn(handle, 'pointercancel', 230, 80);
    expect(points()).toEqual(committed);
    fireEvent.doubleClick(handle);
    expect(modelStore.getState().inlineEditor).toBeUndefined();
    fireEvent.click(segment);
    fireEvent.click(segment, { shiftKey: true });
    expect(modelStore.getState().selection).toEqual([]);
    expect(points()).toEqual(committed);
  });

  it('places and moves a bend with clicks', () => {
    render(<DiagramCanvas />);
    add();
    const segment = document.querySelector('[data-bend-segment="0"]');
    expect(segment).not.toBeNull();
    fireEvent.click(segment ?? document.body);
    const pane = document.querySelector('.react-flow__pane') ?? document.body;
    fireEvent.pointerDown(pane);
    fireEvent.click(pane, { clientX: 250, clientY: 100 });
    const placed = points();
    expect(placed).toHaveLength(1);
    fireEvent.click(bend());
    fireEvent.click(screen.getByRole('button', { name: 'Move bend' }));
    fireEvent.click(pane, { clientX: 270, clientY: 120 });
    expect(points()).toHaveLength(1);
    expect(points()).not.toEqual(placed);
  });

  it('drops a preview when another element is selected, leaving the model as it was', () => {
    render(<DiagramCanvas />);
    const committed = modelStore.getState().present;
    add();
    press('Enter');
    press('ArrowUp');
    act(() => {
      dispatch(Action.Select({ elementIds: [actorElement] }));
    });
    expect(screen.queryByRole('button', { name: 'Add bend' })).toBeNull();
    expect(modelStore.getState().present).toBe(committed);
  });

  it('cancels a preview on a window blur and on its Cancel action', () => {
    render(<DiagramCanvas />);
    add();
    press('Enter');
    press('ArrowDown');
    fireEvent.blur(window);
    expect(points()).toEqual([]);
    add();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(points()).toEqual([]);
  });

  it('keeps the flow rename action on a double-click of its line', () => {
    render(<DiagramCanvas />);
    const segment = document.querySelector('[data-bend-segment="0"]');
    fireEvent.doubleClick(segment ?? document.body);
    expect(modelStore.getState().inlineEditor).toEqual({
      kind: 'name',
      elementId: requestFlow,
    });
    expect(screen.queryByRole('button', { name: 'Add bend' })).toBeNull();
  });
});

describe('DiagramCanvas, a bend on a flow', () => {
  it('nudges a focused bend and keeps deletion and actions local to that bend', () => {
    render(<DiagramCanvas />);
    add();
    press('Enter');
    press('ArrowDown');
    press('Enter');
    bend().focus();
    press('ArrowUp', true);
    press('ArrowLeft');
    expect(points()).toEqual([{ x: 205, y: 15 }]);
    fireEvent.click(bend());
    expect(screen.getByRole('button', { name: 'Remove bend' })).toBe(
      document.activeElement,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Move bend' }));
    press('ArrowRight');
    press('Enter');
    expect(points()).toEqual([{ x: 210, y: 15 }]);
    fireEvent.click(bend());
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('group', { name: 'Bend actions' })).toBeNull();
    bend().focus();
    press('Backspace');
    expect(points()).toEqual([]);
    expect(
      modelStore
        .getState()
        .present.diagrams[0].elements.some(
          (element) => element.id === requestFlow,
        ),
    ).toBe(true);
    add();
    press('Enter');
    press('Enter');
    fireEvent.click(bend());
    fireEvent.click(screen.getByRole('button', { name: 'Remove bend' }));
    expect(points()).toEqual([]);
  });
});

describe('DiagramCanvas, the ends of a flow', () => {
  it('pins a flow end to a side by arrow key once, and releases it by Delete', () => {
    render(<DiagramCanvas />);
    expect(
      screen.queryByRole('button', { name: 'Flow target end' }),
    ).not.toBeNull();
    sourceEnd().focus();
    press('ArrowDown');
    expect(source()).toEqual({
      kind: 'attached',
      element: actorElement,
      side: 'bottom',
    });
    expect(modelStore.getState().past).toHaveLength(1);
    press('ArrowDown');
    expect(modelStore.getState().past).toHaveLength(1);
    sourceEnd().focus();
    press('Delete');
    expect(source()).toEqual({ kind: 'attached', element: actorElement });
  });

  it('pins a flow end to a side through its actions, which close once chosen', () => {
    render(<DiagramCanvas />);
    fireEvent.click(sourceEnd());
    expect(
      screen.getByRole('group', { name: 'Flow end actions' }),
    ).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Follow the route' })).toBe(
      document.activeElement,
    );
    press('Tab');
    expect(
      screen.queryByRole('group', { name: 'Flow end actions' }),
    ).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Top' }));
    expect(source()).toMatchObject({ side: 'top' });
    expect(
      screen.queryByRole('group', { name: 'Flow end actions' }),
    ).toBeNull();
  });

  it('pins a flow end to the side it is dragged to, on release alone', () => {
    render(<DiagramCanvas />);
    const before = modelStore.getState().present;
    const reader = laidOutNode(actorElement);
    pointerOn(sourceEnd(), 'pointerdown', 100, 100);
    pointerOn(
      sourceEnd(),
      'pointermove',
      100 + reader.position.x + reader.size.width,
      100 + reader.position.y + reader.size.height / 2,
    );
    expect(modelStore.getState().present).toBe(before);
    pointerOn(
      sourceEnd(),
      'pointerup',
      100 + reader.position.x + reader.size.width,
      100 + reader.position.y + reader.size.height / 2,
    );
    expect(source()).toMatchObject({ side: 'right' });
  });
});
