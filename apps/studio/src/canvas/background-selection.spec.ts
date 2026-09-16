import { act, renderHook } from '@testing-library/react';
import { actorElement } from '../store/store.fixtures.js';
import { modelStore } from '../store/store.js';
import { useBackgroundSelection } from './background-selection.js';
import { currentAnnouncement } from './announcements.js';
import { selectTool } from './tools.js';
import { canvasModel, openCanvas, primaryPointer } from './canvas.fixtures.js';

const pane = document.createElement('div');
pane.className = 'react-flow__pane';
const event = primaryPointer({ x: 10, y: 10 }, { target: pane });

beforeEach(() => {
  openCanvas([actorElement]);
});

it.each(['select', 'hand'] as const)(
  'clears selection in %s without changing the model or history',
  (tool) => {
    if (tool === 'hand') {
      selectTool(tool);
    }
    const { result } = renderHook(useBackgroundSelection);
    act(() => {
      result.current.down(event);
      result.current.up(event);
    });
    expect(modelStore.getState().selection).toEqual([]);
    expect(modelStore.getState().present).toBe(canvasModel);
    expect(modelStore.getState().past).toEqual([]);
    expect(currentAnnouncement().message).toContain('cleared');
  },
);

it('preserves selection after a pan even when the pointer returns to its starting point', () => {
  const { result } = renderHook(useBackgroundSelection);
  act(() => {
    result.current.down(event);
    result.current.move({ ...event, clientX: 40 });
    result.current.up(event);
  });
  expect(modelStore.getState().selection).toEqual([actorElement]);
});

it('does not interpret a second touch or cancelled gesture as a tap', () => {
  const { result } = renderHook(useBackgroundSelection);
  act(() => {
    result.current.down(event);
    result.current.down({ ...event, isPrimary: false, pointerId: 2 });
    result.current.up(event);
  });
  expect(modelStore.getState().selection).toEqual([actorElement]);
  act(() => {
    result.current.down(event);
    result.current.cancel();
    result.current.up(event);
  });
  expect(modelStore.getState().selection).toEqual([actorElement]);
});

it('leaves placement and presses that change tools alone', () => {
  const { result } = renderHook(useBackgroundSelection);
  act(() => {
    result.current.down(event);
    selectTool('actor');
    result.current.up(event);
  });
  expect(modelStore.getState().selection).toEqual([actorElement]);
  act(() => {
    result.current.down(event);
    result.current.up(event);
  });
  expect(modelStore.getState().selection).toEqual([actorElement]);
});
