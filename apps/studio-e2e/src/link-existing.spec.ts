import { expect, test, type Page } from '@playwright/test';
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
