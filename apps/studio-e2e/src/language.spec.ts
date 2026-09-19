import { expect, test, type Locator, type Page } from '@playwright/test';
import type { Locale } from '@saerskriven/i18n';
import { audit } from './accessibility.fixtures.js';
import {
  closeMenu,
  downloaded,
  editAnnouncement,
  exportedFile,
  languageStorageKey,
  menuButton,
  menuItem,
  nodeNamed,
  openFile,
  openMenu,
  openPlaceholder,
  openText,
  placeByClick,
  readBack,
  recoverySnapshot,
  refusedYaml,
  storefront,
  twoDiagramsFile,
  undoOffered,
} from './studio.fixtures.js';

const readers = {
  'en-CA': {
    language: 'English (Canada)',
    menu: 'Menu',
    diagram: 'Diagram',
    save: 'Save',
    undo: 'Undo',
    dismiss: 'Dismiss problem',
    export: 'Export',
    register: 'Register as Markdown',
    registerTitle: 'threat register',
    severity: 'Severity',
    element: 'element',
    flow: 'flow',
  },
  'fr-CA': {
    language: 'Français (Canada)',
    menu: 'Menu',
    diagram: 'Diagramme',
    save: 'Enregistrer',
    undo: 'Annuler',
    dismiss: 'Masquer le problème',
    export: 'Exporter',
    register: 'Registre en Markdown',
    registerTitle: 'Registre des menaces',
    severity: 'Gravité',
    element: 'élément',
    flow: 'flux',
  },
  sv: {
    language: 'Svenska',
    menu: 'Meny',
    diagram: 'Diagram',
    save: 'Spara',
    undo: 'Ångra',
    dismiss: 'Dölj problemet',
    export: 'Exportera',
    register: 'Register som Markdown',
    registerTitle: 'Hotregister',
    severity: 'Allvarlighetsgrad',
    element: 'element',
    flow: 'flöde',
  },
} as const satisfies Record<Locale, Record<string, string>>;

const languageRow = (page: Page): Locator =>
  page.getByRole('menuitem', {
    name: /(?:English \(Canada\)|Français \(Canada\)|Svenska)$/u,
  });

const openLanguage = async (page: Page): Promise<void> => {
  await openMenu(page);
  await languageRow(page).press('ArrowRight');
  await expect(page.getByRole('menuitemradio').first()).toBeVisible();
};

const chooseLanguage = async (page: Page, name: string): Promise<void> => {
  await openLanguage(page);
  await page.getByRole('menuitemradio', { name }).click();
};

const expectChosen = async (page: Page, name: string): Promise<void> => {
  await openLanguage(page);
  await expect(page.getByRole('menuitemradio', { name })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await closeMenu(page);
};

const arrowTo = async (page: Page, target: Locator): Promise<void> => {
  const steps = await target.evaluate((element) => {
    const menu = element.closest('[role="menu"]');
    const items = [
      ...(menu?.querySelectorAll('[role^="menuitem"]:not([data-disabled])') ??
        []),
    ].filter((item) => item.closest('[role="menu"]') === menu);
    return (
      items.indexOf(element) -
      items.findIndex((item) => item === document.activeElement)
    );
  });
  for (let step = 0; step < steps; step += 1) {
    await page.keyboard.press('ArrowDown');
  }
  await expect(target).toBeFocused();
};

const chooseByKeyboard = async (page: Page, name: string): Promise<void> => {
  await menuButton(page).focus();
  await page.keyboard.press('Enter');
  await arrowTo(page, languageRow(page));
  await page.keyboard.press('ArrowRight');
  await arrowTo(page, page.getByRole('menuitemradio', { name }));
  await page.keyboard.press('Enter');
  await closeMenu(page);
};

const savedAs = async (page: Page, save: string) => {
  await openMenu(page);
  return downloaded(page, () => menuItem(page, save).click());
};

const accented = 'Kafé Ödmjuk Ångström à Québec';

const passes = [
  { locale: 'en-CA', browser: 'sv-SE', prefill: 'sv' },
  { locale: 'fr-CA', browser: 'en-CA', prefill: 'en-CA' },
  { locale: 'sv', browser: 'fr-CA', prefill: 'fr-CA' },
] as const;

for (const { locale, browser, prefill } of passes) {
  test.describe(`a reader choosing ${locale} in a ${browser} browser`, () => {
    test.use({ locale: browser });

    test('is chosen by keyboard, keeps the model, its history, recovery and saved bytes, exports in its language, and survives a reload', async ({
      page,
    }) => {
      const reader = readers[locale];
      await openFile(page, twoDiagramsFile);

      await nodeNamed(page, storefront.webShop).dblclick();
      const field = page.getByRole('textbox', { name: /Web shop/u });
      await field.fill(accented);
      await field.press('Enter');
      const renamed = nodeNamed(page, /^Kafé Ödmjuk Ångström à Québec, /u);
      await expect(renamed).toHaveCount(1);
      await renamed.focus();
      await page.keyboard.press('ControlOrMeta+z');
      await expect(nodeNamed(page, storefront.webShop)).toHaveCount(1);
      await page.keyboard.press('ControlOrMeta+Shift+z');
      await expect(renamed).toHaveCount(1);
      const announced = await editAnnouncement(page).textContent();
      expect(announced).not.toBe('');
      const before = await savedAs(page, readers[prefill].save);
      const recovery = await recoverySnapshot(page);

      await chooseByKeyboard(page, reader.language);

      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      expect(await recoverySnapshot(page)).toBe(recovery);
      await expect(editAnnouncement(page)).not.toHaveText(announced ?? '');
      expect(await undoOffered(page, reader.undo)).toBe(true);
      const after = await savedAs(page, reader.save);
      expect(after.name).toBe(before.name);
      expect(after.text).toBe(before.text);
      expect(
        readBack(after.text).model.diagrams.flatMap((diagram) =>
          diagram.elements.map((element) => element.name),
        ),
      ).toContain(accented);

      const register = await exportedFile(page, reader.register, reader.export);
      expect(register.text).toContain(reader.registerTitle);
      expect(register.text).toContain(reader.severity);
      expect(register.text).toContain(accented);
      for (const other of Object.values(readers)) {
        if (other.severity !== reader.severity) {
          expect(register.text).not.toContain(other.severity);
        }
      }

      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(renamed).toHaveCount(1);
      await expectChosen(page, reader.language);
    });

    test('names its controls and canvas roles, words and dismisses a refusal, and passes the audit', async ({
      page,
    }) => {
      const reader = readers[locale];
      await page.addInitScript(
        ({ key, value }) => {
          localStorage.setItem(key, value);
        },
        { key: languageStorageKey, value: locale },
      );
      await openFile(page, twoDiagramsFile);

      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(menuButton(page)).toHaveAccessibleName(reader.menu);
      await expect(page.getByRole('application')).toHaveAccessibleName(
        reader.diagram,
      );
      await expect(nodeNamed(page, /^Web shop, /u)).toHaveAttribute(
        'aria-roledescription',
        reader.element,
      );
      await expect(
        page.getByRole('group', {
          name: /^browse the catalogue and fill a basket, /u,
        }),
      ).toHaveAttribute('aria-roledescription', reader.flow);

      await openText(page, 'broken.yaml', refusedYaml);
      await expect(page.getByTestId('failure-notice')).toContainText(
        'broken.yaml',
      );
      await audit(page, `in ${locale} with a refusal on screen`);
      await page.getByRole('button', { name: reader.dismiss }).focus();
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('failure-notice')).toBeEmpty();
    });
  });
}

test.describe('a French browser', () => {
  test.use({ locale: 'fr-FR' });

  test('prefills French, and a chosen language survives a reload', async ({
    page,
  }) => {
    await openPlaceholder(page);

    await expect(page.locator('html')).toHaveAttribute('lang', 'fr-CA');
    await expectChosen(page, readers['fr-CA'].language);
    await audit(page, 'in the French the browser asked for');

    await chooseLanguage(page, readers.sv.language);

    await expect(page.locator('html')).toHaveAttribute('lang', 'sv');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'sv');
    await expectChosen(page, readers.sv.language);
  });
});

test.describe('a browser asking for a language the studio has not got', () => {
  test.use({ locale: 'de-DE' });

  test('reads the studio in English', async ({ page }) => {
    await openPlaceholder(page);

    await expect(page.locator('html')).toHaveAttribute('lang', 'en-CA');
    await expectChosen(page, readers['en-CA'].language);
  });
});

test('a stored value naming no supported language prefills from the browser', async ({
  page,
}) => {
  await page.addInitScript((key) => {
    localStorage.setItem(key, 'kl-GL');
  }, languageStorageKey);
  await openPlaceholder(page);

  await expect(page.locator('html')).toHaveAttribute('lang', 'en-CA');
  await expectChosen(page, readers['en-CA'].language);
  const stored = await page.evaluate(
    (key) => localStorage.getItem(key),
    languageStorageKey,
  );
  expect(stored).toBe('kl-GL');
});

test('the old follow-the-browser value prefills from the browser', async ({
  page,
}) => {
  await page.addInitScript((key) => {
    localStorage.setItem(key, 'browser');
  }, languageStorageKey);
  await openPlaceholder(page);

  await expect(page.locator('html')).toHaveAttribute('lang', 'en-CA');
  await expectChosen(page, readers['en-CA'].language);
});

test('a change of language keeps unsaved work, its undo and its file state', async ({
  page,
}) => {
  await openPlaceholder(page);
  await placeByClick(page, 'Actor', /^New actor, actor/u);
  await page.keyboard.press('Enter');
  await expect(menuButton(page)).toHaveAccessibleName(/unsaved changes/u);

  await chooseLanguage(page, readers['fr-CA'].language);

  await expect(page.locator('html')).toHaveAttribute('lang', 'fr-CA');
  await expect(
    page.getByRole('group', { name: /^New actor, acteur/u }),
  ).toHaveCount(1);
  await expect(menuButton(page)).toHaveAccessibleName(
    /modifications non enregistrées/u,
  );
  expect(await undoOffered(page, readers['fr-CA'].undo)).toBe(true);
});
