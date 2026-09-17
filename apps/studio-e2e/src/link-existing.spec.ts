import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  expandThreat,
  focusedOption,
  openTwoDiagrams,
  panelControl,
  panelField,
  runFromMenu,
  selectByKeyboard,
  selectNode,
} from './studio.fixtures.js';

const shopper = /^Shopper, actor/u;

const takeover = /Account takeover/u;

const webShop = /^Web shop, process/u;

const basketPrice = /Basket price changed/u;

const offered = {
  first: {
    name: /^The server prices the basket/u,
    description: /^The server prices the basket/u,
  },
  middle: {
    name: /^Write an audit entry/u,
    description: /^Write an audit entry/u,
  },
  last: {
    name: /^Reservation expiry/u,
    description: /^A reservation lapses/u,
  },
} as const;

const openPicker = async (page: Page) => {
  await openTwoDiagrams(page);
  await selectNode(page, shopper);
  await expandThreat(page, takeover);
  const trigger = panelField(page, 'combobox', 'Existing mitigation');
  await trigger.scrollIntoViewIfNeeded();
  await expect(trigger).toBeInViewport({ ratio: 1 });
  return trigger;
};

test('a pointer links the first, middle and last mitigation offered, picked by name', { tag: '@phone' }, async ({
  page,
}) => {
  const trigger = await openPicker(page);
  const linked = panelField(page, 'textbox', 'Mitigation 2 description');

  for (const [place, { name, description }] of Object.entries(offered)) {
    await test.step(place, async () => {
      await trigger.scrollIntoViewIfNeeded();
      await trigger.click();
      const listbox = page.getByRole('listbox');
      await expect(listbox).toBeInViewport({ ratio: 1 });

      await listbox.getByRole('option', { name }).click();
      await expect(listbox).toHaveCount(0);
      await panelControl(page, 'Link existing mitigation').click();

      await expect(linked).toHaveValue(description);

      await runFromMenu(page, 'Undo');
      await expect(linked).toHaveCount(0);
    });
  }
});

test('the keyboard links the last mitigation offered', async ({ page }) => {
  const trigger = await openPicker(page);
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.keyboard.press('End');
  await expect(focusedOption(page)).toHaveAccessibleName(offered.last.name);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');

  await expect(
    panelField(page, 'textbox', 'Mitigation 2 description'),
  ).toHaveValue(offered.last.description);
});

const suffixShownIn = async (holder: Locator): Promise<string> => {
  const suffix = holder.locator('[data-option-suffix]');
  await expect(suffix).toBeVisible();
  const [outer, label, inner] = await Promise.all([
    holder.boundingBox(),
    holder.locator('[data-option-label]').boundingBox(),
    suffix.boundingBox(),
  ]);
  expect(inner?.height).toBeGreaterThan(0);
  expect(inner?.y).toBeGreaterThanOrEqual(
    (label?.y ?? Infinity) + (label?.height ?? 0),
  );
  expect(inner?.y).toBeGreaterThanOrEqual(outer?.y ?? Infinity);
  expect((inner?.y ?? 0) + (inner?.height ?? 0)).toBeLessThanOrEqual(
    (outer?.y ?? 0) + (outer?.height ?? 0),
  );
  return (await suffix.textContent()) ?? '';
};

test('two mitigations whose first lines match past the cut stay told apart in the listbox and the trigger', async ({
  page,
}) => {
  const shared =
    'Callers forward a bearer token that the proxy holds in memory for the life of the request, and the proxy never writes it to a log, a span or a cache.';
  await openTwoDiagrams(page);
  await selectNode(page, shopper);
  await expandThreat(page, takeover);
  for (const row of [2, 3]) {
    await panelControl(page, 'Add mitigation').click();
    await page.keyboard.insertText(shared);
    await page.keyboard.press('Tab');
    await expect(
      panelField(page, 'textbox', `Mitigation ${String(row)} description`),
    ).toBeFocused();
  }

  await selectByKeyboard(page, webShop);
  await expandThreat(page, basketPrice);
  const trigger = panelField(page, 'combobox', 'Existing mitigation');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  const alike = page.getByRole('option', { name: shared });
  await expect(alike).toHaveCount(2);
  const suffixes = [];
  for (const option of await alike.all()) {
    await option.scrollIntoViewIfNeeded();
    suffixes.push(await suffixShownIn(option));
  }
  expect(new Set(suffixes).size).toBe(2);

  await alike.last().click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
  expect(await suffixShownIn(trigger)).toBe(suffixes[1]);
});
