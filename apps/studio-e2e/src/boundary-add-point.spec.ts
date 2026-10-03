import { expect, test, type Page } from '@playwright/test';
import type { Model, Point } from '@saerskriven/model';
import { registeredChords } from './chords.fixtures.js';
import {
  centreOf,
  dragBy,
  pointHandles,
  reachesAt,
  viewportZoom,
} from './canvas.fixtures.js';
import {
  openTwoDiagrams,
  savedModel,
  selectByKeyboard,
  withoutPickers,
} from './studio.fixtures.js';

const warehouseFloor = /^Warehouse floor, trust boundary/u;

const settledPoints = [
  { x: 0, y: 330 },
  { x: 420, y: 400 },
  { x: 860, y: 330 },
];

const point = (page: Page, number: number) =>
  page.getByRole('button', { name: `Point ${String(number)}`, exact: true });

const midpoint = (page: Page, segment: number) =>
  page.locator(`[data-curve-segment="${String(segment)}"]`);

const curveIn = (model: Model): readonly Point[] => {
  const boundary = model.diagrams
    .flatMap((diagram) => diagram.elements)
    .find((element) => element.name === 'Warehouse floor');
  return boundary?.kind === 'trust-boundary' && boundary.shape.kind === 'curve'
    ? boundary.shape.waypoints
    : [];
};

const undoneToSettled = async (page: Page): Promise<void> => {
  await page.keyboard.press(registeredChords.undo[0]);
  await expect(pointHandles(page)).toHaveCount(settledPoints.length);
  expect(curveIn(await savedModel(page))).toEqual(settledPoints);
};

test('a trust boundary curve takes a new point from a dragged midpoint handle and from Add point, one undo step each', async ({
  page,
}) => {
  await page.addInitScript(withoutPickers);
  await openTwoDiagrams(page);
  await page.keyboard.press(registeredChords['next-diagram'][0]);
  await selectByKeyboard(page, warehouseFloor);
  await expect(pointHandles(page)).toHaveCount(settledPoints.length);

  const pulled = midpoint(page, 0);
  expect(await reachesAt(pulled, await centreOf(pulled))).toBe(true);
  const zoom = await viewportZoom(page);
  await dragBy(page, pulled, { x: 0, y: 40 });
  await expect(pointHandles(page)).toHaveCount(settledPoints.length + 1);
  const dragged = curveIn(await savedModel(page));
  expect(dragged).toHaveLength(settledPoints.length + 1);
  expect([dragged[0], dragged[2], dragged[3]]).toEqual(settledPoints);
  expect(dragged[1]?.x).toBeCloseTo(208.6, 0);
  expect(dragged[1]?.y).toBeCloseTo(374.6 + 40 / zoom, 0);
  await undoneToSettled(page);

  await point(page, 2).focus();
  await page.keyboard.press('Enter');
  const add = page
    .getByRole('group', { name: 'Point actions' })
    .getByRole('button', { name: 'Add point', exact: true });
  await page.keyboard.press('Tab');
  await expect(add).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(pointHandles(page)).toHaveCount(settledPoints.length + 1);
  await expect(point(page, 3)).toBeFocused();
  const added = curveIn(await savedModel(page));
  expect([added[0], added[1], added[3]]).toEqual(settledPoints);
  expect(added[2]?.x).toBeCloseTo(641.3, 1);
  expect(added[2]?.y).toBeCloseTo(374.1, 1);
  await undoneToSettled(page);
});
