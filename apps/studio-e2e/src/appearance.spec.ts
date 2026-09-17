import { darkPalette, lightPalette, rgbColour } from '@saerskriven/canvas';
import { expect, test, type Page } from '@playwright/test';
import { audit } from './accessibility.fixtures.js';
import { openMenu, openPlaceholder } from './studio.fixtures.js';

const appearance = (page: Page) =>
  page.getByRole('menuitem', { name: /^Appearance /u });

const chooseAppearance = async (
  page: Page,
  mode: 'System' | 'Light' | 'Dark',
): Promise<void> => {
  await openMenu(page);
  await appearance(page).press('ArrowRight');
  await page.getByRole('menuitemradio', { name: mode }).click();
};

const expectAppearance = async (
  page: Page,
  mode: 'System' | 'Light' | 'Dark',
): Promise<void> => {
  await openMenu(page);
  await appearance(page).press('ArrowRight');
  await expect(page.getByRole('menuitemradio', { name: mode })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.keyboard.press('Escape');
};

for (const [mode, palette, systemMode] of [
  ['light', lightPalette, 'dark'],
  ['dark', darkPalette, 'light'],
] as const) {
  test(`starts the loading page in the saved ${mode} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: systemMode });
    await page.addInitScript((storedMode) => {
      localStorage.setItem('saerskrivenColourMode', storedMode);
    }, mode);
    await page.route('**/src/main.tsx', (route) => route.abort());

    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute(
      'data-pn-colour-mode',
      mode,
    );
    await expect(page.locator('.initial-page[role="status"]')).toHaveCSS(
      'background-color',
      rgbColour(palette.surfaceCanvas),
    );
  });
}

test('selects each appearance mode and persists explicit choices', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await openPlaceholder(page);

  await chooseAppearance(page, 'System');
  await expect(page.locator('html')).not.toHaveAttribute('data-pn-colour-mode');

  await chooseAppearance(page, 'Light');
  await expect(page.locator('html')).toHaveAttribute(
    'data-pn-colour-mode',
    'light',
  );
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
  await expectAppearance(page, 'Light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute(
    'data-pn-colour-mode',
    'light',
  );

  await chooseAppearance(page, 'Dark');
  await expect(page.locator('html')).toHaveAttribute(
    'data-pn-colour-mode',
    'dark',
  );
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
  await expectAppearance(page, 'Dark');
  await audit(page, 'in the dark appearance chosen from the menu');
});

test('invalid stored appearance returns to System', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('saerskrivenColourMode', 'broken');
  });
  await openPlaceholder(page);

  await expectAppearance(page, 'System');
  await expect(page.locator('html')).not.toHaveAttribute('data-pn-colour-mode');
});
