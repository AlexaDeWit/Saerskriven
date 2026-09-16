import { expect, test } from '@playwright/test';
import { boxesOverlap } from './canvas-geometry.fixtures.js';
import {
  elementNodes,
  nodeNamed,
  openPlaceholder,
  savedFile,
  screenBoxOf,
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

test('the chrome floating over the canvas covers no part of the diagram', async ({
  page,
}) => {
  await openPlaceholder(page);
  const floating = [
    {
      locator: page.getByRole('region', { name: 'Zoom and fit' }),
      called: 'the zoom cluster',
    },
  ];
  const drawn = [
    { locator: nodeNamed(page, /^Actor, actor/u), called: 'the actor' },
    { locator: nodeNamed(page, /^Store, store/u), called: 'the store' },
  ];

  for (const over of floating) {
    for (const under of drawn) {
      expect(
        boxesOverlap(
          await screenBoxOf(over.locator, over.called),
          await screenBoxOf(under.locator, under.called),
        ),
        `${over.called} covers ${under.called}`,
      ).toBe(false);
    }
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
