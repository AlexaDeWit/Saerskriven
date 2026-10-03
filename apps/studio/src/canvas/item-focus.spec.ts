import { unmountedSurface } from '../commands/binding.js';
import { actorElement } from '../store/store.fixtures.js';
import { modelStore } from '../store/store.js';
import { openCanvas } from './canvas.fixtures.js';
import { selectToolOnItem } from './item-focus.js';
import { currentLayout } from './layout.js';
import { elementIds } from './nodes.js';

const canvas = document.createElement('div');
canvas.className = 'react-flow';
canvas.tabIndex = -1;

const node = document.createElement('div');
node.className = 'react-flow__node';
node.dataset['id'] = actorElement;
node.tabIndex = 0;

const resizeControl = document.createElement('button');
const nameField = document.createElement('textarea');
node.append(resizeControl, nameField);

const selectionFrame = document.createElement('div');
selectionFrame.className = 'react-flow__nodesselection';
const frameRect = document.createElement('div');
frameRect.tabIndex = -1;
selectionFrame.append(frameRect);

const besideSelection = ['data-bend-index', 'data-curve-point'].map(
  (attribute) => {
    const handle = document.createElement('button');
    handle.setAttribute(attribute, '0');
    return handle;
  },
);

const selectionCommands = document.createElement('section');
selectionCommands.dataset['selectionCommands'] = '';
const shapeCommand = document.createElement('button');
selectionCommands.append(shapeCommand);

canvas.append(node, selectionFrame, ...besideSelection);
document.body.append(canvas, selectionCommands);

const press = (key: string, on: HTMLElement) => {
  on.focus();
  const nativeEvent = new KeyboardEvent('keydown', { key, bubbles: true });
  on.dispatchEvent(nativeEvent);
  return {
    nativeEvent,
    target: on,
    preventDefault: vi.fn<() => void>(),
    stopPropagation: vi.fn<() => void>(),
  };
};

const answered = (key: string, on: HTMLElement) => {
  const event = press(key, on);
  return {
    event,
    ran: selectToolOnItem(
      event,
      elementIds(currentLayout(modelStore.getState())),
      unmountedSurface,
    ),
  };
};

beforeEach(() => {
  openCanvas([actorElement]);
});

describe('selectToolOnItem', () => {
  it('runs the Select tool from a drawn element, keeping focus there and the press from React Flow', () => {
    const { event, ran } = answered('Escape', node);

    expect(ran).toBe(true);
    expect(modelStore.getState().selection).toEqual([]);
    expect(document.activeElement).toBe(node);
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('moves focus from a control inside an element to the element, for every Select key', () => {
    expect(answered('Escape', resizeControl).ran).toBe(true);
    expect(document.activeElement).toBe(node);

    openCanvas([actorElement]);
    expect(answered('v', resizeControl).ran).toBe(true);
    expect(document.activeElement).toBe(node);
    expect(modelStore.getState().selection).toEqual([]);
  });

  it('moves focus from a handle or command beside the selected element to the element', () => {
    for (const control of [...besideSelection, shapeCommand]) {
      openCanvas([actorElement]);

      expect(answered('Escape', control).ran).toBe(true);
      expect(document.activeElement).toBe(node);
      expect(modelStore.getState().selection).toEqual([]);
    }
  });

  it('moves focus from the frame around a box selection to the canvas', () => {
    expect(answered('Escape', frameRect).ran).toBe(true);

    expect(document.activeElement).toBe(canvas);
    expect(modelStore.getState().selection).toEqual([]);
  });

  it('leaves a text field, another key and the canvas itself to their own handlers', () => {
    const presses = [
      answered('Escape', nameField),
      answered('Enter', node),
      answered('Escape', canvas),
    ];

    expect(presses.map(({ ran }) => ran)).toEqual([false, false, false]);
    expect(modelStore.getState().selection).toEqual([actorElement]);
    for (const { event } of presses) {
      expect(event.stopPropagation).not.toHaveBeenCalled();
    }
  });
});
