import { expect, test, type Locator, type Page } from '@playwright/test';
import { softHyphen } from '@saerskriven/model/fixtures';
import { edgesOf, onScreen } from './canvas.fixtures.js';
import { registeredChords } from './chords.fixtures.js';
import {
  diagramSwitcher,
  editAnnouncement,
  nodeNamed,
  modelPanel,
  openModelPanel,
  openMenu,
  menuItem,
  openFallback,
  openTwoDiagrams,
  placeholder,
  runFromMenu,
  selectByKeyboard,
  selectNode,
  showDetails,
  storefront,
  threatPanel,
} from './studio.fixtures.js';

const register = (page: Page): Locator =>
  page.getByRole('region', { name: 'Threat register', exact: true });

const rows = (page: Page): Locator =>
  register(page).locator('tbody').getByRole('row');

const row = (page: Page, title: string): Locator =>
  rows(page).filter({
    has: page.getByRole('button', { name: title, exact: true }),
  });

const chooser = (page: Page, title: string): Locator =>
  register(page).getByRole('button', { name: title, exact: true });

const modelSummary = (page: Page, title: RegExp): Locator =>
  modelPanel(page).getByRole('button', { name: title });

const modelThreatsTab = (page: Page): Locator =>
  modelPanel(page).getByRole('tab', { name: /^Threats \d+$/u });

const denied = 'Shopper denies placing an order';

const refund = 'Refund policy abused';

const atModelPaneTop = async (page: Page, target: Locator): Promise<boolean> =>
  Math.abs(
    (await edgesOf(target)).top -
      (await edgesOf(modelPanel(page).locator(':scope > div:last-child'))).top,
  ) <= 1.5;

const pressR = async (page: Page): Promise<void> => {
  const [shortcut] = registeredChords['threat-register'];
  await page.keyboard.press(shortcut);
};

test('R opens the register left of the panel, a chosen row opens its threat landed on the model panel beside the register still open, and Escape leaves that panel open', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  await selectNode(page, storefront.shopper);

  await pressR(page);

  await expect(register(page)).toBeVisible();
  await expect(
    chooser(page, 'Account takeover by credential stuffing'),
  ).toBeFocused();
  await expect(rows(page).getByRole('rowheader')).toHaveText([
    '1',
    '10',
    '8',
    '9',
    '11',
    '7',
    '3',
    '4',
    '2',
    '6',
  ]);
  await expect(row(page, refund).getByRole('cell').nth(1)).toHaveText(
    'No element',
  );
  const beside = await edgesOf(threatPanel(page));
  const drawn = await edgesOf(register(page));
  expect(drawn.right).toBeLessThan(beside.left);
  expect(drawn.top).toBeCloseTo(beside.top, 0);

  await chooser(page, denied).click();

  const opened = modelSummary(page, storefront.orderDenied);
  await expect(opened).toHaveAttribute('aria-expanded', 'true');
  await expect(modelPanel(page).locator('[data-threat-item]')).toHaveCount(1);
  await expect(modelThreatsTab(page)).toHaveAttribute('aria-selected', 'true');
  await expect.poll(() => atModelPaneTop(page, opened)).toBe(true);
  await expect(register(page)).toBeVisible();
  await expect(chooser(page, denied)).toHaveAttribute('aria-current', 'true');
  await expect(chooser(page, denied)).toBeFocused();
  await expect(editAnnouncement(page)).toContainText('6');
  expect((await edgesOf(register(page))).right).toBeLessThan(
    (await edgesOf(modelPanel(page))).left,
  );

  await page.keyboard.press('Escape');

  await expect(register(page)).toHaveCount(0);
  await expect(modelPanel(page)).toBeVisible();
  await expect(opened).toBeFocused();
});

test("the menu opens the register, and an element's name closes it and selects that element on its own diagram", async ({
  page,
}) => {
  await openTwoDiagrams(page);

  await runFromMenu(page, 'Threat register');
  await expect(register(page)).toBeVisible();
  await expect(diagramSwitcher(page)).toContainText('Taking an order');

  await row(page, 'Courier learns more than the address')
    .getByRole('button', { name: 'Courier', exact: true })
    .click();

  await expect(register(page)).toHaveCount(0);
  await expect(diagramSwitcher(page)).toContainText('Shipping an order');
  const courier = nodeNamed(page, /^Courier, actor/u);
  await expect(courier).toHaveClass(/selected/u);
  await expect(courier).toBeFocused();
  await expect(
    threatPanel(page).getByRole('heading', { name: 'Courier', exact: true }),
  ).toBeVisible();
});

test("a flow's card under the register is off the Tab path, and Change flow source closes the register to open its card", async ({
  page,
}) => {
  await openFallback(page);
  await selectByKeyboard(page, placeholder.records);
  const card = page.getByRole('region', { name: 'Reconnect flow' });
  await expect(card).toBeVisible();

  await pressR(page);
  await expect(register(page)).toBeVisible();
  await page.keyboard.press('Shift+Tab');
  await expect(
    register(page).getByRole('button', {
      name: 'Close threat register',
      exact: true,
    }),
  ).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  expect(
    await card.evaluate((section) => section.contains(document.activeElement)),
  ).toBe(false);

  await pressR(page);
  await page.keyboard.press(registeredChords['reconnect-source'][0]);

  await expect(register(page)).toHaveCount(0);
  const endpoint = page.getByRole('region', {
    name: 'Flow endpoint',
    exact: true,
  });
  await expect(endpoint).toBeVisible();
  await expect
    .poll(() =>
      endpoint.evaluate((section) => section.contains(document.activeElement)),
    )
    .toBe(true);
});

test('Escape hands focus back to the card control under the register that R was pressed from', async ({
  page,
}) => {
  await openFallback(page);
  await selectByKeyboard(page, placeholder.records);
  const reverse = page
    .getByRole('region', { name: 'Reconnect flow' })
    .getByRole('button', { name: 'Reverse flow', exact: true });
  await reverse.focus();

  await pressR(page);
  await expect(register(page)).toBeVisible();
  await page.keyboard.press('Escape');

  await expect(register(page)).toHaveCount(0);
  await expect(reverse).toBeFocused();
});

test('R typed into a field stays in the field', async ({ page }) => {
  await openTwoDiagrams(page);
  await openModelPanel(page);
  await showDetails(page, modelPanel(page));
  const title = modelPanel(page).getByRole('textbox', {
    name: 'Title',
    exact: true,
  });
  const before = await title.inputValue();
  await title.focus();
  await page.keyboard.press('End');

  await pressR(page);

  await expect(title).toHaveValue(`${before}r`);
  await expect(register(page)).toHaveCount(0);
});

test(
  'the register stays inside the window, and Close closes it',
  { tag: '@phone' },
  async ({ page }) => {
    await openTwoDiagrams(page);

    await pressR(page);

    const drawn = await edgesOf(register(page));
    const width = page.viewportSize()?.width ?? 0;
    expect(drawn.left).toBeGreaterThanOrEqual(0);
    expect(drawn.right).toBeLessThanOrEqual(width);
    const close = register(page).getByRole('button', {
      name: 'Close threat register',
      exact: true,
    });
    await onScreen(close);
    await onScreen(chooser(page, 'Account takeover by credential stuffing'));

    await close.click();

    await expect(register(page)).toHaveCount(0);
  },
);

test(
  'a chosen row closes a register that hides the model panel, with focus on its threat shown there, and is marked as the register opens again',
  { tag: '@phone-only' },
  async ({ page }) => {
    await openTwoDiagrams(page);
    await pressR(page);

    await chooser(page, denied).click();

    await expect(register(page)).toHaveCount(0);
    const opened = modelSummary(page, storefront.orderDenied);
    await expect(opened).toHaveAttribute('aria-expanded', 'true');
    await expect(opened).toBeFocused();
    await expect.poll(() => atModelPaneTop(page, opened)).toBe(true);
    await onScreen(opened);
    await expect(editAnnouncement(page)).toContainText('6');

    await pressR(page);

    await expect(chooser(page, denied)).toHaveAttribute('aria-current', 'true');
    await expect(chooser(page, denied)).toBeFocused();
  },
);

test(
  'a row the model panel refuses closes a register that hides it, with focus on the field holding the refused text, and the register opens again with no row marked',
  { tag: '@phone-only' },
  async ({ page }) => {
    await openTwoDiagrams(page);
    await pressR(page);
    await chooser(page, denied).click();
    const held = modelPanel(page).getByRole('textbox', {
      name: 'Description',
      exact: true,
    });
    await held.fill(`Draft${softHyphen}text`);
    await held.press('Tab');
    await expect(held).toHaveAttribute('aria-invalid', 'true');

    await pressR(page);
    await chooser(page, refund).click();

    await expect(register(page)).toHaveCount(0);
    await expect(held).toBeFocused();
    await expect(held).toHaveValue(`Draft${softHyphen}text`);
    await expect(held).toHaveAttribute('aria-invalid', 'true');
    await onScreen(held);
    await expect(modelSummary(page, storefront.refundAbuse)).toHaveCount(0);

    await test.step('no row is marked as the register opens again, and a row refused from the Details tab shows Threats', async () => {
      await showDetails(page, modelPanel(page));
      await runFromMenu(page, 'Threat register');
      await expect(register(page)).toBeVisible();
      await expect(register(page).locator('[aria-current]')).toHaveCount(0);

      await chooser(page, refund).click();

      await expect(register(page)).toHaveCount(0);
      await expect(modelThreatsTab(page)).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await expect(held).toBeFocused();
      await expect(held).toHaveValue(`Draft${softHyphen}text`);
    });

    await test.step('a row refused while the model panel is closed opens the panel on the refused text', async () => {
      await modelPanel(page)
        .getByRole('button', { name: 'Close model panel', exact: true })
        .click();
      await expect(modelPanel(page)).toHaveCount(0);
      await runFromMenu(page, 'Threat register');

      await chooser(page, refund).click();

      await expect(register(page)).toHaveCount(0);
      await expect(held).toBeFocused();
      await expect(held).toHaveValue(`Draft${softHyphen}text`);
    });
  },
);

test(
  'the model panel under a register as wide as the window is off the Tab path until the register closes',
  { tag: '@phone-only' },
  async ({ page }) => {
    await openTwoDiagrams(page);
    await openModelPanel(page);
    await pressR(page);
    const covered = page.getByRole('region', {
      name: 'Model',
      exact: true,
      includeHidden: true,
    });
    await expect(covered).toHaveCount(1);
    await expect(covered).toBeHidden();
    const inModelPanel = (): Promise<boolean> =>
      covered.evaluate((section) => section.contains(document.activeElement));

    await rows(page).last().getByRole('button').last().focus();
    await page.keyboard.press('Tab');

    expect(await inModelPanel()).toBe(false);

    await chooser(page, refund).focus();
    await page.keyboard.press('Escape');
    await expect(register(page)).toHaveCount(0);
    await expect(covered).toBeVisible();
    expect(await inModelPanel()).toBe(true);
  },
);

test(
  'Register Details opens model metadata with focus on its title',
  { tag: '@phone' },
  async ({ page }) => {
    await openTwoDiagrams(page);
    await pressR(page);

    await register(page)
      .getByRole('button', { name: 'Details', exact: true })
      .click();

    await expect(register(page)).toHaveCount(0);
    const title = modelPanel(page).getByRole('textbox', {
      name: 'Title',
      exact: true,
    });
    await expect(title).toBeFocused();
    await expect(title).toHaveValue('Two diagrams');
    await title.fill('Register model details');
    await title.press('Tab');
    await runFromMenu(page, 'Undo');
    await expect(title).toHaveValue('Two diagrams');
  },
);

test(
  'the explicitly opened menu takes pointer input above the register and editor',
  { tag: '@phone' },
  async ({ page }) => {
    await openTwoDiagrams(page);
    await pressR(page);
    await openMenu(page);
    await expect(menuItem(page, 'Model')).toHaveCount(0);
    const item = menuItem(page, 'Threat register');
    await expect(item).toBeVisible();
    await onScreen(item);
    await item.click();
    await expect(register(page)).toBeVisible();

    await chooser(page, refund).click();
    if (await register(page).isVisible()) {
      await page.keyboard.press('Escape');
    }
    const widen = modelPanel(page).getByRole('button', {
      name: 'Widen pane',
      exact: true,
    });
    if (await widen.isVisible()) {
      await widen.click();
    }
    await openMenu(page);
    await onScreen(item);
    await item.click();
    await expect(register(page)).toBeVisible();
    await expect(rows(page)).toHaveCount(10);
  },
);
