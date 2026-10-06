import { expect, test } from '@playwright/test';
import { canvasClassNames } from '@saerskriven/canvas';
import { elementNodes, flowBlockOf } from './canvas.fixtures.js';
import {
  nodeNamed,
  openFallback,
  openPlaceholder,
  placeholder,
  savedFile,
} from './studio.fixtures.js';

const drawnNames = [
  { of: placeholder.actor, className: canvasClassNames.label, says: 'Actor' },
  { of: placeholder.store, className: canvasClassNames.label, says: 'Store' },
  {
    of: placeholder.records,
    className: canvasClassNames.flowLabel,
    says: 'Records',
  },
] as const;

test('the studio opens on an actor, the records it sends, and the store they land in', async ({
  page,
}) => {
  await openPlaceholder(page);

  await expect(elementNodes(page)).toHaveCount(2);
  await expect(page.locator('.react-flow__edge')).toHaveCount(1);
  for (const { of, className, says } of drawnNames) {
    const item = nodeNamed(page, of);
    const drawing =
      className === canvasClassNames.flowLabel ? await flowBlockOf(item) : item;
    const lines = drawing.locator(`text.${className} tspan`);

    await expect(lines, `${says} is drawn on one line`).toHaveCount(1);
    await expect(lines).toHaveText(says);
  }
});

test('the tab follows the file after the first save', async ({ page }) => {
  await openFallback(page);
  const landingTitle = await page.title();
  expect(landingTitle.trim()).not.toBe('');

  const written = await savedFile(page);

  expect(written.name).toBe('threat-model.yaml');
  await expect.poll(() => page.title()).not.toBe(landingTitle);
  await expect.poll(() => page.title()).toContain(written.name);
});
