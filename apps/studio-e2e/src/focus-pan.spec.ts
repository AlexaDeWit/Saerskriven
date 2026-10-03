import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  boxesOverlap,
  canvasContainer,
  canvasSettled,
  centreOf,
  focusRingShown,
  screenBoxOf,
  viewportTransform,
  viewportZoom,
  type Box,
  type Point,
} from './canvas.fixtures.js';
import {
  beforeCanvas,
  nameField,
  nodeNamed,
  openEveryGlyph,
  selectNode,
  tabTo,
  threatPanel,
  toolButton,
  undoOffered,
} from './studio.fixtures.js';

const firstFlow = /^Submit order, flow/u;

const actor = /^Customer\sbrowser, actor/u;

const store = /^Order database, store/u;

const lowestBoundary = /^Partner network, trust boundary/u;

const shownPastElementsAtItsEnds = 0.5;

const justInside = 16;

const beyondTheBorder = 40;

const farStep = 20;

const panTakesAtLeast = 400;

const panRunsOut = 1000;

const scrolledAcross = -100;

const offsetIn = (transform: string): Point => {
  const [x, y] = [...transform.matchAll(/(-?[\d.]+)px/gu)].map((found) =>
    Number(found[1]),
  );
  return { x: x ?? Number.NaN, y: y ?? Number.NaN };
};

const viewportBox = (page: Page): Promise<Box> =>
  screenBoxOf(canvasContainer(page), 'the canvas');

const edgeGaps = async (page: Page, item: Locator) => {
  const viewport = await viewportBox(page);
  const drawn = await screenBoxOf(item);
  return {
    left: drawn.x - viewport.x,
    top: drawn.y - viewport.y,
    right: viewport.x + viewport.width - (drawn.x + drawn.width),
    bottom: viewport.y + viewport.height - (drawn.y + drawn.height),
  };
};

const insideTheViewport = async (page: Page, item: Locator): Promise<boolean> =>
  Object.values(await edgeGaps(page, item)).every((gap) => gap >= 0);

const focusedOn = (item: Locator): Promise<boolean> =>
  item.evaluate((node) => node === document.activeElement);

const scrollViewBy = async (page: Page, by: Point): Promise<void> => {
  const over = await centreOf(canvasContainer(page));
  await page.mouse.move(over.x, over.y);
  await page.mouse.wheel(-2 * by.x, -2 * by.y);
  await canvasSettled(page);
};

const tabFromRest = async (page: Page, target: Locator): Promise<string> => {
  await beforeCanvas(page).focus();
  let rested = await viewportTransform(page);
  for (
    let pressed = 0;
    pressed < 40 && !(await focusedOn(target));
    pressed += 1
  ) {
    await canvasSettled(page);
    rested = await viewportTransform(page);
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
  return rested;
};

const firstFlowScrolledOut = async (page: Page): Promise<Locator> => {
  await openEveryGlyph(page);
  await canvasSettled(page);
  const flow = nodeNamed(page, firstFlow);
  const drawn = await screenBoxOf(flow);
  const viewport = await viewportBox(page);
  await scrollViewBy(page, {
    x: viewport.x - beyondTheBorder - (drawn.x + drawn.width),
    y: 0,
  });
  expect(await insideTheViewport(page, flow)).toBe(false);
  return flow;
};

const scrollOnceTheViewMoves = async (page: Page, by: Point): Promise<void> => {
  await page.evaluate(
    (wheel) => {
      const viewport = document.querySelector('.react-flow__viewport');
      const from = viewport?.getAttribute('style');
      const moved = new MutationObserver(() => {
        const reached = viewport?.getAttribute('style');
        if (reached !== from) {
          moved.disconnect();
          window.saerskrivenScrolledFrom = reached ?? '';
          viewport?.dispatchEvent(
            new WheelEvent('wheel', {
              ...wheel,
              bubbles: true,
              cancelable: true,
            }),
          );
        }
      });
      if (viewport !== null) {
        moved.observe(viewport, { attributeFilter: ['style'] });
      }
    },
    { deltaX: -2 * by.x, deltaY: -2 * by.y },
  );
};

type ViewLog = {
  focusedAt: number;
  readonly seen: { readonly at: number; readonly transform: string }[];
};

declare global {
  interface Window {
    saerskrivenViewLog?: ViewLog;
    saerskrivenScrolledFrom?: string;
  }
}

const recordView = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const log: ViewLog = { focusedAt: Number.NaN, seen: [] };
    const viewport = document.querySelector('.react-flow__viewport');
    window.saerskrivenViewLog = log;
    document.addEventListener('focusin', () => {
      log.focusedAt = performance.now();
    });
    if (viewport !== null) {
      new MutationObserver(() => {
        log.seen.push({
          at: performance.now(),
          transform: viewport.getAttribute('style') ?? '',
        });
      }).observe(viewport, { attributeFilter: ['style'] });
    }
  });
};

const viewRecorded = (page: Page): Promise<ViewLog> =>
  page.evaluate(
    () => window.saerskrivenViewLog ?? { focusedAt: Number.NaN, seen: [] },
  );

const pressTimes = async (
  page: Page,
  key: string,
  times: number,
): Promise<void> => {
  for (let pressed = 0; pressed < times; pressed += 1) {
    await page.keyboard.press(key);
  }
};

test('Tab onto a flow outside the viewport brings it just inside, by the least distance, and its ring shows', async ({
  page,
}) => {
  const flow = await firstFlowScrolledOut(page);
  const zoom = await viewportZoom(page);
  const before = offsetIn(await viewportTransform(page));

  const shown = await focusRingShown(flow, beforeCanvas(page), () =>
    tabTo(page, flow),
  );

  expect(shown).toBeGreaterThanOrEqual(shownPastElementsAtItsEnds);
  const { left } = await edgeGaps(page, flow);
  expect(left).toBeGreaterThanOrEqual(0);
  expect(left).toBeLessThan(justInside);
  expect(offsetIn(await viewportTransform(page)).y).toBe(before.y);
  expect(await viewportZoom(page)).toBe(zoom);
});

test('Tab onto an element outside the viewport brings it just inside, by the least distance, at the same zoom and as no edit', async ({
  page,
}) => {
  await openEveryGlyph(page);
  await canvasSettled(page);
  const item = nodeNamed(page, lowestBoundary);
  const zoom = await viewportZoom(page);
  await scrollViewBy(page, {
    x: 0,
    y: beyondTheBorder + (await edgeGaps(page, item)).bottom,
  });
  expect(await insideTheViewport(page, item)).toBe(false);
  const scrolled = await viewportTransform(page);

  const rested = await tabFromRest(page, item);
  await canvasSettled(page);

  expect(rested, 'no earlier stop moved the view').toBe(scrolled);
  const { bottom } = await edgeGaps(page, item);
  expect(bottom).toBeGreaterThanOrEqual(0);
  expect(bottom).toBeLessThan(justInside);
  expect(offsetIn(await viewportTransform(page)).x).toBe(offsetIn(scrolled).x);
  expect(await viewportZoom(page)).toBe(zoom);
  expect(await undoOffered(page)).toBe(false);
});

test('Tab onto an element under the threat panel leaves the view where it is, and its ring under the panel', async ({
  page,
}) => {
  await openEveryGlyph(page);
  const selected = await selectNode(page, actor);
  await expect(threatPanel(page)).toBeVisible();
  await canvasSettled(page);
  const item = nodeNamed(page, store);
  const covered = async (): Promise<boolean> =>
    boxesOverlap(await screenBoxOf(item), await screenBoxOf(threatPanel(page)));
  expect(await covered()).toBe(true);
  expect(await insideTheViewport(page, item)).toBe(true);
  const before = await viewportTransform(page);

  await tabTo(page, item, selected);

  await expect(item).toHaveCSS('outline-style', 'solid');
  await canvasSettled(page);
  expect(await viewportTransform(page)).toBe(before);
  expect(await covered()).toBe(true);
});

test('an arrow-key move that pushes an element past the right edge and then the bottom edge is followed, with no Tab before it', async ({
  page,
}) => {
  await openEveryGlyph(page);
  const item = await selectNode(page, store);
  await canvasSettled(page);
  const step = farStep * (await viewportZoom(page));
  const start = offsetIn(await viewportTransform(page));

  await pressTimes(
    page,
    'Shift+ArrowRight',
    Math.ceil((await edgeGaps(page, item)).right / step) + 2,
  );
  await canvasSettled(page);

  const across = offsetIn(await viewportTransform(page));
  const { right } = await edgeGaps(page, item);
  expect(right).toBeGreaterThanOrEqual(0);
  expect(right).toBeLessThan(justInside);
  expect(across.x).toBeLessThan(start.x);
  expect(across.y).toBe(start.y);

  await pressTimes(
    page,
    'Shift+ArrowDown',
    Math.ceil((await edgeGaps(page, item)).bottom / step) + 2,
  );
  await canvasSettled(page);

  const down = offsetIn(await viewportTransform(page));
  const { bottom } = await edgeGaps(page, item);
  expect(bottom).toBeGreaterThanOrEqual(0);
  expect(bottom).toBeLessThan(justInside);
  expect(down.y).toBeLessThan(across.y);
  expect(down.x).toBe(across.x);
});

test('a pointer drag that carries an element past the edge leaves the view where it is', async ({
  page,
}) => {
  await openEveryGlyph(page);
  await canvasSettled(page);
  const item = nodeNamed(page, store);
  const drawn = await screenBoxOf(item);
  const { right } = await edgeGaps(page, item);
  const before = await viewportTransform(page);
  const from = { x: drawn.x + drawn.width / 8, y: drawn.y + drawn.height / 4 };

  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + right + beyondTheBorder, from.y, {
    steps: 12,
  });
  await page.mouse.up();

  await expect(item).toHaveClass(/selected/u);
  await canvasSettled(page);
  expect(await insideTheViewport(page, item)).toBe(false);
  expect(await viewportTransform(page)).toBe(before);
});

test('a pointer press on an element that lies partly outside the viewport leaves the view where it is', async ({
  page,
}) => {
  await openEveryGlyph(page);
  await canvasSettled(page);
  const item = nodeNamed(page, store);
  await scrollViewBy(page, {
    x: beyondTheBorder + (await edgeGaps(page, item)).right,
    y: 0,
  });
  expect(await insideTheViewport(page, item)).toBe(false);
  const drawn = await screenBoxOf(item);
  const before = await viewportTransform(page);

  await page.mouse.click(drawn.x + drawn.width / 8, drawn.y + drawn.height / 4);

  await expect(item).toBeFocused();
  await expect(item).toHaveClass(/selected/u);
  await canvasSettled(page);
  expect(await viewportTransform(page)).toBe(before);
});

test('an element placed by pointer across the border and named with Enter leaves the view where it is, though Tab was pressed before', async ({
  page,
}) => {
  await openEveryGlyph(page);
  await canvasSettled(page);
  await tabTo(page, nodeNamed(page, firstFlow));
  const viewport = await viewportBox(page);
  const before = await viewportTransform(page);

  await toolButton(page, 'Actor').click();
  await page.mouse.click(
    viewport.x + viewport.width - 6,
    viewport.y + (viewport.height * 2) / 3,
  );
  await expect(nameField(page, 'New actor')).toBeFocused();
  await page.keyboard.press('Enter');

  const placed = nodeNamed(page, /^New actor, actor/u);
  await expect(placed).toBeFocused();
  await expect(placed).toHaveCSS('outline-style', 'solid');
  expect(await insideTheViewport(page, placed)).toBe(false);
  await canvasSettled(page);
  expect(await viewportTransform(page)).toBe(before);
});

test('the pan passes through places on its way, takes its time and keeps one zoom', async ({
  page,
}) => {
  const flow = await firstFlowScrolledOut(page);
  const zoom = await viewportZoom(page);
  await recordView(page);

  await tabTo(page, flow);
  await expect.poll(() => insideTheViewport(page, flow)).toBe(true);
  await canvasSettled(page);

  const { focusedAt, seen } = await viewRecorded(page);
  expect(new Set(seen.map((view) => view.transform)).size).toBeGreaterThan(2);
  expect((seen.at(-1)?.at ?? 0) - focusedAt).toBeGreaterThan(panTakesAtLeast);
  expect(
    seen.filter((view) => !view.transform.includes(`scale(${String(zoom)})`)),
  ).toEqual([]);
});

test('the pan is one step where motion is reduced', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const flow = await firstFlowScrolledOut(page);
  await recordView(page);

  await tabTo(page, flow);
  await expect.poll(() => insideTheViewport(page, flow)).toBe(true);
  await canvasSettled(page);

  expect((await viewRecorded(page)).seen).toHaveLength(1);
});

test('scrolling during the pan takes the view, and the pan does not take it back', async ({
  page,
}) => {
  const flow = await firstFlowScrolledOut(page);
  await scrollOnceTheViewMoves(page, { x: scrolledAcross, y: 0 });

  await tabTo(page, flow);
  await page.waitForFunction(
    (until) => performance.now() >= until,
    await page.evaluate((wait) => performance.now() + wait, panRunsOut),
  );
  await canvasSettled(page);

  const from = offsetIn(
    await page.evaluate(() => window.saerskrivenScrolledFrom ?? ''),
  );
  const rested = offsetIn(await viewportTransform(page));
  expect(rested.x).toBeCloseTo(from.x + scrolledAcross, 1);
  expect(rested.y).toBeCloseTo(from.y, 1);
  expect(await insideTheViewport(page, flow)).toBe(false);
});
