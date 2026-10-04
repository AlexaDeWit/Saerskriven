import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  boxOf,
  boxSelect,
  canvasSettled,
  dragBy,
  drawnBy,
  elementNodes,
  lineOf,
  screenBoxOf,
  turnsOf,
  type Point,
} from './canvas.fixtures.js';
import {
  editAnnouncement,
  nodeNamed,
  openPlaceholder,
  openTwoDiagrams,
  placeholder,
  runFromMenu,
  selectByKeyboard,
  selectNode,
  storefront,
  threatPanel,
} from './studio.fixtures.js';

const placeholderNodes = (page: Page) => [
  nodeNamed(page, placeholder.actor),
  nodeNamed(page, placeholder.store),
];

const paidOrder = /^record the paid order, flow/u;

const shopNetworkGroup = (page: Page): Locator[] =>
  [
    storefront.shopNetwork,
    storefront.webShop,
    storefront.catalogue,
    storefront.ledger,
  ].map((name) => nodeNamed(page, name));

const emptyCanvasIn = async (
  page: Page,
  node: Locator,
  across: number,
  down: number,
): Promise<Point> => {
  const box = await screenBoxOf(node, 'the node');
  const at = { x: box.x + box.width * across, y: box.y + box.height * down };
  const onPane = await page.evaluate(
    ({ x, y }) =>
      document.elementFromPoint(x, y)?.matches('.react-flow__pane') ?? false,
    at,
  );
  expect(onPane, 'the point is empty canvas').toBe(true);
  return at;
};

const dragFrom = async (page: Page, at: Point, by: Point): Promise<void> => {
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x + by.x, at.y + by.y, { steps: 8 });
  await page.mouse.up();
};

test('a background drag selects every element wholly inside its box', async ({
  page,
}) => {
  await openPlaceholder(page);
  const [actor, store] = placeholderNodes(page);

  await boxSelect(page, [actor, store]);

  await expect(actor).toHaveClass(/selected/u);
  await expect(store).toHaveClass(/selected/u);
  await expect(page.locator('.react-flow__edge.selected')).toHaveCount(1);
  await expect(threatPanel(page)).toContainText('3 elements selected');
  await expect(
    threatPanel(page).getByRole('button', { name: 'Add a threat' }),
  ).toHaveCount(0);
});

test('a box around one node leaves its attached flow out', async ({ page }) => {
  await openPlaceholder(page);
  const [actor, store] = placeholderNodes(page);

  await boxSelect(page, [actor]);

  await expect(actor).toHaveClass(/selected/u);
  await expect(store).not.toHaveClass(/selected/u);
  await expect(page.locator('.react-flow__edge.selected')).toHaveCount(0);
});

test('Shift-click and Shift+Enter extend and trim the selection', async ({
  page,
}) => {
  await openPlaceholder(page);
  const [actor, store] = placeholderNodes(page);
  const flow = nodeNamed(page, placeholder.records);

  await actor.click();
  await store.click({ modifiers: ['Shift'] });
  await expect(actor).toHaveClass(/selected/u);
  await expect(store).toHaveClass(/selected/u);

  await store.click({ modifiers: ['Shift'] });
  await expect(store).not.toHaveClass(/selected/u);

  await store.focus();
  await page.keyboard.press('Shift+Enter');
  await expect(actor).toHaveClass(/selected/u);
  await expect(store).toHaveClass(/selected/u);

  await page.keyboard.press('ControlOrMeta+a');
  await expect(elementNodes(page)).toHaveCount(2);
  await expect(page.locator('.react-flow__node.selected')).toHaveCount(2);
  await expect(page.locator('.react-flow__edge.selected')).toHaveCount(1);
  await expect(threatPanel(page)).toContainText('3 elements selected');
  await flow.focus();
  await page.keyboard.press('Shift+Enter');
  await expect(flow).not.toHaveClass(/selected/u);
  await page.keyboard.press('Shift+Enter');
  await expect(flow).toHaveClass(/selected/u);
});

test('a plain click or Enter reduces a group to that element', async ({
  page,
}) => {
  await openPlaceholder(page);
  const [actor, store] = placeholderNodes(page);
  await boxSelect(page, [actor, store]);

  await actor.click();

  await expect(actor).toHaveClass(/selected/u);
  await expect(store).not.toHaveClass(/selected/u);
  await expect(
    threatPanel(page).getByRole('heading', { name: 'Actor', exact: true }),
  ).toBeVisible();

  await page.keyboard.press('ControlOrMeta+a');
  const flow = nodeNamed(page, placeholder.records);
  await flow.focus();
  await page.keyboard.press('Enter');

  await expect(flow).toHaveClass(/selected/u);
  await expect(actor).not.toHaveClass(/selected/u);
  await expect(store).not.toHaveClass(/selected/u);
  await expect(page.locator('.react-flow__edge.selected')).toHaveCount(1);
});

test('dragging a multi-selection moves it by one offset and undo restores it', async ({
  page,
}) => {
  await openPlaceholder(page);
  const [actor, store] = placeholderNodes(page);
  const flow = lineOf(page, placeholder.records);
  await page.keyboard.press('ControlOrMeta+a');
  const actorBefore = await boxOf(actor);
  const storeBefore = await boxOf(store);
  const flowBefore = await drawnBy(flow);

  await dragBy(page, actor, 60);

  await expect.poll(async () => (await boxOf(actor)).x).not.toBe(actorBefore.x);
  const actorAfter = await boxOf(actor);
  const storeAfter = await boxOf(store);
  expect(actorAfter.x - actorBefore.x).toBe(storeAfter.x - storeBefore.x);
  expect(actorAfter.y - actorBefore.y).toBe(storeAfter.y - storeBefore.y);
  expect(await drawnBy(flow)).not.toBe(flowBefore);
  await expect(page.locator('.react-flow__edge.selected')).toHaveCount(1);

  await runFromMenu(page, 'Undo');

  await expect.poll(() => boxOf(actor)).toEqual(actorBefore);
  await expect.poll(() => boxOf(store)).toEqual(storeBefore);
  await expect.poll(() => drawnBy(flow)).toBe(flowBefore);
});

test('a selected free flow moves by the group offset and undo restores it', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  const gateway = await selectNode(page, /^Payment\sgateway, process/u);
  const callback = nodeNamed(page, /^card network callback, flow/u);
  const line = lineOf(page, /^card network callback, flow/u);
  await callback.focus();
  await page.keyboard.press('Shift+Enter');
  await expect(callback).toHaveClass(/selected/u);
  await canvasSettled(page);
  const gatewayBefore = await gateway.boundingBox();
  const lineBefore = await line.boundingBox();
  const drawnBefore = await drawnBy(line);
  expect(gatewayBefore).not.toBeNull();
  expect(lineBefore).not.toBeNull();

  const gatewayModel = await boxOf(gateway);

  await dragBy(page, gateway, 60);

  await expect
    .poll(async () => (await boxOf(gateway)).x)
    .not.toBe(gatewayModel.x);
  const gatewayAfter = await gateway.boundingBox();
  const lineAfter = await line.boundingBox();
  expect(gatewayAfter).not.toBeNull();
  expect(lineAfter).not.toBeNull();
  expect((lineAfter?.width ?? 0) - (lineBefore?.width ?? 0)).toBeCloseTo(0);
  expect((lineAfter?.height ?? 0) - (lineBefore?.height ?? 0)).toBeCloseTo(0);
  expect((lineAfter?.x ?? 0) - (lineBefore?.x ?? 0)).toBeCloseTo(
    (gatewayAfter?.x ?? 0) - (gatewayBefore?.x ?? 0),
  );
  expect((lineAfter?.y ?? 0) - (lineBefore?.y ?? 0)).toBeCloseTo(
    (gatewayAfter?.y ?? 0) - (gatewayBefore?.y ?? 0),
  );

  await runFromMenu(page, 'Undo');

  await expect.poll(() => gateway.boundingBox()).toEqual(gatewayBefore);
  await expect.poll(() => drawnBy(line)).toBe(drawnBefore);
});

test('Delete removes a multi-selection with one cascade announcement', async ({
  page,
}) => {
  await openPlaceholder(page);
  const [actor, store] = placeholderNodes(page);
  await boxSelect(page, [actor, store]);

  await page.keyboard.press('Delete');

  await expect(elementNodes(page)).toHaveCount(0);
  await expect(page.locator('.react-flow__edge')).toHaveCount(0);
  const said = editAnnouncement(page);
  await expect(said).not.toBeEmpty();
  await expect(said).toHaveText(/\b3\b/u);
  await expect(said).toHaveText(/\b1\b/u);
  await expect(said.locator('span')).toHaveCount(1);
});

test('a drag from empty space inside a selected boundary moves the group by one offset and undo restores it', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  const group = shopNetworkGroup(page);
  const [boundary] = group;
  const shopper = nodeNamed(page, storefront.shopper);
  const line = lineOf(page, paidOrder);
  await boxSelect(page, [boundary]);
  for (const node of group) {
    await expect(node).toHaveClass(/selected/u);
  }
  await expect(nodeNamed(page, paidOrder)).toHaveClass(/selected/u);
  const before = await Promise.all(group.map(boxOf));
  const shopperBefore = await boxOf(shopper);
  const drawnBefore = await drawnBy(line);

  await dragFrom(page, await emptyCanvasIn(page, boundary, 0.1, 0.9), {
    x: 60,
    y: 40,
  });

  await expect
    .poll(async () => (await boxOf(boundary)).x)
    .not.toBe(before[0].x);
  await expect.poll(() => drawnBy(line)).not.toBe(drawnBefore);
  const after = await Promise.all(group.map(boxOf));
  const offset = { x: after[0].x - before[0].x, y: after[0].y - before[0].y };
  expect(offset.x).toBeGreaterThan(0);
  expect(offset.y).toBeGreaterThan(0);
  after.forEach((box, index) => {
    expect(box.x - before[index].x).toBeCloseTo(offset.x);
    expect(box.y - before[index].y).toBeCloseTo(offset.y);
  });
  const turnsBefore = turnsOf(drawnBefore);
  turnsOf(await drawnBy(line)).forEach((turn, index) => {
    expect(turn.x - turnsBefore[index].x).toBeCloseTo(offset.x);
    expect(turn.y - turnsBefore[index].y).toBeCloseTo(offset.y);
  });
  expect(await boxOf(shopper)).toEqual(shopperBefore);
  for (const node of group) {
    await expect(node).toHaveClass(/selected/u);
  }

  await runFromMenu(page, 'Undo');

  for (const [index, node] of group.entries()) {
    await expect.poll(() => boxOf(node)).toEqual(before[index]);
  }
  await expect.poll(() => drawnBy(line)).toBe(drawnBefore);
});

test('inside a selected group a still click clears it, and outside a drag draws a box', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  const [boundary] = shopNetworkGroup(page);
  const selected = page.locator(
    '.react-flow__node.selected, .react-flow__edge.selected',
  );
  await boxSelect(page, [boundary]);
  const placed = await boxOf(boundary);

  const inside = await emptyCanvasIn(page, boundary, 0.1, 0.9);
  await page.mouse.click(inside.x, inside.y);

  await expect(selected).toHaveCount(0);
  await boxSelect(page, [boundary]);
  const outside = await emptyCanvasIn(page, boundary, -0.15, 0.1);
  await page.mouse.move(outside.x, outside.y);
  await page.mouse.down();
  await page.mouse.move(outside.x + 40, outside.y + 40, { steps: 6 });
  await expect(page.locator('.react-flow__selection')).toBeVisible();
  await page.mouse.up();

  await expect(selected).toHaveCount(0);
  expect(await boxOf(boundary)).toEqual(placed);
});

test('a boundary selected alone drags from its interior and from an element inside it, which a click selects', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  const boundary = await selectByKeyboard(page, storefront.shopNetwork);
  const webShop = nodeNamed(page, storefront.webShop);
  const boundaryBefore = await boxOf(boundary);
  const webShopBefore = await boxOf(webShop);

  await dragFrom(page, await emptyCanvasIn(page, boundary, 0.1, 0.9), {
    x: 50,
    y: 0,
  });

  await expect
    .poll(async () => (await boxOf(boundary)).x)
    .toBeGreaterThan(boundaryBefore.x);
  const moved = await boxOf(boundary);
  await canvasSettled(page);
  await dragBy(page, webShop, { x: 50, y: 0 });
  await expect
    .poll(async () => (await boxOf(boundary)).x)
    .toBeGreaterThan(moved.x);
  expect(await boxOf(webShop)).toEqual(webShopBefore);
  await expect(webShop).not.toHaveClass(/selected/u);

  await webShop.click();

  await expect(webShop).toHaveClass(/selected/u);
  await expect(boundary).not.toHaveClass(/selected/u);
});
