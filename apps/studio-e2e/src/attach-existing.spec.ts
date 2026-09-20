import { expect, test, type Page } from '@playwright/test';
import {
  chooseInPanel,
  expandThreat,
  openTwoDiagrams,
  panelControl,
  panelField,
  runFromMenu,
  selectNode,
  storefront,
  threatSummary,
} from './studio.fixtures.js';

const unattached = 'Refund policy abused';

const listings = /Unpublished listings readable/u;

const onCatalogue = async (page: Page): Promise<void> => {
  await openTwoDiagrams(page);
  await selectNode(page, storefront.catalogue);
};

test('the threat attached to nothing is offered first, and attaching it is one undo step', async ({
  page,
}) => {
  await onCatalogue(page);
  const trigger = panelField(page, 'combobox', 'Existing threat');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  await expect(page.getByRole('option').first()).toHaveAccessibleName(
    unattached,
  );

  await page.getByRole('option').first().click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await panelControl(page, 'Attach existing threat').click();
  await expect(threatSummary(page, /Refund policy abused/u)).toBeVisible();

  await runFromMenu(page, 'Undo');

  await expect(threatSummary(page, /Refund policy abused/u)).toHaveCount(0);
});

test('an element attached from the threat editor can be detached again', async ({
  page,
}) => {
  await onCatalogue(page);
  await expandThreat(page, listings);
  const attached = panelControl(page, 'Detach Order ledger');
  await expect(attached).toHaveCount(0);

  await chooseInPanel(page, 'Existing element', 'Order ledger');
  await panelControl(page, 'Attach existing element').click();
  await expect(attached).toBeVisible();

  await attached.click();

  await expect(attached).toHaveCount(0);
  await expect(threatSummary(page, listings)).toBeVisible();
});

test('detaching the last element removes the threat, and undo restores it', async ({
  page,
}) => {
  await onCatalogue(page);
  await expandThreat(page, listings);
  await panelControl(page, 'Detach read the product listings').click();
  await expect(panelControl(page, 'Detach Catalogue')).toBeVisible();

  await panelControl(page, 'Detach Catalogue').click();

  await expect(threatSummary(page, listings)).toHaveCount(0);

  await runFromMenu(page, 'Undo');

  await expect(threatSummary(page, listings)).toBeVisible();
});
