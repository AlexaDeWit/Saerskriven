import { expect, test, type Page } from '@playwright/test';
import type { Model, Point } from '@saerskriven/model';
import { registeredChords } from './chords.fixtures.js';
import {
  boxOf,
  centreOf,
  dragBy,
  reachesAt,
  viewportZoom,
} from './canvas.fixtures.js';
import { openFile, savedModel, selectByKeyboard } from './studio.fixtures.js';

const recordsOffice = /^Records office, trust boundary/u;

const settledPoints = [
  { x: 0, y: 300 },
  { x: 200, y: 340 },
  { x: 400, y: 300 },
];

const pointerRounding = 1;

const curveIn = (model: Model) => {
  const boundary = model.diagrams
    .flatMap((diagram) => diagram.elements)
    .find((element) => element.id === 'boundary-records');
  return {
    name: boundary?.name,
    points:
      boundary?.kind === 'trust-boundary' && boundary.shape.kind === 'curve'
        ? boundary.shape.waypoints
        : [],
    threatened: model.threats
      .filter((threat) => threat.id === 'threat-non-compliance')
      .flatMap((threat) => threat.elements),
  };
};

const expectNear = (actual: Point | undefined, expected: Point): void => {
  expect(Math.abs((actual?.x ?? Number.NaN) - expected.x)).toBeLessThanOrEqual(
    pointerRounding,
  );
  expect(Math.abs((actual?.y ?? Number.NaN) - expected.y)).toBeLessThanOrEqual(
    pointerRounding,
  );
};

const undoneToSettled = async (page: Page): Promise<void> => {
  await page.keyboard.press(registeredChords.undo[0]);
  expect(curveIn(await savedModel(page)).points).toEqual(settledPoints);
};

test('a trust boundary curve scales from a corner and from Position and size, keeping its name and threats, one undo step each', async ({
  page,
}) => {
  await openFile(page, 'saerskriven/feature-complete.yaml');
  await page.keyboard.press(registeredChords['next-diagram'][0]);
  const boundary = await selectByKeyboard(page, recordsOffice);
  const corner = boundary.getByRole('button', {
    name: 'Resize Records office from top left corner',
    exact: true,
  });
  const firstPoint = page.getByRole('button', { name: 'Point 1', exact: true });
  for (const control of [corner, firstPoint]) {
    expect(await reachesAt(control, await centreOf(control))).toBe(true);
  }

  const before = await boxOf(boundary);
  const zoom = await viewportZoom(page);
  await dragBy(page, corner.locator('..'), { x: -40, y: -30 });
  await expect.poll(async () => (await boxOf(boundary)).x).not.toBe(before.x);
  const dragged = curveIn(await savedModel(page));
  expect(dragged.name).toBe('Records office');
  expect(dragged.threatened).toContain('boundary-records');
  expect(dragged.points).toHaveLength(3);
  expectNear(dragged.points[0], { x: -40 / zoom, y: 300 - 30 / zoom });
  expect(dragged.points[1]?.y).toBeCloseTo(340);
  expect(dragged.points[2]?.x).toBeCloseTo(400);
  await undoneToSettled(page);

  await boundary.focus();
  await page.keyboard.press(registeredChords['edit-geometry'][0]);
  const geometry = page.getByRole('region', { name: 'Position and size' });
  const width = geometry.getByRole('spinbutton', {
    name: 'Width',
    exact: true,
  });
  await expect(width).toHaveValue(String(before.width));
  await width.fill(String(before.width + 400));
  await geometry.getByRole('button', { name: 'Apply geometry' }).click();
  const formed = curveIn(await savedModel(page));
  expect(formed).toEqual({
    name: 'Records office',
    points: [
      { x: 0, y: 300 },
      { x: 400, y: 340 },
      { x: 800, y: 300 },
    ],
    threatened: ['boundary-records'],
  });
  await undoneToSettled(page);
});
