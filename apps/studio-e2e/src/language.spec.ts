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

/** The Language row, named in each locale the spec reads it in. */
const heading = {
  'en-CA': /^Language /u,
  'fr-CA': /^Langue /u,
  sv: /^Språk /u,
} as const;

type Heading = (typeof heading)[keyof typeof heading];

const openLanguage = async (page: Page, row: Heading): Promise<void> => {
  await openMenu(page);
  await page.getByRole('menuitem', { name: row }).press('ArrowRight');
  await expect(page.getByRole('menuitemradio').first()).toBeVisible();
};

const chooseLanguage = async (
  page: Page,
  row: Heading,
  name: string,
): Promise<void> => {
  await openLanguage(page, row);
  await page.getByRole('menuitemradio', { name }).click();
};

const expectChosen = async (
  page: Page,
  row: Heading,
  name: string,
): Promise<void> => {
  await openLanguage(page, row);
  await expect(page.getByRole('menuitemradio', { name })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.keyboard.press('Escape');
};

test.describe('a French browser', () => {
  test.use({ locale: 'fr-FR' });

  test('prefills French, and a chosen language survives a reload', async ({
    page,
  }) => {
    await openPlaceholder(page);

    await expect(page.locator('html')).toHaveAttribute('lang', 'fr-CA');
    await expectChosen(page, heading['fr-CA'], 'Français (Canada)');
    await audit(page, 'in the French the browser asked for');

    await chooseLanguage(page, heading['fr-CA'], 'Svenska');

    await expect(page.locator('html')).toHaveAttribute('lang', 'sv');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'sv');
    await expectChosen(page, heading.sv, 'Svenska');
  });
});

test.describe('a browser asking for a language the studio has not got', () => {
  test.use({ locale: 'de-DE' });

  test('reads the studio in English', async ({ page }) => {
    await openPlaceholder(page);

    await expect(page.locator('html')).toHaveAttribute('lang', 'en-CA');
    await expectChosen(page, heading['en-CA'], 'English (Canada)');
  });
});

test('a stored value naming no supported language prefills from the browser', async ({
  page,
}) => {
  await page.addInitScript((key) => {
    localStorage.setItem(key, 'kl-GL');
  }, languageStorageKey);
  await openPlaceholder(page);

  await expect(page.locator('html')).toHaveAttribute('lang', 'en-CA');
  await expectChosen(page, heading['en-CA'], 'English (Canada)');
  const stored = await page.evaluate(
    (key) => localStorage.getItem(key),
    languageStorageKey,
  );
  expect(stored).toBe('kl-GL');
});

test('the old follow-the-browser value prefills from the browser', async ({
  page,
}) => {
  await page.addInitScript((key) => {
    localStorage.setItem(key, 'browser');
  }, languageStorageKey);
  await openPlaceholder(page);

  await expect(page.locator('html')).toHaveAttribute('lang', 'en-CA');
  await expectChosen(page, heading['en-CA'], 'English (Canada)');
});

test('a change of language keeps unsaved work, its undo and its file state', async ({
  page,
}) => {
  await openPlaceholder(page);
  await placeByClick(page, 'Actor', /^New actor, actor/u);
  await page.keyboard.press('Enter');
  await expect(menuButton(page)).toHaveAccessibleName(/unsaved changes/u);

  await chooseLanguage(page, heading['en-CA'], 'Français (Canada)');

  await expect(page.locator('html')).toHaveAttribute('lang', 'fr-CA');
  await expect(
    page.getByRole('group', { name: /^New actor, acteur/u }),
  ).toHaveCount(1);
  await expect(menuButton(page)).toHaveAccessibleName(
    /modifications non enregistrées/u,
  );
  expect(await undoOffered(page, 'Annuler')).toBe(true);
});
