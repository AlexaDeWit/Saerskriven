import { expect, test, type Locator, type Page } from '@playwright/test';
import { darkPalette, lightPalette, rgbColour } from '@saerskriven/canvas';
import { committedText } from '@saerskriven/model/fixtures';
import {
  boxesOverlap,
  canvasContainer,
  canvasSettled,
  centreOf,
  focusRingShown,
  halfwayAlong,
  lineOf,
  screenBoxOf,
  viewportTransform,
  viewportZoom,
  type Box,
  type Point,
} from './canvas.fixtures.js';
import {
  beforeCanvas,
  closeThreats,
  nodeNamed,
  openModelDocument,
  selectByKeyboard,
  selectNode,
  tabTo,
  threatPanel,
  undoOffered,
} from './studio.fixtures.js';

const shownOnAnElement = 0.8;

const shownPastElementsAtItsEnds = 0.5;

const shownOnAControl = 0.9;

const actor = /^Customer\sbrowser, actor/u;

const store = /^Order database, store/u;

const boundaryBox = /^Service perimeter, trust boundary/u;

const boundaryCurve = /^Edge zone, trust boundary/u;

const flowIntoTheStore = /^Store order, flow/u;

const items = [
  ['an actor', actor, shownOnAnElement],
  ['a process', /^Order API, process/u, shownOnAnElement],
  ['a store', store, shownOnAnElement],
  ['a note', /^Retention note, text/u, shownOnAnElement],
  ['a trust boundary box', boundaryBox, shownOnAnElement],
  ['a trust boundary curve', boundaryCurve, shownOnAnElement],
  ['a flow', /^Submit order, flow/u, shownPastElementsAtItsEnds],
] as const;

const resized = [
  ['an element', actor],
  ['a trust boundary box', boundaryBox],
  ['a trust boundary curve', boundaryCurve],
] as const;

const schemes = [
  ['light', lightPalette],
  ['dark', darkPalette],
] as const;

const resizeControls = '.react-flow__resize-control > button';

const stopsJustClear = 16;

const panTakesAtLeast = 400;

const scrolledAcross = -100;

const panRunsOut = 1000;

const openEveryGlyphFitted = async (page: Page): Promise<void> => {
  await openModelDocument(
    page,
    JSON.parse(committedText('every-glyph.model.json')),
  );
  await canvasSettled(page);
};

const openEveryGlyph = async (page: Page): Promise<void> => {
  await openEveryGlyphFitted(page);
  await page.getByRole('button', { name: 'Reset zoom to 100%' }).click();
  await canvasSettled(page);
};

const panes = (page: Page): Locator => page.locator('[data-pane]');

const paneBoxes = async (page: Page): Promise<Box[]> =>
  Promise.all((await panes(page).all()).map((pane) => screenBoxOf(pane)));

const underAPane = async (page: Page, item: Locator): Promise<boolean> => {
  const drawn = await screenBoxOf(item);
  return (await paneBoxes(page)).some((pane) => boxesOverlap(drawn, pane));
};

const liesWithin = (inner: Box, outer: Box): boolean =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

const gapBetween = (one: Box, other: Box): number =>
  Math.max(
    other.x - (one.x + one.width),
    one.x - (other.x + other.width),
    other.y - (one.y + one.height),
    one.y - (other.y + other.height),
  );

const viewportOffset = async (page: Page): Promise<Point> => {
  const [x, y] = [
    ...(await viewportTransform(page)).matchAll(/(-?[\d.]+)px/gu),
  ].map((found) => Number(found[1]));
  return { x: x ?? Number.NaN, y: y ?? Number.NaN };
};

const scrollViewBy = async (page: Page, by: Point): Promise<void> => {
  const over = await centreOf(canvasContainer(page));
  await page.mouse.move(over.x, over.y);
  await page.mouse.wheel(-2 * by.x, -2 * by.y);
};

const scrollOnceTheViewMoves = async (page: Page, by: Point): Promise<void> => {
  await page.evaluate(
    (wheel) => {
      const viewport = document.querySelector('.react-flow__viewport');
      const from = viewport?.getAttribute('style');
      const moved = new MutationObserver(() => {
        if (viewport?.getAttribute('style') !== from) {
          moved.disconnect();
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

const selectActorByPointer = async (page: Page): Promise<Locator> => {
  await openEveryGlyphFitted(page);
  const selected = await selectNode(page, actor);
  await expect(threatPanel(page)).toBeVisible();
  await canvasSettled(page);
  return selected;
};

const expectShown = (shown: number, least: number, what: string): void => {
  test.info().annotations.push({
    type: 'focus ring shown',
    description: `${what}: ${shown.toFixed(3)} of at least ${String(least)}`,
  });
  expect.soft(shown, what).toBeGreaterThanOrEqual(least);
};

const expectRingOnItems = async (
  page: Page,
  colour: string | undefined,
): Promise<void> => {
  for (const [kind, name, least] of items) {
    await test.step(kind, async () => {
      const item = nodeNamed(page, name);
      const shown = await focusRingShown(item, beforeCanvas(page), async () => {
        await tabTo(page, item);
        if (colour !== undefined) {
          await expect(item).toHaveCSS('outline-color', colour);
        }
      });
      expectShown(shown, least, kind);
    });
  }
};

for (const [scheme, palette] of schemes) {
  test(`every kind of canvas item shows the focus ring over its own drawing from the keyboard, ${scheme}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await openEveryGlyph(page);

    await expectRingOnItems(page, rgbColour(palette.actionPrimary));
  });

  for (const [kind, name] of resized) {
    test(`every resize control on ${kind} shows the focus ring from the keyboard, ${scheme}`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await openEveryGlyph(page);
      const node = await selectByKeyboard(page, name);
      await closeThreats(page);
      await expect(node).toBeFocused();
      const controls = node.locator(resizeControls);
      await expect(controls).toHaveCount(8);

      for (const control of await controls.all()) {
        const shown = await focusRingShown(control, beforeCanvas(page), () =>
          tabTo(page, control, node),
        );
        expectShown(
          shown,
          shownOnAControl,
          (await control.getAttribute('aria-label')) ?? kind,
        );
      }
    });
  }
}

test('the focus ring on every kind of canvas item survives forced colours', async ({
  page,
}) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await openEveryGlyph(page);

  await expectRingOnItems(page, undefined);
});

test('every resize control on a trust boundary shows its ring clear of the open panes at the default fit', async ({
  page,
}) => {
  await openEveryGlyphFitted(page);
  const node = await selectByKeyboard(page, boundaryBox);
  await expect(node).toBeFocused();
  const zoom = await viewportZoom(page);
  const controls = node.locator(resizeControls);
  await expect(controls).toHaveCount(8);

  for (const control of await controls.all()) {
    const shown = await focusRingShown(control, beforeCanvas(page), () =>
      tabTo(page, control, node),
    );
    const name = (await control.getAttribute('aria-label')) ?? 'a control';
    expectShown(shown, shownOnAControl, name);
    expect.soft(await underAPane(page, control), name).toBe(false);
  }
  expect(await viewportZoom(page)).toBe(zoom);
});

test('a resize control wholly under the Trust boundary card pans clear of it and shows its ring', async ({
  page,
}) => {
  await openEveryGlyphFitted(page);
  const node = await selectByKeyboard(page, boundaryBox);
  await closeThreats(page);
  await expect(node).toBeFocused();
  const control = node.getByRole('button', {
    name: 'Resize Service perimeter from left',
    exact: true,
  });
  const card = page.getByRole('region', {
    name: 'Trust boundary',
    exact: true,
  });
  const from = await centreOf(control);
  const under = await centreOf(card);
  await scrollViewBy(page, { x: under.x - from.x, y: under.y - from.y });
  await canvasSettled(page);
  expect(
    liesWithin(await screenBoxOf(control), await screenBoxOf(card)),
    'the control lies wholly under the card',
  ).toBe(true);

  const shown = await focusRingShown(control, beforeCanvas(page), () =>
    tabTo(page, control, node),
  );

  expectShown(shown, shownOnAControl, 'the left control');
  expect(await underAPane(page, control)).toBe(false);
});

test('an element under the threat panel pans just clear of it when Tab lands on it, at the same zoom and as no edit', async ({
  page,
}) => {
  const selected = await selectActorByPointer(page);
  const item = nodeNamed(page, store);
  const zoom = await viewportZoom(page);
  expect(await underAPane(page, item)).toBe(true);

  const shown = await focusRingShown(item, beforeCanvas(page), () =>
    tabTo(page, item, selected),
  );

  expectShown(shown, shownOnAnElement, 'the store');
  const gap = gapBetween(
    await screenBoxOf(item),
    await screenBoxOf(threatPanel(page)),
  );
  expect(gap).toBeGreaterThanOrEqual(0);
  expect(gap).toBeLessThan(stopsJustClear);
  expect(await viewportZoom(page)).toBe(zoom);
  expect(await undoOffered(page)).toBe(false);
});

test('the pan passes through places on its way, takes its time and keeps one zoom', async ({
  page,
}) => {
  const selected = await selectActorByPointer(page);
  const item = nodeNamed(page, store);
  const zoom = await viewportZoom(page);
  await recordView(page);

  await tabTo(page, item, selected);
  await expect.poll(() => underAPane(page, item)).toBe(false);
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
  const selected = await selectActorByPointer(page);
  const item = nodeNamed(page, store);
  await recordView(page);

  await tabTo(page, item, selected);
  await expect.poll(() => underAPane(page, item)).toBe(false);
  await canvasSettled(page);

  expect((await viewRecorded(page)).seen).toHaveLength(1);
});

test('scrolling during the pan takes the view, and the pan does not take it back', async ({
  page,
}) => {
  const selected = await selectActorByPointer(page);
  const item = nodeNamed(page, store);
  const before = await viewportOffset(page);
  await scrollOnceTheViewMoves(page, { x: scrolledAcross, y: 0 });

  await tabTo(page, item, selected);
  await page.waitForFunction(
    (until) => performance.now() >= until,
    await page.evaluate((wait) => performance.now() + wait, panRunsOut),
  );
  await canvasSettled(page);

  expect((await viewportOffset(page)).x).toBeCloseTo(
    before.x + scrolledAcross,
    1,
  );
  expect(await underAPane(page, item)).toBe(true);
});

test('a pointer press on a flow the threat panel partly covers leaves the view where it is', async ({
  page,
}) => {
  await selectActorByPointer(page);
  const flow = nodeNamed(page, flowIntoTheStore);
  expect(await underAPane(page, flow)).toBe(true);
  const before = await viewportTransform(page);
  const at = await halfwayAlong(lineOf(page, flowIntoTheStore));

  await page.mouse.click(at.x, at.y);

  await expect(flow).toBeFocused();
  await canvasSettled(page);
  expect(await viewportTransform(page)).toBe(before);
});

test('closing the threat panel over the focused element returns focus to it and leaves the view where it is', async ({
  page,
}) => {
  await openEveryGlyphFitted(page);
  const node = await selectByKeyboard(page, store);
  expect(await underAPane(page, node)).toBe(true);
  const before = await viewportTransform(page);

  await closeThreats(page);

  await expect(node).toBeFocused();
  await canvasSettled(page);
  expect(await viewportTransform(page)).toBe(before);
});

test('an element too large to bring clear of the threat panel leaves the view where it is', async ({
  page,
}) => {
  const selected = await selectActorByPointer(page);
  const boundary = nodeNamed(page, boundaryBox);
  expect(await underAPane(page, boundary)).toBe(true);
  const before = await viewportTransform(page);

  await selected.focus();
  for (
    let pressed = 0;
    pressed < 10 &&
    !(await boundary.evaluate((node) => node === document.activeElement));
    pressed += 1
  ) {
    await page.keyboard.press('Shift+Tab');
  }

  await expect(boundary).toBeFocused();
  await expect(boundary).toHaveCSS('outline-style', 'solid');
  await canvasSettled(page);
  expect(await viewportTransform(page)).toBe(before);
});
