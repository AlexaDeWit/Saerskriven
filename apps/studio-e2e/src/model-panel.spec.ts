import { expect, test, type Locator, type Page } from '@playwright/test';
import { registeredChords } from './chords.fixtures.js';
import { onScreen, screenBoxOf } from './canvas.fixtures.js';
import {
  canvasSurface,
  chooseByKeyboard,
  chooseInPanel,
  editAnnouncement,
  expandThreat,
  menuButton,
  menuItem,
  nodeNamed,
  offeredToLink,
  openShopperTakeover,
  openTwoDiagrams,
  panelControl,
  panelField,
  runFromMenu,
  selectByKeyboard,
  selectNode,
  showDetails,
  storefront,
  threatPanel,
  threatSummary,
  undoOffered,
} from './studio.fixtures.js';

const modelPanel = (page: Page): Locator =>
  page.getByRole('region', { name: 'Model', exact: true });

const modelField = (
  page: Page,
  role: 'textbox' | 'combobox',
  name: string,
): Locator => modelPanel(page).getByRole(role, { name, exact: true });

const modelControl = (page: Page, name: string): Locator =>
  modelPanel(page).getByRole('button', { name, exact: true });

const threatsTab = (page: Page): Locator =>
  modelPanel(page).getByRole('tab', { name: /^Threats \d+$/u });

const foldedRecord = (page: Page, name: string): Locator =>
  modelPanel(page).getByRole('button', {
    name,
    exact: true,
    expanded: false,
  });

const cardCertification =
  'Assumption 1, The payment provider holds its own card data certification.';

const modelThreat = (page: Page, title: RegExp): Locator =>
  modelPanel(page).getByRole('button', { name: title });

const existingAssumption = (page: Page): Locator =>
  modelField(page, 'combobox', 'Existing assumption');

const refundAbuse = /Refund policy abused/u;

const cardData = /Card data disclosed in transit/u;

const forgedCallback = /Forged payment callback/u;

const paymentGateway = /^Payment\s*gateway, process/u;

const wholeModelField = 'Applies to the whole model';

const wholeModel = (page: Page): Locator =>
  modelField(page, 'combobox', wholeModelField);

const attachedElements = (page: Page): Locator =>
  modelPanel(page).getByRole('group', {
    name: 'Attached elements',
    exact: true,
  });

const openModelPanel = async (page: Page): Promise<void> => {
  await runFromMenu(page, 'Model');
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

test('the model panel takes the selection panel location and clears the selection, and a selection brings the selection panel back', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  const node = await selectNode(page, storefront.shopper);
  const threats = await screenBoxOf(threatPanel(page));

  await openModelPanel(page);

  await expect(threatPanel(page)).toHaveCount(0);
  await expect(node).not.toHaveClass(/selected/u);
  const model = await screenBoxOf(modelPanel(page));
  expect(model.x + model.width).toBeCloseTo(threats.x + threats.width, 0);
  expect(model.y).toBeCloseTo(threats.y, 0);

  await selectByKeyboard(page, storefront.shopper);
  await expect(modelPanel(page)).toHaveCount(0);
  await expect(threatPanel(page)).toBeVisible();
});

test('M opens the model panel on Threats, listing every threat with one on no element, which opens and is edited in place', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  await selectNode(page, storefront.shopper);
  const [shortcut] = registeredChords['model-panel'];

  await page.keyboard.press(shortcut);

  await expect(threatsTab(page)).toBeFocused();
  await expect(threatsTab(page)).toHaveAttribute('aria-selected', 'true');
  await expect(threatsTab(page)).toHaveText(/10/u);
  await expect(
    modelPanel(page).getByRole('heading', { name: 'Two diagrams' }),
  ).toBeVisible();
  await expect(modelPanel(page).locator('[data-threat-item]')).toHaveCount(10);
  const loose = modelThreat(page, refundAbuse);
  await expect(loose).toHaveAccessibleName(/On no element$/u);
  await expect(modelThreat(page, storefront.takeover)).toHaveAccessibleName(
    /On Shopper and /u,
  );
  await expect(modelThreat(page, cardData)).toHaveAccessibleName(
    /Applies to the whole model On /u,
  );

  await page.keyboard.press('Tab');
  await expect(modelControl(page, 'Add a threat')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(modelThreat(page, storefront.takeover)).toBeFocused();
  await loose.click();
  await expect(loose).toHaveAttribute('aria-expanded', 'true');
  await expect(modelField(page, 'textbox', 'Title')).toHaveValue(
    'Refund policy abused',
  );
  await chooseInPanel(page, 'Severity', 'Critical', modelPanel(page));
  await expect(loose).toContainText('Critical');

  await runFromMenu(page, 'Undo');
  await expect(loose).toContainText('Low');
  expect(await undoOffered(page)).toBe(false);
});

test("detaching a threat's last element from the model's list removes the threat, and one undo brings it back", async ({
  page,
}) => {
  await openTwoDiagrams(page);
  await openModelPanel(page);
  const callback = modelThreat(page, /Forged payment callback/u);
  await callback.click();
  await expect(callback).toHaveAttribute('aria-expanded', 'true');

  await attachedElements(page)
    .getByRole('button', { name: /^Detach /u })
    .click();

  await expect(callback).toHaveCount(0);
  await expect(threatsTab(page)).toHaveText(/9/u);
  await expect(editAnnouncement(page)).toContainText('7');

  await runFromMenu(page, 'Undo');
  await expect(callback).toBeVisible();
  await expect(threatsTab(page)).toHaveText(/10/u);
});

test('Add a threat on the model panel adds a threat that applies to the whole model, opened on its title, and one undo takes it back', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  await openModelPanel(page);

  await modelControl(page, 'Add a threat').click();

  await expect(modelField(page, 'textbox', 'Title')).toBeFocused();
  await expect(threatsTab(page)).toHaveText(/11/u);
  await expect(
    modelPanel(page).getByRole('button', { name: /^12 /u, expanded: true }),
  ).toHaveAccessibleName(/Applies to the whole model$/u);
  await expect(wholeModel(page)).toContainText('Yes');
  await expect(
    attachedElements(page).getByRole('button', { name: /^Detach /u }),
  ).toHaveCount(0);

  await runFromMenu(page, 'Undo');
  await expect(threatsTab(page)).toHaveText(/10/u);
  expect(await undoOffered(page)).toBe(false);
});

test('a threat applied to the whole model stays when its last element is detached, and goes when it stops applying, one undo bringing it back', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  await openModelPanel(page);
  const callback = modelThreat(page, forgedCallback);
  await callback.click();
  await expect(callback).toHaveAttribute('aria-expanded', 'true');
  await expect(wholeModel(page)).toContainText('No');

  await chooseInPanel(page, wholeModelField, 'Yes', modelPanel(page));
  await expect(callback).toHaveAccessibleName(
    /Applies to the whole model On /u,
  );
  await attachedElements(page)
    .getByRole('button', { name: /^Detach /u })
    .click();

  await expect(callback).toHaveAccessibleName(/Applies to the whole model$/u);
  await expect(threatsTab(page)).toHaveText(/10/u);
  await expect(wholeModel(page)).toBeFocused();
  await expect(editAnnouncement(page)).toContainText('7');

  await chooseByKeyboard(page, 'ArrowDown');
  await expect(callback).toHaveCount(0);
  await expect(threatsTab(page)).toHaveText(/9/u);
  await expect(editAnnouncement(page)).toContainText('7');
  const next = modelThreat(page, /Unpublished listings readable/u);
  await expect(next).toBeFocused();
  await expect(next).toHaveAttribute('aria-expanded', 'false');

  await runFromMenu(page, 'Undo');
  await expect(callback).toHaveAccessibleName(/Applies to the whole model$/u);
  await expect(threatsTab(page)).toHaveText(/10/u);
});

test('a threat applied to the whole model in one tab reads so in another, and an undo there takes it back in both', async ({
  context,
  page,
}) => {
  const other = await context.newPage();
  await openTwoDiagrams(page);
  await openTwoDiagrams(other);
  await openModelPanel(other);
  const there = modelThreat(other, forgedCallback);
  await expect(there).not.toHaveAccessibleName(/Applies to the whole model/u);

  await openModelPanel(page);
  const here = modelThreat(page, forgedCallback);
  await here.click();
  await chooseInPanel(page, wholeModelField, 'Yes', modelPanel(page));

  await expect(there).toHaveAccessibleName(/Applies to the whole model On /u);
  await runFromMenu(other, 'Undo');
  await expect(here).not.toHaveAccessibleName(/Applies to the whole model/u);
  await expect(wholeModel(page)).toContainText('No');
});

test('cutting an element of a threat that applies to the whole model and pasting it leaves one threat under its number', async ({
  context,
  page,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openTwoDiagrams(page);
  await selectByKeyboard(page, paymentGateway);

  await page.keyboard.press('ControlOrMeta+x');
  await expect(nodeNamed(page, paymentGateway)).toHaveCount(0);
  await page.keyboard.press('ControlOrMeta+v');

  await expect(nodeNamed(page, paymentGateway)).toHaveCount(1);
  await expect(threatSummary(page, cardData)).toHaveAccessibleName(/^4 /u);
  await openModelPanel(page);
  await expect(threatsTab(page)).toHaveText(/10/u);
  await expect(modelThreat(page, cardData)).toHaveCount(1);
  await expect(modelThreat(page, cardData)).toHaveAccessibleName(
    /Applies to the whole model On /u,
  );
});

test('the model panel opened from the menu by keyboard focuses its Threats tab, and Escape, Close or the menu item again closes it with focus on the canvas', async ({
  page,
}) => {
  await openTwoDiagrams(page);

  await menuButton(page).focus();
  await page.keyboard.press('Enter');
  const item = menuItem(page, 'Model');
  await item.focus();
  await page.keyboard.press('Enter');
  await expect(threatsTab(page)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(modelPanel(page)).toHaveCount(0);
  await expect(canvasSurface(page)).toBeFocused();

  await openModelPanel(page);
  await modelControl(page, 'Close model panel').click();
  await expect(modelPanel(page)).toHaveCount(0);
  await expect(canvasSurface(page)).toBeFocused();

  await openModelPanel(page);
  await runFromMenu(page, 'Model');
  await expect(modelPanel(page)).toHaveCount(0);
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(canvasSurface(page)).toBeFocused();
});

test('M types into Title on Details, and closes the model panel again from outside a text field', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  const [shortcut] = registeredChords['model-panel'];
  await page.keyboard.press(shortcut);
  await expect(threatsTab(page)).toBeFocused();

  await showDetails(page, modelPanel(page));
  const title = modelField(page, 'textbox', 'Title');
  const before = await title.inputValue();
  await title.focus();
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
  await expect(threatsTab(page)).toBeFocused();
});

test('the title and the description commit as one undo step each, and Tab runs from Title through Description to the assumptions group', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  await openModelPanel(page);
  await showDetails(page, modelPanel(page));
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
  await expect(foldedRecord(page, cardCertification)).toBeFocused();
  await expect(
    modelPanel(page).getByRole('group', {
      name: /^Assumptions that apply to the model 2$/u,
    }),
  ).toBeVisible();

  await replaceText(title, 'Two diagrams, retitled');
  await expect(
    modelPanel(page).getByRole('heading', { name: 'Two diagrams, retitled' }),
  ).toBeVisible();
  await replaceText(description, 'A small shop.');

  await runFromMenu(page, 'Undo');
  await expect(description).toHaveValue(before.description);
  await expect(title).toHaveValue('Two diagrams, retitled');
  await runFromMenu(page, 'Undo');
  await expect(title).toHaveValue(before.title);
  expect(await undoOffered(page)).toBe(false);
});

test(
  'an assumption added from the empty row applies to the model, its status changes in place, and one undo takes each back',
  { tag: '@phone' },
  async ({ page }) => {
    await openTwoDiagrams(page);
    expect(await undoOffered(page)).toBe(false);
    await openModelPanel(page);
    await showDetails(page, modelPanel(page));

    const add = modelControl(page, 'Add assumption');
    await onScreenUnscrolled(page, add);
    await add.click();
    const prose = modelField(page, 'textbox', 'Assumption 3');
    await expect(prose).toBeFocused();
    await onScreenUnscrolled(page, prose);

    await page.keyboard.type('The model is kept true by hand.');
    await page.keyboard.press('Tab');
    await expect(add).toBeFocused();
    const status = modelField(page, 'combobox', 'Assumption 3 status');
    await expect(status).toContainText(/unconfirmed/iu);
    await onScreenUnscrolled(page, status);
    await onScreenUnscrolled(page, modelControl(page, 'Unlink assumption 3'));

    await chooseInPanel(page, 'Assumption 3 status', 'Valid', modelPanel(page));
    await expect(status).toContainText(/valid/iu);
    await onScreenUnscrolled(page, status);

    await runFromMenu(page, 'Undo');
    await expect(status).toContainText(/unconfirmed/iu);
    await runFromMenu(page, 'Undo');
    await expect(prose).toHaveCount(0);
    expect(await undoOffered(page)).toBe(false);
  },
);

test(
  'a folded assumption keeps its status on one line beside a first line too long for the row',
  { tag: '@phone' },
  async ({ page }) => {
    await openTwoDiagrams(page);
    await openModelPanel(page);
    await showDetails(page, modelPanel(page));
    const headline = foldedRecord(page, cardCertification);
    await expect(headline).toBeVisible();
    expect(
      await headline
        .locator('span')
        .evaluate((line) => line.scrollWidth > line.clientWidth),
      'the first line is too long for its row',
    ).toBe(true);

    const lines = await modelField(page, 'combobox', 'Assumption 1 status')
      .locator('[data-option-label]')
      .evaluate((label) => {
        const range = document.createRange();
        range.selectNodeContents(label);
        return range.getClientRects().length;
      });

    expect(lines).toBe(1);
  },
);

test("applying a threat's assumption to the model keeps its threat link, and each unlink culls it only from its last reference", async ({
  page,
}) => {
  await openShopperTakeover(page);
  const threatStatus = await panelField(
    page,
    'combobox',
    'Status',
  ).textContent();
  const rotate = 'Callers rotate their tokens.';
  await panelControl(page, 'Add assumption').click();
  await page.keyboard.type(rotate);
  await page.keyboard.press('Tab');
  await expect(panelControl(page, 'Add assumption')).toBeFocused();

  await openModelPanel(page);
  await showDetails(page, modelPanel(page));
  await chooseInPanel(page, 'Existing assumption', rotate, modelPanel(page));
  await modelControl(page, 'Link existing assumption').click();
  await expect(foldedRecord(page, `Assumption 3, ${rotate}`)).toBeFocused();
  expect(await offeredToLink(page, existingAssumption(page), rotate)).toBe(
    false,
  );
  await foldedRecord(page, `Assumption 3, ${rotate}`).click();
  await expect(modelField(page, 'textbox', 'Assumption 3')).toHaveValue(rotate);
  await expect(
    modelControl(page, 'Unlink assumption 3'),
  ).toHaveAccessibleDescription(/1/u);
  await chooseInPanel(
    page,
    'Assumption 3 status',
    'Invalidated',
    modelPanel(page),
  );

  await selectByKeyboard(page, storefront.shopper);
  await expandThreat(page, storefront.takeover);
  await expect(panelField(page, 'combobox', 'Status')).toHaveText(
    threatStatus ?? '',
  );
  await threatPanel(page)
    .getByRole('button', {
      name: `Assumption 1, ${rotate}`,
      exact: true,
      expanded: false,
    })
    .click();
  const unlinkHere = panelControl(page, 'Unlink assumption 1');
  await expect(unlinkHere).not.toHaveAccessibleDescription('');
  await unlinkHere.click();
  await expect(panelField(page, 'textbox', 'Assumption 1')).toHaveCount(0);

  await openModelPanel(page);
  await showDetails(page, modelPanel(page));
  await foldedRecord(page, `Assumption 3, ${rotate}`).click();
  const kept = modelField(page, 'textbox', 'Assumption 3');
  await expect(kept).toHaveValue(rotate);
  await expect(
    modelControl(page, 'Unlink assumption 3'),
  ).toHaveAccessibleDescription('');
  await modelControl(page, 'Unlink assumption 3').click();
  await expect(kept).toHaveCount(0);
  expect(await offeredToLink(page, existingAssumption(page), rotate)).toBe(
    false,
  );

  await runFromMenu(page, 'Undo');
  await expect(kept).toHaveValue(rotate);
});

test('an older assumption linked after an added one lands after it, and leaves and returns there on undo and redo', async ({
  page,
}) => {
  const older = 'Callers rotate their tokens.';
  const added = 'The model is kept true by hand.';
  await openShopperTakeover(page);
  await panelControl(page, 'Add assumption').click();
  await page.keyboard.type(older);
  await page.keyboard.press('Tab');
  await expect(panelControl(page, 'Add assumption')).toBeFocused();

  await openModelPanel(page);
  await showDetails(page, modelPanel(page));
  await modelControl(page, 'Add assumption').click();
  await page.keyboard.type(added);
  await page.keyboard.press('Tab');
  await expect(modelControl(page, 'Add assumption')).toBeFocused();
  await chooseInPanel(page, 'Existing assumption', older, modelPanel(page));
  await modelControl(page, 'Link existing assumption').click();

  const rows = modelPanel(page).locator('[data-record-row]');
  const first = modelField(page, 'textbox', 'Assumption 3');
  const second = rows.nth(3).getByRole('button', {
    name: `Assumption 4, ${older}`,
    exact: true,
    expanded: false,
  });
  await expect(rows).toHaveCount(4);
  await expect(first).toHaveValue(added);
  await expect(second).toBeFocused();

  await runFromMenu(page, 'Undo');
  await expect(rows).toHaveCount(3);
  await expect(first).toHaveValue(added);
  await runFromMenu(page, 'Redo');
  await expect(first).toHaveValue(added);
  await expect(second).toBeVisible();
});

test('the model edited in one tab reaches another, which keeps its own selection and open panel', async ({
  context,
  page,
}) => {
  const other = await context.newPage();
  await openTwoDiagrams(page);
  await openTwoDiagrams(other);
  const selected = await selectNode(other, storefront.catalogue);

  await openModelPanel(page);
  await showDetails(page, modelPanel(page));
  await replaceText(
    modelField(page, 'textbox', 'Title'),
    'Two diagrams, shared',
  );
  await modelControl(page, 'Add assumption').click();
  await page.keyboard.type('Both tabs read one model.');
  await page.keyboard.press('Tab');
  await expect(modelControl(page, 'Add assumption')).toBeFocused();

  await expect.poll(() => undoOffered(other)).toBe(true);
  await expect(selected).toHaveClass(/selected/u);
  await expect(
    threatPanel(other).getByRole('heading', { name: /Catalogue/u }),
  ).toBeVisible();
  await expect(modelPanel(other)).toHaveCount(0);

  await openModelPanel(other);
  await expect(
    modelPanel(other).getByRole('heading', { name: 'Two diagrams, shared' }),
  ).toBeVisible();
  await showDetails(other, modelPanel(other));
  await expect(modelField(other, 'textbox', 'Title')).toHaveValue(
    'Two diagrams, shared',
  );
  await expect(
    foldedRecord(other, 'Assumption 3, Both tabs read one model.'),
  ).toBeVisible();
  await replaceText(
    modelField(other, 'textbox', 'Description'),
    'Edited in the other tab.',
  );

  await expect(modelField(page, 'textbox', 'Description')).toHaveValue(
    'Edited in the other tab.',
  );
  await expect(modelPanel(page)).toBeVisible();
  await expect(nodeNamed(page, storefront.shopper)).not.toHaveClass(
    /selected/u,
  );
});

test(
  'the model panel header stays usable while an unlink announcement shows',
  { tag: '@phone' },
  async ({ page }) => {
    await openTwoDiagrams(page);
    await openModelPanel(page);
    await showDetails(page, modelPanel(page));
    await modelControl(page, 'Add assumption').click();
    await page.keyboard.insertText(
      'Every caller of the proxy presents a token that it scopes to one tenant, and the proxy never forwards it.',
    );
    await page.keyboard.press('Tab');
    await expect(modelControl(page, 'Add assumption')).toBeFocused();

    const unlink = modelControl(page, 'Unlink assumption 3');
    await onScreen(unlink);
    await unlink.click();
    const said = editAnnouncement(page);
    await expect(said).toContainText('Every caller');
    expect((await said.textContent())?.length ?? 0).toBeLessThan(160);

    const collapse = modelControl(page, 'Collapse pane');
    if (await collapse.isVisible()) {
      await collapse.click();
      await modelControl(page, 'Expand pane').click();
    } else {
      const widen = modelControl(page, 'Widen pane');
      await onScreen(widen);
      await widen.click();
      await expect(modelControl(page, 'Restore pane width')).toBeVisible();
    }
    await expect(said).not.toBeEmpty();

    const close = modelControl(page, 'Close model panel');
    await onScreen(close);
    await close.click();
    await expect(modelPanel(page)).toHaveCount(0);
  },
);
