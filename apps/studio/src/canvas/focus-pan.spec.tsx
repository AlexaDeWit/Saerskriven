import type { Box } from '@saerskriven/canvas';
import type { Point } from '@saerskriven/model';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { ReactFlow, type Viewport } from '@xyflow/react';
import { StrictMode, useRef } from 'react';
import {
  armsFocusPan,
  FocusPan,
  focusPanDuration,
  offsetIntoView,
  onKeyboardFocus,
  ringMargin,
  viewPanner,
  type PannedView,
} from './focus-pan.js';
import {
  KeyboardMoveMessage,
  type KeyboardMoveReport,
} from './move-message.js';

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

const window1280 = box(0, 0, 1280, 720);

const besideASidebar = box(240, 56, 1000, 600);

describe('offsetIntoView', () => {
  it('moves nothing for a ring inside the viewport, at its border included', () => {
    for (const ring of [
      box(400, 300, 160, 90),
      box(0, 0, 160, 90),
      box(1120, 630, 160, 90),
      box(2, 300, 160, 90),
    ]) {
      expect(offsetIntoView(ring, window1280)).toBeUndefined();
    }
  });

  it('brings a ring that crosses one side just inside that side, and leaves the other axis alone', () => {
    expect(offsetIntoView(box(-30, 300, 160, 90), window1280)).toEqual({
      x: 30 + ringMargin,
      y: 0,
    });
    expect(offsetIntoView(box(1200, 300, 160, 90), window1280)).toEqual({
      x: 1280 - ringMargin - 1360,
      y: 0,
    });
    expect(offsetIntoView(box(400, -200, 160, 90), window1280)).toEqual({
      x: 0,
      y: 200 + ringMargin,
    });
    expect(offsetIntoView(box(400, 700, 160, 90), window1280)).toEqual({
      x: 0,
      y: 720 - ringMargin - 790,
    });
  });

  it('brings a ring that is outside on two sides in on both', () => {
    expect(offsetIntoView(box(1300, 800, 160, 90), window1280)).toEqual({
      x: 1280 - ringMargin - 1460,
      y: 720 - ringMargin - 890,
    });
  });

  it('measures against the viewport where it is, not against the window', () => {
    expect(offsetIntoView(box(100, 100, 160, 90), besideASidebar)).toEqual({
      x: 240 + ringMargin - 100,
      y: 0,
    });
    expect(offsetIntoView(box(1100, 600, 160, 90), besideASidebar)).toEqual({
      x: 1240 - ringMargin - 1260,
      y: 656 - ringMargin - 690,
    });
    expect(
      offsetIntoView(box(300, 100, 160, 90), besideASidebar),
    ).toBeUndefined();
  });

  it('fills the viewport with a ring too long for it, its nearer end at the border, and rests once the ring spans it', () => {
    expect(offsetIntoView(box(300, 300, 1500, 90), window1280)).toEqual({
      x: ringMargin - 300,
      y: 0,
    });
    expect(offsetIntoView(box(-900, 300, 1500, 90), window1280)).toEqual({
      x: 1280 - ringMargin - 600,
      y: 0,
    });
    expect(offsetIntoView(box(1400, 300, 1500, 90), window1280)).toEqual({
      x: ringMargin - 1400,
      y: 0,
    });
    expect(
      offsetIntoView(box(-100, 300, 1500, 90), window1280),
    ).toBeUndefined();
    expect(
      offsetIntoView(box(-100, -100, 2000, 2000), window1280),
    ).toBeUndefined();
  });

  it('rests where it leaves a ring, so a second look moves nothing', () => {
    for (const ring of [
      box(-30, 300, 160, 90),
      box(1300, 800, 160, 90),
      box(300, 300, 1500, 90),
      box(1400, -900, 1500, 800),
    ]) {
      const { x, y } = offsetIntoView(ring, window1280) ?? { x: 0, y: 0 };
      const rested = box(
        ring.minX + x,
        ring.minY + y,
        ring.maxX - ring.minX,
        ring.maxY - ring.minY,
      );

      expect(offsetIntoView(rested, window1280)).toBeUndefined();
    }
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
      viewPanner(
        { getViewport: () => at.viewport, setViewport },
        () => instant,
      ),
  };
};

describe('viewPanner', () => {
  it('pans by the offset from where the view is, at the same zoom, over the pan duration', () => {
    const view = watchedView();

    view.pan()({ x: 0, y: -27 });

    expect(view.setViewport.mock.calls).toEqual([
      [
        { x: 183, y: 55, zoom: 1.4 },
        { duration: focusPanDuration, interpolate: 'linear' },
      ],
    ]);
  });

  it('moves at once where motion is reduced, and where the call asks for it', () => {
    const reduced = watchedView();
    const held = watchedView();

    reduced.pan(true)({ x: 0, y: -27 });
    held.pan()({ x: 0, y: -27 }, true);

    expect(reduced.setViewport.mock.lastCall?.[1]?.duration).toBe(0);
    expect(held.setViewport.mock.lastCall?.[1]?.duration).toBe(0);
  });

  it('asks nothing of the view where there is no offset', () => {
    const view = watchedView();

    view.pan()(undefined);

    expect(view.setViewport).not.toHaveBeenCalled();
  });

  it('measures an offset that arrives during a pan from where the view has got to', () => {
    const view = watchedView();
    const pan = view.pan();
    pan({ x: 0, y: -27 });
    view.at.viewport = { x: 183, y: 70, zoom: 1.4 };

    pan({ x: -26, y: 0 });

    expect(view.setViewport.mock.lastCall).toEqual([
      { x: 157, y: 70, zoom: 1.4 },
      { duration: focusPanDuration, interpolate: 'linear' },
    ]);
  });

  it('stops a pan on its way where the newest item needs none', () => {
    const view = watchedView();
    const pan = view.pan();
    pan({ x: 0, y: -27 });
    view.at.viewport = { x: 183, y: 70, zoom: 1.4 };

    pan(undefined);

    expect(view.setViewport.mock.lastCall).toEqual([view.at.viewport]);
  });

  it('asks nothing more of a view that has arrived, or that the person has moved since', () => {
    const view = watchedView();
    const pan = view.pan();
    pan({ x: 0, y: -27 });
    view.at.viewport = view.setViewport.mock.lastCall?.[0] ?? opened;

    pan(undefined);
    view.at.viewport = { x: 0, y: 0, zoom: 0.5 };
    pan(undefined);

    expect(view.setViewport).toHaveBeenCalledOnce();
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

const press = (key: string, modifiers: KeyboardEventInit = {}): void => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, ...modifiers }));
};

const arms = (key: string, modifiers: KeyboardEventInit = {}): boolean =>
  armsFocusPan(new KeyboardEvent('keydown', { key, ...modifiers }));

describe('armsFocusPan', () => {
  it('takes Tab, with Shift or without, and no other key or chord', () => {
    expect(arms('Tab')).toBe(true);
    expect(arms('Tab', { shiftKey: true })).toBe(true);
    expect(arms('Tab', { ctrlKey: true })).toBe(false);
    expect(arms('Enter')).toBe(false);
    expect(arms('ArrowRight')).toBe(false);
    expect(arms('a')).toBe(false);
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

  it('answers focus that shows its ring on an element, a flow and a resize control once Tab is pressed', async () => {
    const node = drawn('div', 'react-flow__node', surface);
    const flow = drawn('div', 'react-flow__edge', surface);
    const control = drawn(
      'button',
      '',
      drawn('div', 'react-flow__resize-control', node),
    );
    press('Tab');

    for (const item of [node, flow, control]) {
      focusByKeyboard(item);
      await nextFrame();
    }

    expect(landed.mock.calls).toEqual([[node], [flow], [control]]);
  });

  it('passes over a ringed focus until Tab is pressed, whatever other key was', async () => {
    const node = drawn('div', 'react-flow__node', surface);
    const other = drawn('div', 'react-flow__node', surface);

    focusByKeyboard(node);
    await nextFrame();
    press('Enter');
    press('a');
    focusByKeyboard(other);
    await nextFrame();
    expect(landed).not.toHaveBeenCalled();

    press('Tab', { shiftKey: true });
    focusByKeyboard(node);
    await nextFrame();
    expect(landed.mock.calls).toEqual([[node]]);
  });

  it('passes over a script focus that a pointer press came before, and answers again after Tab', async () => {
    const node = drawn('div', 'react-flow__node', surface);
    const other = drawn('div', 'react-flow__node', surface);
    press('Tab');

    node.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    focusByKeyboard(node);
    await nextFrame();
    expect(landed).not.toHaveBeenCalled();

    press('Tab');
    focusByKeyboard(other);
    await nextFrame();
    expect(landed.mock.calls).toEqual([[other]]);
  });

  it('answers a focus return after another key while Tab is still in charge', async () => {
    const node = drawn('div', 'react-flow__node', surface);
    press('Tab');

    press('Escape');
    focusByKeyboard(node);
    await nextFrame();

    expect(landed.mock.calls).toEqual([[node]]);
  });

  it('waits a frame, and answers only the item focus rests on by then', async () => {
    const node = drawn('div', 'react-flow__node', surface);
    const other = drawn('div', 'react-flow__node', surface);
    press('Tab');

    focusByKeyboard(node);
    expect(landed).not.toHaveBeenCalled();
    focusByKeyboard(other);
    await nextFrame();

    expect(landed.mock.calls).toEqual([[other]]);
  });

  it('passes over focus that shows no ring, as a browser leaves a pointer focus', async () => {
    press('Tab');

    drawn('div', 'react-flow__node', surface).focus();
    await nextFrame();

    expect(landed).not.toHaveBeenCalled();
  });

  it('passes over a field inside an element', async () => {
    const node = drawn('div', 'react-flow__node', surface);
    press('Tab');

    focusByKeyboard(drawn('input', '', node));
    await nextFrame();

    expect(landed).not.toHaveBeenCalled();
  });

  it('takes focus handed back after the window lost it as no move', async () => {
    const node = drawn('div', 'react-flow__node', surface);
    const other = drawn('div', 'react-flow__node', surface);
    press('Tab');
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
    press('Tab');
    focusByKeyboard(node);
    stop();
    await nextFrame();

    press('Tab');
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

const nodes = [
  { id: 'store', position: { x: 0, y: 0 }, data: {}, selected: true },
  { id: 'note', position: { x: 300, y: 0 }, data: {} },
];

function Canvas({
  panning,
  zoom = 1,
}: {
  readonly panning: boolean;
  readonly zoom?: number;
}) {
  const report = useRef<KeyboardMoveReport>(null);
  return (
    <StrictMode>
      <ReactFlow
        defaultViewport={{ x: 0, y: 0, zoom }}
        edges={[]}
        height={720}
        nodes={nodes}
        onKeyDown={(event) => {
          report.current?.(event);
        }}
        width={1280}
      >
        <KeyboardMoveMessage ref={report} />
        {panning ? <FocusPan /> : null}
      </ReactFlow>
      <section data-pane="" data-testid="pane" />
    </StrictMode>
  );
}

const mounted = async (
  viewport: Box,
  at: Box,
  { zoom = 1, reducedMotion = true } = {},
) => {
  vi.stubGlobal('matchMedia', () => ({ matches: reducedMotion }));
  const { container, rerender } = render(
    <Canvas panning={false} zoom={zoom} />,
  );
  const [store, note] = await waitFor(() => {
    const found = [
      ...container.querySelectorAll<HTMLElement>('.react-flow__node'),
    ];
    expect(found).toHaveLength(2);
    return found;
  });
  rerender(<Canvas panning zoom={zoom} />);
  for (const node of [store, note]) {
    if (node !== undefined) {
      node.style.outlineStyle = 'solid';
      node.style.outlineWidth = '2px';
      node.style.outlineOffset = '2px';
      ringable(node);
    }
  }
  drawnAt(container.querySelector('.react-flow'), viewport);
  drawnAt(store ?? null, at);
  drawnAt(container.querySelector('[data-testid="pane"]'), viewport);
  return {
    store: store ?? document.body,
    note: note ?? document.body,
    view: () => viewOf(container),
    stopPanning: () => {
      rerender(<Canvas panning={false} zoom={zoom} />);
    },
  };
};

const tabOnto = async (node: HTMLElement): Promise<void> => {
  press('Tab');
  focusByKeyboard(node);
  await nextFrame();
};

const arrowOn = async (node: HTMLElement, init = {}): Promise<void> => {
  fireEvent.keyDown(node, { key: 'ArrowRight', ...init });
  await nextFrame();
};

describe('FocusPan', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('brings an item Tab lands on outside the viewport just inside it, once, mounted where its effect runs twice, and at once where motion is reduced', async () => {
    const canvas = await mounted(window1280, box(1250, 300, 100, 50));
    const rested = { x: 1280 - ringMargin - (1350 + 4), y: 0 };

    await tabOnto(canvas.store);
    expect(canvas.view()).toEqual(rested);
    await nextFrame();

    expect(canvas.view()).toEqual(rested);
  });

  it('leaves the view alone for an item inside the viewport, a pane lying over the whole of it', async () => {
    const canvas = await mounted(window1280, box(1000, 300, 100, 50));

    await tabOnto(canvas.store);

    expect(canvas.view()).toEqual({ x: 0, y: 0 });
  });

  it('measures the ring at the zoom it is drawn at, against a viewport away from the window origin', async () => {
    const canvas = await mounted(besideASidebar, box(150, 100, 100, 50), {
      zoom: 2,
    });

    await tabOnto(canvas.store);

    expect(canvas.view()).toEqual({
      x: 240 + ringMargin - (150 - 2 * 4),
      y: 0,
    });
  });

  it('takes an item that draws no outline at its own box', async () => {
    const canvas = await mounted(window1280, box(1250, 300, 100, 50));
    canvas.store.style.outlineStyle = 'none';

    await tabOnto(canvas.store);

    expect(canvas.view()).toEqual({ x: 1280 - ringMargin - 1350, y: 0 });
  });

  it('follows an arrow-key move that carries the focused element out of the viewport, with no Tab before it', async () => {
    const canvas = await mounted(window1280, box(1250, 690, 100, 50));
    canvas.store.focus();

    await arrowOn(canvas.store);

    expect(canvas.view()).toEqual({
      x: 1280 - ringMargin - (1350 + 4),
      y: 720 - ringMargin - (740 + 4),
    });
  });

  it('leaves the view alone for an arrow-key move that ends inside the viewport', async () => {
    const canvas = await mounted(window1280, box(1000, 300, 100, 50));
    canvas.store.focus();

    await arrowOn(canvas.store);

    expect(canvas.view()).toEqual({ x: 0, y: 0 });
  });

  it('leaves the view alone for a moved element that already spans the viewport', async () => {
    const canvas = await mounted(window1280, box(-100, -100, 2000, 2000));
    canvas.store.focus();

    await arrowOn(canvas.store);

    expect(canvas.view()).toEqual({ x: 0, y: 0 });
  });

  it('leaves the view alone for an arrow key that moves nothing, on an element the selection leaves out', async () => {
    const canvas = await mounted(window1280, box(1250, 300, 100, 50));
    drawnAt(canvas.note, box(1250, 300, 100, 50));
    canvas.note.focus();

    await arrowOn(canvas.note);

    expect(canvas.view()).toEqual({ x: 0, y: 0 });
  });

  it('keeps up at once with an arrow key held down, where motion is not reduced', async () => {
    const canvas = await mounted(window1280, box(1250, 300, 100, 50), {
      reducedMotion: false,
    });
    canvas.store.focus();

    await arrowOn(canvas.store, { repeat: true });

    expect(canvas.view()).toEqual({
      x: 1280 - ringMargin - (1350 + 4),
      y: 0,
    });
  });

  it('stops following once it is unmounted, a move still waiting for its frame included', async () => {
    const canvas = await mounted(window1280, box(1250, 300, 100, 50));
    canvas.store.focus();

    fireEvent.keyDown(canvas.store, { key: 'ArrowRight' });
    canvas.stopPanning();
    await nextFrame();
    await arrowOn(canvas.store);

    expect(canvas.view()).toEqual({ x: 0, y: 0 });
  });
});
