import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  closeMenu,
  expandThreat,
  menuItem,
  nodeNamed,
  onScreen,
  openEcluse,
  openMenu,
  panelControl,
  panelField,
  runFromMenu,
  screenBoxOf,
  selectByKeyboard,
  selectNode,
  threatPanel,
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

const chooseInModel = async (
  page: Page,
  field: string,
  option: string,
): Promise<void> => {
  await modelField(page, 'combobox', field).click();
  await page.getByRole('option', { name: option, exact: true }).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
};

const undoOffered = async (page: Page): Promise<boolean> => {
  await openMenu(page);
  const disabled = await menuItem(page, 'Undo').getAttribute('aria-disabled');
  await closeMenu(page);
  return disabled !== 'true';
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

test('Model properties opens with nothing selected, and Escape or Close closes it', async ({
  page,
}) => {
  await openEcluse(page);

  await openModelProperties(page);
  await modelField(page, 'textbox', 'Title').click();
  await page.keyboard.press('Escape');
  await expect(modelPanel(page)).toHaveCount(0);

  await openModelProperties(page);
  await modelControl(page, 'Close model properties').click();
  await expect(modelPanel(page)).toHaveCount(0);
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

  await chooseInModel(page, 'Assumption 1 status', 'valid');
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
  await chooseInModel(page, 'Assumption 1 status', 'invalidated');

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
