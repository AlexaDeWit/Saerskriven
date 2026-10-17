import { expect, test, type Page } from '@playwright/test';
import { copiesModelInput } from '@saerskriven/model/fixtures';
import {
  clickInsideCorner,
  nodeNamed,
  openModelDocument,
  runFromMenu,
  selectNode,
  tabTo,
} from './studio.fixtures.js';

const picker = (page: Page) =>
  page.getByRole('region', { name: /^Merge into/u });

const sharedApi = /^Orders API, process, .*also on Fulfilment$/u;

test('Merge an element into this one picks one box at a time, by click or keyboard, and keeps the selected element on both diagrams, as one undo step', async ({
  page,
}) => {
  await openModelDocument(page, copiesModelInput);
  await selectNode(page, /^Orders API, process/u);

  await runFromMenu(page, 'Merge an element into this one');
  const webShop = picker(page).getByRole('radio', { name: 'Web shop' });
  const copy = picker(page).getByRole('radio', { name: 'Orders API' });
  await expect(webShop).toBeFocused();
  await expect(copy).toHaveAccessibleDescription(/Fulfilment/u);
  await clickInsideCorner(webShop);
  await expect(webShop).toBeChecked();
  await page.keyboard.press('ArrowDown');
  await expect(copy).toBeChecked();
  await expect(webShop).not.toBeChecked();
  const merge = picker(page).getByRole('button', { name: 'Merge' });
  await tabTo(page, merge, copy);
  await page.keyboard.press('Enter');

  await expect(picker(page)).toHaveCount(0);
  await expect(nodeNamed(page, sharedApi)).toBeFocused();
  await expect(nodeNamed(page, sharedApi)).toHaveClass(/selected/u);

  await runFromMenu(page, 'Undo');

  await expect(nodeNamed(page, sharedApi)).toHaveCount(0);
  await expect(nodeNamed(page, /^Orders API, process/u)).toHaveCount(1);
});

test('a merge of two elements a flow joins is refused, naming the flow, merges nothing and leaves focus on the element kept', async ({
  page,
}) => {
  await openModelDocument(page, copiesModelInput);
  await selectNode(page, /^Orders API, process/u);

  await runFromMenu(page, 'Merge an element into this one');
  await page.keyboard.press('Space');
  await picker(page).getByRole('button', { name: 'Merge' }).click();

  await expect(page.getByTestId('failure-notice')).toContainText(/\border\b/u);
  await expect(nodeNamed(page, /^Web shop, process/u)).toHaveCount(1);
  await expect(nodeNamed(page, /^Orders API, process/u)).toBeFocused();
});
