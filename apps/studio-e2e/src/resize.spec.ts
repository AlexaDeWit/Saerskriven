import {
  expect,
  test,
  type CDPSession,
  type Locator,
  type Page,
} from '@playwright/test';
import { boxAt, curveBoundary, modelWith } from '@saerskriven/model/fixtures';
import {
  type Box,
  boxOf,
  centreOf,
  dragBy,
  onScreen,
  type Point,
  pointHandles,
  pressOn,
  reachesAt,
  screenBoxOf,
  touchCancel,
  touchDown,
  touchDrag,
  touchFingers,
  touchSession,
  touchUp,
  viewportZoom,
} from './canvas.fixtures.js';
import {
  openModelDocument,
  openPlaceholder,
  placeholder,
  runFromMenu,
  selectByKeyboard,
  selectNode,
  toolButton,
  undoOffered,
} from './studio.fixtures.js';

const pointerTolerance = 1;

const kiosk = {
  name: 'Kiosk',
  drawn: /^Kiosk, actor/u,
  size: { width: 112.5, height: 80 },
} as const;

const kioskModel = modelWith({
  elements: [boxAt('el-kiosk', 0, 0, 'actor', kiosk.size, kiosk.name)],
});

const perimeter = {
  name: 'Perimeter',
  drawn: /^Perimeter, trust boundary/u,
  points: [
    { x: 0, y: 0 },
    { x: 60, y: 40 },
    { x: 120, y: 0 },
  ],
} as const;

const perimeterModel = modelWith({
  elements: [curveBoundary('el-perimeter', perimeter.points, perimeter.name)],
});

const sideCases = [
  ['top', { x: 0, y: -40 }, 'height'],
  ['right', { x: 40, y: 0 }, 'width'],
  ['bottom', { x: 0, y: 40 }, 'height'],
  ['left', { x: -40, y: 0 }, 'width'],
] as const;

const pastMinimumInsideViewport = 300;

const shrinkingCases = [
  ['top', { x: 0, y: pastMinimumInsideViewport }, 'height'],
  ['right', { x: -pastMinimumInsideViewport, y: 0 }, 'width'],
  ['bottom', { x: 0, y: -pastMinimumInsideViewport }, 'height'],
  ['left', { x: pastMinimumInsideViewport, y: 0 }, 'width'],
] as const;

const sideControl = (node: Locator, side: string, of = 'Actor'): Locator =>
  node.getByRole('button', {
    name: `Resize ${of} from ${side}`,
    exact: true,
  });

const glyphWidthOf = async (node: Locator): Promise<number> =>
  Number(await node.locator('svg').first().getAttribute('width'));

const touchDragged = 60;

const selectKioskForTouch = async (
  page: Page,
): Promise<{
  readonly session: CDPSession;
  readonly node: Locator;
  readonly before: Box;
}> => {
  const session = await touchSession(page);
  await openModelDocument(page, kioskModel);
  const node = await selectNode(page, kiosk.drawn);
  return { session, node, before: await boxOf(node) };
};

const expectFixedOpposite = (side: string, before: Box, after: Box): void => {
  if (side === 'top') {
    expect(after.y + after.height).toBeCloseTo(before.y + before.height);
  } else if (side === 'right') {
    expect(after.x).toBeCloseTo(before.x);
  } else if (side === 'bottom') {
    expect(after.y).toBeCloseTo(before.y);
  } else {
    expect(after.x + after.width).toBeCloseTo(before.x + before.width);
  }
};

const expectOtherAxisFixed = (side: string, before: Box, after: Box): void => {
  if (side === 'top' || side === 'bottom') {
    expect(after.x).toBeCloseTo(before.x);
    expect(after.width).toBeCloseTo(before.width);
  } else {
    expect(after.y).toBeCloseTo(before.y);
    expect(after.height).toBeCloseTo(before.height);
  }
};

test('each side control changes only its axis and fixes the opposite side', async ({
  page,
}) => {
  await openPlaceholder(page);
  const node = await selectNode(page, placeholder.actor);
  const before = await boxOf(node);

  for (const [side, offset, changed] of sideCases) {
    await test.step(side, async () => {
      const control = sideControl(node, side);
      await expect(control).toBeVisible();

      await dragBy(page, control, offset);
      await expect
        .poll(async () => (await boxOf(node))[changed])
        .not.toBe(before[changed]);
      const after = await boxOf(node);

      expectFixedOpposite(side, before, after);
      expectOtherAxisFixed(side, before, after);

      await runFromMenu(page, 'Undo');
      await expect.poll(() => boxOf(node)).toEqual(before);
    });
  }
});

test('the glyph follows the selection bounds during a resize drag', async ({
  page,
}) => {
  await openPlaceholder(page);
  const node = await selectNode(page, placeholder.actor);
  const before = await glyphWidthOf(node);
  const from = await pressOn(page, sideControl(node, 'right'));

  await page.mouse.move(from.x + 40, from.y, { steps: 8 });
  await expect.poll(() => glyphWidthOf(node)).not.toBe(before);
  expect(await glyphWidthOf(node)).toBeCloseTo((await boxOf(node)).width);

  await page.mouse.up();
});

test('each side control stops at the minimum size', async ({ page }) => {
  await openPlaceholder(page);
  const node = await selectNode(page, placeholder.actor);
  const before = await boxOf(node);

  for (const [side, offset, changed] of shrinkingCases) {
    await test.step(side, async () => {
      const control = sideControl(node, side);
      await expect(control).toBeVisible();

      await dragBy(page, control, offset);
      await expect.poll(async () => (await boxOf(node))[changed]).toBe(10);

      expectFixedOpposite(side, before, await boxOf(node));

      await runFromMenu(page, 'Undo');
      await expect.poll(() => boxOf(node)).toEqual(before);
    });
  }
});

test('a no-op resize at the minimum leaves later geometry settled', async ({
  page,
}) => {
  await openPlaceholder(page);
  const node = await selectNode(page, placeholder.actor);
  const right = sideControl(node, 'right');

  await dragBy(page, right, { x: -400, y: 0 });
  await expect.poll(async () => (await boxOf(node)).width).toBe(10);
  await pressOn(page, right);
  await page.mouse.up();

  await runFromMenu(page, 'Undo');
  await expect.poll(async () => (await boxOf(node)).width).toBeGreaterThan(10);
  expect(await glyphWidthOf(node)).toBe((await boxOf(node)).width);
});

test('a press on a control without movement records no edit at a fractional size', async ({
  page,
}) => {
  await openModelDocument(page, kioskModel);
  const node = await selectNode(page, kiosk.drawn);
  const before = await boxOf(node);
  expect(before.width).toBe(kiosk.size.width);
  const right = sideControl(node, 'right', kiosk.name);

  await pressOn(page, right);
  await page.mouse.up();

  await expect(right).toBeFocused();
  expect(await undoOffered(page)).toBe(false);
  expect(await boxOf(node)).toEqual(before);
});

test('a touch drag on a control resizes for the whole drag, as one undo step', async ({
  page,
}) => {
  const { session, node, before } = await selectKioskForTouch(page);
  const from = await centreOf(sideControl(node, 'right', kiosk.name));
  const grown = touchDragged / (await viewportZoom(page));

  await touchDrag(session, from, { x: from.x + touchDragged, y: from.y });

  await expect
    .poll(async () =>
      Math.abs((await boxOf(node)).width - before.width - grown),
    )
    .toBeLessThanOrEqual(pointerTolerance);

  await runFromMenu(page, 'Undo');

  await expect.poll(() => boxOf(node)).toEqual(before);
  expect(await undoOffered(page)).toBe(false);
  expect(await glyphWidthOf(node)).toBe(before.width);
  await session.detach();
});

test('a touch resize cut short by a deselect is put back, and a still press after it records no edit', async ({
  page,
}) => {
  const { session, node, before } = await selectKioskForTouch(page);
  const right = sideControl(node, 'right', kiosk.name);
  const from = await centreOf(right);

  await touchDown(session, from, { x: from.x + touchDragged, y: from.y });
  await expect
    .poll(async () => (await boxOf(node)).width)
    .not.toBe(before.width);
  await page.keyboard.press('Escape');
  await expect(node).not.toHaveClass(/selected/u);
  await touchUp(session);

  await expect.poll(() => boxOf(node)).toEqual(before);
  await expect.poll(() => glyphWidthOf(node)).toBe(before.width);
  expect(await undoOffered(page)).toBe(false);

  await selectNode(page, kiosk.drawn);
  await pressOn(page, right);
  await page.mouse.up();

  await expect(right).toBeFocused();
  expect(await undoOffered(page)).toBe(false);
  expect(await boxOf(node)).toEqual(before);
  await session.detach();
});

test('a cancelled touch resize is put back, and a still touch after it records no edit', async ({
  page,
}) => {
  const { session, node, before } = await selectKioskForTouch(page);
  const right = sideControl(node, 'right', kiosk.name);
  const from = await centreOf(right);

  await touchDown(session, from, { x: from.x + touchDragged, y: from.y });
  await expect
    .poll(async () => (await boxOf(node)).width)
    .not.toBe(before.width);
  await touchCancel(session);

  await expect.poll(() => boxOf(node)).toEqual(before);
  await expect.poll(() => glyphWidthOf(node)).toBe(before.width);
  expect(await undoOffered(page)).toBe(false);

  await touchDrag(session, from, from);

  await expect(right).toBeFocused();
  expect(await undoOffered(page)).toBe(false);
  expect(await boxOf(node)).toEqual(before);
  await session.detach();
});

test('a second finger on another control resizes nothing while the first holds the element', async ({
  page,
}) => {
  const { session, node, before } = await selectKioskForTouch(page);
  const from = await centreOf(sideControl(node, 'right', kiosk.name));
  const held = { x: from.x + touchDragged, y: from.y };
  const bottom = sideControl(node, 'bottom', kiosk.name);
  const grown = touchDragged / (await viewportZoom(page));

  await touchDown(session, from, held);
  await onScreen(bottom);
  const other = await centreOf(bottom);
  const moved = { x: other.x, y: other.y + touchDragged };
  await touchFingers(session, 'touchStart', [
    [1, held],
    [2, other],
  ]);
  await touchFingers(session, 'touchEnd', [[1, held]]);
  await touchFingers(session, 'touchMove', [[2, moved]]);
  await touchUp(session);

  await expect
    .poll(async () =>
      Math.abs((await boxOf(node)).width - before.width - grown),
    )
    .toBeLessThanOrEqual(pointerTolerance);
  expect((await boxOf(node)).height).toBe(before.height);
  await runFromMenu(page, 'Undo');
  await expect.poll(() => boxOf(node)).toEqual(before);
  expect(await undoOffered(page)).toBe(false);
  await session.detach();
});

test('a second finger on the border of a corner handle leaves the resize under the first as it is', async ({
  page,
}) => {
  const session = await touchSession(page);
  await openModelDocument(page, perimeterModel);
  const curve = await selectByKeyboard(page, perimeter.drawn);
  await expect(pointHandles(page)).toHaveCount(perimeter.points.length);
  const right = sideControl(curve, 'right', perimeter.name);
  await onScreen(right);
  const from = await centreOf(right);
  const held = { x: from.x + touchDragged, y: from.y };

  await touchDown(session, from, held);
  await expect(pointHandles(page)).toHaveCount(0);
  const button = sideControl(curve, 'bottom left corner', perimeter.name);
  const corner = button.locator('..');
  const drawn = await screenBoxOf(corner);
  const border = {
    x: Math.round(drawn.x + (await viewportZoom(page)) / 2),
    y: Math.round(drawn.y + drawn.height / 2),
  };
  expect(await reachesAt(corner, border)).toBe(true);
  expect(await reachesAt(button, border)).toBe(false);
  await touchFingers(session, 'touchStart', [
    [1, held],
    [2, border],
  ]);
  await touchFingers(session, 'touchEnd', [[2, border]]);

  await expect(pointHandles(page)).toHaveCount(0);
  await touchUp(session);
  await expect(pointHandles(page)).toHaveCount(perimeter.points.length);
  await runFromMenu(page, 'Undo');
  expect(await undoOffered(page)).toBe(false);
  await session.detach();
});

test('a still touch on a corner after a touch resize from the bottom records no edit', async ({
  page,
}) => {
  const { session, node, before } = await selectKioskForTouch(page);
  const from = await centreOf(sideControl(node, 'bottom', kiosk.name));
  const grown = touchDragged / (await viewportZoom(page));

  await touchDrag(session, from, { x: from.x, y: from.y + touchDragged });
  await expect
    .poll(async () =>
      Math.abs((await boxOf(node)).height - before.height - grown),
    )
    .toBeLessThanOrEqual(pointerTolerance);
  const resized = await boxOf(node);
  expect(resized.width).toBe(before.width);

  const corner = sideControl(node, 'bottom right corner', kiosk.name);
  const at = await centreOf(corner);
  await touchDrag(session, at, at);

  await expect(corner).toBeFocused();
  expect(await boxOf(node)).toEqual(resized);
  await runFromMenu(page, 'Undo');
  await expect.poll(() => boxOf(node)).toEqual(before);
  expect(await undoOffered(page)).toBe(false);
  await session.detach();
});

test('a corner resizes both axes in one undo step', async ({ page }) => {
  await openPlaceholder(page);
  const node = await selectNode(page, placeholder.actor);
  const before = await boxOf(node);
  const corner = node
    .getByRole('button', {
      name: 'Resize Actor from top left corner',
      exact: true,
    })
    .locator('..');

  await dragBy(page, corner, { x: -40, y: -40 });
  await expect.poll(async () => (await boxOf(node)).x).not.toBe(before.x);
  const resized = await boxOf(node);
  expect(resized.width).not.toBe(before.width);
  expect(resized.height).not.toBe(before.height);

  await runFromMenu(page, 'Undo');

  await expect.poll(() => boxOf(node)).toEqual(before);
});

test('pan and zoom preserve the model-space resize result', async ({
  page,
}) => {
  await openPlaceholder(page);
  let node = await selectNode(page, placeholder.actor);
  const original = await boxOf(node);
  const modelOffset = 20;
  await dragBy(page, sideControl(node, 'right'), {
    x: modelOffset * (await viewportZoom(page)),
    y: 0,
  });
  await expect
    .poll(async () => (await boxOf(node)).width)
    .not.toBe(original.width);
  const plainDelta = (await boxOf(node)).width - original.width;
  await runFromMenu(page, 'Undo');

  await page.getByRole('button', { name: 'Zoom out' }).click();
  await toolButton(page, 'Hand').click();
  await dragBy(page, page.locator('.react-flow__pane'), { x: 80, y: 40 });
  await toolButton(page, 'Select').click();

  node = await selectNode(page, placeholder.actor);
  const before = await boxOf(node);
  const offset: Point = { x: modelOffset * (await viewportZoom(page)), y: 0 };

  await dragBy(page, sideControl(node, 'right'), offset);
  await expect
    .poll(async () => (await boxOf(node)).width)
    .not.toBe(before.width);
  const after = await boxOf(node);
  expect(Math.abs(after.width - before.width - plainDelta)).toBeLessThanOrEqual(
    pointerTolerance,
  );
  expect(after.x).toBeCloseTo(before.x);
  expect(after.y).toBeCloseTo(before.y);
});

test('arrow keys resize from a focused side control', async ({ page }) => {
  await openPlaceholder(page);
  const node = await selectNode(page, placeholder.actor);
  const before = await boxOf(node);
  const top = node.getByRole('button', {
    name: 'Resize Actor from top',
    exact: true,
  });

  await top.focus();
  await top.press('ArrowUp');

  await expect.poll(async () => (await boxOf(node)).y).toBe(before.y - 5);
  const after = await boxOf(node);
  expect(after.height).toBe(before.height + 5);
  expect(after.y + after.height).toBe(before.y + before.height);
});
