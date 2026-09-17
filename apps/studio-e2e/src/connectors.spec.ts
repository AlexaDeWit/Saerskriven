import { expect, test } from '@playwright/test';
import { registeredChords } from './chords.fixtures.js';
import {
  dragTo,
  emptyCanvasPoint,
  handleOn,
  menuItem,
  nodeNamed,
  openMenu,
  openPlaceholder,
  openTwoDiagrams,
  placeByClick,
  runFromMenu,
  selectByKeyboard,
  selectNode,
  stepThroughOptions,
} from './studio.fixtures.js';

const actor = /^Actor, actor/u;

const store = /^Store, store/u;

const webShop = /^Web shop, process/u;

const flows = '.react-flow__edge';

test('a selected element keeps its handles with the pointer elsewhere', async ({
  page,
}) => {
  await openPlaceholder(page);
  const away = await emptyCanvasPoint(page);

  await selectNode(page, actor);
  await page.mouse.move(away.x, away.y);

  await expect(handleOn(nodeNamed(page, actor), 'right')).toBeVisible();
  await expect(handleOn(nodeNamed(page, store), 'left')).toBeHidden();
});

test('a drag released over empty canvas draws nothing and costs no undo step', async ({
  page,
}) => {
  await openPlaceholder(page);
  await placeByClick(page, 'Actor', /^New actor, actor/u);
  await page.keyboard.press('Enter');
  await expect(nodeNamed(page, /^New actor, actor/u)).toHaveCount(1);

  await nodeNamed(page, actor).hover();
  await dragTo(
    page,
    handleOn(nodeNamed(page, actor), 'right'),
    await emptyCanvasPoint(page),
  );

  await expect(page.locator(flows)).toHaveCount(1);

  await runFromMenu(page, 'Undo');

  await expect(nodeNamed(page, /^New actor, actor/u)).toHaveCount(0);
  await openMenu(page);
  await expect(menuItem(page, 'Undo')).toHaveAttribute('aria-disabled', 'true');
});

test('the start-flow chord draws a flow from the selected element', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  await selectByKeyboard(page, webShop);

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
  const selected = await selectByKeyboard(page, webShop);

  await page.keyboard.press(registeredChords['start-flow'][0]);
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.keyboard.press(registeredChords['select-tool'][1]);

  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(page.locator(flows)).toHaveCount(7);
  await expect(selected).toHaveClass(/selected/u);
});
