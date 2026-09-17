import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  addRecord,
  chooseInPanel,
  expandThreat,
  openTwoDiagrams,
  panelControl,
  panelField,
  selectNode,
  threatPanel,
} from './studio.fixtures.js';

const ledger = /^Order ledger, store/u;

const orderDenied = /Shopper denies placing an order/u;

const shopper = /^Shopper, actor/u;

const takeover = /Account takeover/u;

const serverPricing = /^The server prices the basket/u;

const unbacked = 'mitigated-without-implemented-work';

const invalidated = 'rests-on-invalidated-assumption';

const summaryOf = (page: Page, title: RegExp): Locator =>
  threatPanel(page).getByRole('button', { name: title });

const collapse = async (page: Page, title: RegExp): Promise<Locator> => {
  const summary = summaryOf(page, title);
  if ((await summary.getAttribute('aria-expanded')) === 'true') {
    await summary.click();
  }
  await expect(summary).toHaveAttribute('aria-expanded', 'false');
  return summary;
};

const countOn = (summary: Locator, kind: string): Locator =>
  summary.locator(`[data-count="${kind}"]`);

const countOf = async (summary: Locator, kind: string): Promise<number> => {
  const text = (await countOn(summary, kind).textContent()) ?? '';
  return Number(/\d+$/u.exec(text.trim())?.[0] ?? Number.NaN);
};

const markOn = (summary: Locator, flag: string): Locator =>
  summary.locator(`[data-flag="${flag}"]`);

const partsInOrder = (name: string, parts: readonly string[]): boolean =>
  parts.every((part, index) => {
    const at = name.indexOf(part);
    return at >= 0 && (index === 0 || at > name.indexOf(parts[index - 1]));
  });

const namesItsParts = async (summary: Locator): Promise<void> => {
  const parts = (
    await summary.locator('[data-count], [data-flag]').allTextContents()
  ).map((part) => part.trim());
  expect(parts.length).toBeGreaterThan(0);
  await expect
    .poll(async () => partsInOrder(await summary.ariaSnapshot(), parts))
    .toBe(true);
};

const raiseBothFlags = async (page: Page): Promise<void> => {
  await expandThreat(page, orderDenied);
  await chooseInPanel(page, 'Mitigation 1 status', 'proposed');
  await addRecord(page, 'assumption', 'Callers rotate their tokens.');
  await chooseInPanel(page, 'Assumption 1 status', 'invalidated');
};

test('collapsed counts follow records linked and unlinked from the expanded view', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  await selectNode(page, ledger);
  await expandThreat(page, orderDenied);
  await addRecord(page, 'mitigation', 'Strip caller tokens at the edge');
  await addRecord(page, 'assumption', 'Callers rotate their tokens.');

  const summary = await collapse(page, orderDenied);
  await expect.poll(() => countOf(summary, 'mitigations')).toBe(2);
  await expect.poll(() => countOf(summary, 'assumptions')).toBe(1);
  await namesItsParts(summary);

  await expandThreat(page, orderDenied);
  await chooseInPanel(page, 'Existing mitigation', serverPricing);
  await panelControl(page, 'Link existing mitigation').click();
  await expect(
    panelField(page, 'textbox', 'Mitigation 3 description'),
  ).toHaveValue(serverPricing);
  await collapse(page, orderDenied);
  await expect.poll(() => countOf(summary, 'mitigations')).toBe(3);

  await expandThreat(page, orderDenied);
  await panelControl(page, 'Unlink mitigation 3').click();
  await collapse(page, orderDenied);
  await expect.poll(() => countOf(summary, 'mitigations')).toBe(2);
  await expect.poll(() => countOf(summary, 'assumptions')).toBe(1);
});

test('a mitigated threat with only proposed work is marked until the work is implemented', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  await selectNode(page, ledger);
  const summary = summaryOf(page, orderDenied);
  await expect(markOn(summary, unbacked)).toBeVisible();
  await namesItsParts(summary);

  await expandThreat(page, orderDenied);
  await chooseInPanel(page, 'Mitigation 1 status', 'implemented');
  await collapse(page, orderDenied);
  await expect(markOn(summary, unbacked)).toHaveCount(0);

  await expandThreat(page, orderDenied);
  await chooseInPanel(page, 'Mitigation 1 status', 'proposed');
  await collapse(page, orderDenied);
  await expect(markOn(summary, unbacked)).toBeVisible();
});

test('only an invalidated assumption marks the threat it is linked to', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  await selectNode(page, shopper);
  await expandThreat(page, takeover);
  await addRecord(page, 'assumption', 'Callers rotate their tokens.');
  const summary = summaryOf(page, takeover);

  for (const status of ['unconfirmed', 'valid']) {
    await chooseInPanel(page, 'Assumption 1 status', status);
    await collapse(page, takeover);
    await expect(summary.locator('[data-flag]')).toHaveCount(0);
    await expandThreat(page, takeover);
  }

  await chooseInPanel(page, 'Assumption 1 status', 'invalidated');
  await collapse(page, takeover);
  await expect(markOn(summary, invalidated)).toBeVisible();
  await namesItsParts(summary);
});

test('each flag mark keeps its glyph and outline in forced colours', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  await selectNode(page, ledger);
  await raiseBothFlags(page);
  const summary = await collapse(page, orderDenied);
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

test('a summary with counts and both flags fits the panel without scrolling sideways', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  await selectNode(page, ledger);
  await raiseBothFlags(page);
  const summary = await collapse(page, orderDenied);
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
    const outside = [
      node,
      ...node.querySelectorAll('[data-count], [data-flag]'),
    ].filter((part) => part.getBoundingClientRect().right > edge + 0.5);
    return {
      outside: outside.length,
      scrolls: (scroller?.scrollWidth ?? 1) > (scroller?.clientWidth ?? 0),
    };
  });

  expect(overflow).toEqual({ outside: 0, scrolls: false });
});

test('a record status changed in one tab updates the collapsed summary in another', async ({
  context,
  page,
}) => {
  const other = await context.newPage();
  await openTwoDiagrams(page);
  await openTwoDiagrams(other);
  await selectNode(other, ledger);
  const summary = summaryOf(other, orderDenied);
  await expect(summary).toHaveAttribute('aria-expanded', 'false');
  await expect(markOn(summary, unbacked)).toBeVisible();

  await selectNode(page, ledger);
  await expandThreat(page, orderDenied);
  await chooseInPanel(page, 'Mitigation 1 status', 'implemented');
  await expect(
    panelField(page, 'combobox', 'Mitigation 1 status'),
  ).toContainText(/implemented/iu);

  await expect(markOn(summary, unbacked)).toHaveCount(0);
  await expect(summary).toHaveAttribute('aria-expanded', 'false');
});
