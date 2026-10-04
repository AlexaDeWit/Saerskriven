import { expect, test, type Page } from '@playwright/test';
import type { Model } from '@saerskriven/model';
import { commandChord, registeredChords } from './chords.fixtures.js';
import { dragBy, pointHandles, viewportZoom } from './canvas.fixtures.js';
import {
  openTwoDiagrams,
  savedModel,
  selectByKeyboard,
  storefront,
  withoutPickers,
} from './studio.fixtures.js';

const warehouseFloor = /^Warehouse floor, trust boundary/u;

const point = (page: Page, number: number) =>
  page.getByRole('button', { name: `Point ${String(number)}`, exact: true });

const shapeNamed = (model: Model, name: string) =>
  model.diagrams
    .flatMap((diagram) => diagram.elements)
    .find(
      (element) => element.name === name && element.kind === 'trust-boundary',
    );

test('a trust boundary curve moves a point by arrow key and by dragging, and removes one, one undo step each', async ({
  page,
}) => {
  await page.addInitScript(withoutPickers);
  await openTwoDiagrams(page);
  await page.keyboard.press(registeredChords['next-diagram'][0]);
  await selectByKeyboard(page, warehouseFloor);
  await expect(pointHandles(page)).toHaveCount(3);
  await point(page, 2).focus();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Shift+ArrowLeft');
  const zoom = await viewportZoom(page);
  await dragBy(page, point(page, 1), { x: 0, y: 40 });
  await point(page, 3).focus();
  await page.keyboard.press('Delete');
  await expect(pointHandles(page)).toHaveCount(2);
  const boundary = shapeNamed(await savedModel(page), 'Warehouse floor');
  const waypoints =
    boundary?.kind === 'trust-boundary' && boundary.shape.kind === 'curve'
      ? boundary.shape.waypoints
      : [];
  expect(waypoints).toHaveLength(2);
  expect(waypoints[0]?.x).toBeCloseTo(0);
  expect(waypoints[0]?.y).toBeCloseTo(330 + 40 / zoom, 0);
  expect(waypoints[1]).toEqual({ x: 400, y: 395 });
  await page.keyboard.press(await commandChord(page, 'ControlOrMeta+z'));
  await expect(pointHandles(page)).toHaveCount(3);
});

test('a trust boundary switches between a box and a curve by its chord and its command, and saves each shape', async ({
  page,
}) => {
  await page.addInitScript(withoutPickers);
  await openTwoDiagrams(page);
  await selectByKeyboard(page, storefront.shopNetwork);
  await expect(pointHandles(page)).toHaveCount(0);
  await page.keyboard.press(registeredChords['toggle-boundary-shape'][0]);
  await expect(pointHandles(page)).toHaveCount(3);
  expect(shapeNamed(await savedModel(page), 'Shop network')).toMatchObject({
    shape: {
      kind: 'curve',
      waypoints: [
        { x: 300, y: 540 },
        { x: 580, y: 20 },
        { x: 860, y: 540 },
      ],
    },
  });
  const switchShape = page
    .getByRole('region', { name: 'Trust boundary' })
    .getByRole('button', { name: 'Switch boundary shape', exact: true });
  await expect(switchShape).toHaveAttribute('aria-keyshortcuts', 'Shift+B');
  await switchShape.click();
  await expect(pointHandles(page)).toHaveCount(0);
  expect(shapeNamed(await savedModel(page), 'Shop network')).toMatchObject({
    shape: {
      kind: 'box',
      position: { x: 300, y: 20 },
      size: { width: 560, height: 520 },
    },
  });
  await page.keyboard.press(await commandChord(page, 'ControlOrMeta+z'));
  await expect(pointHandles(page)).toHaveCount(3);
});
