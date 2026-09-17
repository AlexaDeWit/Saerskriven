import { expect, test, type Locator, type Page } from '@playwright/test';
import { halfwayAlong, lineOf } from './canvas-geometry.fixtures.js';
import {
  beforeCanvas,
  canvasSettled,
  canvasSurface,
  centreOf,
  dragBy,
  dragOnto,
  elementNodes,
  handleOn,
  nodeNamed,
  openPlaceholder,
  openTwoDiagrams,
  placeOf,
  runFromMenu,
  selectNode,
  toolButton,
} from './studio.fixtures.js';

const boundaryHandlePoint = async (
  boundary: Locator,
  side: 'top' | 'bottom',
): Promise<{ readonly x: number; readonly y: number }> =>
  centreOf(handleOn(boundary, side));

const expectBoundaryHitTarget = async (
  page: Page,
  at: { readonly x: number; readonly y: number },
): Promise<void> => {
  await page.mouse.move(at.x, at.y);
  const target = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.getAttribute('class') ?? '',
    at,
  );
  expect(target).toContain('pn-boundary-hit-target');
};

const dragFromBoundaryHandle = async (
  page: Page,
  boundary: Locator,
  side: 'top' | 'bottom',
): Promise<void> => {
  await canvasSettled(page);
  const from = await boundaryHandlePoint(boundary, side);
  await expectBoundaryHitTarget(page, from);
  const before = await placeOf(boundary);

  await page.mouse.down();
  await page.mouse.move(from.x + 30, from.y + 30, { steps: 8 });
  await expect(boundary).toHaveClass(/dragging/u);
  await page.mouse.up();

  await expect.poll(() => placeOf(boundary)).not.toBe(before);
};

test('a real model is drawn whole: 7 elements and 7 flows', async ({
  page,
}) => {
  await openTwoDiagrams(page);

  await expect(elementNodes(page)).toHaveCount(7);
  await expect(page.locator('.react-flow__edge')).toHaveCount(7);
  await expect(nodeNamed(page, /^Web shop, process/u)).toBeVisible();
});

test('tabbing into a real model reaches every flow before any element', async ({
  page,
}) => {
  await openTwoDiagrams(page);

  await beforeCanvas(page).focus();
  await page.keyboard.press('Tab');

  await expect(page.locator('.react-flow__edge:focus')).toHaveCount(1);
});

test('a click selects an element and the canvas draws the selection', async ({
  page,
}) => {
  await openPlaceholder(page);
  const actor = nodeNamed(page, /^Actor, actor/u);

  await actor.click();

  await expect(actor).toHaveClass(/selected/u);
  await expect(nodeNamed(page, /^Store, store/u)).not.toHaveClass(/selected/u);
});

test('the selection moves between an element and a flow, either way', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  const webShop = nodeNamed(page, /^Web shop, process/u);
  const selectedFlow = page.locator('.react-flow__edge.selected');

  await webShop.click();
  await expect(webShop).toHaveClass(/selected/u);

  await beforeCanvas(page).focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(selectedFlow).toHaveCount(1);
  await expect(webShop).not.toHaveClass(/selected/u);

  await webShop.click();
  await expect(webShop).toHaveClass(/selected/u);
  await expect(selectedFlow).toHaveCount(0);
});

test('a flow under a selected trust boundary takes a line or label click', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  const boundary = nodeNamed(page, /^Shop network, trust boundary/u);
  const flowName = /^read the product listings, flow/u;
  const flow = nodeNamed(page, flowName);

  const onOutline = await boundaryHandlePoint(boundary, 'bottom');
  await page.mouse.click(onOutline.x, onOutline.y);
  await expect(boundary).toHaveClass(/selected/u);
  await canvasSettled(page);

  const onLine = await halfwayAlong(lineOf(page, flowName));
  await page.mouse.click(onLine.x, onLine.y);
  await expect(flow).toHaveClass(/selected/u);
  await expect(boundary).not.toHaveClass(/selected/u);

  await page.mouse.click(onOutline.x, onOutline.y);
  await canvasSettled(page);
  await flow.locator('.pn-flow-label').click();
  await expect(flow).toHaveClass(/selected/u);
  await expect(boundary).not.toHaveClass(/selected/u);
});

test('a trust boundary selects from its drawn name', async ({ page }) => {
  await openTwoDiagrams(page);
  const boundary = nodeNamed(page, /^Shop network, trust boundary/u);

  await boundary.locator('.pn-label').click();

  await expect(boundary).toHaveClass(/selected/u);
});

test('a trust boundary selects and drags from its outline', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  const boundary = nodeNamed(page, /^Shop network, trust boundary/u);

  const onOutline = await boundaryHandlePoint(boundary, 'bottom');
  await expectBoundaryHitTarget(page, onOutline);
  await page.mouse.click(onOutline.x, onOutline.y);
  await expect(boundary).toHaveClass(/selected/u);
  await dragFromBoundaryHandle(page, boundary, 'bottom');
});

test('a curve boundary drags where its outline crosses a disabled handle', async ({
  page,
}) => {
  await openPlaceholder(page);
  await toolButton(page, 'Trust boundary curve').click();
  await canvasSurface(page).focus();
  await page.keyboard.press('Enter');
  const boundary = nodeNamed(page, /^New trust boundary curve/u);
  await expect(boundary).toHaveClass(/selected/u);
  await page.keyboard.press('Enter');

  await dragFromBoundaryHandle(page, boundary, 'top');
});

test('a selected regular node stays above a later overlapping node', async ({
  page,
}) => {
  await openPlaceholder(page);
  const actor = await selectNode(page, /^Actor, actor/u);
  await page.getByRole('button', { name: 'Fit to view' }).click();
  const store = nodeNamed(page, /^Store, store/u);
  await dragOnto(page, actor, store);
  const actorBox = await actor.boundingBox();
  const storeBox = await store.boundingBox();
  expect(actorBox).not.toBeNull();
  expect(storeBox).not.toBeNull();
  const overlap = {
    left: Math.max(actorBox?.x ?? 0, storeBox?.x ?? 0),
    top: Math.max(actorBox?.y ?? 0, storeBox?.y ?? 0),
    right: Math.min(
      (actorBox?.x ?? 0) + (actorBox?.width ?? 0),
      (storeBox?.x ?? 0) + (storeBox?.width ?? 0),
    ),
    bottom: Math.min(
      (actorBox?.y ?? 0) + (actorBox?.height ?? 0),
      (storeBox?.y ?? 0) + (storeBox?.height ?? 0),
    ),
  };
  expect(overlap.right).toBeGreaterThan(overlap.left);
  expect(overlap.bottom).toBeGreaterThan(overlap.top);
  const sharedCentre = {
    x: (overlap.left + overlap.right) / 2,
    y: (overlap.top + overlap.bottom) / 2,
  };

  const top = await page.evaluate(
    ({ x, y }) =>
      document
        .elementFromPoint(x, y)
        ?.closest('.react-flow__node')
        ?.getAttribute('data-id'),
    sharedCentre,
  );
  expect(top).toBe(await actor.getAttribute('data-id'));
});

test('a drag moves the element through the store, and undo puts it back', async ({
  page,
}) => {
  await openPlaceholder(page);
  const actor = nodeNamed(page, /^Actor, actor/u);
  const before = await placeOf(actor);

  await dragBy(page, actor, 60);

  await expect.poll(() => placeOf(actor)).not.toBe(before);

  await runFromMenu(page, 'Undo');

  await expect.poll(() => placeOf(actor)).toBe(before);
});

test('an element is reachable, selectable and movable by keyboard alone', async ({
  page,
}) => {
  await openPlaceholder(page);
  const actor = nodeNamed(page, /^Actor, actor/u);

  await beforeCanvas(page).focus();
  await page.keyboard.press('Tab');
  await expect(nodeNamed(page, /^Records, flow/u)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(actor).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(nodeNamed(page, /^Store, store/u)).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(actor).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(actor).toHaveClass(/selected/u);

  const selected = await placeOf(actor);
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => placeOf(actor)).not.toBe(selected);

  await runFromMenu(page, 'Undo');
  await expect.poll(() => placeOf(actor)).toBe(selected);
});
