import { expect, test, type Locator, type Page } from '@playwright/test';
import { canvasClassNames } from '@saerskriven/canvas';
import { committedText } from '@saerskriven/model/fixtures';
import {
  boxesOverlap,
  boxOf,
  canvasSettled,
  centreOf,
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

const corners = [
  ['top', 'left'],
  ['top', 'right'],
  ['bottom', 'right'],
  ['bottom', 'left'],
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

const cornerTolerance = 0.5;

const badgeShapes = `.${canvasClassNames.badge} circle, .${canvasClassNames.badge} path`;

const badgeInk = (node: Locator) => inkBoxOf(node.locator(badgeShapes));

const badgeFace = (node: Locator): Locator => node.locator(badgeShapes).first();

const expectHandlesOnCornersClearOfBadge = async (
  node: Locator,
): Promise<void> => {
  const frame = await screenBoxOf(node);
  const ink = await badgeInk(node);
  for (const [vertical, horizontal] of corners) {
    const square = await screenBoxOf(
      node.locator(
        `.react-flow__resize-control.handle.${vertical}.${horizontal}`,
      ),
    );
    const corner = {
      x: horizontal === 'left' ? frame.x : frame.x + frame.width,
      y: vertical === 'top' ? frame.y : frame.y + frame.height,
    };
    expect(corner.x).toBeGreaterThanOrEqual(square.x - cornerTolerance);
    expect(corner.x).toBeLessThanOrEqual(
      square.x + square.width + cornerTolerance,
    );
    expect(corner.y).toBeGreaterThanOrEqual(square.y - cornerTolerance);
    expect(corner.y).toBeLessThanOrEqual(
      square.y + square.height + cornerTolerance,
    );
    expect(boxesOverlap(square, ink)).toBe(false);
  }
};

for (const [badge, element, name, counts] of cases) {
  test(
    `a selected element with ${badge} keeps every handle on its corner, its controls reachable and its badge clear past the corner, at low zoom as well`,
    { tag: '@phone' },
    async ({ page }) => {
      const node = await selectClear(page, name);

      await test.step('every corner handle sits on its corner, clear of the badge', async () => {
        await expect(
          node.locator(`.${canvasClassNames.badgePrimary}`),
        ).toHaveCount(counts);
        await expect(
          node.locator('.react-flow__resize-control.handle'),
        ).toHaveCount(4);
        await expectHandlesOnCornersClearOfBadge(node);
      });

      await test.step('every resize control is under the pointer', async () => {
        const controls = node.locator('.react-flow__resize-control > button');
        await expect(controls).toHaveCount(8);
        for (const control of await controls.all()) {
          await onScreen(control);
        }
      });

      await test.step('the badge steps out past the top right corner and takes the pointer there', async () => {
        const frame = await screenBoxOf(node);
        const ink = await badgeInk(node);
        expect(ink.x).toBeGreaterThan(frame.x + frame.width);
        expect(ink.y).toBeLessThan(frame.y);
        expect(
          await reachesAt(
            node.locator(`.${canvasClassNames.badge}`),
            await centreOf(badgeFace(node)),
          ),
        ).toBe(true);
      });

      await test.step('at low zoom every corner handle still sits on its corner, clear of the badge', async () => {
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
        await expectHandlesOnCornersClearOfBadge(node);
      });
    },
  );

  test(`a press on the stepped-out badge drags the selected element with ${badge}`, async ({
    page,
  }) => {
    const node = await selectClear(page, name);
    const original = await boxOf(node);

    await dragBy(page, badgeFace(node), { x: 40, y: 30 });

    await expect.poll(async () => (await boxOf(node)).x).not.toBe(original.x);
    await expect(node).toHaveClass(/selected/u);
    await runFromMenu(page, 'Undo');
    await expect.poll(() => boxOf(node)).toEqual(original);
  });

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
