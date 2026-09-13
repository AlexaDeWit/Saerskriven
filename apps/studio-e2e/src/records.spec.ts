import { expect, test, type Locator, type Page } from '@playwright/test';
import { registeredChords } from './chords.js';
import {
  centreOf,
  chooseInPanel,
  closeMenu,
  expandThreat,
  menuItem,
  nodeNamed,
  openEcluse,
  openMenu,
  panelControl,
  panelField,
  runFromMenu,
  selectNode,
  threatPanel,
} from './studio.fixtures.js';

const proxy = /^Écluse proxy, process/u;

const dredger = /^Écluse Dredger, process/u;

const purge = /Dredger inappropriately purges/u;

const forwarded = /Forwarded caller credentials/u;

const chokepoint = /Chokepoint exhaustion/u;

const onScreen = async (target: Locator): Promise<void> => {
  await target.scrollIntoViewIfNeeded();
  await expect(target).toBeInViewport();
  const at = await centreOf(target);
  const reached = await target.evaluate(
    (node, point) => node.contains(document.elementFromPoint(point.x, point.y)),
    at,
  );
  expect(reached, 'a record control is covered').toBe(true);
};

const offeredToLink = async (page: Page, label: string): Promise<boolean> => {
  const existing = panelField(page, 'combobox', 'Existing mitigation');
  if ((await existing.count()) === 0) {
    return false;
  }
  await existing.click();
  await expect(page.getByRole('listbox')).toBeVisible();
  const found = await page
    .getByRole('option', { name: label, exact: true })
    .count();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  return found > 0;
};

const undoOffered = async (page: Page): Promise<boolean> => {
  await openMenu(page);
  const disabled = await menuItem(page, 'Undo').getAttribute('aria-disabled');
  await closeMenu(page);
  return disabled !== 'true';
};

test('a mitigation added from the empty row is one undo step, and its status changes in place', async ({
  page,
}) => {
  await openEcluse(page);
  await selectNode(page, dredger);
  await expandThreat(page, purge);
  const threatStatus = panelField(page, 'combobox', 'Status');
  const before = await threatStatus.textContent();

  const add = panelControl(page, 'Add mitigation');
  await onScreen(add);
  await add.click();

  const title = panelField(page, 'textbox', 'Mitigation 2 title');
  await expect(title).toBeFocused();
  await onScreen(title);
  await page.keyboard.type('Keep a restorable copy of every purge');
  await page.keyboard.press('Tab');
  await expect(
    panelField(page, 'textbox', 'Mitigation 2 description'),
  ).toBeFocused();

  const status = panelField(page, 'combobox', 'Mitigation 2 status');
  await onScreen(status);
  await expect(status).toContainText(/proposed/iu);
  await onScreen(panelControl(page, 'Unlink mitigation 2'));

  for (const chosen of ['implemented', 'verified']) {
    await chooseInPanel(page, 'Mitigation 2 status', chosen);
    await expect(status).toContainText(chosen);
    await expect(threatStatus).toHaveText(before ?? '');
  }

  await runFromMenu(page, 'Undo');
  await expect(status).toContainText(/implemented/iu);
  await runFromMenu(page, 'Undo');
  await runFromMenu(page, 'Undo');
  await expect(title).toHaveCount(0);
  await runFromMenu(page, 'Redo');
  await expect(title).toHaveValue('Keep a restorable copy of every purge');
});

test('Tab out of a new record reaches its status, and undoing the record keeps focus in its group', async ({
  page,
}) => {
  await openEcluse(page);
  await selectNode(page, proxy);
  await expandThreat(page, forwarded);

  await panelControl(page, 'Add assumption').click();
  await page.keyboard.type('Callers rotate their tokens.');
  await page.keyboard.press('Tab');

  const status = panelField(page, 'combobox', 'Assumption 1 status');
  await expect(status).toBeFocused();

  await page.keyboard.press(registeredChords.undo[0]);

  await expect(status).toHaveCount(0);
  await expect(panelControl(page, 'Add assumption')).toBeFocused();
});

test('a click on Add right after typing in a new row keeps the record and opens the next row', async ({
  page,
}) => {
  await openEcluse(page);
  await selectNode(page, proxy);
  await expandThreat(page, forwarded);

  const add = panelControl(page, 'Add mitigation');
  await add.click();
  await page.keyboard.type('Strip caller tokens at the edge');
  await add.click();

  await expect(panelField(page, 'textbox', 'Mitigation 2 title')).toHaveValue(
    'Strip caller tokens at the edge',
  );
  await expect(panelField(page, 'textbox', 'Mitigation 3 title')).toBeFocused();
});

test('Shift+Tab from Existing reaches Add after a new row became a record', async ({
  page,
}) => {
  await openEcluse(page);
  await selectNode(page, proxy);
  await expandThreat(page, forwarded);
  await panelControl(page, 'Add mitigation').click();
  await page.keyboard.type('Bound every upstream response');
  await page.keyboard.press('Tab');

  await expandThreat(page, chokepoint);
  await panelControl(page, 'Add mitigation').click();
  await page.keyboard.type('Shed load at the chokepoint');
  const existing = panelField(page, 'combobox', 'Existing mitigation');
  await existing.focus();
  await expect(panelField(page, 'textbox', 'Mitigation 2 title')).toHaveValue(
    'Shed load at the chokepoint',
  );
  await page.keyboard.press('Shift+Tab');

  await expect(panelControl(page, 'Add mitigation')).toBeFocused();
});

test('Discard on a new row with typed text leaves no record and nothing to undo', async ({
  page,
  isMobile,
}) => {
  await openEcluse(page);
  await selectNode(page, proxy);
  await expandThreat(page, forwarded);

  const add = panelControl(page, 'Add mitigation');
  await add.click();
  await page.keyboard.type('Strip caller tokens at the edge');
  const discard = panelControl(page, 'Discard mitigation 2');
  await (isMobile ? discard.tap() : discard.click());

  await expect(panelField(page, 'textbox', 'Mitigation 2 title')).toHaveCount(
    0,
  );
  await expect(add).toBeFocused();
  expect(await undoOffered(page)).toBe(false);
});

test('leaving the empty row leaves no record and nothing to undo', async ({
  page,
}) => {
  await openEcluse(page);
  await selectNode(page, proxy);
  await expandThreat(page, forwarded);

  const add = panelControl(page, 'Add assumption');
  await add.click();
  const prose = panelField(page, 'textbox', 'Assumption 1');
  await expect(prose).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    panelField(page, 'combobox', 'Assumption 1 status'),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(panelControl(page, 'Discard assumption 1')).toBeFocused();
  await page.keyboard.press('Tab');

  await expect(add).toBeFocused();
  await expect(prose).toHaveCount(0);
  expect(await undoOffered(page)).toBe(false);
});

test('a linked record says how many other threats hold it, and unlinking culls it only from its last threat', async ({
  page,
}) => {
  await openEcluse(page);
  await selectNode(page, proxy);
  await expandThreat(page, forwarded);

  const bound = 'Bound every upstream response';
  await panelControl(page, 'Add mitigation').click();
  await page.keyboard.type(bound);
  await page.keyboard.press('Tab');
  await expect(
    panelField(page, 'textbox', 'Mitigation 2 description'),
  ).toBeFocused();
  expect(await offeredToLink(page, bound)).toBe(false);

  await expandThreat(page, chokepoint);
  expect(await offeredToLink(page, bound)).toBe(true);
  await chooseInPanel(page, 'Existing mitigation', bound);
  await panelControl(page, 'Link existing mitigation').click();

  const linked = panelField(page, 'textbox', 'Mitigation 2 title');
  await expect(linked).toHaveValue(bound);
  await expect(linked).toBeFocused();
  expect(await offeredToLink(page, bound)).toBe(false);
  await expect(
    panelControl(page, 'Unlink mitigation 2'),
  ).toHaveAccessibleDescription(/1/u);

  await panelControl(page, 'Unlink mitigation 2').click();
  await expect(linked).toHaveCount(0);
  expect(await offeredToLink(page, bound)).toBe(true);

  await expandThreat(page, forwarded);
  const kept = panelField(page, 'textbox', 'Mitigation 2 title');
  await expect(kept).toHaveValue(bound);
  await expect(
    panelControl(page, 'Unlink mitigation 2'),
  ).not.toHaveAccessibleDescription(/1/u);

  await panelControl(page, 'Unlink mitigation 2').click();
  await expect(kept).toHaveCount(0);
  expect(await offeredToLink(page, bound)).toBe(false);

  await runFromMenu(page, 'Undo');
  await expect(kept).toHaveValue(bound);
});

test('a record edit in one tab reaches another, which keeps its own selection', async ({
  context,
  page,
}) => {
  const other = await context.newPage();
  await openEcluse(page);
  await openEcluse(other);
  const worker = await selectNode(other, /^Mirror worker, process/u);

  await selectNode(page, proxy);
  await expandThreat(page, forwarded);
  await panelControl(page, 'Add mitigation').click();
  await page.keyboard.type('Strip caller tokens at the edge');
  await page.keyboard.press('Tab');
  await expect(
    panelField(page, 'combobox', 'Mitigation 2 status'),
  ).toBeVisible();

  await expect.poll(() => undoOffered(other)).toBe(true);
  await expect(worker).toHaveClass(/selected/u);
  await expect(
    threatPanel(other).getByRole('heading', { name: /Mirror worker/u }),
  ).toBeVisible();

  await selectNode(other, proxy);
  await expandThreat(other, forwarded);
  await expect(panelField(other, 'textbox', 'Mitigation 2 title')).toHaveValue(
    'Strip caller tokens at the edge',
  );
  await chooseInPanel(other, 'Mitigation 2 status', 'verified');

  await expect(
    panelField(page, 'combobox', 'Mitigation 2 status'),
  ).toContainText(/verified/iu);
  await expect(nodeNamed(page, proxy)).toHaveClass(/selected/u);
});
