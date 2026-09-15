import { expect, test, type Locator, type Page } from '@playwright/test';
import { registeredChords } from './chords.js';
import {
  canvasSurface,
  chooseInPanel,
  expandThreat,
  menuButton,
  menuItem,
  nodeNamed,
  onScreen,
  openEcluse,
  panelControl,
  panelField,
  runFromMenu,
  screenBoxOf,
  selectByKeyboard,
  selectNode,
  threatPanel,
  undoOffered,
} from './studio.fixtures.js';

const proxy = /^Écluse proxy, process/u;

const worker = /^Mirror worker, process/u;

const forwarded = /Forwarded caller credentials/u;

const modelPanel = (page: Page): Locator =>
  page.getByRole('region', { name: 'Model properties' });

const modelField = (
  page: Page,
  role: 'textbox' | 'combobox',
  name: string,
): Locator => modelPanel(page).getByRole(role, { name, exact: true });

const modelControl = (page: Page, name: string): Locator =>
  modelPanel(page).getByRole('button', { name, exact: true });

const openModelProperties = async (page: Page): Promise<void> => {
  await runFromMenu(page, 'Model properties');
  await expect(modelPanel(page)).toBeVisible();
};

const replaceText = async (field: Locator, text: string): Promise<void> => {
  await field.fill(text);
  await field.press('Tab');
};

const onScreenUnscrolled = async (
  page: Page,
  target: Locator,
): Promise<void> => {
  await onScreen(target);
  const scrolls = await modelPanel(page).evaluate((panel) =>
    [document.documentElement, panel, ...panel.querySelectorAll('*')].some(
      (node) =>
        (node === document.documentElement ||
          ['auto', 'scroll'].includes(getComputedStyle(node).overflowX)) &&
        node.scrollWidth > node.clientWidth,
    ),
  );
  expect(scrolls, 'the page or the panel scrolls horizontally').toBe(false);
};

test('Model properties takes the selection panel location and clears the selection, and a selection brings the selection panel back', async ({
  page,
}) => {
  await openEcluse(page);
  const node = await selectNode(page, proxy);
  const threats = await screenBoxOf(threatPanel(page));

  await openModelProperties(page);

  await expect(threatPanel(page)).toHaveCount(0);
  await expect(node).not.toHaveClass(/selected/u);
  const model = await screenBoxOf(modelPanel(page));
  expect(model.x + model.width).toBeCloseTo(threats.x + threats.width, 0);
  expect(model.y).toBeCloseTo(threats.y, 0);

  await selectByKeyboard(page, proxy);
  await expect(modelPanel(page)).toHaveCount(0);
  await expect(threatPanel(page)).toBeVisible();
});

test('Model properties opened from the menu by keyboard focuses Title, Escape, Close or the menu item again closes it with focus on the canvas', async ({
  page,
}) => {
  await openEcluse(page);

  await menuButton(page).focus();
  await page.keyboard.press('Enter');
  const item = menuItem(page, 'Model properties');
  await item.focus();
  await page.keyboard.press('Enter');
  await expect(modelField(page, 'textbox', 'Title')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(modelPanel(page)).toHaveCount(0);
  await expect(canvasSurface(page)).toBeFocused();

  await openModelProperties(page);
  await modelControl(page, 'Close model properties').click();
  await expect(modelPanel(page)).toHaveCount(0);
  await expect(canvasSurface(page)).toBeFocused();

  await openModelProperties(page);
  await runFromMenu(page, 'Model properties');
  await expect(modelPanel(page)).toHaveCount(0);
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(canvasSurface(page)).toBeFocused();
});

test('M opens Model properties with focus in Title, types into Title, and closes them again from outside a text field', async ({
  page,
}) => {
  await openEcluse(page);
  const node = await selectNode(page, proxy);
  const [shortcut] = registeredChords['model-properties'];

  await page.keyboard.press(shortcut);
  const title = modelField(page, 'textbox', 'Title');
  await expect(title).toBeFocused();
  await expect(threatPanel(page)).toHaveCount(0);
  await expect(node).not.toHaveClass(/selected/u);

  const before = await title.inputValue();
  await page.keyboard.press('End');
  await page.keyboard.press(shortcut);
  await expect(title).toHaveValue(`${before}m`);
  await page.keyboard.press('Backspace');
  await expect(title).toHaveValue(before);

  await modelControl(page, 'Add assumption').focus();
  await page.keyboard.press(shortcut);
  await expect(modelPanel(page)).toHaveCount(0);
  await expect(canvasSurface(page)).toBeFocused();
  expect(await undoOffered(page)).toBe(false);

  await page.keyboard.press(shortcut);
  await expect(modelField(page, 'textbox', 'Title')).toBeFocused();
});

test('the title and the description commit as one undo step each, and Tab runs from Title through Description to the Assumptions group', async ({
  page,
}) => {
  await openEcluse(page);
  await openModelProperties(page);
  const title = modelField(page, 'textbox', 'Title');
  const description = modelField(page, 'textbox', 'Description');
  const before = {
    title: await title.inputValue(),
    description: await description.inputValue(),
  };

  await title.focus();
  await page.keyboard.press('Tab');
  await expect(description).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(modelControl(page, 'Add assumption')).toBeFocused();
  await expect(
    modelPanel(page).getByRole('group', { name: 'Assumptions' }),
  ).toBeVisible();

  await replaceText(title, 'Écluse, retitled');
  await replaceText(description, 'A policy proxy.');

  await runFromMenu(page, 'Undo');
  await expect(description).toHaveValue(before.description);
  await expect(title).toHaveValue('Écluse, retitled');
  await runFromMenu(page, 'Undo');
  await expect(title).toHaveValue(before.title);
  expect(await undoOffered(page)).toBe(false);
});

test('an assumption added from the empty row applies to the model, its status changes in place, and one undo takes each back', async ({
  page,
}) => {
  await openEcluse(page);
  expect(await undoOffered(page)).toBe(false);
  await openModelProperties(page);

  const add = modelControl(page, 'Add assumption');
  await onScreenUnscrolled(page, add);
  await add.click();
  const prose = modelField(page, 'textbox', 'Assumption 1');
  await expect(prose).toBeFocused();
  await onScreenUnscrolled(page, prose);

  await page.keyboard.type('The model is kept true by hand.');
  await page.keyboard.press('Tab');
  const status = modelField(page, 'combobox', 'Assumption 1 status');
  await expect(status).toBeFocused();
  await expect(status).toContainText(/unconfirmed/iu);
  await onScreenUnscrolled(page, status);
  await onScreenUnscrolled(page, modelControl(page, 'Unlink assumption 1'));

  await chooseInPanel(page, 'Assumption 1 status', 'valid', modelPanel(page));
  await expect(status).toContainText(/valid/iu);
  await onScreenUnscrolled(page, status);

  await runFromMenu(page, 'Undo');
  await expect(status).toContainText(/unconfirmed/iu);
  await runFromMenu(page, 'Undo');
  await expect(prose).toHaveCount(0);
  expect(await undoOffered(page)).toBe(false);
});

test("applying a threat's assumption to the model keeps its threat link, and each unlink culls it only from its last reference", async ({
  page,
}) => {
  await openEcluse(page);
  await selectNode(page, proxy);
  await expandThreat(page, forwarded);
  const threatStatus = await panelField(
    page,
    'combobox',
    'Status',
  ).textContent();
  const rotate = 'Callers rotate their tokens.';
  await panelControl(page, 'Add assumption').click();
  await page.keyboard.type(rotate);
  await page.keyboard.press('Tab');
  await expect(
    panelField(page, 'combobox', 'Assumption 1 status'),
  ).toBeFocused();

  await openModelProperties(page);
  await modelField(page, 'combobox', 'Existing assumption').click();
  await expect(page.getByRole('option')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await modelControl(page, 'Link existing assumption').click();
  await expect(modelField(page, 'textbox', 'Assumption 1')).toHaveValue(rotate);
  await expect(modelField(page, 'combobox', 'Existing assumption')).toHaveCount(
    0,
  );
  await expect(
    modelControl(page, 'Unlink assumption 1'),
  ).toHaveAccessibleDescription(/1/u);
  await chooseInPanel(
    page,
    'Assumption 1 status',
    'invalidated',
    modelPanel(page),
  );

  await selectByKeyboard(page, proxy);
  await expandThreat(page, forwarded);
  await expect(panelField(page, 'combobox', 'Status')).toHaveText(
    threatStatus ?? '',
  );
  const unlinkHere = panelControl(page, 'Unlink assumption 1');
  await expect(unlinkHere).not.toHaveAccessibleDescription('');
  await unlinkHere.click();
  await expect(panelField(page, 'textbox', 'Assumption 1')).toHaveCount(0);

  await openModelProperties(page);
  const kept = modelField(page, 'textbox', 'Assumption 1');
  await expect(kept).toHaveValue(rotate);
  await expect(
    modelControl(page, 'Unlink assumption 1'),
  ).toHaveAccessibleDescription('');
  await modelControl(page, 'Unlink assumption 1').click();
  await expect(kept).toHaveCount(0);
  await expect(modelField(page, 'combobox', 'Existing assumption')).toHaveCount(
    0,
  );

  await runFromMenu(page, 'Undo');
  await expect(kept).toHaveValue(rotate);
});

test('an older assumption linked after an added one lands after it, and leaves and returns there on undo and redo', async ({
  page,
}) => {
  const older = 'Callers rotate their tokens.';
  const added = 'The model is kept true by hand.';
  await openEcluse(page);
  await selectNode(page, proxy);
  await expandThreat(page, forwarded);
  await panelControl(page, 'Add assumption').click();
  await page.keyboard.type(older);
  await page.keyboard.press('Tab');
  await expect(
    panelField(page, 'combobox', 'Assumption 1 status'),
  ).toBeFocused();

  await openModelProperties(page);
  await modelControl(page, 'Add assumption').click();
  await page.keyboard.type(added);
  await page.keyboard.press('Tab');
  await expect(
    modelField(page, 'combobox', 'Assumption 1 status'),
  ).toBeFocused();
  await modelControl(page, 'Link existing assumption').click();

  const first = modelField(page, 'textbox', 'Assumption 1');
  const second = modelField(page, 'textbox', 'Assumption 2');
  await expect(first).toHaveValue(added);
  await expect(second).toHaveValue(older);
  await expect(second).toBeFocused();

  await runFromMenu(page, 'Undo');
  await expect(second).toHaveCount(0);
  await expect(first).toHaveValue(added);
  await runFromMenu(page, 'Redo');
  await expect(first).toHaveValue(added);
  await expect(second).toHaveValue(older);
});

test('model properties edited in one tab reach another, which keeps its own selection and open panel', async ({
  context,
  page,
}) => {
  const other = await context.newPage();
  await openEcluse(page);
  await openEcluse(other);
  const selected = await selectNode(other, worker);

  await openModelProperties(page);
  await replaceText(modelField(page, 'textbox', 'Title'), 'Écluse, shared');
  await modelControl(page, 'Add assumption').click();
  await page.keyboard.type('Both tabs read one model.');
  await page.keyboard.press('Tab');
  await expect(
    modelField(page, 'combobox', 'Assumption 1 status'),
  ).toBeFocused();

  await expect.poll(() => undoOffered(other)).toBe(true);
  await expect(selected).toHaveClass(/selected/u);
  await expect(
    threatPanel(other).getByRole('heading', { name: /Mirror worker/u }),
  ).toBeVisible();
  await expect(modelPanel(other)).toHaveCount(0);

  await openModelProperties(other);
  await expect(modelField(other, 'textbox', 'Title')).toHaveValue(
    'Écluse, shared',
  );
  await expect(modelField(other, 'textbox', 'Assumption 1')).toHaveValue(
    'Both tabs read one model.',
  );
  await replaceText(
    modelField(other, 'textbox', 'Description'),
    'Edited in the other tab.',
  );

  await expect(modelField(page, 'textbox', 'Description')).toHaveValue(
    'Edited in the other tab.',
  );
  await expect(modelPanel(page)).toBeVisible();
  await expect(nodeNamed(page, proxy)).not.toHaveClass(/selected/u);
});
