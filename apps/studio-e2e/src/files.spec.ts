import { expect, test } from '@playwright/test';
import {
  closeMenu,
  elementNodes,
  nodeNamed,
  openFile,
  openMenu,
  openText,
  savedFile,
  featureCompleteFile,
  twoDiagramsFile,
  withoutPickers,
} from './studio.fixtures.js';

test('opens a model, saves it back, and writes a file that parses again', async ({
  page,
}) => {
  await openFile(page, featureCompleteFile);

  await openMenu(page);
  await expect(page.getByTestId('file-state')).toContainText(
    'feature-complete.json',
  );
  await expect(page.getByTestId('file-state')).toContainText(
    'Threat Dragon JSON',
  );
  await closeMenu(page);
  await expect(elementNodes(page)).toHaveCount(6);
  await expect(page.locator('.react-flow__edge')).toHaveCount(3);

  const written = await savedFile(page);

  expect(written.name).toBe('feature-complete.json');
  expect(JSON.parse(written.text)).toMatchObject({
    version: '2.6.2',
    summary: { title: 'Clinic booking' },
  });
  await expect(page.getByTestId('loss-report')).toBeEmpty();
});

test('opens the native format by its content, and draws its diagram', async ({
  page,
}) => {
  await openFile(page, twoDiagramsFile);

  await openMenu(page);
  await expect(page.getByTestId('file-state')).toContainText(
    'two-diagrams.yaml',
  );
  await expect(page.getByTestId('file-state')).toContainText(
    'Saerskriven YAML',
  );
  await closeMenu(page);
  await expect(elementNodes(page)).toHaveCount(7);
  await expect(page.locator('.react-flow__edge')).toHaveCount(7);
  await expect(nodeNamed(page, /^Shop network, trust boundary/u)).toBeVisible();
  await expect(nodeNamed(page, /^Web shop, process/u)).toBeVisible();
});

test('says what it could not read, and stays up', async ({ page }) => {
  await page.addInitScript(withoutPickers);
  await page.goto('/');
  await expect(page.getByTestId('canvas-container')).toBeVisible();

  await openText(page, 'notes.txt', 'no threat model here');

  await expect(page.getByTestId('failure-notice')).toContainText('notes.txt');
  await expect(page.getByTestId('canvas-container')).toBeVisible();
});
