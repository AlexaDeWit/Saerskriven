import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  expandThreat,
  focusedOption,
  openEcluse,
  panelControl,
  panelField,
  selectNode,
} from './studio.fixtures.js';

const proxy = /^Écluse proxy, process/u;

const forwarded = /Forwarded caller credentials/u;

const chokepoint = /Chokepoint exhaustion/u;

const offered = {
  first: /^Fail-closed caps bound the input/u,
  middle: /^The control is an operator-architecture invariant/u,
  last: /^Dredger must verify explicit operator consent/u,
} as const;

const openPicker = async (page: Page) => {
  await openEcluse(page);
  await selectNode(page, proxy);
  await expandThreat(page, forwarded);
  const trigger = panelField(page, 'combobox', 'Existing mitigation');
  await trigger.scrollIntoViewIfNeeded();
  await expect(trigger).toBeInViewport({ ratio: 1 });
  return trigger;
};

for (const [place, name] of Object.entries(offered)) {
  test(`a pointer links the ${place} mitigation offered, picked by name`, async ({
    page,
  }) => {
    const trigger = await openPicker(page);
    await trigger.click();
    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeInViewport({ ratio: 1 });

    await listbox.getByRole('option', { name }).click();
    await expect(listbox).toHaveCount(0);
    await panelControl(page, 'Link existing mitigation').click();

    await expect(
      panelField(page, 'textbox', 'Mitigation 2 description'),
    ).toHaveValue(name);
  });
}

test('the keyboard links the last mitigation offered', async ({ page }) => {
  const trigger = await openPicker(page);
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.keyboard.press('End');
  await expect(focusedOption(page)).toHaveAccessibleName(offered.last);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');

  await expect(
    panelField(page, 'textbox', 'Mitigation 2 description'),
  ).toHaveValue(offered.last);
});

const suffixShownIn = async (holder: Locator): Promise<string> => {
  const suffix = holder.locator('[data-option-suffix]');
  await expect(suffix).toBeVisible();
  const [outer, inner] = await Promise.all([
    holder.boundingBox(),
    suffix.boundingBox(),
  ]);
  expect(inner?.height).toBeGreaterThan(0);
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
  await openEcluse(page);
  await selectNode(page, proxy);
  await expandThreat(page, forwarded);
  for (const row of [2, 3]) {
    await panelControl(page, 'Add mitigation').click();
    await page.keyboard.insertText(shared);
    await page.keyboard.press('Tab');
    await expect(
      panelField(page, 'textbox', `Mitigation ${String(row)} description`),
    ).toBeFocused();
  }

  await expandThreat(page, chokepoint);
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
