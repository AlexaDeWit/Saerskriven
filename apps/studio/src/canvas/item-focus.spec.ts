import type { ElementId } from '@saerskriven/model';
import { act, render, screen } from '@testing-library/react';
import { createElement, type FunctionComponent } from 'react';
import { unmountedSurface } from '../commands/binding.js';
import { actorElement, processElement } from '../store/store.fixtures.js';
import { modelStore } from '../store/store.js';
import { boundaryElement, openCanvas, requestFlow } from './canvas.fixtures.js';
import { commandOnItem } from './item-focus.js';
import { currentLayout } from './layout.js';
import { elementIds } from './nodes.js';
import {
  BoundaryShapeCommands,
  FlowEndpointCommands,
} from './selection-controls.js';

const canvas = document.createElement('div');
canvas.className = 'react-flow';
canvas.tabIndex = -1;

const drawn = (className: string, id: ElementId): HTMLElement => {
  const item = document.createElement('div');
  item.className = className;
  item.dataset['id'] = id;
  item.tabIndex = 0;
  return item;
};

const node = drawn('react-flow__node', actorElement);
const flow = drawn('react-flow__edge', requestFlow);
const boundary = drawn('react-flow__node', boundaryElement);

const resizeControl = document.createElement('button');
const nameField = document.createElement('textarea');
node.append(resizeControl, nameField);

const selectionFrame = document.createElement('div');
selectionFrame.className = 'react-flow__nodesselection';
const frameRect = document.createElement('div');
frameRect.tabIndex = -1;
selectionFrame.append(frameRect);

const besideSelection = [
  'data-bend-index',
  'data-flow-end',
  'data-bend-toolbar',
  'data-curve-point',
].map((attribute) => {
  const holder = document.createElement('div');
  holder.setAttribute(attribute, '0');
  const control = document.createElement('button');
  holder.append(control);
  canvas.append(holder);
  return control;
});

canvas.append(node, flow, boundary, selectionFrame);
document.body.append(canvas);

const press = (
  key: string,
  on: HTMLElement,
  modifiers: KeyboardEventInit = {},
) => {
  on.focus();
  const nativeEvent = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    ...modifiers,
  });
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
    ran: commandOnItem(
      event,
      elementIds(currentLayout(modelStore.getState())),
      unmountedSurface,
    ),
  };
};

beforeEach(() => {
  openCanvas([actorElement]);
});

describe('commandOnItem', () => {
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

  it('moves focus from a handle or the route toolbar beside the selected element to the element', () => {
    for (const control of besideSelection) {
      openCanvas([actorElement]);

      expect(answered('Escape', control).ran).toBe(true);
      expect(document.activeElement).toBe(node);
      expect(modelStore.getState().selection).toEqual([]);
    }
  });

  it('moves focus from the flow endpoint and boundary shape commands to the element they act on', () => {
    const sections: readonly [
      FunctionComponent,
      ElementId,
      HTMLElement,
      string,
    ][] = [
      [FlowEndpointCommands, requestFlow, flow, 'Change flow source'],
      [
        BoundaryShapeCommands,
        boundaryElement,
        boundary,
        'Switch boundary shape',
      ],
    ];
    for (const [Commands, selected, item, name] of sections) {
      openCanvas([selected]);
      const { unmount } = render(createElement(Commands));
      const command = screen.getByRole('button', { name });

      act(() => {
        expect(answered('Escape', command).ran).toBe(true);
      });

      expect(document.activeElement).toBe(item);
      expect(modelStore.getState().selection).toEqual([]);
      unmount();
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

describe('modifier commands on a selection frame', () => {
  it('aligns before the frame handles the arrow and keeps its focus', () => {
    openCanvas([actorElement, processElement]);
    const before = modelStore.getState().present;
    const event = press('ArrowLeft', frameRect, {
      ctrlKey: true,
      shiftKey: true,
    });

    expect(
      commandOnItem(
        event,
        elementIds(currentLayout(modelStore.getState())),
        unmountedSurface,
      ),
    ).toBe(true);
    expect(
      currentLayout(modelStore.getState())
        .nodes.filter(({ id }) => [actorElement, processElement].includes(id))
        .map(({ position }) => position.x),
    ).toEqual([0, 0]);
    expect(modelStore.getState().past).toEqual([before]);
    expect(document.activeElement).toBe(frameRect);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopPropagation).toHaveBeenCalledOnce();
  });
});
