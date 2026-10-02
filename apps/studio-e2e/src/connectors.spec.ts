import { expect, test } from '@playwright/test';
import { registeredChords } from './chords.fixtures.js';
import {
  boxOf,
  dragBy,
  dragOnto,
  dragTo,
  drawnBy,
  emptyCanvasPoint,
  handlesOf,
  lineOf,
  turnsOf,
} from './canvas.fixtures.js';
import {
  handleOn,
  menuItem,
  nodeNamed,
  openMenu,
  openPlaceholder,
  openTwoDiagrams,
  placeByClick,
  placeholder,
  runFromMenu,
  selectByKeyboard,
  selectNode,
  stepThroughOptions,
  storefront,
} from './studio.fixtures.js';

const flows = '.react-flow__edge';

test('a selected element keeps its handles with the pointer elsewhere', async ({
  page,
}) => {
  await openPlaceholder(page);
  const away = await emptyCanvasPoint(page);

  await selectNode(page, placeholder.actor);
  await page.mouse.move(away.x, away.y);

  await expect(
    handleOn(nodeNamed(page, placeholder.actor), 'right'),
  ).toBeVisible();
  await expect(
    handleOn(nodeNamed(page, placeholder.store), 'left'),
  ).toBeHidden();
});

test('a drag released over empty canvas draws nothing and costs no undo step', async ({
  page,
}) => {
  await openPlaceholder(page);
  await placeByClick(page, 'Actor', /^New actor, actor/u);
  await page.keyboard.press('Enter');
  await expect(nodeNamed(page, /^New actor, actor/u)).toHaveCount(1);

  await nodeNamed(page, placeholder.actor).hover();
  await dragTo(
    page,
    handleOn(nodeNamed(page, placeholder.actor), 'right'),
    await emptyCanvasPoint(page),
  );

  await expect(page.locator(flows)).toHaveCount(1);

  await runFromMenu(page, 'Undo');

  await expect(nodeNamed(page, /^New actor, actor/u)).toHaveCount(0);
  await openMenu(page);
  await expect(menuItem(page, 'Undo')).toHaveAttribute('aria-disabled', 'true');
});

test('a flow drawn between two handles keeps those sides when an element moves past where the automatic side would flip', async ({
  page,
}) => {
  await openPlaceholder(page);
  const actor = nodeNamed(page, placeholder.actor);
  const store = nodeNamed(page, placeholder.store);
  await actor.hover();
  await dragOnto(page, handleOn(actor, 'right'), handleOn(store, 'left'));
  const drawn = lineOf(page, /^New flow, flow/u);
  await expect(drawn).toHaveCount(1);

  await selectNode(page, placeholder.actor);
  const [from, to] = await Promise.all([
    actor.boundingBox(),
    store.boundingBox(),
  ]);
  expect(from).not.toBeNull();
  expect(to).not.toBeNull();
  await dragBy(page, actor, {
    x: (to?.x ?? 0) - (from?.x ?? 0),
    y: 250,
  });

  await expect.poll(async () => (await boxOf(actor)).y).toBeGreaterThan(100);
  const route = turnsOf(await drawnBy(drawn));
  const [, actorRight] = handlesOf(await boxOf(actor));
  const [, , , storeLeft] = handlesOf(await boxOf(store));
  expect(route[0]).toEqual(actorRight);
  expect(route.at(-1)).toEqual(storeLeft);
});

test('the start-flow chord draws a flow from the selected element', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  await selectByKeyboard(page, storefront.webShop);

  await page.keyboard.press(registeredChords['start-flow'][0]);
  await expect(page.getByRole('listbox')).toBeVisible();
  await stepThroughOptions(page, 'ArrowDown');
  await page.keyboard.press('Enter');

  await expect(page.locator(flows)).toHaveCount(8);
});

test('escape cancels a flow the chord started and leaves the selection', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  const selected = await selectByKeyboard(page, storefront.webShop);

  await page.keyboard.press(registeredChords['start-flow'][0]);
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.keyboard.press(registeredChords['select-tool'][1]);

  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(page.locator(flows)).toHaveCount(7);
  await expect(selected).toHaveClass(/selected/u);
});
