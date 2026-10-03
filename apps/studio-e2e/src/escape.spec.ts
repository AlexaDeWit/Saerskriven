import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  boxOf,
  boxSelect,
  canvasContainer,
  drawnBy,
  lineOf,
  pressOn,
} from './canvas.fixtures.js';
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
