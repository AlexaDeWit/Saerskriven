import { test, expect as browserExpect, type Route } from '@playwright/test';
import { saerskrivenYamlCodec } from '@saerskriven/formats';
import { Either } from 'effect';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const expect = browserExpect.configure({ timeout: 10_000 });

const fixture = resolve(
  import.meta.dirname,
  '../../../test-data/saerskriven/feature-complete.yaml',
);
const original = readFileSync(fixture, 'utf8');
const projectModel = readFileSync(
  resolve(import.meta.dirname, '../../../threat-modelling/saerskriven.yaml'),
  'utf8',
);
const frozen = (name: string) =>
  readFileSync(
    resolve(
      import.meta.dirname,
      '../../../test-data/share-links/' + name + '.fragment.txt',
    ),
    'utf8',
  ).trimEnd();

test('the project model selects Rust PPMd and reads back @phone', async ({
  page,
}) => {
  const expected = saerskrivenYamlCodec.write(
    Either.getOrThrow(saerskrivenYamlCodec.read(projectModel)).model,
  ).output;
  await page.goto('/share-poc.html');
  await page.getByLabel('Source model').fill(projectModel);
  await page
    .getByRole('button', { name: 'Generate link', exact: true })
    .click();
  await expect(
    page
      .getByRole('region', { name: 'Size comparison' })
      .getByText('ppmd', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Inspect link', exact: true }).click();
  await expect(page.getByLabel('Decoded YAML')).toHaveValue(expected);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= globalThis.innerWidth,
    ),
  ).toBe(true);
});

test('the opt-in worker writes a shorter link and opens it @phone', async ({
  page,
}) => {
  await page.goto('/share-poc.html');
  await page.getByLabel('Model file').setInputFiles(fixture);
  await expect(page.getByLabel('Source model')).toHaveValue(original);
  await page
    .getByRole('button', { name: 'Generate link', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Size comparison' }),
  ).toBeVisible();
  const link = await page.getByLabel('Link to inspect').inputValue();
  expect(new URL(link).hash).toMatch(/^#share=2\./u);
  const popup = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'Open link in a new tab' }).click();
  const opened = await popup;
  await expect(opened.getByLabel('Decoded YAML')).toHaveValue(original);
  await expect(opened).toHaveURL(/\/share-poc\.html$/u);
  await opened.close();
});

test('both frozen codecs and legacy migrations open on the development page @phone', async ({
  page,
}) => {
  await page.goto('/share-poc.html');
  for (const name of [
    'v2-brotli',
    'v2-ppmd',
    'v1-feature-complete',
    'v1-v021',
  ]) {
    await page.getByLabel('Link to inspect').fill(frozen(name));
    await page
      .getByRole('button', { name: 'Inspect link', exact: true })
      .click();
    await expect(page.getByLabel('Decoded YAML')).toBeVisible();
    expect(await page.getByLabel('Decoded YAML').inputValue()).toContain(
      'formatVersion: 2',
    );
  }
});

test('a cancelled generation leaves the source intact and permits another request @phone', async ({
  page,
  context,
}) => {
  const pending: string[] = [];
  const hold = (route: Route): void => {
    pending.push(route.request().url());
  };
  await context.route('**/*saerskriven_brotli.wasm*', hold);
  await page.goto('/share-poc.html');
  await page.getByLabel('Source model').fill(original);
  await page
    .getByRole('button', { name: 'Generate link', exact: true })
    .click();
  await expect.poll(() => pending.length).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Cancel', exact: true }),
  ).toBeDisabled();
  await expect(page.getByLabel('Source model')).toHaveValue(original);
  await context.unroute('**/*saerskriven_brotli.wasm*', hold);
  await page
    .getByRole('button', { name: 'Generate link', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Size comparison' }),
  ).toBeVisible();
});

test('a malformed link reports a refusal without discarding source text @phone', async ({
  page,
}) => {
  await page.goto('/share-poc.html');
  await page.getByLabel('Source model').fill(original);
  await page
    .getByLabel('Link to inspect')
    .fill(frozen('v2-ppmd').slice(0, -10));
  await page.getByRole('button', { name: 'Inspect link', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Inspect link', exact: true }),
  ).toBeEnabled();
  await expect(page.getByLabel('Decoded YAML')).toHaveCount(0);
  await expect(page.getByLabel('Source model')).toHaveValue(original);
});
