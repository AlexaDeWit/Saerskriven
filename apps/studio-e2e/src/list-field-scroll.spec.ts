import { expect, test, type Locator, type Page } from '@playwright/test';
import { edgesOf } from './canvas.fixtures.js';
import {
  focusedOption,
  openShopperTakeover,
  panelField,
  scrollPaneTo,
  scrollCue,
  scrolledOffItsStart,
} from './studio.fixtures.js';

const labelOf = async (option: Locator): Promise<string> =>
  (await option.locator('[data-option-label]').textContent()) ?? '';

const openNearTopEdge = async (page: Page): Promise<Locator> => {
  await openShopperTakeover(page);
  const field = panelField(page, 'combobox', 'Category');
  expect(await scrollPaneTo(field, 'top')).toBe(true);
  return field;
};

const first = (page: Page): Locator => page.getByRole('option').first();

const last = (page: Page): Locator => page.getByRole('option').last();

const cutAtItsEnd = async (page: Page): Promise<void> => {
  await expect(page.getByRole('listbox')).toBeVisible();
  await expect(scrollCue(page, 'later')).toBeVisible();
  await expect(scrollCue(page, 'earlier')).toHaveCount(0);
  await expect(last(page)).not.toBeInViewport();
};

const reachedItsEnd = async (page: Page): Promise<void> => {
  await expect(last(page)).toBeInViewport({ ratio: 1 });
  await expect(scrollCue(page, 'later')).toHaveCount(0);
  await expect(scrollCue(page, 'earlier')).toBeVisible();
};

test(
  'a list field cut short below the pane top shows that it scrolls on, and a pointer on the cue at either edge scrolls it there',
  { tag: '@phone' },
  async ({ page }) => {
    const field = await openNearTopEdge(page);
    await field.click();
    await cutAtItsEnd(page);
    const lastLabel = await labelOf(last(page));

    await scrollCue(page, 'later').hover();
    await reachedItsEnd(page);
    await scrollCue(page, 'earlier').hover();
    await expect(first(page)).toBeInViewport({ ratio: 1 });
    await expect(scrollCue(page, 'earlier')).toHaveCount(0);
    await scrollCue(page, 'later').hover();
    await reachedItsEnd(page);
    await last(page).click();

    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(field).toContainText(lastLabel);
  },
);

test(
  'a list field cut short below the pane top keeps the option the keyboard moves to clear of its cue, and reaches its last option',
  { tag: '@phone' },
  async ({ page }) => {
    const field = await openNearTopEdge(page);
    await field.focus();
    await page.keyboard.press('Enter');
    await cutAtItsEnd(page);
    const lastLabel = await labelOf(last(page));

    await scrolledOffItsStart(page);
    expect((await edgesOf(focusedOption(page))).bottom).toBeLessThanOrEqual(
      (await edgesOf(scrollCue(page, 'later'))).top + 0.5,
    );
    await page.keyboard.press('End');
    await expect(focusedOption(page)).toHaveAccessibleName(lastLabel);
    await reachedItsEnd(page);
    await page.keyboard.press('Enter');

    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(field).toContainText(lastLabel);
  },
);
