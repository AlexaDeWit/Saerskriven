import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  darkPalette,
  lightPalette,
  rgbColour,
  type Palette,
} from '@saerskriven/canvas';
import { registeredChords } from './chords.fixtures.js';
import {
  chromeCard,
  diagramSwitcher,
  expandThreat,
  menuButton,
  openTwoDiagrams,
  panelField,
  scrollPaneTo,
  selectByKeyboard,
  selectNode,
  stepThroughOptions,
  storefront,
} from './studio.fixtures.js';

const palettes = [
  ['light', lightPalette],
  ['dark', darkPalette],
] as const;

const cursorRow = (page: Page): Locator => page.locator('[data-highlighted]');

const switchedOnTool = (page: Page): Locator =>
  chromeCard(page).locator('[aria-pressed="true"]');

const drawnAsCursor = async (row: Locator, palette: Palette): Promise<void> => {
  await expect(row).toHaveCSS(
    'background-color',
    rgbColour(palette.actionTint),
  );
  await expect(row).toHaveCSS('color', rgbColour(palette.textPrimary));
  await expect(row).toHaveCSS('outline-style', 'solid');
  await expect(row).toHaveCSS(
    'outline-color',
    rgbColour(palette.actionPrimary),
  );
};

const inEachScheme = async (page: Page, row: Locator): Promise<void> => {
  for (const [scheme, palette] of palettes) {
    await page.emulateMedia({ colorScheme: scheme });
    await drawnAsCursor(row, palette);
  }
};

const ringedInForcedColours = async (
  page: Page,
  row: Locator,
): Promise<void> => {
  await page.emulateMedia({ colorScheme: 'light', forcedColors: 'active' });
  await expect(row).toHaveCSS('outline-style', 'solid');
  await expect(row).not.toHaveCSS('outline-width', '0px');
  await page.emulateMedia({ forcedColors: 'none' });
};

const openThreat = async (page: Page): Promise<void> => {
  await openTwoDiagrams(page);
  await selectNode(page, storefront.shopper);
  await expandThreat(page, storefront.takeover);
};

const openByKeyboard = async (trigger: Locator): Promise<void> => {
  await trigger.focus();
  await trigger.press('Enter');
};

const chosenMarks = (option: Locator) =>
  option.evaluate((row) => ({
    weight: getComputedStyle(row).fontWeight,
    checked: row.querySelector('[aria-hidden="true"]') !== null,
  }));

test('a list field draws the row under the keyboard or the pointer as a ringed tint, and the chosen value keeps its weight and its check either way', async ({
  page,
}) => {
  await openThreat(page);
  const field = panelField(page, 'combobox', 'Status');
  expect(await scrollPaneTo(field, 'top')).toBe(true);
  await openByKeyboard(field);
  const options = page.getByRole('option');
  const chosen = page.locator('[role="option"][data-state="checked"]');
  await expect(cursorRow(page)).toHaveCount(1);
  await expect(chosen).toHaveAttribute('data-highlighted');

  await inEachScheme(page, chosen);
  expect(await chosenMarks(chosen)).toEqual({ weight: '600', checked: true });

  await stepThroughOptions(page, 'ArrowDown');
  const stepped = cursorRow(page);
  await expect(chosen).not.toHaveAttribute('data-highlighted');
  await inEachScheme(page, stepped);
  expect(await chosenMarks(chosen)).toEqual({ weight: '600', checked: true });
  expect(await chosenMarks(stepped)).toEqual({ weight: '400', checked: false });
  await expect(chosen).toHaveCSS('outline-style', 'none');

  const pointed = options.nth(2);
  await pointed.hover();
  await expect(pointed).toHaveAttribute('data-highlighted');
  await inEachScheme(page, pointed);
  await ringedInForcedColours(page, pointed);
});

const arrowTo = async (
  page: Page,
  row: Locator,
  key: 'ArrowDown' | 'ArrowUp',
): Promise<void> => {
  await expect(async () => {
    await page.keyboard.press(key);
    await expect(row).toHaveAttribute('data-highlighted', { timeout: 250 });
  }).toPass({ intervals: [0] });
};

const openMenuByKeyboard = async (page: Page): Promise<void> => {
  await openTwoDiagrams(page);
  await openByKeyboard(menuButton(page));
  await expect(page.getByRole('menu')).toBeVisible();
};

const pickers: readonly {
  readonly name: string;
  readonly open: (page: Page) => Promise<void>;
}[] = [
  {
    name: 'an Existing picker with nothing chosen yet',
    open: async (page) => {
      await openThreat(page);
      await openByKeyboard(panelField(page, 'combobox', 'Existing element'));
      await expect(page.getByRole('listbox')).toBeVisible();
      await expect(
        page.locator('[role="option"][data-state="checked"]'),
      ).toHaveCount(0);
    },
  },
  {
    name: 'the diagram switcher',
    open: async (page) => {
      await openTwoDiagrams(page);
      await openByKeyboard(diagramSwitcher(page));
      await expect(page.getByRole('menu')).toBeVisible();
    },
  },
  {
    name: 'the menu',
    open: openMenuByKeyboard,
  },
  {
    name: "the menu's Appearance submenu trigger",
    open: async (page) => {
      await openMenuByKeyboard(page);
      await arrowTo(
        page,
        page.getByRole('menuitem', { name: /^Appearance/u }),
        'ArrowDown',
      );
    },
  },
  {
    name: "the menu's project link",
    open: async (page) => {
      await openMenuByKeyboard(page);
      await page.keyboard.press('End');
      await arrowTo(
        page,
        page.getByRole('menuitem', { name: /^View source/u }),
        'ArrowUp',
      );
    },
  },
  {
    name: 'the flow target chooser',
    open: async (page) => {
      await openTwoDiagrams(page);
      await selectByKeyboard(page, storefront.webShop);
      await page.keyboard.press(registeredChords['start-flow'][0]);
      await expect(page.getByRole('listbox')).toBeVisible();
    },
  },
];

for (const picker of pickers) {
  test(`${picker.name} draws its cursor row as a ringed tint, never the solid accent a switched-on tool keeps`, async ({
    page,
  }) => {
    await picker.open(page);
    const row = cursorRow(page);
    await expect(row).toHaveCount(1);

    await inEachScheme(page, row);
    await ringedInForcedColours(page, row);
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(switchedOnTool(page)).toHaveCSS(
      'background-color',
      rgbColour(lightPalette.actionPrimary),
    );
  });
}
