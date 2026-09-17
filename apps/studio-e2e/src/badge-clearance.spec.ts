import { expect, test, type Locator, type Page } from '@playwright/test';
import { committedText } from '@saerskriven/model/fixtures';
import {
  boxesOverlap,
  boxOf,
  canvasSettled,
  dragBy,
  inkBoxOf,
  onScreen,
  reachesAt,
  screenBoxOf,
  viewportZoom,
} from './canvas.fixtures.js';
import {
  openModelDocument,
  runFromMenu,
  selectNode,
  threatPanel,
} from './studio.fixtures.js';

const cases = [
  ['a counted badge', 'Order API', /^Order API, process/u, 1],
  ['a flag-only badge', 'Order database', /^Order database, store/u, 0],
] as const;

const resizeDrags = [
  ['top right corner', { x: 24, y: -24 }, true],
  ['right', { x: 24, y: 0 }, false],
] as const;

const openWithFlagOnlyStore = async (page: Page): Promise<void> => {
  const text = committedText('every-glyph.model.json')
    .replace('"elements": ["el-db"]', '"elements": ["el-api"]')
    .replace('"elements": ["el-edge-zone"]', '"elements": ["el-db"]');
  await openModelDocument(page, JSON.parse(text));
};

const selectClear = async (page: Page, name: RegExp): Promise<Locator> => {
  await openWithFlagOnlyStore(page);
  const node = await selectNode(page, name);
  await threatPanel(page)
    .getByRole('button', { name: 'Close threats', exact: true })
    .click();
  await expect(threatPanel(page)).toHaveCount(0);
  return node;
};

const lowZoom = 0.45;

const onScreenGap = 2;

const badgeInk = (node: Locator) =>
  inkBoxOf(node.locator('.pn-badge circle, .pn-badge path'));

for (const [badge, element, name, counts] of cases) {
  test(
    `a selected element with ${badge} keeps its handles, controls and badge clear of each other, at low zoom as well`,
    { tag: '@phone' },
    async ({ page }) => {
      const node = await selectClear(page, name);

      await test.step('no corner handle covers the badge', async () => {
        await expect(node.locator('.pn-badge-primary')).toHaveCount(counts);
        const ink = await badgeInk(node);
        const handles = node.locator('.react-flow__resize-control.handle');
        await expect(handles).toHaveCount(4);
        for (const handle of await handles.all()) {
          expect(boxesOverlap(await screenBoxOf(handle), ink)).toBe(false);
        }
      });

      await test.step('every resize control is under the pointer', async () => {
        const controls = node.locator('.react-flow__resize-control > button');
        await expect(controls).toHaveCount(8);
        for (const control of await controls.all()) {
          await onScreen(control);
        }
      });

      await test.step('the badge draws above the selection frame and the side lines', async () => {
        await page.addStyleTag({
          content:
            '.react-flow__node.selected::after, .react-flow__resize-control.line { pointer-events: auto !important; }',
        });
        const corner = await screenBoxOf(node);
        const ink = await badgeInk(node);
        const inside = {
          x: corner.x + corner.width - ink.width * 0.1,
          y: corner.y + ink.width * 0.17,
        };
        expect(await reachesAt(node.locator('.pn-badge'), inside)).toBe(true);
      });

      await test.step('the top right handle keeps a gap from the badge on screen at low zoom', async () => {
        const zoomOut = page.getByRole('button', {
          name: 'Zoom out',
          exact: true,
        });
        for (
          let step = 0;
          step < 10 && (await viewportZoom(page)) > lowZoom;
          step++
        ) {
          await zoomOut.click();
          await canvasSettled(page);
        }
        expect(await viewportZoom(page)).toBeLessThanOrEqual(lowZoom);
        const handle = await screenBoxOf(
          node.locator('.react-flow__resize-control.handle.top.right'),
        );
        const ink = await badgeInk(node);
        expect(ink.x - (handle.x + handle.width)).toBeGreaterThanOrEqual(
          onScreenGap,
        );
      });
    },
  );

  test(`the corner and side controls still resize an element with ${badge}`, async ({
    page,
  }) => {
    const node = await selectClear(page, name);
    const original = await boxOf(node);

    for (const [control, offset, growsHeight] of resizeDrags) {
      await test.step(`the ${control} control`, async () => {
        const resize = node.getByRole('button', {
          name: `Resize ${element} from ${control}`,
          exact: true,
        });
        await expect(resize).toBeVisible();

        await dragBy(page, resize, offset);

        await expect
          .poll(async () => (await boxOf(node)).width)
          .toBeGreaterThan(original.width);
        expect((await boxOf(node)).height > original.height).toBe(growsHeight);

        await runFromMenu(page, 'Undo');
        await expect.poll(() => boxOf(node)).toEqual(original);
      });
    }
  });
}
