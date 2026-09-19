import { expect, test } from '@playwright/test';
import { repositoryRoot, sha256Of } from '@saerskriven/model/fixtures';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expectedPdfDigest, pdfPageCount } from './exports.fixtures.js';
import { pseudoMarkers } from '@saerskriven/i18n';
import {
  exportedFile,
  languageStorageKey,
  menuButton,
  openFile,
  twoDiagramsFile,
} from './studio.fixtures.js';

const compilerDownloadAndTypesetTimeout = 60_000;

const socialImage = 'https://alexadewit.github.io/Saerskriven/social-card.png';
const socialImageAlt =
  'Saerskriven: Draw the system. Record the threats. An example threat model connects a maintainer, studio, and model file.';

test('the Pages build loads its hashed PDF assets below the site base', async ({
  page,
}) => {
  test.setTimeout(compilerDownloadAndTypesetTimeout);
  await openFile(page, twoDiagramsFile, './');

  const output = await exportedFile(page, 'Model as PDF');

  expect(output.name).toBe('two-diagrams.pdf');
  expect(pdfPageCount(output.bytes)).toBe(6);
  expect(sha256Of(output.bytes)).toBe(expectedPdfDigest());
});

test('the Pages build publishes the social card and its text alternative', async ({
  page,
}) => {
  await page.goto('./');

  const property = (name: string) =>
    page.locator(`meta[property="${name}"]`).getAttribute('content');
  const named = (name: string) =>
    page.locator(`meta[name="${name}"]`).getAttribute('content');

  expect(await property('og:image')).toBe(socialImage);
  expect(await property('og:image:type')).toBe('image/png');
  expect(await property('og:image:width')).toBe('1200');
  expect(await property('og:image:height')).toBe('630');
  expect(await property('og:image:alt')).toBe(socialImageAlt);
  expect(await named('twitter:card')).toBe('summary_large_image');
  expect(await named('twitter:image')).toBe(socialImage);
  expect(await named('twitter:image:alt')).toBe(socialImageAlt);

  const response = await page.request.get(
    new URL('social-card.png', page.url()).href,
  );
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('image/png');
  const png = await response.body();
  expect(png.subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(630);
});

test('the release build identifies its own version outside the menu', async ({
  page,
}) => {
  await page.goto('./');
  const manifest: unknown = JSON.parse(
    readFileSync(join(repositoryRoot, 'package.json'), 'utf8'),
  );
  assert.ok(
    typeof manifest === 'object' && manifest !== null && 'version' in manifest,
  );
  const version = manifest.version;
  assert.equal(typeof version, 'string');
  const badge = page.getByTestId('studio-version');
  await expect(badge).toBeVisible();
  await expect(badge).toHaveText(String(version));
  await page.getByRole('button', { name: /^Menu/u }).click();
  await expect(page.getByRole('menuitem').and(page.locator('a'))).toHaveCount(
    1,
  );
  const response = await page.request.get(
    new URL('version.json', page.url()).href,
  );
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual({
    version,
    tag: `v${String(version)}`,
  });
});

test('the Pages build words the studio in each language below the site base, with no pseudo-locale', async ({
  page,
}) => {
  const refused: string[] = [];
  page.on('response', (response) => {
    if (response.status() >= 400) {
      refused.push(`${String(response.status())} ${response.url()}`);
    }
  });
  page.on('requestfailed', (request) => {
    refused.push(`failed ${request.url()}`);
  });

  for (const [locale, menu] of [
    ['en-CA', 'Menu'],
    ['fr-CA', 'Menu'],
    ['sv', 'Meny'],
  ] as const) {
    await page.goto('./?pseudo-locale');
    await page.evaluate(
      ({ key, chosen }) => {
        localStorage.setItem(key, chosen);
      },
      { key: languageStorageKey, chosen: locale },
    );
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(menuButton(page)).toHaveAccessibleName(menu);
  }

  const base = new URL('./', page.url()).href;
  const scripts = await page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLScriptElement>('script[src]'),
      ...document.querySelectorAll<HTMLLinkElement>(
        'link[rel="modulepreload"]',
      ),
    ].map((element) =>
      element instanceof HTMLScriptElement ? element.src : element.href,
    ),
  );
  expect(scripts.length).toBeGreaterThan(0);
  for (const script of scripts) {
    expect(script.startsWith(base)).toBe(true);
    const source = await (await page.request.get(script)).text();
    expect(source.includes(pseudoMarkers.open), script).toBe(false);
  }
  expect(refused).toEqual([]);
});
