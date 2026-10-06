import { expect, test } from '@playwright/test';
import { boxOf, boxSelect, clearPositionOn } from './canvas.fixtures.js';
import { commandChord, registeredChords } from './chords.fixtures.js';
import {
  editAnnouncement,
  nodeNamed,
  openTwoDiagrams,
  selectNode,
  storefront,
} from './studio.fixtures.js';

test('Align runs after mouse selection with an element or the selection frame focused, and undoes once', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  const shopper = await selectNode(page, storefront.shopper);
  const webShop = nodeNamed(page, storefront.webShop);
  await webShop.click({
    modifiers: ['Shift'],
    position: await clearPositionOn(webShop),
  });
  await expect(shopper).toHaveClass(/selected/u);
  await expect(webShop).toHaveClass(/selected/u);
  await expect(webShop).toBeFocused();
  const before = [await boxOf(shopper), await boxOf(webShop)];
  expect(before[0].x).not.toBe(before[1].x);

  await page.keyboard.press(
    await commandChord(page, registeredChords['align-left'][0]),
  );

  await expect
    .poll(async () => [await boxOf(shopper), await boxOf(webShop)])
    .toEqual(
      before.map((box) => ({ ...box, x: Math.min(before[0].x, before[1].x) })),
    );
  await expect(editAnnouncement(page)).not.toBeEmpty();
  await page.keyboard.press(await commandChord(page, registeredChords.undo[0]));
  await expect
    .poll(async () => [await boxOf(shopper), await boxOf(webShop)])
    .toEqual(before);

  await boxSelect(page, [shopper, webShop]);
  const frame = page.locator('.react-flow__nodesselection-rect');
  await expect(frame).toBeFocused();
  await page.keyboard.press(
    await commandChord(page, registeredChords['align-left'][0]),
  );
  await expect
    .poll(async () => [await boxOf(shopper), await boxOf(webShop)])
    .toEqual(
      before.map((box) => ({ ...box, x: Math.min(before[0].x, before[1].x) })),
    );
  await page.keyboard.press(await commandChord(page, registeredChords.undo[0]));
  await expect
    .poll(async () => [await boxOf(shopper), await boxOf(webShop)])
    .toEqual(before);
});
