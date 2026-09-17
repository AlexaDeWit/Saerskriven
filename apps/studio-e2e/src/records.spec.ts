import { expect, test, type Locator, type Page } from '@playwright/test';
import { softHyphen } from '@saerskriven/model/fixtures';
import type { Box } from './canvas-geometry.fixtures.js';
import { registeredChords } from './chords.fixtures.js';
import {
  addRecord,
  chooseInPanel,
  editAnnouncement,
  expandThreat,
  nodeNamed,
  offeredToLink,
  onScreen,
  openTwoDiagrams,
  panelControl,
  panelField,
  runFromMenu,
  screenBoxOf,
  scrolledAbove,
  selectByKeyboard,
  selectNode,
  threatPanel,
  undoOffered,
} from './studio.fixtures.js';

const shopper = /^Shopper, actor/u;

const takeover = /Account takeover/u;

const webShop = /^Web shop, process/u;

const basketPrice = /Basket price changed/u;

const ledger = /^Order ledger, store/u;

const orderDenied = /Shopper denies placing an order/u;

const describedNumbers = (control: Locator): Promise<readonly number[]> =>
  control.evaluate((element) =>
    (
      document
        .getElementById(element.getAttribute('aria-describedby') ?? '')
        ?.textContent.match(/\d+/gu) ?? []
    ).map(Number),
  );

const mitigationOffered = (page: Page, label: string): Promise<boolean> =>
  offeredToLink(
    page,
    panelField(page, 'combobox', 'Existing mitigation'),
    label,
  );

test('a mitigation added from the empty row is one undo step, and its status changes in place', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  await selectNode(page, ledger);
  await expandThreat(page, orderDenied);
  const threatStatus = panelField(page, 'combobox', 'Status');
  const before = await threatStatus.textContent();

  const add = panelControl(page, 'Add mitigation');
  await onScreen(add);
  await add.click();

  const title = panelField(page, 'textbox', 'Mitigation 2 title');
  await expect(title).toBeFocused();
  await onScreen(title);
  await page.keyboard.type('Sign every ledger entry');
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
  await expect(title).toHaveValue('Sign every ledger entry');
});

test('Tab out of a new record reaches its status, and undoing the record keeps focus in its group', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  await selectNode(page, shopper);
  await expandThreat(page, takeover);

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
  await openTwoDiagrams(page);
  await selectNode(page, shopper);
  await expandThreat(page, takeover);

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
  await openTwoDiagrams(page);
  await selectNode(page, shopper);
  await expandThreat(page, takeover);
  await panelControl(page, 'Add mitigation').click();
  await page.keyboard.type('Bound every upstream response');
  await page.keyboard.press('Tab');

  await selectByKeyboard(page, webShop);
  await expandThreat(page, basketPrice);
  await panelControl(page, 'Add mitigation').click();
  await page.keyboard.type('Price the basket on the server');
  const existing = panelField(page, 'combobox', 'Existing mitigation');
  await existing.focus();
  await expect(panelField(page, 'textbox', 'Mitigation 3 title')).toHaveValue(
    'Price the basket on the server',
  );
  await page.keyboard.press('Shift+Tab');

  await expect(panelControl(page, 'Add mitigation')).toBeFocused();
});

test('Discard on a new row with typed text leaves no record and nothing to undo', async ({
  page,
  isMobile,
}) => {
  await openTwoDiagrams(page);
  await selectNode(page, shopper);
  await expandThreat(page, takeover);

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
  await openTwoDiagrams(page);
  await selectNode(page, shopper);
  await expandThreat(page, takeover);

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

test('a linked record names the other threats that hold it by number, and unlinking culls it only from its last threat', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  await selectNode(page, shopper);
  await expandThreat(page, takeover);

  const bound = 'Bound every upstream response';
  await panelControl(page, 'Add mitigation').click();
  await page.keyboard.type(bound);
  await page.keyboard.press('Tab');
  await expect(
    panelField(page, 'textbox', 'Mitigation 2 description'),
  ).toBeFocused();
  expect(await mitigationOffered(page, bound)).toBe(false);

  await selectByKeyboard(page, webShop);
  await expandThreat(page, basketPrice);
  expect(await mitigationOffered(page, bound)).toBe(true);
  await chooseInPanel(page, 'Existing mitigation', bound);
  await panelControl(page, 'Link existing mitigation').click();

  const linked = panelField(page, 'textbox', 'Mitigation 3 title');
  await expect(linked).toHaveValue(bound);
  await expect(linked).toBeFocused();
  expect(await mitigationOffered(page, bound)).toBe(false);
  await expect
    .poll(() => describedNumbers(panelControl(page, 'Unlink mitigation 3')))
    .toEqual([1]);

  await panelControl(page, 'Unlink mitigation 3').click();
  await expect(linked).toHaveCount(0);
  expect(await mitigationOffered(page, bound)).toBe(true);

  await selectByKeyboard(page, shopper);
  await expandThreat(page, takeover);
  const kept = panelField(page, 'textbox', 'Mitigation 2 title');
  await expect(kept).toHaveValue(bound);
  await expect
    .poll(() => describedNumbers(panelControl(page, 'Unlink mitigation 2')))
    .toEqual([]);

  await panelControl(page, 'Unlink mitigation 2').click();
  await expect(kept).toHaveCount(0);
  expect(await mitigationOffered(page, bound)).toBe(false);

  await runFromMenu(page, 'Undo');
  await expect(kept).toHaveValue(bound);
});

test('unlinking a record with a long first line announces a bounded name, and the pane header stays usable under it', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  await selectNode(page, shopper);
  await expandThreat(page, takeover);
  await panelControl(page, 'Add mitigation').click();
  await page.keyboard.insertText(
    'The shop signs every basket token with a key that it rotates each day, and it refuses a basket whose token was signed with a key it has retired.',
  );
  await page.keyboard.press('Tab');
  const unlink = panelControl(page, 'Unlink mitigation 2');
  await onScreen(unlink);
  await unlink.click();

  const said = editAnnouncement(page);
  await expect(said).toContainText('The shop signs every');
  expect((await said.textContent())?.length ?? 0).toBeLessThan(160);

  const widen = panelControl(page, 'Widen pane');
  await onScreen(widen);
  await widen.click();
  await expect(panelControl(page, 'Restore pane width')).toBeVisible();
  await expect(said).not.toBeEmpty();

  const close = panelControl(page, 'Close threats');
  await onScreen(close);
  await close.click();
  await expect(threatPanel(page)).toHaveCount(0);
});

test('the pane and its record fields stay where they are when an unlink is announced and when the next keystroke clears it', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  await selectNode(page, shopper);
  await expandThreat(page, takeover);
  await panelControl(page, 'Add mitigation').click();
  await page.keyboard.type('Strip caller tokens at the edge');
  await page.keyboard.press('Tab');
  const description = panelField(page, 'textbox', 'Mitigation 2 description');
  await expect(description).toBeFocused();

  const top = (await screenBoxOf(threatPanel(page))).y;
  const unlink = panelControl(page, 'Unlink mitigation 1');
  await onScreen(unlink);
  await unlink.click();
  await expect(editAnnouncement(page)).not.toBeEmpty();
  expect((await screenBoxOf(threatPanel(page))).y).toBe(top);

  const remaining = panelField(page, 'textbox', 'Mitigation 1 title');
  await remaining.focus();
  await remaining.press('End');
  const field = (await screenBoxOf(remaining)).y;
  await page.keyboard.type('s');
  await page.keyboard.press('Tab');
  await expect(remaining).toHaveValue('Strip caller tokens at the edges');
  await expect(editAnnouncement(page)).toBeEmpty();
  expect((await screenBoxOf(threatPanel(page))).y).toBe(top);
  expect((await screenBoxOf(remaining)).y).toBe(field);
});

const scrollPaneTo = (
  target: Locator,
  edge: 'top' | 'bottom',
): Promise<boolean> =>
  target.evaluate((element, side) => {
    let pane = element.parentElement;
    while (pane !== null && getComputedStyle(pane).overflowY !== 'auto') {
      pane = pane.parentElement;
    }
    if (pane === null) {
      return false;
    }
    const drawn = element.getBoundingClientRect();
    const port = pane.getBoundingClientRect().top + pane.clientTop;
    const wanted =
      pane.scrollTop +
      (side === 'top'
        ? drawn.top - port
        : drawn.bottom - port - pane.clientHeight);
    pane.scrollTop = wanted;
    return Math.abs(pane.scrollTop - wanted) < 1;
  }, edge);

const settledBox = async (target: Locator): Promise<Box> => {
  let before = '';
  let box = await screenBoxOf(target);
  await expect
    .poll(async () => {
      box = await screenBoxOf(target);
      const now = JSON.stringify(box);
      const settled = now === before;
      before = now;
      return settled;
    })
    .toBe(true);
  return box;
};

test('an unlink keeps the pane scrolled where it was while the next Unlink is on screen', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  await selectNode(page, shopper);
  await expandThreat(page, takeover);
  await addRecord(page, 'mitigation', 'Strip caller tokens at the edge');
  await addRecord(page, 'mitigation', 'Rotate the upstream token hourly');

  const unlink = panelControl(page, 'Unlink mitigation 1');
  await onScreen(unlink);
  const add = panelControl(page, 'Add mitigation');
  const scrolled = await scrolledAbove(add);
  await unlink.click();

  await expect(panelField(page, 'textbox', 'Mitigation 1 title')).toHaveValue(
    'Strip caller tokens at the edge',
  );
  await expect(unlink).toBeFocused();
  await expect(unlink).toBeInViewport({ ratio: 1 });
  expect(await scrolledAbove(add)).toBe(scrolled);
});

test('an unlink scrolls the pane only as far as the next Unlink needs to be seen', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  await selectNode(page, shopper);
  await expandThreat(page, takeover);
  await addRecord(page, 'mitigation', 'Strip caller tokens at the edge');
  await addRecord(
    page,
    'mitigation',
    'Rotate the upstream token hourly',
    'Issue tokens per caller.\nExpire them within the hour.\nRefuse a replay.\nLog each rotation.\nAlert on a failed rotation.',
  );

  const unlink = panelControl(page, 'Unlink mitigation 2');
  expect(await scrollPaneTo(unlink, 'bottom')).toBe(true);
  const pressed = await screenBoxOf(unlink);
  const add = panelControl(page, 'Add mitigation');
  const scrolled = await scrolledAbove(add);
  await unlink.click();

  await expect(panelField(page, 'textbox', 'Mitigation 2 title')).toHaveValue(
    'Rotate the upstream token hourly',
  );
  await expect(unlink).toBeFocused();
  await expect(unlink).toBeInViewport({ ratio: 1 });
  expect(await scrolledAbove(add)).toBeGreaterThan(scrolled);
  const revealed = await screenBoxOf(unlink);
  expect(
    Math.abs(revealed.y + revealed.height - (pressed.y + pressed.height)),
  ).toBeLessThanOrEqual(1);
});

test('a record arriving from another tab above the rows in view leaves those rows where they are', async ({
  context,
  page,
}) => {
  const other = await context.newPage();
  await openTwoDiagrams(page);
  await openTwoDiagrams(other);
  await selectNode(page, shopper);
  await expandThreat(page, takeover);
  await addRecord(page, 'assumption', 'Callers rotate their tokens.');
  await addRecord(page, 'assumption', 'The edge strips unknown headers.');
  await addRecord(page, 'assumption', 'Upstream logs never hold tokens.');
  const addMitigation = panelControl(page, 'Add mitigation');
  expect(await scrollPaneTo(addMitigation, 'top')).toBe(true);
  const drawn = await settledBox(addMitigation);

  await selectNode(other, shopper);
  await expandThreat(other, takeover);
  await addRecord(other, 'mitigation', 'Strip caller tokens at the edge');

  await expect(panelField(page, 'textbox', 'Mitigation 2 title')).toHaveValue(
    'Strip caller tokens at the edge',
  );
  expect(await settledBox(addMitigation)).toEqual(drawn);
});

test('a message longer than two lines stops above the open pane at phone width', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Only a phone-width message runs past two lines');
  await openTwoDiagrams(page);
  await selectByKeyboard(page, /^Catalogue, store/u);
  await expect(threatPanel(page)).toBeVisible();

  await page.keyboard.press('Enter');
  await page.keyboard.press('End');
  await page.keyboard.insertText(softHyphen);
  await page.keyboard.press('Enter');
  const said = editAnnouncement(page);
  await expect(said).toContainText('Catalogue');

  const message = await screenBoxOf(said);
  const pane = await screenBoxOf(threatPanel(page));
  expect(message.y + message.height).toBeLessThanOrEqual(pane.y);
  await onScreen(panelControl(page, 'Close threats'));
});

test('a record edit in one tab reaches another, which keeps its own selection', async ({
  context,
  page,
}) => {
  const other = await context.newPage();
  await openTwoDiagrams(page);
  await openTwoDiagrams(other);
  const catalogue = await selectNode(other, /^Catalogue, store/u);

  await selectNode(page, shopper);
  await expandThreat(page, takeover);
  await panelControl(page, 'Add mitigation').click();
  await page.keyboard.type('Strip caller tokens at the edge');
  await page.keyboard.press('Tab');
  await expect(
    panelField(page, 'combobox', 'Mitigation 2 status'),
  ).toBeVisible();

  await expect.poll(() => undoOffered(other)).toBe(true);
  await expect(catalogue).toHaveClass(/selected/u);
  await expect(
    threatPanel(other).getByRole('heading', { name: /Catalogue/u }),
  ).toBeVisible();

  await selectByKeyboard(other, shopper);
  await expandThreat(other, takeover);
  await expect(panelField(other, 'textbox', 'Mitigation 2 title')).toHaveValue(
    'Strip caller tokens at the edge',
  );
  await chooseInPanel(other, 'Mitigation 2 status', 'verified');

  await expect(
    panelField(page, 'combobox', 'Mitigation 2 status'),
  ).toContainText(/verified/iu);
  await expect(nodeNamed(page, shopper)).toHaveClass(/selected/u);
});
