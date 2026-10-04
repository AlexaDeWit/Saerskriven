import {
  expect,
  test,
  type CDPSession,
  type Locator,
  type Page,
} from '@playwright/test';
import { canvasClassNames } from '@saerskriven/canvas';

/** A box, in the diagram's own coordinates or on screen. */
export type Box = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/** One point, in the diagram's own coordinates or on screen. */
export type Point = { readonly x: number; readonly y: number };

/** The box the diagram is drawn in, chrome and graph paper included. */
export const canvasContainer = (page: Page): Locator =>
  page.getByTestId('canvas-container');

/** Visible box elements exclude the hidden anchors of free flow ends. */
export const elementNodes = (page: Page): Locator =>
  page.locator('.react-flow__nodes').getByRole('group');

/**
 * Where React Flow has the canvas, read off the transform it writes. Zoom and
 * fit are the viewport moving with nothing in the model changing, so the
 * transform is the only thing that says they happened.
 */
export const viewportTransform = async (page: Page): Promise<string> =>
  (await page.locator('.react-flow__viewport').getAttribute('style')) ?? '';

/** The handles on the points of the selected trust boundary curve. */
export const pointHandles = (page: Page): Locator =>
  page.getByRole('button', { name: /^Point \d+$/u });

/** The scale React Flow applies to model coordinates. */
export const viewportZoom = async (page: Page): Promise<number> =>
  Number(/scale\(([\d.]+)\)/u.exec(await viewportTransform(page))?.[1]);

/** Waits for consecutive matching viewport transforms before a canvas gesture. */
export const canvasSettled = async (page: Page): Promise<void> => {
  let before = '';
  await expect
    .poll(async () => {
      const now = await viewportTransform(page);
      const settled = now !== '' && now === before;
      before = now;
      return settled;
    })
    .toBe(true);
};

/** Whether two boxes share any area. Boxes that only touch do not. */
export const boxesOverlap = (one: Box, other: Box): boolean =>
  one.x < other.x + other.width &&
  other.x < one.x + one.width &&
  one.y < other.y + other.height &&
  other.y < one.y + one.height;

const decimals = 3;
const coordinateTolerance = 0.01;

const rounded = (point: Point): Point => ({
  x: Number(point.x.toFixed(decimals)),
  y: Number(point.y.toFixed(decimals)),
});

const numberIn = (style: string, pattern: RegExp): number =>
  Number(pattern.exec(style)?.[1] ?? Number.NaN);

/**
 * The box React Flow is drawing a node in, read off the style attribute it
 * places and sizes the node with. It is the live one: a drag frame reaches a
 * node's style long before it reaches the store, so this is where an element
 * is during a gesture.
 */
export const boxOf = async (node: Locator): Promise<Box> => {
  const style = (await node.getAttribute('style')) ?? '';
  return {
    x: numberIn(style, /translate\((-?[\d.]+)px/u),
    y: numberIn(style, /translate\(-?[\d.]+px,\s*(-?[\d.]+)px/u),
    width: numberIn(style, /width:\s*([\d.]+)px/u),
    height: numberIn(style, /height:\s*([\d.]+)px/u),
  };
};

/** Reads a node position from its transform without including the selection-dependent stacking style. */
export const placeOf = async (node: Locator): Promise<string> => {
  const style = (await node.getAttribute('style')) ?? '';
  return /translate\([^)]*\)/u.exec(style)?.[0] ?? style;
};

/** Where a control is drawn on screen, held to be drawn at all. */
export const screenBoxOf = async (
  target: Locator,
  called?: string,
): Promise<Box> => {
  const box = await target.boundingBox();
  expect(
    box,
    called === undefined ? undefined : `${called} is on the page`,
  ).not.toBeNull();
  return box ?? { x: 0, y: 0, width: 0, height: 0 };
};

/** The four edges and the size of where a control is drawn on screen. */
export const edgesOf = async (
  target: Locator,
): Promise<{
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}> => {
  const drawn = await screenBoxOf(target, 'the box');
  return {
    left: drawn.x,
    right: drawn.x + drawn.width,
    top: drawn.y,
    bottom: drawn.y + drawn.height,
    width: drawn.width,
    height: drawn.height,
  };
};

/** The centre of where a control is drawn on screen. */
export const centreOf = async (target: Locator): Promise<Point> => {
  const box = await screenBoxOf(target);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

/** Whether the topmost element at a screen point is `target` or inside it. */
export const reachesAt = (target: Locator, at: Point): Promise<boolean> =>
  target.evaluate(
    (node, point) => node.contains(document.elementFromPoint(point.x, point.y)),
    at,
  );

/**
 * Where to click `target`, from its top left corner, at a point nothing else
 * covers. A click aimed at a covered centre has Playwright scroll the element
 * into reach, and React Flow puts its wrapper's scroll back a frame later, so
 * such a click lands only by winning that race.
 */
export const clearPositionOn = async (target: Locator): Promise<Point> => {
  const position = await target.evaluate((node) => {
    const box = node.getBoundingClientRect();
    const steps = 8;
    const offsets = Array.from(
      { length: steps - 1 },
      (unused, step) => step + 1,
    );
    return offsets
      .flatMap((row) =>
        offsets.map((column) => ({
          x: Math.round((box.width * column) / steps),
          y: Math.round((box.height * row) / steps),
        })),
      )
      .find((at) =>
        node.contains(
          document.elementFromPoint(box.left + at.x, box.top + at.y),
        ),
      );
  });
  expect(position, 'the element is covered all over').toBeDefined();
  return position ?? { x: 0, y: 0 };
};

/** Scrolls a control into view and fails where it is off screen or something else covers its centre. */
export const onScreen = async (target: Locator): Promise<void> => {
  await target.scrollIntoViewIfNeeded();
  await expect(target).toBeInViewport();
  const reached = await reachesAt(target, await centreOf(target));
  expect(reached, 'the control is covered').toBe(true);
};

const ringReach = 16;

/**
 * The share of `target`'s outline along which a focus ring is on screen once
 * `focus` has moved keyboard focus there and the view has come to rest, which
 * is where a pan to the target leaves it. Two screenshots are read in CSS
 * pixels, one with focus on `target` and one after it has gone to `away`: at
 * each pixel along each side of `target`, whether a pixel up to 16 pixels
 * across that side, short of its middle, differs between them. Anything drawn
 * over the ring leaves its pixels as they were, and so does a part of it off
 * the viewport. The view is held to stay where it rested from the first
 * screenshot to the second. Focus is left on `away`.
 */
export const focusRingShown = async (
  target: Locator,
  away: Locator,
  focus: () => Promise<void>,
): Promise<number> => {
  const page = target.page();
  await focus();
  await expect(target).toBeFocused();
  await canvasSettled(page);
  const rested = await viewportTransform(page);
  const shown = await screenBoxOf(target);
  const clip = {
    x: Math.max(Math.floor(shown.x) - ringReach, 0),
    y: Math.max(Math.floor(shown.y) - ringReach, 0),
    width: Math.ceil(shown.width) + 2 * ringReach,
    height: Math.ceil(shown.height) + 2 * ringReach,
  };
  const after = await page.screenshot({ clip, scale: 'css' });
  await away.focus();
  const before = await page.screenshot({ clip, scale: 'css' });
  expect(
    await viewportTransform(page),
    'the view moved while the ring was measured',
  ).toBe(rested);
  return page.evaluate(
    async ({ images, origin, box, across }) => {
      const [from, to] = await Promise.all(
        images.map(async (png) => {
          const image = new Image();
          image.src = `data:image/png;base64,${png}`;
          await image.decode();
          const canvas = new OffscreenCanvas(image.width, image.height);
          const context = canvas.getContext('2d');
          context?.drawImage(image, 0, 0);
          return (
            context?.getImageData(0, 0, image.width, image.height) ??
            new ImageData(1, 1)
          );
        }),
      );
      const fromWidth = from?.width ?? 0;
      const toWidth = to?.width ?? 0;
      const width = Math.min(fromWidth, toWidth);
      const height = Math.min(from?.height ?? 0, to?.height ?? 0);
      const changed = (x: number, y: number): boolean => {
        const column = Math.round(x - origin.x);
        const row = Math.round(y - origin.y);
        if (column < 0 || column >= width || row < 0 || row >= height) {
          return false;
        }
        const was = (row * fromWidth + column) * 4;
        const is = (row * toWidth + column) * 4;
        return (
          [0, 1, 2].reduce(
            (sum, channel) =>
              sum +
              Math.abs(
                (from?.data[was + channel] ?? 0) -
                  (to?.data[is + channel] ?? 0),
              ),
            0,
          ) > 48
        );
      };
      const offsets = (extent: number): number[] =>
        Array.from(
          { length: across + Math.floor(Math.min(across, extent / 2)) + 1 },
          (_, step) => step - across,
        );
      const down = offsets(box.height);
      const along = offsets(box.width);
      const right = box.x + box.width;
      const bottom = box.y + box.height;
      const sides = [
        ...Array.from({ length: Math.floor(box.width) }, (_, step) => [
          down.some((offset) => changed(box.x + step, box.y + offset)),
          down.some((offset) => changed(box.x + step, bottom - offset)),
        ]),
        ...Array.from({ length: Math.floor(box.height) }, (_, step) => [
          along.some((offset) => changed(box.x + offset, box.y + step)),
          along.some((offset) => changed(right - offset, box.y + step)),
        ]),
      ].flat();
      return sides.filter(Boolean).length / Math.max(sides.length, 1);
    },
    {
      images: [before.toString('base64'), after.toString('base64')],
      origin: { x: clip.x, y: clip.y },
      box: shown,
      across: ringReach,
    },
  );
};

/** How far every ancestor of `target` is scrolled, summed, so a scroll anywhere above it shows. */
export const scrolledAbove = (target: Locator): Promise<number> =>
  target.evaluate((element) => {
    let scrolled = 0;
    for (let node = element.parentElement; node; node = node.parentElement) {
      scrolled += node.scrollTop;
    }
    return scrolled;
  });

const drawnBoxOf = (shapes: Locator, stroked: boolean): Promise<Box> =>
  shapes.evaluateAll((elements, withStroke) => {
    const boxes = elements.map((element) => {
      if (!(element instanceof SVGGraphicsElement)) {
        throw new Error('The locator found a non-SVG shape.');
      }
      const geometry = element.getBBox();
      const matrix = element.getScreenCTM() ?? new DOMMatrix();
      const corners = [geometry.x, geometry.x + geometry.width].flatMap((x) =>
        [geometry.y, geometry.y + geometry.height].map((y) =>
          new DOMPoint(x, y).matrixTransform(matrix),
        ),
      );
      const stroke = withStroke
        ? Number.parseFloat(getComputedStyle(element).strokeWidth)
        : 0;
      const scaleX = Math.hypot(matrix.a, matrix.b);
      const scaleY = Math.hypot(matrix.c, matrix.d);
      const horizontalLine =
        element instanceof SVGLineElement &&
        element.x1.baseVal.value !== element.x2.baseVal.value;
      const verticalLine =
        element instanceof SVGLineElement &&
        element.y1.baseVal.value !== element.y2.baseVal.value;
      const padX =
        verticalLine || !(element instanceof SVGLineElement)
          ? (stroke * scaleX) / 2
          : 0;
      const padY =
        horizontalLine || !(element instanceof SVGLineElement)
          ? (stroke * scaleY) / 2
          : 0;
      return {
        left: Math.min(...corners.map((corner) => corner.x)) - padX,
        top: Math.min(...corners.map((corner) => corner.y)) - padY,
        right: Math.max(...corners.map((corner) => corner.x)) + padX,
        bottom: Math.max(...corners.map((corner) => corner.y)) + padY,
      };
    });
    const left = Math.min(...boxes.map((box) => box.left));
    const top = Math.min(...boxes.map((box) => box.top));
    const right = Math.max(...boxes.map((box) => box.right));
    const bottom = Math.max(...boxes.map((box) => box.bottom));
    return { x: left, y: top, width: right - left, height: bottom - top };
  }, stroked);

/**
 * The screen-space box of SVG shape geometry, its stroke left out, read from
 * `getBBox` through `getScreenCTM`. A client rect and Playwright's
 * `boundingBox` are no measure of it across engines: Firefox's cover the
 * stroke, with a mitre allowance on a path, in layout units of a sixtieth of
 * a pixel, and Chromium's client rect leaves the stroke out.
 */
export const geometryBoxOf = (shapes: Locator): Promise<Box> =>
  drawnBoxOf(shapes, false);

/** The screen-space box of SVG shape ink: its geometry and half its stroke on each stroked side. */
export const inkBoxOf = (shapes: Locator): Promise<Box> =>
  drawnBoxOf(shapes, true);

/** Where a flow attached to that box ends: one of the four side midpoints. */
export const handlesOf = (box: Box): Point[] =>
  [
    { x: box.x + box.width / 2, y: box.y },
    { x: box.x + box.width, y: box.y + box.height / 2 },
    { x: box.x + box.width / 2, y: box.y + box.height },
    { x: box.x, y: box.y + box.height / 2 },
  ].map(rounded);

/** The line one flow draws, from its source through its waypoints. */
export const lineOf = (page: Page, name: RegExp): Locator =>
  page.getByRole('group', { name }).locator(`path.${canvasClassNames.flow}`);

/**
 * The whole pixel nearest the screen point halfway along a drawn flow. A
 * pointer sent to a fraction of a pixel stays there in Chromium and is cut to
 * the whole pixel in Firefox.
 */
export const halfwayAlong = (line: Locator): Promise<Point> =>
  line.evaluate<Point, SVGPathElement>((path) => {
    const along = path.getPointAtLength(path.getTotalLength() / 2);
    const point = new DOMPoint(along.x, along.y).matrixTransform(
      path.getScreenCTM() ?? new DOMMatrix(),
    );
    return { x: Math.round(point.x), y: Math.round(point.y) };
  });

/** The path a line is drawn along, as the `d` attribute carries it. */
export const drawnBy = async (line: Locator): Promise<string> =>
  (await line.getAttribute('d')) ?? '';

/** The ordered route points in a drawn SVG path. */
export const turnsOf = (drawn: string): Point[] =>
  [...drawn.matchAll(/(-?[\d.]+)\s+(-?[\d.]+)/gu)].map((turn) =>
    rounded({ x: Number(turn[1]), y: Number(turn[2]) }),
  );

/** Which of a line's turns sit on one of the handles offered. */
export const endsOn = (drawn: string, handles: readonly Point[]): Point[] =>
  turnsOf(drawn).filter((turn) =>
    handles.some(
      (handle) =>
        Math.abs(handle.x - turn.x) <= coordinateTolerance &&
        Math.abs(handle.y - turn.y) <= coordinateTolerance,
    ),
  );

/**
 * Presses the pointer on the centre of a target and answers where it landed,
 * leaving the button down so the caller can move and read before the drop.
 */
export const pressOn = async (page: Page, target: Locator): Promise<Point> => {
  const at = await centreOf(target);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  return at;
};

/** Drags from the centre of `target` by the given screen-pixel offset. */
export const dragBy = async (
  page: Page,
  target: Locator,
  by: number | Point,
): Promise<void> => {
  const start = await centreOf(target);
  const offset = typeof by === 'number' ? { x: by, y: by } : by;
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + offset.x, start.y + offset.y, { steps: 8 });
  await page.mouse.up();
};

/** Drags from the centre of a locator to a point on the page. */
export const dragTo = async (
  page: Page,
  from: Locator,
  to: Point,
): Promise<void> => {
  const start = await centreOf(from);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
};

/** Drags from the centre of one locator to the centre of another. */
export const dragOnto = async (
  page: Page,
  from: Locator,
  onto: Locator,
): Promise<void> => {
  await dragTo(page, from, await centreOf(onto));
};

/** Draws one selection box around every node in `targets`. */
export const boxSelect = async (
  page: Page,
  targets: readonly [Locator, ...Locator[]],
): Promise<void> => {
  const drawn = await Promise.all(targets.map((target) => screenBoxOf(target)));
  const margin = 16;
  const from = {
    x: Math.min(...drawn.map((box) => box.x)) - margin,
    y: Math.min(...drawn.map((box) => box.y)) - margin,
  };
  const to = {
    x: Math.max(...drawn.map((box) => box.x + box.width)) + margin,
    y: Math.max(...drawn.map((box) => box.y + box.height)) + margin,
  };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await expect(page.locator('.react-flow__selection')).toBeVisible();
  await page.mouse.up();
};

const clearBy = 48;

const steps = 8;

const chromeFree = 0.75;

const grid = Array.from({ length: steps - 1 }, (unused, step) => step + 1);

const clearOf = (boxes: readonly (Box | null)[], at: Point): boolean =>
  boxes.every(
    (box) =>
      box === null ||
      at.x < box.x - clearBy ||
      at.x > box.x + box.width + clearBy ||
      at.y < box.y - clearBy ||
      at.y > box.y + box.height + clearBy,
  );

/**
 * Finds a whole-pixel point clear of drawn elements, connection snap distance
 * and the lower chrome area. A press asked for at y 67.5 lands there in
 * Chromium and at 67 in Firefox.
 */
export const emptyCanvasPoint = async (page: Page): Promise<Point> => {
  const canvas = await screenBoxOf(canvasContainer(page), 'the canvas');
  const room = { width: canvas.width, height: canvas.height * chromeFree };
  const drawn = await Promise.all(
    (await elementNodes(page).all()).map(async (node) => node.boundingBox()),
  );
  const candidates = grid
    .flatMap((column) =>
      grid.map((row) => ({
        x: Math.round(canvas.x + (room.width * column) / steps),
        y: Math.round(canvas.y + (room.height * row) / steps),
      })),
    )
    .filter((at) => clearOf(drawn, at));
  const clear = await page.evaluate(
    (points) =>
      points.find(
        (at) =>
          document
            .elementFromPoint(at.x, at.y)
            ?.closest('.react-flow__pane') instanceof Element,
      ),
    candidates,
  );

  expect(clear, 'the canvas has no point clear of every element').toBeDefined();
  return clear ?? { x: canvas.x, y: canvas.y };
};

const touchPoint = (at: Point, id = 1) => ({
  x: Math.round(at.x),
  y: Math.round(at.y),
  id,
});

/**
 * Enables touch input on a Chromium debugging session, and skips the calling
 * test in every other engine, which has no route for a finger that stays down
 * and moves. Playwright's `touchscreen` taps and no more, and needs a
 * `hasTouch` context: Firefox has no touch events without one, and with one
 * it delivers a mouse click with no pointer events, which a touch spec selects
 * and opens the menu with.
 */
export const touchSession = async (page: Page): Promise<CDPSession> => {
  test.skip(
    page.context().browser()?.browserType().name() !== 'chromium',
    'Playwright holds a finger down and moves it only through a Chromium DevTools session',
  );
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setTouchEmulationEnabled', {
    enabled: true,
    maxTouchPoints: 2,
  });
  return session;
};

/**
 * Puts one finger down at a screen point and moves it to another, leaving it
 * down so the caller can act before the lift.
 */
export const touchDown = async (
  session: CDPSession,
  from: Point,
  to: Point,
): Promise<void> => {
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [touchPoint(from)],
  });
  for (let step = 1; step <= 6; step += 1) {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        touchPoint({
          x: from.x + ((to.x - from.x) * step) / 6,
          y: from.y + ((to.y - from.y) * step) / 6,
        }),
      ],
    });
  }
};

const withNoFingerLeft =
  (type: 'touchEnd' | 'touchCancel') =>
  async (session: CDPSession): Promise<void> => {
    await session.send('Input.dispatchTouchEvent', { type, touchPoints: [] });
  };

/** Lifts every finger still down. */
export const touchUp = withNoFingerLeft('touchEnd');

/** Cancels every finger still down, which the page sees as `touchcancel`. */
export const touchCancel = withNoFingerLeft('touchCancel');

/**
 * Sends one touch event about the fingers named, each under its own id, so a
 * second finger can press or move while the first is down, and stay down while
 * it lifts. In Chromium a `touchStart` that names a finger already down beside
 * a new one presses the new one alone, and a `touchEnd` lifts the fingers it
 * names and leaves the others down. The finger {@link touchDown} leaves down
 * is id 1.
 */
export const touchFingers = async (
  session: CDPSession,
  type: 'touchStart' | 'touchMove' | 'touchEnd',
  fingers: readonly (readonly [id: number, at: Point])[],
): Promise<void> => {
  await session.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: fingers.map(([id, at]) => touchPoint(at, id)),
  });
};

/** Sends a touch gesture between screen coordinates, including a stationary tap. */
export const touchDrag = async (
  session: CDPSession,
  from: Point,
  to: Point,
): Promise<void> => {
  await touchDown(session, from, to);
  await touchUp(session);
};
