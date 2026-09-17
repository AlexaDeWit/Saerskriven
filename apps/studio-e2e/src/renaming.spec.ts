import { expect, test, type Locator, type Page } from '@playwright/test';
import { registeredChords } from './chords.fixtures.js';
import { dragOnto } from './canvas.fixtures.js';
import {
  canvasSurface,
  menuButton,
  nameField,
  nodeNamed,
  openPlaceholder,
  openTwoDiagrams,
  placeholder,
  runFromMenu,
  selectByKeyboard,
  selectNode,
} from './studio.fixtures.js';

const drawnName = (element: Locator, run: string): Locator =>
  element.locator(`text.${run}`);

const drawFlow = async (page: Page): Promise<void> => {
  const actor = nodeNamed(page, placeholder.actor);
  await actor.hover();
  await dragOnto(
    page,
    actor.locator('[data-handleid="right"]'),
    nodeNamed(page, placeholder.store).locator('[data-handleid="left"]'),
  );
  await expect(nodeNamed(page, /^New flow, flow/u)).toHaveCount(1);
};

test('a store is renamed by double-clicking it, and undo puts the name back', async ({
  page,
}) => {
  await openPlaceholder(page);
  const store = nodeNamed(page, placeholder.store);

  await store.dblclick();
  await nameField(page, 'Store').fill('Ledger');
  await nameField(page, 'Store').press('Enter');

  const renamed = nodeNamed(page, /^Ledger, store/u);
  await expect(renamed).toHaveCount(1);
  await expect(drawnName(renamed, 'pn-label')).toHaveText('Ledger');
  await expect(renamed).toBeFocused();

  await runFromMenu(page, 'Undo');

  await expect(nodeNamed(page, placeholder.store)).toHaveCount(1);
});

test('a store is renamed from the keyboard, on the selection', async ({
  page,
}) => {
  await openPlaceholder(page);
  await selectByKeyboard(page, placeholder.store);

  await page.keyboard.press('Enter');
  await nameField(page, 'Store').fill('Ledger');
  await nameField(page, 'Store').press('Enter');

  await expect(nodeNamed(page, /^Ledger, store/u)).toHaveCount(1);
});

test('escape leaves the name the model holds', async ({ page }) => {
  await openPlaceholder(page);
  const reader = await selectNode(page, placeholder.actor);

  await page.keyboard.press(registeredChords.rename[0]);
  await nameField(page, 'Actor').fill('Auditor');
  await nameField(page, 'Actor').press('Escape');

  await expect(nameField(page, 'Actor')).toHaveCount(0);
  await expect(nodeNamed(page, placeholder.actor)).toHaveCount(1);
  await expect(reader).toBeFocused();
});

test('the menu opens the name of the selection in a field', async ({
  page,
}) => {
  await openPlaceholder(page);
  await selectNode(page, placeholder.store);

  await runFromMenu(page, 'Rename selection');

  await expect(nameField(page, 'Store')).toBeFocused();
  await nameField(page, 'Store').fill('Ledger');
  await nameField(page, 'Store').press('Enter');

  await expect(nodeNamed(page, /^Ledger, store/u)).toHaveCount(1);
});

test('leaving the field for another control keeps the click that took focus', async ({
  page,
}) => {
  await openPlaceholder(page);
  await selectNode(page, placeholder.store);

  await page.keyboard.press(registeredChords.rename[0]);
  await nameField(page, 'Store').fill('Ledger');
  await menuButton(page).click();

  await expect(nodeNamed(page, /^Ledger, store/u)).toHaveCount(1);
  await expect(page.getByRole('menu')).toBeVisible();
});

test('the field stands where the name was drawn and holds the whole of it', async ({
  page,
}) => {
  await openPlaceholder(page);
  const longName = 'Ledger of every transaction the studio records';
  await nodeNamed(page, placeholder.store).dblclick();
  await nameField(page, 'Store').fill(longName);
  await nameField(page, 'Store').press('Enter');
  const renamed = nodeNamed(page, new RegExp(`^${longName}, store`, 'u'));
  await expect(renamed).toBeFocused();

  await renamed.dblclick();

  const field = nameField(page, longName);
  await expect(field).toBeFocused();
  await expect(drawnName(renamed, 'pn-label')).toHaveCount(0);
  await expect
    .poll(() =>
      field.evaluate((element) => ({
        wrapped:
          element.clientHeight >=
          2 * parseFloat(getComputedStyle(element).lineHeight),
        clipped: element.scrollHeight > element.clientHeight,
      })),
    )
    .toEqual({ wrapped: true, clipped: false });

  await field.press('Escape');

  await expect(drawnName(renamed, 'pn-label')).toContainText('Ledger');
});

test('a flow is renamed by double-clicking the label it draws', async ({
  page,
}) => {
  await openPlaceholder(page);
  await drawFlow(page);

  const flow = nodeNamed(page, /^New flow, flow/u);
  await drawnName(flow, 'pn-flow-label').dblclick();
  await expect(nameField(page, 'New flow')).toBeFocused();
  await expect(drawnName(flow, 'pn-flow-label')).toHaveCount(0);
  await nameField(page, 'New flow').fill('Opens');
  await nameField(page, 'New flow').press('Enter');

  const renamed = nodeNamed(page, /^Opens, flow/u);
  await expect(renamed).toHaveCount(1);
  await expect(drawnName(renamed, 'pn-flow-label')).toHaveText('Opens');
});

test('a flow of a real model is renamed from the keyboard', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  await selectByKeyboard(page, /^read the product listings, flow/u);

  await page.keyboard.press('Enter');
  await nameField(page, 'read the product listings').fill('Listings');
  await nameField(page, 'read the product listings').press('Enter');

  const renamed = nodeNamed(page, /^Listings, flow/u);
  await expect(renamed).toHaveCount(1);
  await expect(drawnName(renamed, 'pn-flow-label')).toHaveText('Listings');

  await runFromMenu(page, 'Undo');

  await expect(
    nodeNamed(page, /^read the product listings, flow/u),
  ).toHaveCount(1);
});

test('Enter reopens a selected Note for prose editing', async ({ page }) => {
  await openPlaceholder(page);
  await canvasSurface(page).focus();
  await page.keyboard.press(registeredChords['note-tool'][0]);
  await page.keyboard.press('Enter');

  const editor = page.getByRole('textbox', { name: 'Note text' });
  await editor.fill('Review the trust boundary.');
  await editor.press('ControlOrMeta+Enter');
  await expect(nodeNamed(page, /^Note, text/u)).toBeFocused();

  await page.keyboard.press('Enter');

  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue('Review the trust boundary.');
});
