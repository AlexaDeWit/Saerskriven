import { act, renderHook } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { useRef } from 'react';
import { Action } from '../store/actions.js';
import { dispatch, modelStore } from '../store/store.js';
import { openCanvas, primaryPointer, requestFlow } from './canvas.fixtures.js';
import { useFlowBendInteraction } from './flow-bend-interaction.js';
import { useFlowBends } from './flow-bends.js';
import { actorElement } from '../store/store.fixtures.js';

const button = document.createElement('button');
const target = { kind: 'insert' as const, index: 0, point: { x: 200, y: 30 } };
const renderBends = () =>
  renderHook(
    () => {
      const bends = useFlowBends();
      const toolbar = useRef<HTMLFieldSetElement>(null);
      return {
        bends,
        controls: useFlowBendInteraction(
          bends,
          bends.layout.edges.find((edge) => edge.id === requestFlow),
          toolbar,
        ),
      };
    },
    { wrapper: ReactFlowProvider },
  );

beforeEach(() => {
  openCanvas([requestFlow]);
});

it('holds a drag outside history until release, then moves that bend independently', () => {
  const { result } = renderBends();
  const before = modelStore.getState().present;
  act(() => {
    result.current.controls.down(
      primaryPointer({ x: 100, y: 100 }, { currentTarget: button }),
      target,
    );
  });
  act(() => {
    result.current.controls.move(
      primaryPointer({ x: 102, y: 101 }, { currentTarget: button }),
    );
  });
  expect(result.current.bends.draft).toBeUndefined();
  act(() => {
    result.current.controls.move(
      primaryPointer(
        { x: 140, y: 160 },
        { currentTarget: button, pointerId: 2 },
      ),
    );
  });
  expect(result.current.bends.draft).toBeUndefined();
  act(() => {
    result.current.controls.move(
      primaryPointer({ x: 140, y: 160 }, { currentTarget: button }),
    );
  });
  expect(result.current.bends.draft).toMatchObject({
    point: { x: 240, y: 90 },
  });
  expect(modelStore.getState().present).toBe(before);
  act(() => {
    result.current.controls.up(
      primaryPointer(
        { x: 140, y: 160 },
        { currentTarget: button, pointerId: 2 },
      ),
    );
  });
  expect(modelStore.getState().present).toBe(before);
  act(() => {
    result.current.controls.up(
      primaryPointer({ x: 140, y: 160 }, { currentTarget: button }),
    );
  });
  expect(result.current.bends.flow?.waypoints).toEqual([{ x: 240, y: 90 }]);
  expect(modelStore.getState().past).toHaveLength(1);
  act(() => {
    result.current.controls.down(
      primaryPointer({ x: 140, y: 160 }, { currentTarget: button }),
      {
        kind: 'move',
        index: 0,
        point: { x: 240, y: 90 },
      },
    );
  });
  act(() => {
    result.current.controls.move(
      primaryPointer({ x: 150, y: 180 }, { currentTarget: button }),
    );
  });
  act(() => {
    result.current.controls.up(
      primaryPointer({ x: 150, y: 180 }, { currentTarget: button }),
    );
  });
  expect(result.current.bends.flow?.waypoints).toEqual([{ x: 250, y: 110 }]);
  expect(modelStore.getState().past).toHaveLength(2);
});

it('ignores secondary pointers, stationary clicks, and returned drags', () => {
  const { result } = renderBends();
  act(() => {
    result.current.controls.down(
      {
        ...primaryPointer({ x: 100, y: 100 }, { currentTarget: button }),
        button: 2,
      },
      target,
    );
  });
  act(() => {
    result.current.controls.move(
      primaryPointer({ x: 140, y: 160 }, { currentTarget: button }),
    );
    result.current.controls.up(
      primaryPointer({ x: 140, y: 160 }, { currentTarget: button }),
    );
  });
  expect(result.current.bends.flow?.waypoints).toEqual([]);
  act(() => {
    result.current.controls.down(
      primaryPointer({ x: 100, y: 100 }, { currentTarget: button }),
      target,
    );
    result.current.controls.up(
      primaryPointer({ x: 100, y: 100 }, { currentTarget: button }),
    );
  });
  expect(modelStore.getState().past).toHaveLength(0);
  act(() => {
    result.current.controls.down(
      primaryPointer({ x: 100, y: 100 }, { currentTarget: button }),
      target,
    );
  });
  act(() => {
    result.current.controls.move(
      primaryPointer({ x: 140, y: 160 }, { currentTarget: button }),
    );
  });
  act(() => {
    result.current.controls.up(
      primaryPointer({ x: 100, y: 100 }, { currentTarget: button }),
    );
  });
  expect(result.current.bends.draft).toBeUndefined();
  expect(modelStore.getState().past).toHaveLength(0);
});

it('cancels a pointer gesture and rejects its release after the selection changes', () => {
  const { result } = renderBends();
  act(() => {
    result.current.controls.down(
      primaryPointer({ x: 100, y: 100 }, { currentTarget: button }),
      target,
    );
  });
  act(() => {
    result.current.controls.move(
      primaryPointer({ x: 140, y: 160 }, { currentTarget: button }),
    );
  });
  act(() => {
    result.current.controls.cancel();
  });
  act(() => {
    result.current.controls.up(
      primaryPointer({ x: 140, y: 160 }, { currentTarget: button }),
    );
  });
  expect(result.current.bends.draft).toBeUndefined();
  expect(modelStore.getState().past).toHaveLength(0);
  act(() => {
    result.current.controls.down(
      primaryPointer({ x: 100, y: 100 }, { currentTarget: button }),
      target,
    );
  });
  act(() => {
    dispatch(Action.Select({ elementIds: [actorElement] }));
  });
  act(() => {
    result.current.controls.move(
      primaryPointer({ x: 140, y: 160 }, { currentTarget: button }),
    );
    result.current.controls.up(
      primaryPointer({ x: 140, y: 160 }, { currentTarget: button }),
    );
  });
  expect(modelStore.getState().past).toHaveLength(0);
});
