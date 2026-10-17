import { expect, test, type Page } from '@playwright/test';
import { canvasInteractionClassNames } from '@saerskriven/canvas';
import type { ModelInput } from '@saerskriven/model';
import { sharedModelInput } from '@saerskriven/model/fixtures';
import { screenBoxOf } from './canvas.fixtures.js';
import {
  clickInsideCorner,
  diagramSwitcher,
  nodeNamed,
  openModelDocument,
  runFromMenu,
  selectNode,
  tabTo,
  threatPanel,
} from './studio.fixtures.js';

const picker = (page: Page) =>
  page.getByRole('region', { name: 'Add existing element' });

const paymentsApi = /^Payments API, process/u;

const flowBlocks = (page: Page): Promise<string> =>
  page.locator(`.${canvasInteractionClassNames.flowBlockSurface}`).innerHTML();

const chargeOnOneDiagram: ModelInput = {
  ...sharedModelInput,
  diagrams: sharedModelInput.diagrams.map((diagram) =>
    diagram.id === 'payments'
      ? {
          ...diagram,
          placements: diagram.placements.filter(
            ({ element }) => element !== 'charge',
          ),
        }
      : diagram,
  ),
};

test('Add existing element picks by keyboard and adds the picks to the diagram on screen as one undo step', async ({
  page,
}) => {
  await openModelDocument(page, sharedModelInput);
  await expect(nodeNamed(page, /^Card vault, store/u)).toHaveCount(0);

  await page.keyboard.press('e');
  const vault = picker(page).getByRole('button', { name: 'Card vault' });
  await expect(vault).toBeFocused();
  await expect(vault).toHaveAccessibleDescription(/Payments/u);
  await expect(picker(page).getByRole('button', { name: 'Score' })).toHaveCount(
    0,
  );
  await page.keyboard.press('Space');
  await expect(vault).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Enter');
  await expect(vault).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('Enter');
  await expect(vault).toHaveAttribute('aria-pressed', 'true');
  const add = picker(page).getByRole('button', { name: 'Add 1' });
  await tabTo(page, add, vault);
  await page.keyboard.press('Enter');

  await expect(picker(page)).toHaveCount(0);
  await expect(
    nodeNamed(page, /^Card vault, store, also on Payments$/u),
  ).toBeFocused();
  await expect(
    nodeNamed(page, /^Charge, flow, from Payments API to Card vault,/u),
  ).toHaveCount(1);
  await expect(nodeNamed(page, /^Score, flow/u)).toHaveCount(0);

  await runFromMenu(page, 'Undo');

  await expect(nodeNamed(page, /^Card vault, store/u)).toHaveCount(0);
  await expect(
    nodeNamed(page, /^Charge, flow, .*Card vault on another diagram/u),
  ).toHaveCount(1);
});

test('a click anywhere on a box of Add existing element picks it, and a second puts it back', async ({
  page,
}) => {
  await openModelDocument(page, sharedModelInput);
  await runFromMenu(page, 'Add existing element');
  const vault = picker(page).getByRole('button', { name: 'Card vault' });
  expect((await screenBoxOf(vault)).height).toBeGreaterThanOrEqual(44);

  await clickInsideCorner(vault);
  await expect(vault).toHaveAttribute('aria-pressed', 'true');
  await expect(
    picker(page).getByRole('button', { name: 'Add 1' }),
  ).toBeVisible();
  await clickInsideCorner(vault);

  await expect(vault).toHaveAttribute('aria-pressed', 'false');
});

test('Escape puts the picker away with nothing added', async ({ page }) => {
  await openModelDocument(page, sharedModelInput);
  await runFromMenu(page, 'Add existing element');
  await expect(
    picker(page).getByRole('button', { name: 'Card vault' }),
  ).toBeFocused();

  await page.keyboard.press('Space');
  await page.keyboard.press('Escape');

  await expect(picker(page)).toHaveCount(0);
  await expect(nodeNamed(page, /^Card vault, store/u)).toHaveCount(0);
});

test('a flow on two diagrams draws the name blocks it draws on one, its name alone saying where else it is', async ({
  baseURL,
  browser,
  page,
}) => {
  await openModelDocument(page, sharedModelInput);
  await expect(
    nodeNamed(page, /^Charge, flow, .*also on Payments$/u),
  ).toHaveCount(1);
  const shared = await flowBlocks(page);

  const alone = await browser.newPage({
    baseURL,
    locale: 'en-CA',
    viewport: page.viewportSize(),
  });
  await openModelDocument(alone, chargeOnOneDiagram);
  await expect(nodeNamed(alone, /^Charge, flow/u)).toHaveCount(1);
  await expect(nodeNamed(alone, /^Charge, flow, .*also on/u)).toHaveCount(0);
  const single = await flowBlocks(alone);
  await alone.close();

  expect(shared).toContain('Charge');
  expect(single).toBe(shared);
});

test('a name on the Also on line shows that diagram with the element selected, by keyboard', async ({
  page,
}) => {
  await openModelDocument(page, sharedModelInput);
  await selectNode(page, paymentsApi);
  const show = threatPanel(page).getByRole('button', {
    name: 'Show on Payments',
  });
  await expect(show).toBeVisible();

  await show.focus();
  await page.keyboard.press('Enter');

  await expect(diagramSwitcher(page)).toHaveText('Payments');
  const there = nodeNamed(
    page,
    /^Payments API, process, .*also on High level$/u,
  );
  await expect(there).toBeFocused();
  await expect(there).toHaveClass(/selected/u);
  await expect(
    threatPanel(page).getByRole('button', { name: 'Show on High level' }),
  ).toBeVisible();
});
