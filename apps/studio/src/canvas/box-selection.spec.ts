import { act, renderHook } from '@testing-library/react';
import { actorElement } from '../store/store.fixtures.js';
import { modelStore } from '../store/store.js';
import { useBoxSelection } from './box-selection.js';
import { openCanvas, primaryPointer, requestFlow } from './canvas.fixtures.js';

const svg = 'http://www.w3.org/2000/svg';

const surface = document.createElement('div');
const pane = document.createElement('div');
pane.className = 'react-flow__pane';
const flow = document.createElementNS(svg, 'g');
flow.setAttribute('class', 'react-flow__edge');
flow.setAttribute('data-id', 'edge-request');
surface.append(pane, flow);

const elements = new Map([['edge-request', requestFlow]]);

const twiceAsLarge = { a: 2, b: 0, c: 0, d: 2, e: 100, f: 50 };

const drawnAt = (
  geometry: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  },
  toScreen: typeof twiceAsLarge | null = twiceAsLarge,
): void => {
  Object.defineProperties(flow, {
    getBBox: { configurable: true, value: () => geometry },
    getScreenCTM: { configurable: true, value: () => toScreen },
  });
};

const boxed = (
  from: readonly [number, number],
  to: readonly [number, number],
) => {
  const { result } = renderHook(() =>
    useBoxSelection({ current: surface }, elements),
  );
  act(() => {
    result.current.pointerDown(
      primaryPointer(
        { x: from[0], y: from[1] },
        { target: pane, pointerType: 'mouse' },
      ),
      'select',
    );
    result.current.onSelectionStart();
    result.current.onSelectionEnd({ clientX: to[0], clientY: to[1] });
  });
};

beforeEach(() => {
  openCanvas([actorElement]);
  drawnAt({ x: 10, y: 20, width: 40, height: 5 });
  vi.spyOn(flow, 'getBoundingClientRect').mockReturnValue(
    DOMRect.fromRect({ x: 40, y: 10, width: 240, height: 170 }),
  );
});

describe('useBoxSelection', () => {
  it('adds a flow whose geometry the box contains, whatever its client rect takes in', () => {
    boxed([110, 80], [210, 110]);

    expect(modelStore.getState().selection).toEqual([
      actorElement,
      requestFlow,
    ]);
  });

  it('leaves out a flow whose geometry crosses the box', () => {
    boxed([110, 80], [190, 110]);

    expect(modelStore.getState().selection).toEqual([actorElement]);
  });

  it('leaves out a flow the browser draws nowhere', () => {
    drawnAt({ x: 10, y: 20, width: 40, height: 5 }, null);

    boxed([110, 80], [210, 110]);

    expect(modelStore.getState().selection).toEqual([actorElement]);
  });
});
