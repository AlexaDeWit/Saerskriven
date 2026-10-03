import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  expandThreat,
  focusedOption,
  openTwoDiagrams,
  panelField,
  runFromMenu,
  scrollPaneTo,
  selectNode,
  storefront,
} from './studio.fixtures.js';

const scrollCue = (page: Page, edge: 'earlier' | 'later'): Locator =>
  page.locator(`[data-scroll-cue="${edge}"]`);

const labelOf = async (option: Locator): Promise<string> =>
  (await option.locator('[data-option-label]').textContent()) ?? '';

const openNearTopEdge = async (page: Page): Promise<Locator> => {
  const field = panelField(page, 'combobox', 'Category');
  expect(await scrollPaneTo(field, 'top')).toBe(true);
  return field;
};

const cutAtItsEnd = async (page: Page, last: Locator): Promise<void> => {
  await expect(page.getByRole('listbox')).toBeVisible();
  await expect(scrollCue(page, 'later')).toBeVisible();
  await expect(scrollCue(page, 'earlier')).toHaveCount(0);
  await expect(last).not.toBeInViewport();
};

const reachedItsEnd = async (page: Page, last: Locator): Promise<void> => {
  await expect(last).toBeInViewport({ ratio: 1 });
  await expect(scrollCue(page, 'later')).toHaveCount(0);
  await expect(scrollCue(page, 'earlier')).toBeVisible();
};

test(
  'a list field cut short below the pane top shows that it scrolls on, and its last option is reached by pointer and by keyboard',
  { tag: '@phone' },
  async ({ page }) => {
    await openTwoDiagrams(page);
    await selectNode(page, storefront.shopper);
    await expandThreat(page, storefront.takeover);
    const last = page.getByRole('option').last();

    const field = await openNearTopEdge(page);
    const first = await field.textContent();
    await field.click();
    await cutAtItsEnd(page, last);
    const lastLabel = await labelOf(last);
    await scrollCue(page, 'later').hover();
    await reachedItsEnd(page, last);
    await last.click();
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(field).toContainText(lastLabel);

    await runFromMenu(page, 'Undo');
    await expect(field).toHaveText(first ?? '');

    await (await openNearTopEdge(page)).focus();
    await page.keyboard.press('Enter');
    await cutAtItsEnd(page, last);
    await page.keyboard.press('End');
    await expect(focusedOption(page)).toHaveAccessibleName(lastLabel);
    await reachedItsEnd(page, last);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(field).toContainText(lastLabel);
  },
);
