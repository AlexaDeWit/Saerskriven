import { expect, test, type Page } from '@playwright/test';
import { canvasInteractionClassNames } from '@saerskriven/canvas';
import { sharedModelInput } from '@saerskriven/model/fixtures';
import { boxesOverlap, screenBoxOf, zoomOutTo } from './canvas.fixtures.js';
import {
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

test('Add existing element picks by keyboard and adds the picks to the diagram on screen as one undo step', async ({
  page,
}) => {
  await openModelDocument(page, sharedModelInput);
  await expect(nodeNamed(page, /^Card vault, store/u)).toHaveCount(0);

  await page.keyboard.press('e');
  const vault = picker(page).getByRole('checkbox', { name: 'Card vault' });
  await expect(vault).toBeFocused();
  await expect(vault).toHaveAccessibleDescription(/Payments/u);
  await expect(
    picker(page).getByRole('checkbox', { name: 'Score' }),
  ).toBeVisible();
  await page.keyboard.press('Space');
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

test('Escape puts the picker away with nothing added', async ({ page }) => {
  await openModelDocument(page, sharedModelInput);
  await runFromMenu(page, 'Add existing element');
  await expect(
    picker(page).getByRole('checkbox', { name: 'Card vault' }),
  ).toBeFocused();

  await page.keyboard.press('Space');
  await page.keyboard.press('Escape');

  await expect(picker(page)).toHaveCount(0);
  await expect(nodeNamed(page, /^Card vault, store/u)).toHaveCount(0);
});

test('every placement of a shared element carries the mark, and its name says where else it is', async ({
  page,
}) => {
  await openModelDocument(page, sharedModelInput);

  const shared = nodeNamed(page, paymentsApi);
  await expect(shared).toHaveAccessibleName(/, also on Payments$/u);
  await expect(shared.locator('[data-shared-mark]')).toBeVisible();
  await expect(
    nodeNamed(page, /^Customer, actor/u).locator('[data-shared-mark]'),
  ).toHaveCount(0);
  await expect(
    page.locator(
      `.${canvasInteractionClassNames.flowBlockSurface} [data-shared-mark]`,
    ),
  ).toHaveCount(1);
});

test('a selected shared element keeps its mark clear of the top left resize handle, at low zoom as well', async ({
  page,
}) => {
  await openModelDocument(page, sharedModelInput);
  const node = await selectNode(page, paymentsApi);
  const markClear = async (): Promise<void> => {
    const handle = await screenBoxOf(
      node.locator('.react-flow__resize-control.handle.top.left'),
    );
    const mark = await screenBoxOf(node.locator('[data-shared-mark] rect'));
    expect(boxesOverlap(handle, mark)).toBe(false);
  };

  await markClear();
  await zoomOutTo(page, 0.45);
  await markClear();
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
