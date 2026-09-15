import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
  boxesOverlap,
  boxOf,
  inkBoxOf,
  type Box,
  type Point,
} from './canvas-geometry.fixtures.js';
import {
  dragBy,
  openModelDocument,
  selectNode,
  threatPanel,
  vendored,
} from './studio.fixtures.js';

const everyGlyph = 'test-data/every-glyph.model.json';

const cases = [
  ['a counted badge', 'Order API', /^Order API, process/u, 1],
  ['a flag-only badge', 'Order database', /^Order database, store/u, 0],
] as const;

const resizeDrags = [
  ['top right corner', { x: 24, y: -24 }, true],
  ['right', { x: 24, y: 0 }, false],
] as const;

const openWithFlagOnlyStore = async (page: Page): Promise<void> => {
  const text = readFileSync(vendored(everyGlyph), 'utf8')
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

const measured = async (locator: Locator): Promise<Box> => {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box ?? { x: 0, y: 0, width: 0, height: 0 };
};

const centreOf = (box: Box): Point => ({
  x: box.x + box.width / 2,
  y: box.y + box.height / 2,
});

const topmostIs = (target: Locator, at: Point): Promise<boolean> =>
  target.evaluate(
    (element, point) =>
      element.contains(document.elementFromPoint(point.x, point.y)),
    at,
  );

for (const [badge, element, name, counts] of cases) {
  test(`no corner handle of a selected element covers ${badge}`, async ({
    page,
  }) => {
    const node = await selectClear(page, name);
    await expect(node.locator('.pn-badge-primary')).toHaveCount(counts);
    const ink = await inkBoxOf(
      node.locator('.pn-badge').locator('circle, path'),
    );
    const handles = node.locator('.react-flow__resize-control.handle');
    await expect(handles).toHaveCount(4);

    for (const handle of await handles.all()) {
      expect(boxesOverlap(await measured(handle), ink)).toBe(false);
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
    const corner = await measured(node);
    const ink = await inkBoxOf(
      node.locator('.pn-badge circle, .pn-badge path'),
    );
    const inside = {
      x: corner.x + corner.width - ink.width * 0.1,
      y: corner.y + ink.width * 0.17,
    };

    expect(await topmostIs(node.locator('.pn-badge'), inside)).toBe(true);
  });

  test(`${badge} leaves every resize control of a selected element under the pointer`, async ({
    page,
  }) => {
    const node = await selectClear(page, name);
    const controls = node.locator('.react-flow__resize-control > button');
    await expect(controls).toHaveCount(8);

    for (const control of await controls.all()) {
      expect(await topmostIs(control, centreOf(await measured(control)))).toBe(
        true,
      );
    }
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
