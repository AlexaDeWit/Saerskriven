import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  boxOf,
  boxSelect,
  canvasContainer,
  canvasSettled,
  clearPositionOn,
  drawnBy,
  emptyCanvasPoint,
  lineOf,
  pressOn,
  screenBoxOf,
  viewportTransform,
} from './canvas.fixtures.js';
import { registeredChords } from './chords.fixtures.js';
import {
  canvasSurface,
  focusSettled,
  nodeNamed,
  openPlaceholder,
  openTwoDiagrams,
  placeholder,
  selectByKeyboard,
  selectNode,
  storefront,
  undoOffered,
} from './studio.fixtures.js';

const warehouseFloor = /^Warehouse floor, trust boundary/u;

const escapeTwiceFromCard = async (
  page: Page,
  command: Locator,
  item: Locator,
): Promise<void> => {
  await command.focus();
  await expect(page.getByRole('tooltip')).toBeVisible();

  await page.keyboard.press('Escape');

  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await expect(item).toHaveClass(/selected/u);
  await expect(command).toBeFocused();

  await page.keyboard.press('Escape');

  await expect(command).toHaveCount(0);
  await expect(item).not.toHaveClass(/selected/u);
  await focusSettled(item);
};

const selected = (page: Page): Locator =>
  page.locator('.react-flow__node.selected, .react-flow__edge.selected');

const escapeMidDrag = async (page: Page, from: Locator): Promise<void> => {
  const at = await pressOn(page, from);
  const before = await boxOf(from);
  await page.mouse.move(at.x + 60, at.y + 40, { steps: 8 });
  await expect
    .poll(async () => (await boxOf(from)).x, 'the drag is under way')
    .not.toBe(before.x);
  await page.keyboard.press('Escape');
  await page.mouse.move(at.x + 90, at.y + 70, { steps: 4 });
  await page.mouse.up();
};

test('Escape mid-drag puts a multi-selection back, records nothing, and clears the selection', async ({
  page,
}) => {
  await openPlaceholder(page);
  const actor = nodeNamed(page, placeholder.actor);
  const store = nodeNamed(page, placeholder.store);
  const flow = lineOf(page, placeholder.records);
  await page.keyboard.press('ControlOrMeta+a');
  await expect(selected(page)).toHaveCount(3);
  const actorBefore = await boxOf(actor);
  const storeBefore = await boxOf(store);
  const flowBefore = await drawnBy(flow);

  await escapeMidDrag(page, actor);

  await expect(selected(page)).toHaveCount(0);
  await expect(canvasContainer(page)).toHaveAttribute(
    'data-active-tool',
    'select',
  );
  await expect.poll(() => boxOf(actor)).toEqual(actorBefore);
  expect(await boxOf(store)).toEqual(storeBefore);
  await expect.poll(() => drawnBy(flow)).toBe(flowBefore);
  expect(await undoOffered(page)).toBe(false);
});

test('Escape mid-drag puts a single element back and records nothing', async ({
  page,
}) => {
  await openPlaceholder(page);
  const actor = nodeNamed(page, placeholder.actor);
  const flow = lineOf(page, placeholder.records);
  const actorBefore = await boxOf(actor);
  const flowBefore = await drawnBy(flow);

  await escapeMidDrag(page, actor);

  await expect(selected(page)).toHaveCount(0);
  await expect.poll(() => boxOf(actor)).toEqual(actorBefore);
  await expect.poll(() => drawnBy(flow)).toBe(flowBefore);
  expect(await undoOffered(page)).toBe(false);

  await actor.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowRight');

  await expect.poll(async () => (await boxOf(actor)).x).toBe(actorBefore.x + 5);
  expect((await boxOf(actor)).y).toBe(actorBefore.y);
});

test('a drag put back by Escape no longer pans the view at the canvas edge', async ({
  page,
}) => {
  await openPlaceholder(page);
  const actor = nodeNamed(page, placeholder.actor);
  const canvas = await screenBoxOf(canvasContainer(page), 'the canvas');
  const at = await pressOn(page, actor);
  await page.mouse.move(at.x + 20, at.y + 20, { steps: 4 });
  await page.keyboard.press('Escape');

  await page.mouse.move(canvas.x + canvas.width - 10, at.y + 20, {
    steps: 6,
  });
  const held = await viewportTransform(page);
  await canvasSettled(page);

  expect(await viewportTransform(page)).toBe(held);
  await page.mouse.up();
});

test('a drag a blurred window put back stays ended through an arrow key, a pointer move and the release', async ({
  page,
}) => {
  await openPlaceholder(page);
  const actor = nodeNamed(page, placeholder.actor);
  const store = nodeNamed(page, placeholder.store);
  await page.keyboard.press('ControlOrMeta+a');
  const actorBefore = await boxOf(actor);
  const storeBefore = await boxOf(store);
  const pane = await emptyCanvasPoint(page);
  const at = await pressOn(page, actor);
  await page.mouse.move(at.x + 60, at.y + 40, { steps: 8 });
  await expect
    .poll(async () => (await boxOf(actor)).x, 'the drag is under way')
    .not.toBe(actorBefore.x);

  await page.evaluate(() => {
    window.dispatchEvent(new Event('blur'));
  });
  await actor.focus();
  await page.keyboard.press('ArrowRight');
  await page.mouse.move(pane.x, pane.y, { steps: 6 });
  await page.mouse.up();

  await expect
    .poll(() => boxOf(actor))
    .toEqual({ ...actorBefore, x: actorBefore.x + 5 });
  expect(await boxOf(store)).toEqual({ ...storeBefore, x: storeBefore.x + 5 });
});

test('a press that crosses the drag threshold and moves nothing leaves the next keyboard move alone', async ({
  page,
}) => {
  await openPlaceholder(page);
  const actor = nodeNamed(page, placeholder.actor);
  const store = nodeNamed(page, placeholder.store);
  const storeBefore = await boxOf(store);
  const at = await pressOn(page, actor);
  await page.mouse.move(at.x + 2, at.y, { steps: 1 });
  await page.mouse.up();

  await store.click({ position: await clearPositionOn(store) });
  await expect(store).toHaveClass(/selected/u);
  await page.keyboard.press('ArrowRight');

  await expect.poll(async () => (await boxOf(store)).x).toBe(storeBefore.x + 5);
});

test('Escape that clears the selection leaves focus on the element, flow or trust boundary that had it', async ({
  page,
}) => {
  await openTwoDiagrams(page);

  for (const name of [
    storefront.shopper,
    /^return the rendered page, flow/u,
    storefront.shopNetwork,
  ]) {
    const item = await selectByKeyboard(page, name);

    await page.keyboard.press('Escape');

    await expect(item).not.toHaveClass(/selected/u);
    await focusSettled(item);
  }
});

test('Escape on a selected element resize control moves focus to the element', async ({
  page,
}) => {
  await openPlaceholder(page);
  const actor = await selectNode(page, placeholder.actor);
  const control = actor.getByRole('button', {
    name: 'Resize Actor from top',
    exact: true,
  });
  await control.focus();

  await page.keyboard.press('Escape');

  await expect(control).toHaveCount(0);
  await expect(actor).not.toHaveClass(/selected/u);
  await focusSettled(actor);
});

test('Escape on a bend or end handle, the route toolbar or a flow card icon moves focus to the selected flow', async ({
  page,
}) => {
  await openPlaceholder(page);
  const flow = await selectByKeyboard(page, placeholder.records);
  await page.keyboard.press(registeredChords['add-bend'][0]);
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');

  for (const handle of [
    page.getByRole('button', { name: 'Bend 1', exact: true }),
    page.getByRole('button', { name: 'Flow source end', exact: true }),
  ]) {
    await handle.focus();

    await page.keyboard.press('Escape');

    await expect(handle).toHaveCount(0);
    await expect(flow).not.toHaveClass(/selected/u);
    await focusSettled(flow);
    await page.keyboard.press('Enter');
  }

  await escapeTwiceFromCard(
    page,
    page.getByRole('button', { name: 'Add bend', exact: true }),
    flow,
  );
  await page.keyboard.press('Enter');

  await escapeTwiceFromCard(
    page,
    page.getByRole('button', { name: 'Change flow source', exact: true }),
    flow,
  );
});

test('Escape on a point handle, or twice on the shape switch icon, of a selected curve moves focus to the trust boundary', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  await page.keyboard.press(registeredChords['next-diagram'][0]);
  const boundary = await selectByKeyboard(page, warehouseFloor);
  const point = page.getByRole('button', { name: 'Point 1', exact: true });
  await point.focus();

  await page.keyboard.press('Escape');

  await expect(point).toHaveCount(0);
  await expect(boundary).not.toHaveClass(/selected/u);
  await focusSettled(boundary);

  await page.keyboard.press('Enter');
  await escapeTwiceFromCard(
    page,
    page.getByRole('button', { name: 'Switch boundary shape', exact: true }),
    boundary,
  );
});

test('Escape after a box selection moves focus to the canvas, or keeps it on the element that has it', async ({
  page,
}) => {
  await openPlaceholder(page);
  const actor = nodeNamed(page, placeholder.actor);
  const store = nodeNamed(page, placeholder.store);
  await boxSelect(page, [actor, store]);

  await page.keyboard.press('Escape');

  await expect(selected(page)).toHaveCount(0);
  await focusSettled(canvasSurface(page));

  await boxSelect(page, [actor, store]);
  await store.focus();

  await page.keyboard.press('Escape');

  await expect(selected(page)).toHaveCount(0);
  await focusSettled(store);
});
