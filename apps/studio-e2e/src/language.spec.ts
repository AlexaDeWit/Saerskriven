import { expect, test, type Page } from '@playwright/test';
import { audit } from './accessibility.fixtures.js';
import {
  menuButton,
  openMenu,
  openPlaceholder,
  placeByClick,
  undoOffered,
} from './studio.fixtures.js';

const languageStorageKey = 'saerskrivenLanguage';

const language = (page: Page, heading: string) =>
  page.getByRole('menuitem', { name: new RegExp(`^${heading} `, 'u') });

const openLanguage = async (page: Page, heading: string): Promise<void> => {
  await openMenu(page);
  await language(page, heading).press('ArrowRight');
  await expect(page.getByRole('menuitemradio').first()).toBeVisible();
};

const chooseLanguage = async (
  page: Page,
  heading: string,
  name: string,
): Promise<void> => {
  await openLanguage(page, heading);
  await page.getByRole('menuitemradio', { name }).click();
};

const expectChosen = async (
  page: Page,
  heading: string,
  name: string,
): Promise<void> => {
  await openLanguage(page, heading);
  await expect(page.getByRole('menuitemradio', { name })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.keyboard.press('Escape');
};

test.describe('a French browser', () => {
  test.use({ locale: 'fr-FR' });

  test('reads the studio in French until another language is chosen', async ({
    page,
  }) => {
    await openPlaceholder(page);

    await expect(page.locator('html')).toHaveAttribute('lang', 'fr-CA');
    await expectChosen(page, 'Langue', 'Suivre le navigateur');

    await chooseLanguage(page, 'Langue', 'Svenska');

    await expect(page.locator('html')).toHaveAttribute('lang', 'sv');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'sv');
    await expectChosen(page, 'Språk', 'Svenska');

    await chooseLanguage(page, 'Språk', 'Följ webbläsaren');

    await expect(page.locator('html')).toHaveAttribute('lang', 'fr-CA');
    await audit(page, 'in the French the browser asked for');
  });
});

test.describe('a browser asking for a language the studio has not got', () => {
  test.use({ locale: 'de-DE' });

  test('reads the studio in English', async ({ page }) => {
    await openPlaceholder(page);

    await expect(page.locator('html')).toHaveAttribute('lang', 'en-CA');
    await expectChosen(page, 'Language', 'Follow the browser');
  });
});

test('a stored value naming no supported language follows the browser', async ({
  page,
}) => {
  await page.addInitScript((key) => {
    localStorage.setItem(key, 'kl-GL');
  }, languageStorageKey);
  await openPlaceholder(page);

  await expect(page.locator('html')).toHaveAttribute('lang', 'en-CA');
  await expectChosen(page, 'Language', 'Follow the browser');
});

test('a change of language keeps unsaved work, its undo and its file state', async ({
  page,
}) => {
  await openPlaceholder(page);
  const placed = await placeByClick(page, 'Actor', /^New actor, actor/u);
  await page.keyboard.press('Enter');
  await expect(menuButton(page)).toHaveAccessibleName(/unsaved changes/u);

  await chooseLanguage(page, 'Language', 'Français (Canada)');

  await expect(page.locator('html')).toHaveAttribute('lang', 'fr-CA');
  await expect(placed).toHaveCount(1);
  await expect(menuButton(page)).toHaveAccessibleName(/unsaved changes/u);
  expect(await undoOffered(page)).toBe(true);
});
