import { expect, test as browserTest } from '@playwright/test';
import { darkPalette, lightPalette, rgbColour } from '@saerskriven/canvas';
import { sha256Of } from '@saerskriven/model/fixtures';
import { canvasSettled, elementNodes } from './canvas.fixtures.js';
import { pdfPageCount } from './exports.fixtures.js';
import { registeredChords } from './chords.fixtures.js';
import { savePicker, stubSavePicker } from './save-picker.fixtures.js';
import {
  allowClipboard,
  chooseFile,
  closeMenu,
  diagramChoice,
  exportedFile,
  menuItem,
  nodeNamed,
  openFile,
  openMenu,
  openSwitcher,
  readBack,
  readClipboardText,
  runFromMenu,
  savedFile,
  savedFromMenu,
  selectByKeyboard,
  storefront,
  twoDiagrams,
  twoDiagramsFile,
} from './studio.fixtures.js';

const test = browserTest.extend<{ violations: string[] }>({
  violations: [
    async ({ page }, use) => {
      const violations: string[] = [];
      page.on('console', (message) => {
        if (message.text().startsWith('studio-csp-violation:')) {
          violations.push(message.text());
        }
      });
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (event) => {
          console.error(
            `studio-csp-violation: ${event.effectiveDirective} ${event.blockedURI}`,
          );
        });
      });
      await use(violations);
      expect(violations).toEqual([]);
    },
    { auto: true },
  ],
});

const renderAssetsAndTypesetTimeout = 60_000;

test('the first head element permits the exact built colour-mode script', async ({
  page,
}) => {
  await page.goto('./');
  const first = page.locator('head > :first-child');
  await expect(first).toHaveAttribute('http-equiv', 'Content-Security-Policy');
  const scripts = page.locator('script:not([src])');
  await expect(scripts).toHaveCount(2);
  await expect(page.locator('script[data-initial-colour-mode]')).toHaveCount(1);
  await expect(page.locator('script[data-studio-schema-config]')).toHaveCount(
    1,
  );
  const hashes = (await scripts.allTextContents()).map(
    (body) =>
      `'sha256-${Buffer.from(sha256Of(Buffer.from(body)), 'hex').toString('base64')}'`,
  );
  const policy = await first.getAttribute('content');
  expect(
    policy
      ?.split('; ')
      .find((directive) => directive.startsWith('script-src ')),
  ).toBe(`script-src 'self' 'wasm-unsafe-eval' ${hashes.join(' ')}`);
  expect(policy).not.toContain("'unsafe-eval'");
  expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");
});

for (const [mode, palette, systemMode] of [
  ['light', lightPalette, 'dark'],
  ['dark', darkPalette, 'light'],
] as const) {
  test(`the built loading page paints in stored ${mode} mode`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: systemMode });
    await page.addInitScript((storedMode) => {
      localStorage.setItem('saerskrivenColourMode', storedMode);
    }, mode);
    await page.route('**/assets/*.js', (route) => route.abort());
    await page.goto('./');
    await expect(page.locator('html')).toHaveAttribute(
      'data-saer-colour-mode',
      mode,
    );
    await expect(page.locator('.initial-page[role="status"]')).toHaveCSS(
      'background-color',
      rgbColour(palette.surfaceCanvas),
    );
  });
}

test('the built policy allows share links, menus, Select, downloads and render assets', async ({
  context,
  page,
}) => {
  test.setTimeout(renderAssetsAndTypesetTimeout);
  await allowClipboard(context);
  const fetched: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'fetch') {
      fetched.push(request.url());
    }
  });
  await openFile(page, twoDiagramsFile, './');

  for (const name of ['Export', 'Arrange', /^Appearance: /u, /^Language: /u]) {
    await openMenu(page);
    await page.getByRole('menuitem', { name, exact: true }).hover();
    await expect(page.getByRole('menu')).toHaveCount(2);
    await closeMenu(page);
  }
  await openSwitcher(page);
  await diagramChoice(page, twoDiagrams.second.title).click();
  await expect(nodeNamed(page, twoDiagrams.second.drawn)).toBeVisible();
  await openSwitcher(page);
  await diagramChoice(page, twoDiagrams.first.title).click();
  await selectByKeyboard(page, storefront.webShop);
  await page.keyboard.press(registeredChords['start-flow'][0]);
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.keyboard.press('Escape');

  await runFromMenu(page, 'Share as link');
  await expect(page.getByTestId('share-report')).not.toBeEmpty();
  const link = await readClipboardText(page);
  expect(link).toContain('/Saerskriven/#share=1.');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
  await expect(elementNodes(page)).toHaveCount(2);
  await page.goto(link);
  await canvasSettled(page);
  await expect(elementNodes(page)).toHaveCount(7);
  await expect(nodeNamed(page, storefront.webShop)).toBeVisible();
  expect(new URL(page.url()).hash).toBe('');

  await openMenu(page);
  await menuItem(page, 'Save as').click();
  const savedAs = await savedFromMenu(page, 'Save as Saerskriven YAML');
  expect(readBack(savedAs.text).model.diagrams).toHaveLength(2);
  const saved = await savedFile(page);
  expect(readBack(saved.text).model.diagrams).toHaveLength(2);

  const png = await exportedFile(page, 'Diagram as PNG');
  expect(png.bytes.subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );
  const pdf = await exportedFile(page, 'Model as PDF');
  expect(pdfPageCount(pdf.bytes)).toBe(6);
  const base = new URL('./', page.url()).href;
  expect(new Set(fetched.filter((url) => url.endsWith('.wasm'))).size).toBe(3);
  expect(fetched.some((url) => url.endsWith('.ttf'))).toBe(true);
  for (const url of fetched) {
    expect(url.startsWith(base), url).toBe(true);
  }
});

test('the built Save as writes through the save picker API', async ({
  page,
}) => {
  await page.addInitScript(stubSavePicker, savePicker);
  await page.goto('./');
  await chooseFile(page, twoDiagramsFile);
  await runFromMenu(page, 'Save as');
  await expect
    .poll(() =>
      page.evaluate(
        (key): unknown => Reflect.get(globalThis, key),
        savePicker.written,
      ),
    )
    .toHaveLength(1);
  const written = await page.evaluate(
    (key): unknown => Reflect.get(globalThis, key),
    savePicker.written,
  );
  expect(Array.isArray(written)).toBe(true);
  if (Array.isArray(written)) {
    expect(readBack(String(written[0])).model.diagrams).toHaveLength(2);
  }
});
