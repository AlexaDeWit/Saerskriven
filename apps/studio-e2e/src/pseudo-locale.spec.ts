import { expect, test, type Locator, type Page } from '@playwright/test';
import { pseudoText } from '@saerskriven/i18n';
import { committedText } from '@saerskriven/model/fixtures';
import {
  chromeCard,
  diagramSwitcher,
  menuItem,
  openModelDocument,
  openText,
  refusedYaml,
  selectNode,
  storefront,
  withoutPickers,
} from './studio.fixtures.js';

const pseudoEntry = '/?pseudo-locale';

const refusedName = 'broken.yaml';

const twoDiagramsModel: unknown = JSON.parse(
  committedText('two-diagrams.model.json'),
);

const typedFields = new Set([
  'title',
  'name',
  'description',
  'prose',
  'text',
  'owner',
  'contributors',
  'reasonOutOfScope',
  'methodologyName',
]);

const spaced = (text: string): string => text.replaceAll(/\s+/gu, ' ').trim();

const typedIn = (value: unknown, field?: string): readonly string[] => {
  if (typeof value === 'string') {
    return field !== undefined && typedFields.has(field) ? [value] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => typedIn(item, field));
  }
  if (typeof value !== 'object' || value === null) {
    return [];
  }
  const custom =
    'methodology' in value &&
    value.methodology === 'custom' &&
    'category' in value &&
    typeof value.category === 'string'
      ? [value.category]
      : [];
  return [
    ...custom,
    ...Object.entries(value).flatMap(([key, item]) => typedIn(item, key)),
  ];
};

const userData = new Set(
  [...typedIn(twoDiagramsModel), refusedName].map(spaced),
);

const markedLiteral = /⟦[^⟧]*⟧/u;

const formattedNumber = /^(?=.*\d)[\d\s.,%]+$/u;

const itemSeparator = /,(?: |$)/u;

const listConjunction = / and /u;

const exceptions: readonly {
  readonly text: RegExp;
  readonly reason: string;
}[] = [
  {
    text: /^(?:F\d{1,2}|[A-Z\d?=+-])$/u,
    reason:
      'a character or function key is written as its key cap prints it, in every language',
  },
  {
    text: /^(?:English \(Canada\)|Français \(Canada\)|Svenska)$/u,
    reason: 'each language is offered under its own name',
  },
  {
    text: /^(?:Saerskriven|Saerskriven YAML)$/u,
    reason:
      'the product name and a file format name are the same in every language',
  },
  {
    text: /^[?LMHC!]$/u,
    reason:
      "a badge mark comes from render's terms for the locale, which #499 reuses on screen and the pseudo-locale does not read",
  },
  {
    text: /^[☰⊡●○▾]$/u,
    reason: 'a decorative glyph is hidden from assistive technology',
  },
  {
    text: /^(?:React Flow|React Flow attribution|node|edge)$/u,
    reason:
      "React Flow's attribution link and the role descriptions it fixes on a node and an edge",
  },
  {
    text: /^[\w.]+: Invalid input: /u,
    reason:
      'a model or schema parse issue is English under a worded headline until #488',
  },
];

const isDatum = (item: string): boolean =>
  formattedNumber.test(item) ||
  userData.has(item) ||
  item.split(listConjunction).every((part) => userData.has(part.trim()));

const isData = (piece: string): boolean =>
  isDatum(piece.replace(/,$/u, '')) ||
  piece
    .split(itemSeparator)
    .map((item) => item.trim())
    .filter((item) => item !== '')
    .every(isDatum);

const strayText = (shown: readonly string[]): readonly string[] =>
  shown.filter((text) =>
    text
      .split(markedLiteral)
      .map(spaced)
      .some(
        (piece) =>
          piece !== '' &&
          !isData(piece) &&
          !exceptions.some(({ text: excepted }) => excepted.test(piece)),
      ),
  );

const shownText = (page: Page): Promise<readonly string[]> =>
  page.evaluate(() => {
    const named = [
      'aria-label',
      'aria-description',
      'aria-roledescription',
      'title',
      'placeholder',
      'alt',
    ];
    const shown = { opacityProperty: true, visibilityProperty: true };
    const found: string[] = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    for (
      let node = walker.nextNode();
      node !== null;
      node = walker.nextNode()
    ) {
      const text = node.textContent?.trim() ?? '';
      const parent = node.parentElement;
      if (
        text !== '' &&
        parent?.closest('svg text') === null &&
        parent.checkVisibility(shown)
      ) {
        found.push(text);
      }
    }
    for (const label of document.body.querySelectorAll('svg text')) {
      if (label.checkVisibility(shown)) {
        const lines = [...label.querySelectorAll('tspan')].map(
          (line) => line.textContent ?? '',
        );
        found.push(
          (lines.length === 0 ? [label.textContent ?? ''] : lines).join(' '),
        );
      }
    }
    for (const element of document.body.querySelectorAll('*')) {
      if (element.checkVisibility(shown)) {
        for (const name of named) {
          const value = element.getAttribute(name)?.trim() ?? '';
          if (value !== '') {
            found.push(value);
          }
        }
      }
    }
    return found;
  });

const scanned = async (
  page: Page,
  state: string,
  found: Map<string, string>,
): Promise<void> => {
  for (const text of strayText(await shownText(page))) {
    if (!found.has(text)) {
      found.set(text, state);
    }
  }
};

const menuButton = (page: Page) =>
  page.getByRole('button', { name: pseudoText('Menu'), exact: true });

const openPseudo = async (page: Page): Promise<void> => {
  await page.addInitScript(withoutPickers);
  await openModelDocument(page, twoDiagramsModel, pseudoEntry);
};

test('the pseudo-locale shows no app text outside the catalogues', async ({
  page,
}) => {
  const found = new Map<string, string>();
  await openPseudo(page);
  await scanned(page, 'on the canvas', found);

  await menuButton(page).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await scanned(page, 'in the menu', found);
  const submenus = page.locator('[role="menuitem"][aria-haspopup="menu"]');
  for (let index = 0; index < (await submenus.count()); index += 1) {
    const trigger = submenus.nth(index);
    await trigger.press('ArrowRight');
    await expect(page.getByRole('menu')).toHaveCount(2);
    await scanned(page, `in submenu ${String(index + 1)}`, found);
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('menu')).toHaveCount(1);
  }
  await menuItem(page, pseudoText('Keyboard shortcuts')).click();
  await expect(
    page.getByRole('region', { name: pseudoText('Keyboard shortcuts') }),
  ).toBeVisible();
  await scanned(page, 'in the shortcut reference', found);
  await page.keyboard.press('Escape');

  await menuButton(page).click();
  await menuItem(page, pseudoText('Model properties')).click();
  await scanned(page, 'in the model properties', found);

  await selectNode(page, /^Web shop, /u);
  const threats = page.getByRole('region', { name: pseudoText('Threats') });
  await expect(threats).toBeVisible();
  const basketPrice = threats.getByRole('button', {
    name: storefront.basketPrice,
  });
  await basketPrice.click();
  await expect(basketPrice).toHaveAttribute('aria-expanded', 'true');
  await scanned(page, 'in the threat panel', found);

  await diagramSwitcher(page).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await scanned(page, 'in the diagram switcher', found);
  await page.keyboard.press('Escape');

  await openText(page, refusedName, refusedYaml);
  const notice = page.getByTestId('failure-notice');
  await expect(notice).toContainText(refusedName);
  await notice.locator('summary').click();
  await scanned(page, 'in a failure notice', found);

  expect(
    [...found].map(([text, state]) => `${state}: ${text}`),
    'text outside the pseudo markers',
  ).toEqual([]);
});

const subpixel = 1;

const clipped = (region: Locator): Promise<readonly string[]> =>
  region.evaluate((root) =>
    [root, ...root.querySelectorAll('*')]
      .filter(
        (element) =>
          element.checkVisibility() &&
          element.scrollWidth > element.clientWidth + 1 &&
          getComputedStyle(element).overflowX !== 'auto' &&
          getComputedStyle(element).overflowX !== 'scroll',
      )
      .map((element) => element.textContent?.trim().slice(0, 60) ?? ''),
  );

const fitsAcross = async (page: Page, region: Locator): Promise<void> => {
  const width = page.viewportSize()?.width ?? 0;
  for (const box of await region.evaluateAll((elements) =>
    elements.map((element) => {
      const { left, right } = element.getBoundingClientRect();
      return { left, right };
    }),
  )) {
    expect(box.left).toBeGreaterThanOrEqual(-subpixel);
    expect(box.right).toBeLessThanOrEqual(width + subpixel);
  }
  expect(await clipped(region.first())).toEqual([]);
};

test(
  'the lengthened pseudo-locale text fits a narrow layout',
  { tag: '@phone' },
  async ({ page }) => {
    await openPseudo(page);
    await fitsAcross(page, chromeCard(page));

    await menuButton(page).click();
    const menus = page.getByRole('menu');
    await fitsAcross(page, menus);
    await menuItem(page, pseudoText('Export')).press('ArrowRight');
    await expect(menus).toHaveCount(2);
    await fitsAcross(page, menus.last());
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(menus).toHaveCount(0);

    await openText(page, refusedName, refusedYaml);
    const notice = page.getByTestId('failure-notice');
    await expect(notice).toContainText(refusedName);
    await fitsAcross(page, notice);

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  },
);
