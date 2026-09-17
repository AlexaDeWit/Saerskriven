import { expect, test, type Page } from '@playwright/test';
import {
  boxOf,
  boxSelect,
  canvasSettled,
  dragBy,
  drawnBy,
  elementNodes,
  lineOf,
} from './canvas.fixtures.js';
import {
  editAnnouncement,
  nodeNamed,
  openPlaceholder,
  openTwoDiagrams,
  placeholder,
  runFromMenu,
  selectNode,
  threatPanel,
} from './studio.fixtures.js';

const placeholderNodes = (page: Page) => [
  nodeNamed(page, placeholder.actor),
  nodeNamed(page, placeholder.store),
];

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
  await expect(threatPanel(page)).toContainText('Threats on Actor');

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
  await expect(said.locator('p')).toHaveCount(1);
});
