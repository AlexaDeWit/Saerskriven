import { expect, test, type Page } from '@playwright/test';
import { boxAt, modelWith } from '@saerskriven/model/fixtures';
import {
  boxOf,
  centreOf,
  pressOn,
  touchFingers,
  touchSession,
  touchUp,
  viewportZoom,
} from './canvas.fixtures.js';
import {
  openModelDocument,
  selectNode,
  undoOffered,
} from './studio.fixtures.js';

const kioskModel = modelWith({
  elements: [
    boxAt('el-kiosk', 0, 0, 'actor', { width: 128, height: 64 }, 'Kiosk'),
  ],
});

const touchMouseDelayMs = 550;

const joinedResize = async (page: Page) => {
  const session = await touchSession(page);
  await openModelDocument(page, kioskModel);
  const node = await selectNode(page, /^Kiosk, actor/u);
  const before = await boxOf(node);
  const right = node.getByRole('button', {
    name: 'Resize Kiosk from right',
    exact: true,
  });
  const from = await pressOn(page, right);
  await page.mouse.move(from.x - 40, from.y, { steps: 4 });
  await expect
    .poll(async () => (await boxOf(node)).width)
    .not.toBe(before.width);
  await touchFingers(session, 'touchStart', [[1, await centreOf(right)]]);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  expect(await boxOf(node)).toEqual(before);
  expect(await node.locator('svg').first().getAttribute('width')).toBe(
    String(before.width),
  );
  await page.mouse.up();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      }),
  );
  expect(await undoOffered(page)).toBe(false);
  return { session, node, before };
};

test('a joined touch from a blurred resize cannot change a fresh resize on another control', async ({
  page,
}) => {
  const { session, node, before } = await joinedResize(page);
  const from = await pressOn(
    page,
    node.getByRole('button', { name: 'Resize Kiosk from left', exact: true }),
  );
  await page.mouse.move(from.x - 40, from.y, { steps: 4 });
  const fresh = await boxOf(node);
  expect(fresh.width).toBeGreaterThan(before.width);
  expect(await node.locator('svg').first().getAttribute('width')).toBe(
    String(fresh.width),
  );

  await touchUp(session);

  expect(await boxOf(node)).toEqual(fresh);
  expect(await node.locator('svg').first().getAttribute('width')).toBe(
    String(fresh.width),
  );
  await page.mouse.up();
  await session.detach();
  expect(await boxOf(node)).toEqual(fresh);
  expect(await node.locator('svg').first().getAttribute('width')).toBe(
    String(fresh.width),
  );
  expect(await undoOffered(page)).toBe(true);
});

test('a late joined touch release preserves the restored extent for a new mouse press', async ({
  page,
}) => {
  const { session, node, before } = await joinedResize(page);
  await touchUp(session);
  expect(await boxOf(node)).toEqual(before);
  expect(await node.locator('svg').first().getAttribute('width')).toBe(
    String(before.width),
  );
  expect(await undoOffered(page)).toBe(false);
  await page.waitForTimeout(touchMouseDelayMs);
  const from = await pressOn(
    page,
    node.getByRole('button', { name: 'Resize Kiosk from right', exact: true }),
  );
  const zoom = await viewportZoom(page);
  await page.mouse.move(from.x - 1, from.y);
  const moved = await boxOf(node);

  expect(moved.width).toBe(before.width + Math.floor(-1 / zoom));
  expect(moved.x).toBe(before.x);
  expect(moved.y).toBe(before.y);
  expect(moved.height).toBe(before.height);
  expect(await node.locator('svg').first().getAttribute('width')).toBe(
    String(moved.width),
  );
  await page.mouse.up();
  await session.detach();
  expect(await undoOffered(page)).toBe(true);
});
