import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { boxOf, inkBoxOf, type Box } from './canvas-geometry.fixtures.js';
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

const openWithFlagOnlyStore = async (page: Page): Promise<void> => {
  const text = readFileSync(vendored(everyGlyph), 'utf8')
    .replace('"elements": ["el-db"]', '"elements": ["el-api"]')
    .replace('"elements": ["el-edge-zone"]', '"elements": ["el-db"]');
  await openModelDocument(page, JSON.parse(text));
};

const touchTolerance = 0.5;

const overlaps = (a: Box, b: Box): boolean =>
  a.x + touchTolerance < b.x + b.width &&
  b.x + touchTolerance < a.x + a.width &&
  a.y + touchTolerance < b.y + b.height &&
  b.y + touchTolerance < a.y + a.height;

const selectClear = async (page: Page, name: RegExp): Promise<Locator> => {
  await openWithFlagOnlyStore(page);
  const node = await selectNode(page, name);
  await threatPanel(page)
    .getByRole('button', { name: 'Close threats', exact: true })
    .click();
  await expect(threatPanel(page)).toHaveCount(0);
  return node;
};

for (const [badge, element, name, counts] of cases) {
  test(`no corner handle of a selected element covers ${badge}`, async ({
    page,
  }) => {
    const node = await selectClear(page, name);
    await expect(node.locator('.pn-badge-primary')).toHaveCount(counts);
    const shapes = node.locator('.pn-badge').locator('circle, path');
    const ink = await inkBoxOf(shapes);
    const handles = node.locator('.react-flow__resize-control.handle');
    await expect(handles).toHaveCount(4);

    for (const handle of await handles.all()) {
      const box = await handle.boundingBox();
      expect(box).not.toBeNull();
      expect(box !== null && overlaps(box, ink)).toBe(false);
    }
  });

  test(`the top right corner handle still resizes an element with ${badge}`, async ({
    page,
  }) => {
    const node = await selectClear(page, name);
    const before = await boxOf(node);

    await dragBy(
      page,
      node.getByRole('button', {
        name: `Resize ${element} from top right corner`,
        exact: true,
      }),
      { x: 24, y: -24 },
    );

    await expect
      .poll(async () => (await boxOf(node)).width)
      .toBeGreaterThan(before.width);
    expect((await boxOf(node)).height).toBeGreaterThan(before.height);
  });
}
