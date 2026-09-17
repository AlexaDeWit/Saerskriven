import { expect, test } from '@playwright/test';
import {
  elementNodes,
  nodeNamed,
  openPlaceholder,
  savedFile,
  withoutPickers,
} from './studio.fixtures.js';

const drawnNames = [
  { of: /^Actor, actor/u, className: 'pn-label', says: 'Actor' },
  { of: /^Store, store/u, className: 'pn-label', says: 'Store' },
  { of: /^Records, flow/u, className: 'pn-flow-label', says: 'Records' },
] as const;

test('the studio opens on an actor, the records it sends, and the store they land in', async ({
  page,
}) => {
  await openPlaceholder(page);

  await expect(elementNodes(page)).toHaveCount(2);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  for (const { of, className, says } of drawnNames) {
    const lines = nodeNamed(page, of).locator(`text.${className} tspan`);

    await expect(lines, `${says} is drawn on one line`).toHaveCount(1);
    await expect(lines).toHaveText(says);
  }
});

test('the tab follows the file after the first save', async ({ page }) => {
  await page.addInitScript(withoutPickers);
  await openPlaceholder(page);
  const landingTitle = await page.title();
  expect(landingTitle.trim()).not.toBe('');

  const written = await savedFile(page);

  expect(written.name).toBe('threat-model.yaml');
  await expect.poll(() => page.title()).not.toBe(landingTitle);
  await expect.poll(() => page.title()).toContain(written.name);
});
