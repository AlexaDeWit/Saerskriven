import { expect, test } from '@playwright/test';
import {
  nodeNamed,
  openTwoDiagrams,
  placeByClick,
  runFromMenu,
  selectNode,
  storefront,
  threatPanel,
} from './studio.fixtures.js';

const retitled = 'Credential stuffing takes over an account';

test('redo puts back an edit undone on the canvas and one undone in the panel', async ({
  page,
}) => {
  await openTwoDiagrams(page);

  const added = nodeNamed(page, /^New actor, actor/u);
  await placeByClick(page, 'Actor', /^New actor, actor/u);
  await page.keyboard.press('Enter');

  await runFromMenu(page, 'Undo');
  await expect(added).toHaveCount(0);

  await runFromMenu(page, 'Redo');
  await expect(added).toHaveCount(1);

  await selectNode(page, storefront.shopper);
  const disclosure = threatPanel(page).getByRole('button', {
    name: storefront.takeover,
  });
  await disclosure.click();
  const title = threatPanel(page).getByRole('textbox', {
    name: 'Title',
    exact: true,
  });
  await title.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(retitled);
  await title.press('Enter');
  await expect(
    threatPanel(page).getByRole('button', { name: retitled }),
  ).toBeVisible();

  await runFromMenu(page, 'Undo');
  await expect(disclosure).toBeVisible();

  await runFromMenu(page, 'Redo');
  await expect(
    threatPanel(page).getByRole('button', { name: retitled }),
  ).toBeVisible();
  await expect(added).toHaveCount(1);
});
