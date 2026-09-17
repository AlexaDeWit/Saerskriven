import { expect, test } from '@playwright/test';
import { sha256Of } from '@saerskriven/model/fixtures';
import { exportGolden } from './exports.fixtures.js';
import { exportedFile, openFile, twoDiagramsFile } from './studio.fixtures.js';

test.beforeEach(async ({ page }) => {
  await openFile(page, twoDiagramsFile);
});

test('exports the CLI drawing byte for byte', async ({ page }) => {
  const output = await exportedFile(page, 'Diagram as SVG: Taking an order');

  expect(output.name).toBe('two-diagrams.svg');
  expect(output.bytes).toEqual(
    exportGolden('two-diagrams-storefront.snapshot.svg'),
  );
});

test('exports the CLI picture byte for byte', async ({ page }) => {
  const output = await exportedFile(page, 'Diagram as PNG');

  expect(output.name).toBe('two-diagrams.png');
  expect(sha256Of(output.bytes)).toBe(
    sha256Of(exportGolden('two-diagrams-storefront.snapshot.png')),
  );
});

test('exports the CLI register byte for byte', async ({ page }) => {
  const output = await exportedFile(page, 'Register as Markdown');

  expect(output.name).toBe('two-diagrams.md');
  expect(output.bytes).toEqual(
    exportGolden('two-diagrams.register.snapshot.md'),
  );
});

test('exports the Typst source used by the CLI byte for byte', async ({
  page,
}) => {
  const output = await exportedFile(page, 'Model as Typst');

  expect(output.name).toBe('two-diagrams.typ');
  expect(output.bytes).toEqual(exportGolden('two-diagrams.snapshot.typ'));
});
