import { expect, test } from '@playwright/test';
import { elementNodes } from './canvas.fixtures.js';
import {
  expectFileShown,
  featureCompleteFile,
  nodeNamed,
  openFile,
  savedFile,
  storefront,
  twoDiagramsFile,
} from './studio.fixtures.js';

test('opens a model, saves it back, and writes a file that parses again', async ({
  page,
}) => {
  await openFile(page, featureCompleteFile);

  await expectFileShown(page, 'feature-complete.json', 'Threat Dragon JSON');
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

  await expectFileShown(page, 'two-diagrams.yaml', 'Saerskriven YAML');
  await expect(elementNodes(page)).toHaveCount(7);
  await expect(page.locator('.react-flow__edge')).toHaveCount(7);
  await expect(nodeNamed(page, storefront.shopNetwork)).toBeVisible();
  await expect(nodeNamed(page, storefront.webShop)).toBeVisible();
});
