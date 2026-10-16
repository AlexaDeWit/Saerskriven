import { expect, test, type Locator, type Page } from '@playwright/test';
import { canvasClassNames } from '@saerskriven/canvas';
import { boxAt, modelWith } from '@saerskriven/model/fixtures';
import { commandChord, registeredChords } from './chords.fixtures.js';
import {
  canvasSettled,
  clickSvgText,
  dragOnto,
  flowBlockOf,
  screenBoxOf,
  viewportZoom,
  type Point,
} from './canvas.fixtures.js';
import {
  canvasSurface,
  expandThreat,
  menuButton,
  nameField,
  nodeNamed,
  openModelDocument,
  openPlaceholder,
  openTwoDiagrams,
  panelControl,
  placeholder,
  runFromMenu,
  selectByKeyboard,
  selectNode,
  threatPanel,
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
  await expect(drawnName(renamed, canvasClassNames.label)).toHaveText('Ledger');
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
  const renamed = nodeNamed(page, `${longName}, store`);
  await expect(renamed).toBeFocused();

  await renamed.press('Enter');

  const field = nameField(page, longName);
  await expect(field).toBeFocused();
  await expect(drawnName(renamed, canvasClassNames.label)).toHaveCount(0);
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

  await expect(drawnName(renamed, canvasClassNames.label)).toContainText(
    'Ledger',
  );
});

test('a flow is renamed by double-clicking the label it draws', async ({
  page,
}) => {
  await openPlaceholder(page);
  await drawFlow(page);

  const flow = nodeNamed(page, /^New flow, flow/u);
  await clickSvgText(
    drawnName(await flowBlockOf(flow), canvasClassNames.flowLabel),
    2,
  );
  await expect(nameField(page, 'New flow')).toBeFocused();
  await expect(
    drawnName(await flowBlockOf(flow), canvasClassNames.flowLabel),
  ).toHaveCount(0);
  await nameField(page, 'New flow').fill('Opens');
  await nameField(page, 'New flow').press('Enter');

  const renamed = nodeNamed(page, /^Opens, flow/u);
  await expect(renamed).toHaveCount(1);
  await expect(
    drawnName(await flowBlockOf(renamed), canvasClassNames.flowLabel),
  ).toHaveText('Opens');
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
  await expect(
    drawnName(await flowBlockOf(renamed), canvasClassNames.flowLabel),
  ).toHaveText('Listings');

  await runFromMenu(page, 'Undo');

  await expect(
    nodeNamed(page, /^read the product listings, flow/u),
  ).toHaveCount(1);
});

test('a flow left unlabelled draws no label, and the threat panel names it from its ends', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  await selectByKeyboard(page, /^read the product listings, flow/u);

  await page.keyboard.press('Enter');
  await nameField(page, 'read the product listings').fill('');
  await nameField(page, 'read the product listings').press('Enter');

  const unlabelled = nodeNamed(page, /^flow, from Web shop to Catalogue/u);
  await expect(unlabelled).toHaveCount(1);
  await expect(
    drawnName(await flowBlockOf(unlabelled), canvasClassNames.flowLabel),
  ).toHaveCount(0);
  await expect(
    threatPanel(page).getByRole('heading', {
      name: 'Flow from Web shop to Catalogue',
      exact: true,
    }),
  ).toBeVisible();

  await expandThreat(page, /Unpublished listings readable/u);

  await expect(
    panelControl(page, 'Detach the flow from Web shop to Catalogue'),
  ).toBeVisible();
});

const retentionNote = /^Retention, text/u;

const fieldFirstLine = (field: Locator): Promise<Point> =>
  field.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      x:
        box.x +
        parseFloat(style.borderLeftWidth) +
        parseFloat(style.paddingLeft),
      y:
        box.y +
        parseFloat(style.borderTopWidth) +
        parseFloat(style.paddingTop) +
        parseFloat(style.lineHeight) / 2,
    };
  });

const withinNote = async (note: Locator, at: Point): Promise<Point> => {
  const box = await screenBoxOf(note, 'the Note');
  return { x: at.x - box.x, y: at.y - box.y };
};

test("a Note's field starts its first line where the drawing does, at full zoom", async ({
  page,
}) => {
  await openModelDocument(
    page,
    modelWith({
      elements: [
        {
          ...boxAt(
            'el-note',
            40,
            40,
            'text',
            { width: 240, height: 120 },
            'Retention',
          ),
          text: 'Orders are kept for seven years.',
        },
      ],
    }),
  );
  await page.getByRole('button', { name: 'Reset zoom to 100%' }).click();
  await canvasSettled(page);
  expect(await viewportZoom(page)).toBe(1);
  const note = nodeNamed(page, retentionNote);
  const line = await screenBoxOf(
    note.locator(`text.${canvasClassNames.note}`),
    'the drawn text',
  );
  const drawn = await withinNote(note, {
    x: line.x,
    y: line.y + line.height / 2,
  });

  await selectByKeyboard(page, retentionNote);
  await page.keyboard.press('Enter');
  const field = page.getByRole('textbox', { name: 'Note text' });
  await expect(field).toBeFocused();
  const typed = await withinNote(note, await fieldFirstLine(field));

  expect(Math.abs(typed.x - drawn.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(typed.y - drawn.y)).toBeLessThanOrEqual(1);
});

test('Enter reopens a selected Note for prose editing', async ({ page }) => {
  await openPlaceholder(page);
  await canvasSurface(page).focus();
  await page.keyboard.press(registeredChords['note-tool'][0]);
  await page.keyboard.press('Enter');

  const editor = page.getByRole('textbox', { name: 'Note text' });
  await editor.fill('Review the trust boundary.');
  await editor.press(await commandChord(page, 'ControlOrMeta+Enter'));
  await expect(nodeNamed(page, /^Note, text/u)).toBeFocused();

  await page.keyboard.press('Enter');

  await expect(editor).toBeFocused();
  await expect(editor).toHaveValue('Review the trust boundary.');
});
