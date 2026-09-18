import { expect, test } from '@playwright/test';
import { audit } from './accessibility.fixtures.js';
import { registeredChords } from './chords.fixtures.js';
import {
  chooseInPanel,
  closeMenu,
  diagramChoice,
  diagramSwitcher,
  diagramTitleField,
  expandThreat,
  handleOn,
  menuButton,
  menuItem,
  nameField,
  nodeNamed,
  openFallback,
  openMenu,
  openPlaceholder,
  openText,
  openTwoDiagrams,
  panelField,
  placeByClick,
  placeholder,
  savedFromMenu,
  selectNode,
  storefront,
} from './studio.fixtures.js';

test('the studio page carries no axe-core accessibility violation', async ({
  page,
}) => {
  await openPlaceholder(page);

  await audit(page, 'at rest');
});
test('the studio carries no violation under the system dark preference', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await openPlaceholder(page);

  await audit(page, 'at rest in the dark scheme');
});
test('the studio carries no violation with the threat panel open on a selected element', async ({
  page,
}) => {
  await openPlaceholder(page);

  await page.getByRole('group', { name: placeholder.actor }).click();
  const summary = page.getByRole('button', { name: /sends records/u });
  await summary.click();
  await expect(page.getByRole('textbox', { name: 'Title' })).toBeVisible();
  await chooseInPanel(page, 'Status', 'Mitigated');
  await expect(summary.locator('[data-flag]')).toHaveCount(1);

  await audit(page, 'showing the threat panel with a flagged threat');
  await page.getByRole('combobox', { name: 'Severity' }).press('Enter');
  await expect(page.getByRole('listbox')).toBeVisible();

  await audit(page, 'showing an open listbox', '[role="listbox"]');
});

test('the studio carries no violation with the panel open mid-drag', async ({
  page,
}) => {
  await openPlaceholder(page);

  const actor = page.getByRole('group', { name: placeholder.actor });
  await actor.click();
  await expect(page.getByRole('region', { name: 'Threats' })).toBeVisible();

  const box = await actor.boundingBox();
  const from = {
    x: (box?.x ?? 0) + (box?.width ?? 0) / 2,
    y: (box?.y ?? 0) + (box?.height ?? 0) / 2,
  };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x - 40, from.y + 30, { steps: 8 });

  await audit(page, 'mid-drag with the threat panel open');

  await page.mouse.up();
});
test('the studio carries no violation while it shows a refusal', async ({
  page,
}) => {
  await openPlaceholder(page);

  await expect(page.getByTestId('failure-notice')).toHaveCSS(
    'display',
    'block',
  );

  await openText(page, 'notes.txt', 'no threat model here');
  await expect(page.getByTestId('failure-notice')).toContainText('notes.txt');

  await audit(page, 'showing a refusal');
});
test('the studio carries no violation while it says what an edit did', async ({
  page,
}) => {
  await openPlaceholder(page);

  await placeByClick(page, 'Actor', /^New actor, actor/u);
  await expect(page.getByTestId('canvas-announcement')).toBeEmpty();

  await audit(page, 'showing an added element');

  const name = nameField(page, 'New actor');
  await expect(name).toBeFocused();
  await name.press('Enter');
  await expect(name).toHaveCount(0);
  await page.keyboard.press('Delete');
  await expect(page.getByTestId('canvas-announcement')).not.toBeEmpty();

  await audit(page, 'showing a removed element');
});
test('the studio carries no violation with the menu open', async ({ page }) => {
  await openFallback(page);

  await openMenu(page);

  await audit(page, 'showing the open menu');

  await menuItem(page, 'Export').press('ArrowRight');
  await expect(menuItem(page, 'Diagram as SVG')).toBeVisible();

  await audit(page, 'showing the open Export menu');

  await page.keyboard.press('ArrowLeft');

  await menuItem(page, 'Save as').click();
  await expect(menuItem(page, 'Save as Saerskriven YAML')).toBeVisible();

  await audit(page, 'showing the menu asking which format a save-as writes');

  await savedFromMenu(page, 'Save as Threat Dragon JSON');
  await expect(page.getByTestId('loss-report')).not.toBeEmpty();

  await audit(page, 'showing a loss report');

  await placeByClick(page, 'Actor', /^New actor, actor/u);
  const name = nameField(page, 'New actor');
  await expect(name).toBeFocused();
  await name.press('Enter');
  await expect(name).toHaveCount(0);
  await menuButton(page).press(registeredChords['close-file'][0]);
  await expect(
    menuItem(page, 'Discard changes and create new model'),
  ).toBeVisible();

  await audit(page, 'showing the menu asking before it closes a file');

  await closeMenu(page);
  await expect(menuButton(page)).toBeFocused();
  await page.keyboard.press(registeredChords.open[0]);
  await expect(menuItem(page, 'Discard changes and open')).toBeVisible();

  await audit(page, 'showing the menu asking before it opens a file');
});

test('the open Link existing listbox carries no violation with long record labels', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  await selectNode(page, storefront.shopper);
  await expandThreat(page, storefront.takeover);
  await panelField(page, 'combobox', 'Existing mitigation').click();
  await expect(page.getByRole('listbox')).toBeVisible();

  await audit(
    page,
    'showing the open Link existing listbox',
    '[role="listbox"]',
  );
});

test('the studio carries no violation with the diagram switcher open, or its title field', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  await audit(page, 'naming the diagram on screen');

  await diagramSwitcher(page).click();
  await expect(diagramChoice(page, 'Shipping an order')).toBeVisible();
  await audit(page, 'showing the open diagram switcher');

  await menuItem(page, 'Rename diagram').click();
  await expect(diagramTitleField(page)).toBeFocused();
  await audit(page, 'editing the diagram title');
});

test('the studio carries no violation with an element selected, its connect listbox open, or a flow selected', async ({
  page,
}) => {
  await openPlaceholder(page);

  const actor = nodeNamed(page, placeholder.actor);
  await actor.click();
  await expect(handleOn(actor, 'right')).toBeVisible();

  await audit(page, 'showing a selected element and its handles');

  await page.keyboard.press(registeredChords['start-flow'][0]);
  await expect(page.getByRole('listbox')).toBeVisible();

  await audit(page, 'showing the open connect listbox', '[role="listbox"]');

  await page.getByRole('option', { name: 'Store' }).press('Enter');
  await expect(
    page.getByRole('group', {
      name: /^New flow, flow, from Actor to Store/u,
    }),
  ).toHaveClass(/selected/u);

  await audit(page, 'showing a selected flow');
});
