import { expect, test, type Locator, type Page } from '@playwright/test';
import { committedText } from '@saerskriven/model/fixtures';
import { boxesOverlap, boxOf, inkBoxOf } from './canvas-geometry.fixtures.js';
import { viewportZoom } from './commands.fixtures.js';
import {
  canvasSettled,
  dragBy,
  onScreen,
  openModelDocument,
  reachesAt,
  screenBoxOf,
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
  test(`no corner handle of a selected element covers ${badge}`, async ({
    page,
  }) => {
    const node = await selectClear(page, name);
    await expect(node.locator('.pn-badge-primary')).toHaveCount(counts);
    const ink = await badgeInk(node);
    const handles = node.locator('.react-flow__resize-control.handle');
    await expect(handles).toHaveCount(4);

    for (const handle of await handles.all()) {
      expect(boxesOverlap(await screenBoxOf(handle), ink)).toBe(false);
    }
  });

  test(`${badge} draws above the selection frame and the side lines`, async ({
    page,
  }) => {
    const node = await selectClear(page, name);
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

  test(`${badge} leaves every resize control of a selected element under the pointer`, async ({
    page,
  }) => {
    const node = await selectClear(page, name);
    const controls = node.locator('.react-flow__resize-control > button');
    await expect(controls).toHaveCount(8);

    for (const control of await controls.all()) {
      await onScreen(control);
    }
  });

  test(`the top right handle keeps a gap from ${badge} on screen at low zoom`, async ({
    page,
  }) => {
    const node = await selectClear(page, name);
    const zoomOut = page.getByRole('button', { name: 'Zoom out', exact: true });
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

  for (const [control, offset, growsHeight] of resizeDrags) {
    test(`the ${control} control still resizes an element with ${badge}`, async ({
      page,
    }) => {
      const node = await selectClear(page, name);
      const before = await boxOf(node);

      await dragBy(
        page,
        node.getByRole('button', {
          name: `Resize ${element} from ${control}`,
          exact: true,
        }),
        offset,
      );

      await expect
        .poll(async () => (await boxOf(node)).width)
        .toBeGreaterThan(before.width);
      expect((await boxOf(node)).height > before.height).toBe(growsHeight);
    });
  }
}
