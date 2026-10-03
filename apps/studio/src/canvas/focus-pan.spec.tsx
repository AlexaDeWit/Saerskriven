import type { Box } from '@saerskriven/canvas';
import type { Point } from '@saerskriven/model';
import { render, waitFor } from '@testing-library/react';
import { ReactFlow, type Viewport } from '@xyflow/react';
import { StrictMode } from 'react';
import {
  clearingOffset,
  FocusPan,
  focusPanDuration,
  focusPanner,
  onKeyboardFocus,
  ringClearance,
  type FocusScene,
  type PannedView,
} from './focus-pan.js';

const box = (
  minX: number,
  minY: number,
  width: number,
  height: number,
): Box => ({
  minX,
  minY,
  maxX: minX + width,
  maxY: minY + height,
});

const canvas = box(0, 0, 1280, 720);

const card = box(12, 165, 42, 42);

const panel = box(808, 165, 460, 239);

const scene = (
  ring: Box,
  panes: readonly Box[] = [card, panel],
): FocusScene => ({
  ring,
  panes,
  canvas,
});

const underThePanelTop = scene(box(1056, 158, 30, 30));

const underThePanelSide = scene(box(800, 300, 30, 30));

const underTheCard = scene(box(14, 180, 20, 20));

const betweenTwoPanes = scene(box(104, 130, 20, 20), [
  box(100, 100, 100, 100),
  box(60, 100, 36, 100),
]);

const widerAndTallerThanTheRoom = scene(box(183, 82, 896, 364));

const moved = (ring: Box, by: Point): Box => ({
  minX: ring.minX + by.x,
  minY: ring.minY + by.y,
  maxX: ring.maxX + by.x,
  maxY: ring.maxY + by.y,
});

const clearAfter = ({ ring, panes, canvas: room }: FocusScene, by: Point) => {
  const at = moved(ring, by);
  return (
    at.minX >= room.minX &&
    at.minY >= room.minY &&
    at.maxX <= room.maxX &&
    at.maxY <= room.maxY &&
    panes.every(
      (pane) =>
        at.maxX <= pane.minX - ringClearance ||
        at.minX >= pane.maxX + ringClearance ||
        at.maxY <= pane.minY - ringClearance ||
        at.minY >= pane.maxY + ringClearance,
    )
  );
};

const wholePixelMovesWithin = (reach: number): Point[] =>
  Array.from(
    { length: 2 * reach + 1 },
    (unused, column) => column - reach,
  ).flatMap((x) =>
    Array.from({ length: 2 * reach + 1 }, (unused, row) => ({
      x,
      y: row - reach,
    })),
  );

describe('clearingOffset', () => {
  it('moves nothing for a ring no pane covers, however near', () => {
    for (const ring of [
      box(778, 300, 30, 30),
      box(55, 180, 20, 20),
      box(400, 300, 160, 90),
    ]) {
      expect(clearingOffset(scene(ring))).toBeUndefined();
    }
  });

  it('takes the shortest way out from under a pane, and stops the clearance short of it', () => {
    expect(clearingOffset(underThePanelTop)).toEqual({
      x: 0,
      y: 165 - ringClearance - 188,
    });
    expect(clearingOffset(underThePanelSide)).toEqual({
      x: 808 - ringClearance - 830,
      y: 0,
    });
  });

  it('passes over a way out that leaves the canvas', () => {
    expect(clearingOffset(underTheCard)).toEqual({
      x: 0,
      y: 207 + ringClearance - 180,
    });
  });

  it('lands clear of every pane, not only of the one that covered the ring', () => {
    expect(clearingOffset(betweenTwoPanes)).toEqual({
      x: 0,
      y: 100 - ringClearance - 150,
    });
  });

  it('is no longer than any whole-pixel move that clears the ring', () => {
    for (const covered of [
      underThePanelTop,
      underThePanelSide,
      underTheCard,
      betweenTwoPanes,
    ]) {
      const offset = clearingOffset(covered) ?? { x: 0, y: 0 };
      const length = Math.hypot(offset.x, offset.y);

      expect(clearAfter(covered, offset)).toBe(true);
      expect(
        wholePixelMovesWithin(Math.ceil(length)).filter(
          (move) =>
            Math.hypot(move.x, move.y) < length && clearAfter(covered, move),
        ),
      ).toEqual([]);
    }
  });

  it('moves nothing for a ring that fits nowhere clear of the panes', () => {
    expect(clearingOffset(widerAndTallerThanTheRoom)).toBeUndefined();
    expect(clearingOffset(scene(box(-100, -100, 2000, 2000)))).toBeUndefined();
  });
});

const opened: Viewport = { x: 183, y: 82, zoom: 1.4 };

const watchedView = () => {
  const at = { viewport: opened };
  const setViewport = vi.fn<PannedView['setViewport']>(() =>
    Promise.resolve(true),
  );
  return {
    at,
    setViewport,
    pan: (instant = false) =>
      focusPanner(
        { getViewport: () => at.viewport, setViewport },
        () => instant,
      ),
  };
};

describe('focusPanner', () => {
  it('pans by the clearing offset from where the view is, at the same zoom, over the pan duration', () => {
    const view = watchedView();

    view.pan()(underThePanelTop);

    expect(view.setViewport.mock.calls).toEqual([
      [
        { x: 183, y: 82 - 23 - ringClearance, zoom: 1.4 },
        { duration: focusPanDuration, interpolate: 'linear' },
      ],
    ]);
  });

  it('moves at once where motion is reduced', () => {
    const view = watchedView();

    view.pan(true)(underThePanelTop);

    expect(view.setViewport.mock.lastCall?.[1]?.duration).toBe(0);
  });

  it('asks nothing of the view for a ring already clear', () => {
    const view = watchedView();

    view.pan()(scene(box(400, 300, 160, 90)));

    expect(view.setViewport).not.toHaveBeenCalled();
  });

  it('measures focus that moves during a pan from where the view has got to', () => {
    const view = watchedView();
    const pan = view.pan();
    pan(underThePanelTop);
    view.at.viewport = { x: 183, y: 70, zoom: 1.4 };

    pan(underThePanelSide);

    expect(view.setViewport.mock.lastCall).toEqual([
      { x: 183 - 22 - ringClearance, y: 70, zoom: 1.4 },
      { duration: focusPanDuration, interpolate: 'linear' },
    ]);
  });

  it('stops a pan on its way where the newest focus needs none', () => {
    const view = watchedView();
    const pan = view.pan();
    pan(underThePanelTop);
    view.at.viewport = { x: 183, y: 70, zoom: 1.4 };

    pan(scene(box(400, 300, 160, 90)));

    expect(view.setViewport.mock.lastCall).toEqual([view.at.viewport]);
  });

  it('asks nothing more of a view that has arrived, or that the person has moved since', () => {
    const view = watchedView();
    const pan = view.pan();
    pan(underThePanelTop);
    view.at.viewport = view.setViewport.mock.lastCall?.[0] ?? opened;

    pan(scene(box(400, 300, 160, 90)));
    view.at.viewport = { x: 0, y: 0, zoom: 0.5 };

    expect(view.setViewport).toHaveBeenCalledOnce();
  });

  it('leaves the view alone, focus after focus, where the ring fits nowhere clear', () => {
    const view = watchedView();
    const pan = view.pan();

    pan(widerAndTallerThanTheRoom);
    pan(widerAndTallerThanTheRoom);

    expect(view.setViewport).not.toHaveBeenCalled();
  });
});

const ringed = new WeakSet<Element>();

const ringable = (element: Element): void => {
  const matches = element.matches.bind(element);
  vi.spyOn(element, 'matches').mockImplementation((selector) =>
    selector === ':focus-visible' ? ringed.has(element) : matches(selector),
  );
};

const drawn = (
  tag: string,
  className: string,
  within: Element,
): HTMLElement => {
  const element = document.createElement(tag);
  element.className = className;
  element.tabIndex = 0;
  within.append(element);
  ringable(element);
  return element;
};

const focusByKeyboard = (element: HTMLElement): void => {
  ringed.add(element);
  element.focus();
};

const nextFrame = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });

describe('onKeyboardFocus', () => {
  const landed = vi.fn<(target: Element) => void>();
  let surface: HTMLElement;
  let stop: () => void;

  beforeEach(() => {
    landed.mockClear();
    surface = document.createElement('div');
    document.body.replaceChildren(surface);
    stop = onKeyboardFocus(surface, landed);
  });

  afterEach(() => {
    stop();
  });

  it('answers focus that shows its ring on an element, a flow and a resize control', async () => {
    const node = drawn('div', 'react-flow__node', surface);
    const flow = drawn('div', 'react-flow__edge', surface);
    const control = drawn(
      'button',
      '',
      drawn('div', 'react-flow__resize-control', node),
    );

    for (const item of [node, flow, control]) {
      focusByKeyboard(item);
      await nextFrame();
    }

    expect(landed.mock.calls).toEqual([[node], [flow], [control]]);
  });

  it('waits a frame, and answers only the item focus rests on by then', async () => {
    const node = drawn('div', 'react-flow__node', surface);
    const other = drawn('div', 'react-flow__node', surface);

    focusByKeyboard(node);
    expect(landed).not.toHaveBeenCalled();
    focusByKeyboard(other);
    await nextFrame();

    expect(landed.mock.calls).toEqual([[other]]);
  });

  it('passes over focus that shows no ring, as a pointer press leaves it', async () => {
    drawn('div', 'react-flow__node', surface).focus();
    await nextFrame();

    expect(landed).not.toHaveBeenCalled();
  });

  it('passes over a field inside an element', async () => {
    const node = drawn('div', 'react-flow__node', surface);

    focusByKeyboard(drawn('input', '', node));
    await nextFrame();

    expect(landed).not.toHaveBeenCalled();
  });

  it('takes focus handed back after the window lost it as no move', async () => {
    const node = drawn('div', 'react-flow__node', surface);
    const other = drawn('div', 'react-flow__node', surface);
    focusByKeyboard(node);
    await nextFrame();
    landed.mockClear();

    window.dispatchEvent(new Event('blur'));
    node.blur();
    node.focus();
    await nextFrame();
    expect(landed).not.toHaveBeenCalled();

    other.focus();
    node.focus();
    await nextFrame();
    expect(landed.mock.calls).toEqual([[node]]);
  });

  it('stops listening when asked, a focus still waiting for its frame included', async () => {
    const node = drawn('div', 'react-flow__node', surface);
    focusByKeyboard(node);
    stop();
    await nextFrame();

    focusByKeyboard(drawn('div', 'react-flow__node', surface));
    await nextFrame();

    expect(landed).not.toHaveBeenCalled();
  });
});

const drawnAt = (element: Element | null, at: Box): void => {
  if (element !== null) {
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(at.minX, at.minY, at.maxX - at.minX, at.maxY - at.minY),
    );
  }
};

const viewOf = (within: Element): Point => {
  const [x, y] = [
    ...(
      within.querySelector('.react-flow__viewport')?.getAttribute('style') ?? ''
    ).matchAll(/(-?[\d.]+)px/gu),
  ].map((found) => Number(found[1]));
  return { x: x ?? Number.NaN, y: y ?? Number.NaN };
};

const nodes = [{ id: 'store', position: { x: 0, y: 0 }, data: {} }];

function Canvas({ panning }: { readonly panning: boolean }) {
  return (
    <StrictMode>
      <ReactFlow edges={[]} height={720} nodes={nodes} width={1280}>
        {panning ? <FocusPan /> : null}
      </ReactFlow>
      <section data-pane="" />
    </StrictMode>
  );
}

describe('FocusPan', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('moves the view once for keyboard focus under a pane, mounted where its effect runs twice, and at once where motion is reduced', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const { container, rerender } = render(<Canvas panning={false} />);
    const node = await waitFor(() => {
      const found = container.querySelector<HTMLElement>('.react-flow__node');
      expect(found).not.toBeNull();
      return found ?? document.body;
    });
    rerender(<Canvas panning />);
    node.style.outlineWidth = '2px';
    node.style.outlineOffset = '2px';
    drawnAt(container.querySelector('.react-flow'), canvas);
    drawnAt(container.querySelector('[data-pane]'), panel);
    drawnAt(node, box(1000, 300, 100, 50));
    ringable(node);
    const rested = { x: 0, y: 404 + ringClearance - (300 - 4) };

    focusByKeyboard(node);
    await nextFrame();
    expect(viewOf(container)).toEqual(rested);
    await nextFrame();

    expect(viewOf(container)).toEqual(rested);
  });
});
