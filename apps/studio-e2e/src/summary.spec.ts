import { expect, test, type Locator, type Page } from '@playwright/test';
import { lightPalette, rgbColour } from '@saerskriven/canvas';
import {
  addRecord,
  chooseInPanel,
  expandThreat,
  openTwoDiagrams,
  panelControl,
  panelField,
  selectNode,
  storefront,
  threatPanel,
  threatSummary,
} from './studio.fixtures.js';

const serverPricing = /^The server prices the basket/u;

const unbacked = 'mitigated-without-implemented-work';

const invalidated = 'rests-on-invalidated-assumption';

const collapse = async (page: Page, title: RegExp): Promise<Locator> => {
  const summary = threatSummary(page, title);
  if ((await summary.getAttribute('aria-expanded')) === 'true') {
    await summary.click();
  }
  await expect(summary).toHaveAttribute('aria-expanded', 'false');
  return summary;
};

const recordGroup = (page: Page, heading: string, count: number): Locator =>
  threatPanel(page).getByRole('group', {
    name: `${heading} ${String(count)}`,
    exact: true,
  });

const markOn = (summary: Locator, flag: string): Locator =>
  summary.locator(`[data-flag="${flag}"]`);

const partsInOrder = (name: string, parts: readonly string[]): boolean =>
  parts.every((part, index) => {
    const at = name.indexOf(part);
    return at >= 0 && (index === 0 || at > name.indexOf(parts[index - 1]));
  });

const namesItsParts = async (summary: Locator): Promise<void> => {
  const parts = (await summary.locator('[data-flag]').allTextContents()).map(
    (part) => part.trim(),
  );
  expect(parts.length).toBeGreaterThan(0);
  await expect
    .poll(async () => partsInOrder(await summary.ariaSnapshot(), parts))
    .toBe(true);
};

const raiseBothFlags = async (page: Page): Promise<void> => {
  await expandThreat(page, storefront.orderDenied);
  await addRecord(page, 'assumption', 'Callers rotate their tokens.');
  await chooseInPanel(page, 'Assumption 1 status', 'Invalidated');
};

test('the record groups of an expanded threat count what is added, linked and unlinked, and the summary counts nothing', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  await selectNode(page, storefront.ledger);
  await expandThreat(page, storefront.orderDenied);
  await expect(recordGroup(page, 'Mitigations', 1)).toBeVisible();
  await addRecord(page, 'mitigation', 'Strip caller tokens at the edge');
  await addRecord(page, 'assumption', 'Callers rotate their tokens.');
  await expect(recordGroup(page, 'Mitigations', 2)).toBeVisible();
  await expect(recordGroup(page, 'Assumptions', 1)).toBeVisible();

  await chooseInPanel(page, 'Existing mitigation', serverPricing);
  await panelControl(page, 'Link existing mitigation').click();
  await expect(recordGroup(page, 'Mitigations', 3)).toBeVisible();
  await threatPanel(page)
    .getByRole('button', { name: serverPricing, expanded: false })
    .click();
  await panelControl(page, 'Unlink mitigation 3').click();
  await expect(recordGroup(page, 'Mitigations', 2)).toBeVisible();

  const summary = await collapse(page, storefront.orderDenied);
  await expect(summary).not.toHaveAccessibleName(/Mitigations|Assumptions/u);
});

test('an open status is the one drawn as a filled pill', async ({ page }) => {
  await openTwoDiagrams(page);
  await selectNode(page, storefront.shopper);
  const summary = threatSummary(page, storefront.takeover);
  const open = summary.locator('[data-status="open"]');
  await expect(open).toHaveCSS(
    'background-color',
    rgbColour(lightPalette.textPrimary),
  );

  await expandThreat(page, storefront.takeover);
  await chooseInPanel(page, 'Status', 'Accepted risk');
  await collapse(page, storefront.takeover);

  const accepted = summary.locator('[data-status="accepted-risk"]');
  await expect(accepted).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(accepted.locator('svg path')).toHaveCount(1);
  await expect(open).toHaveCount(0);
});

test('a mitigated threat with only proposed work is marked until the work is implemented', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  await selectNode(page, storefront.ledger);
  const summary = threatSummary(page, storefront.orderDenied);
  await expect(markOn(summary, unbacked)).toBeVisible();
  await namesItsParts(summary);

  await expandThreat(page, storefront.orderDenied);
  await chooseInPanel(page, 'Mitigation 1 status', 'Implemented');
  await collapse(page, storefront.orderDenied);
  await expect(markOn(summary, unbacked)).toHaveCount(0);

  await expandThreat(page, storefront.orderDenied);
  await chooseInPanel(page, 'Mitigation 1 status', 'Proposed');
  await collapse(page, storefront.orderDenied);
  await expect(markOn(summary, unbacked)).toBeVisible();
});

test('only an invalidated assumption marks the threat it is linked to', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  await selectNode(page, storefront.shopper);
  await expandThreat(page, storefront.takeover);
  await addRecord(page, 'assumption', 'Callers rotate their tokens.');
  const summary = threatSummary(page, storefront.takeover);

  for (const status of ['Unconfirmed', 'Valid']) {
    await chooseInPanel(page, 'Assumption 1 status', status);
    await collapse(page, storefront.takeover);
    await expect(summary.locator('[data-flag]')).toHaveCount(0);
    await expandThreat(page, storefront.takeover);
  }

  await chooseInPanel(page, 'Assumption 1 status', 'Invalidated');
  await collapse(page, storefront.takeover);
  await expect(markOn(summary, invalidated)).toBeVisible();
  await namesItsParts(summary);
});

test('each flag mark keeps its glyph and outline in forced colours', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  await selectNode(page, storefront.ledger);
  await raiseBothFlags(page);
  const summary = await collapse(page, storefront.orderDenied);
  await page.emulateMedia({ forcedColors: 'active' });

  const drawn = await summary.locator('[data-flag]').evaluateAll((marks) =>
    marks.map((mark) => {
      const path = mark.querySelector('path');
      const markStyle = getComputedStyle(mark);
      const glyphStyle = path === null ? undefined : getComputedStyle(path);
      return {
        glyph: path?.getAttribute('d') ?? '',
        stroke: glyphStyle?.stroke ?? 'none',
        colour: markStyle.color,
        border: markStyle.borderTopStyle,
        text: mark.textContent,
      };
    }),
  );

  expect(drawn).toHaveLength(2);
  for (const mark of drawn) {
    expect(mark.stroke).toBe(mark.colour);
    expect(mark.border).not.toBe('none');
  }
  expect(new Set(drawn.map(({ glyph }) => glyph)).size).toBe(2);
  expect(new Set(drawn.map(({ text }) => text)).size).toBe(2);
});

test(
  'a summary with both flags fits the panel without scrolling sideways',
  { tag: '@phone' },
  async ({ page }) => {
    await openTwoDiagrams(page);
    await selectNode(page, storefront.ledger);
    await raiseBothFlags(page);
    const summary = await collapse(page, storefront.orderDenied);
    await expect(summary.locator('[data-flag]')).toHaveCount(2);

    const overflow = await summary.evaluate((node) => {
      let scroller = node.parentElement;
      while (
        scroller !== null &&
        getComputedStyle(scroller).overflowY !== 'auto'
      ) {
        scroller = scroller.parentElement;
      }
      const edge = scroller?.getBoundingClientRect().right ?? 0;
      const outside = [node, ...node.querySelectorAll('[data-flag]')].filter(
        (part) => part.getBoundingClientRect().right > edge + 0.5,
      );
      return {
        outside: outside.length,
        scrolls: (scroller?.scrollWidth ?? 1) > (scroller?.clientWidth ?? 0),
      };
    });

    expect(overflow).toEqual({ outside: 0, scrolls: false });
  },
);

test('a record status changed in one tab updates the collapsed summary in another', async ({
  context,
  page,
}) => {
  const other = await context.newPage();
  await openTwoDiagrams(page);
  await openTwoDiagrams(other);
  await selectNode(other, storefront.ledger);
  const summary = threatSummary(other, storefront.orderDenied);
  await expect(summary).toHaveAttribute('aria-expanded', 'false');
  await expect(markOn(summary, unbacked)).toBeVisible();

  await selectNode(page, storefront.ledger);
  await expandThreat(page, storefront.orderDenied);
  await chooseInPanel(page, 'Mitigation 1 status', 'Implemented');
  await expect(
    panelField(page, 'combobox', 'Mitigation 1 status'),
  ).toContainText(/implemented/iu);

  await expect(markOn(summary, unbacked)).toHaveCount(0);
  await expect(summary).toHaveAttribute('aria-expanded', 'false');
});
