import { act, fireEvent, render, screen } from '@testing-library/react';
import { currentAnnouncement } from './announcements.js';
import { Action } from '../store/actions.js';
import { dispatch, modelStore } from '../store/store.js';
import {
  laidOutNode,
  noteElement,
  openCanvas,
  requestFlow,
} from './canvas.fixtures.js';
import { DiagramCanvas } from './diagram-canvas.js';
import { currentLayout } from './layout.js';
import {
  actorElement,
  heldElements,
  processElement,
} from '../store/store.fixtures.js';

const reader = (): HTMLElement =>
  screen.getByRole('group', { name: /^Reader, actor/u });

const note = (): HTMLElement =>
  screen.getByRole('group', { name: /^Note, text/u });

const readerBox = () => {
  const { position, size } = laidOutNode(actorElement);
  return { position, size };
};

const resizeControl = (from: string): HTMLElement =>
  screen.getByRole('button', { name: `Resize Reader from ${from}` });

describe('DiagramCanvas', () => {
  beforeEach(() => {
    openCanvas();
  });

  it('mounts one node per element, each named from the model', () => {
    render(<DiagramCanvas />);

    expect(screen.getAllByRole('group')).toHaveLength(
      currentLayout(modelStore.getState()).nodes.length,
    );
    expect(
      screen.getAllByRole('group', {
        name: 'Reader, actor, 1 open threat, highest severity medium',
      }),
    ).toHaveLength(1);
    expect(
      screen.getAllByRole('group', { name: 'Studio, process' }),
    ).toHaveLength(1);
  });

  it('reaches every element by keyboard', () => {
    render(<DiagramCanvas />);

    expect(
      screen
        .getAllByRole('group')
        .map((group) => group.getAttribute('tabindex')),
    ).toEqual(currentLayout(modelStore.getState()).nodes.map(() => '0'));
  });

  it('draws the selection the store holds', () => {
    openCanvas([actorElement]);
    render(<DiagramCanvas />);

    expect(reader().classList.contains('selected')).toBe(true);
  });

  it('selects the element that was clicked, through the store', () => {
    render(<DiagramCanvas />);

    fireEvent.click(reader());

    expect(modelStore.getState().selection).toEqual([actorElement]);
    expect(reader().classList.contains('selected')).toBe(true);
  });

  it('draws a selection the store moves to after it has mounted', () => {
    render(<DiagramCanvas />);

    act(() => {
      dispatch(Action.Select({ elementIds: [actorElement] }));
    });

    expect(reader().classList.contains('selected')).toBe(true);
  });

  it('removes the selected element on the delete key, and says what went with it', () => {
    openCanvas([actorElement]);
    render(<DiagramCanvas />);

    fireEvent.keyDown(reader(), { key: 'Delete' });

    expect(heldElements()).toBe(5);
    expect(currentAnnouncement().message).not.toBe('');
  });

  it('removes the selected flow on the backspace key', () => {
    openCanvas([requestFlow]);
    render(<DiagramCanvas />);

    fireEvent.keyDown(screen.getByTestId('rf__wrapper'), { key: 'Backspace' });

    expect(heldElements()).toBe(5);
  });

  it('leaves the model alone on the delete key while nothing is selected', () => {
    render(<DiagramCanvas />);

    fireEvent.keyDown(reader(), { key: 'Delete' });

    expect(heldElements()).toBe(6);
    expect(currentAnnouncement().message).toBe('');
  });

  it('draws the threat panel over itself while an element is selected', () => {
    render(<DiagramCanvas />);
    expect(screen.queryByRole('region', { name: 'Threats' })).toBeNull();

    act(() => {
      dispatch(Action.Select({ elementIds: [actorElement] }));
    });

    expect(screen.getByRole('region', { name: 'Threats' })).toBeDefined();
    expect(
      screen
        .getByTestId('canvas-container')
        .contains(screen.getByTestId('threat-panel')),
    ).toBe(true);
  });

  it('opens the selected element name on Enter', () => {
    openCanvas([actorElement]);
    render(<DiagramCanvas />);

    fireEvent.keyDown(reader(), { key: 'Enter' });

    expect(modelStore.getState().inlineEditor).toEqual({
      kind: 'name',
      elementId: actorElement,
    });
    expect(screen.getByRole('textbox', { name: 'Name of Reader' })).toBe(
      document.activeElement,
    );
  });

  it('opens the selected Note prose on Enter', () => {
    openCanvas([noteElement]);
    render(<DiagramCanvas />);

    fireEvent.keyDown(note(), { key: 'Enter' });

    expect(modelStore.getState().inlineEditor).toEqual({
      kind: 'note',
      elementId: noteElement,
    });
    expect(screen.getByRole('textbox', { name: 'Note text' })).toBe(
      document.activeElement,
    );
  });

  it('leaves Enter to React Flow where the press is what selects the element', () => {
    render(<DiagramCanvas />);
    reader().focus();

    fireEvent.keyDown(reader(), { key: 'Enter' });

    expect(modelStore.getState().selection).toEqual([actorElement]);
    expect(document.activeElement).toBe(reader());
  });

  it('leaves Space to select without opening the text editor', () => {
    render(<DiagramCanvas />);
    reader().focus();

    fireEvent.keyDown(reader(), { key: ' ' });

    expect(modelStore.getState().selection).toEqual([actorElement]);
    expect(modelStore.getState().inlineEditor).toBeUndefined();

    fireEvent.keyDown(reader(), { key: ' ' });

    expect(modelStore.getState().inlineEditor).toBeUndefined();
  });

  it('reduces a group to the element clicked or activated with Enter', () => {
    openCanvas([actorElement, processElement]);
    render(<DiagramCanvas />);

    fireEvent.click(reader());
    expect(modelStore.getState().selection).toEqual([actorElement]);

    act(() => {
      dispatch(Action.Select({ elementIds: [actorElement, processElement] }));
    });
    fireEvent.keyDown(reader(), { key: 'Enter' });
    expect(modelStore.getState().selection).toEqual([actorElement]);
  });

  it('toggles a focused element with Shift+Enter', () => {
    openCanvas([actorElement, processElement]);
    render(<DiagramCanvas />);

    fireEvent.keyDown(reader(), { key: 'Enter', shiftKey: true });
    expect(modelStore.getState().selection).toEqual([processElement]);

    fireEvent.keyDown(reader(), { key: 'Enter', shiftKey: true });
    expect(modelStore.getState().selection).toEqual([
      processElement,
      actorElement,
    ]);
  });

  it('settles a keyboard move through the transient edge path', () => {
    openCanvas([actorElement]);
    render(<DiagramCanvas />);

    fireEvent.keyDown(reader(), { key: 'ArrowRight' });

    expect(modelStore.getState().past).toHaveLength(1);
  });

  it.each([
    [
      'top',
      'ArrowUp',
      { position: { x: 0, y: -5 }, size: { width: 120, height: 65 } },
    ],
    [
      'right',
      'ArrowRight',
      { position: { x: 0, y: 0 }, size: { width: 125, height: 60 } },
    ],
    [
      'bottom',
      'ArrowDown',
      { position: { x: 0, y: 0 }, size: { width: 120, height: 65 } },
    ],
    [
      'left',
      'ArrowLeft',
      { position: { x: -5, y: 0 }, size: { width: 125, height: 60 } },
    ],
  ] as const)(
    'resizes from the %s by keyboard with the opposite side fixed',
    (from, key, expected) => {
      openCanvas([actorElement]);
      render(<DiagramCanvas />);

      fireEvent.keyDown(resizeControl(from), { key });

      expect(readerBox()).toEqual(expected);
      expect(modelStore.getState().past).toHaveLength(1);
    },
  );

  it('shrinks in the reverse direction and undo restores the full box', () => {
    openCanvas([actorElement]);
    render(<DiagramCanvas />);
    const before = readerBox();

    fireEvent.keyDown(resizeControl('top'), { key: 'ArrowDown' });

    expect(readerBox()).toEqual({
      position: { x: 0, y: 5 },
      size: { width: 120, height: 55 },
    });
    act(() => {
      dispatch(Action.Undo());
    });
    expect(readerBox()).toEqual(before);
  });

  it('clears a selected flow when the pointer lands on nothing', () => {
    openCanvas([requestFlow]);
    render(<DiagramCanvas />);
    const pane = document.querySelector('.react-flow__pane');
    expect(pane).not.toBeNull();

    fireEvent.pointerDown(pane ?? document.body, {
      button: 0,
      isPrimary: true,
      pointerId: 1,
    });
    fireEvent.pointerUp(pane ?? document.body, {
      button: 0,
      isPrimary: true,
      pointerId: 1,
    });

    expect(modelStore.getState().selection).toEqual([]);
  });

  it('opens the name of a node in a field on the second click of a pair', () => {
    render(<DiagramCanvas />);

    fireEvent.click(reader(), { detail: 1 });
    fireEvent.click(reader(), { detail: 2 });

    expect(modelStore.getState().inlineEditor).toEqual({
      kind: 'name',
      elementId: actorElement,
    });
  });

  it('opens a Note prose field on the second click of a pair', () => {
    render(<DiagramCanvas />);

    fireEvent.click(note(), { detail: 1 });
    fireEvent.click(note(), { detail: 2 });

    expect(modelStore.getState().inlineEditor).toEqual({
      kind: 'note',
      elementId: noteElement,
    });
  });

  it('describes the canvas keys React Flow exposes with each item', () => {
    render(<DiagramCanvas />);

    const nodeDescription = document.querySelector(
      '[id^="react-flow__node-desc"]',
    );
    const flowDescription = document.querySelector(
      '[id^="react-flow__edge-desc"]',
    );

    expect(nodeDescription?.textContent).toContain('Enter or Space');
    expect(nodeDescription?.textContent).toContain(
      'Edit the selected canvas text: Enter',
    );
    expect(nodeDescription?.textContent).toContain('Hand: H or Space');
    expect(nodeDescription?.textContent).toContain('Focus threats: T');
    expect(flowDescription?.textContent).toContain(
      'Edit the selected canvas text: Enter',
    );
  });

  it('leaves a click on a canvas control out of the rename gesture', () => {
    render(<DiagramCanvas />);

    fireEvent.click(reader(), { detail: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }), {
      detail: 2,
    });

    expect(modelStore.getState().inlineEditor).toBeUndefined();
  });
});
