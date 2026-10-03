import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  expandThreat,
  focusedOption,
  openShopperTakeover,
  panelControl,
  panelField,
  runFromMenu,
  selectByKeyboard,
  storefront,
  threatPanel,
} from './studio.fixtures.js';

const offered = {
  first: {
    name: /^The server prices the basket/u,
    toggle: /^Mitigation 2, The server prices the basket/u,
    description: /^The server prices the basket/u,
  },
  middle: {
    name: /^Write an audit entry/u,
    toggle: /^Mitigation 2, Write an audit entry/u,
    description: /^Write an audit entry/u,
  },
  last: {
    name: /^Reservation expiry/u,
    toggle: /^Mitigation 2, Reservation expiry$/u,
    description: /^A reservation lapses/u,
  },
} as const;

const linkedToggle = (page: Page): Locator =>
  threatPanel(page).getByRole('button', { name: /^Mitigation 2(?:,|$)/u });

const openPicker = async (page: Page) => {
  await openShopperTakeover(page);
  const trigger = panelField(page, 'combobox', 'Existing mitigation');
  await trigger.scrollIntoViewIfNeeded();
  await expect(trigger).toBeInViewport({ ratio: 1 });
  return trigger;
};

test(
  'a pointer links the first, middle and last mitigation offered, picked by name',
  { tag: '@phone' },
  async ({ page }) => {
    const trigger = await openPicker(page);
    const linked = linkedToggle(page);

    for (const [place, { name, toggle }] of Object.entries(offered)) {
      await test.step(place, async () => {
        await trigger.scrollIntoViewIfNeeded();
        await trigger.click();
        const listbox = page.getByRole('listbox');
        await expect(listbox).toBeInViewport({ ratio: 1 });

        await listbox.getByRole('option', { name }).click();
        await expect(listbox).toHaveCount(0);
        await panelControl(page, 'Link existing mitigation').click();

        await expect(linked).toHaveAccessibleName(toggle);
        await expect(linked).toBeFocused();

        await runFromMenu(page, 'Undo');
        await expect(linked).toHaveCount(0);
      });
    }
  },
);

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

  const linked = linkedToggle(page);
  await expect(linked).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(
    panelField(page, 'textbox', 'Mitigation 2 description'),
  ).toHaveValue(offered.last.description);
});

const suffixShownIn = async (holder: Locator): Promise<string> => {
  const suffix = holder.locator('[data-option-suffix]');
  await expect(suffix).toBeVisible();
  const [outer, label, inner] = await holder.evaluate((option) =>
    [
      option,
      option.querySelector('[data-option-label]'),
      option.querySelector('[data-option-suffix]'),
    ].map((part) => {
      const rect = part?.getBoundingClientRect();
      return { y: rect?.y ?? Number.NaN, height: rect?.height ?? 0 };
    }),
  );
  expect(inner.height).toBeGreaterThan(0);
  expect(inner.y).toBeGreaterThanOrEqual(label.y + label.height);
  expect(inner.y).toBeGreaterThanOrEqual(outer.y);
  expect(inner.y + inner.height).toBeLessThanOrEqual(outer.y + outer.height);
  return (await suffix.textContent()) ?? '';
};

test('two mitigations whose first lines match past the cut stay told apart in the listbox and the trigger', async ({
  page,
}) => {
  const shared =
    'Callers forward a bearer token that the proxy holds in memory for the life of the request, and the proxy never writes it to a log, a span or a cache.';
  await openShopperTakeover(page);
  for (const row of [2, 3]) {
    await panelControl(page, 'Add mitigation').click();
    await page.keyboard.insertText(shared);
    await page.keyboard.press('Tab');
    await expect(
      panelField(page, 'textbox', `Mitigation ${String(row)} description`),
    ).toBeFocused();
  }

  await selectByKeyboard(page, storefront.webShop);
  await expandThreat(page, storefront.basketPrice);
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
