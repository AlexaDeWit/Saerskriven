import { layoutDiagram } from '@saerskriven/canvas';
import { drawnAt } from '@saerskriven/model/fixtures';
import { expect, test } from '@playwright/test';
import { commandChord } from './chords.fixtures.js';
import {
  canvasSettled,
  emptyCanvasPoint,
  viewportZoom,
} from './canvas.fixtures.js';
import {
  allowClipboard,
  editAnnouncement,
  openFallback,
  placeholder,
  requiresClipboardApiRead,
  savedModel,
  selectByKeyboard,
} from './studio.fixtures.js';

test('paste centres a copied graph after pan and zoom and keeps its relative geometry', async ({
  page,
  context,
}) => {
  requiresClipboardApiRead(context);
  await allowClipboard(context);
  await openFallback(page);
  await selectByKeyboard(page, placeholder.records);
  await page.keyboard.press(await commandChord(page, 'ControlOrMeta+c'));
  await expect(editAnnouncement(page)).not.toBeEmpty();
  await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
  await page.keyboard.press('h');
  const at = await emptyCanvasPoint(page);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x + 200, at.y + 100, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.press('v');
  await canvasSettled(page);
  const before = await savedModel(page);
  const originalIds = new Set(before.elements.map((element) => element.id));
  const zoom = await viewportZoom(page);
  const target = await page.evaluate(() => {
    const canvas = document
      .querySelector('.react-flow')
      ?.getBoundingClientRect();
    const card = document
      .querySelector('[data-testid="chrome-card"]')
      ?.getBoundingClientRect();
    const viewport = document.querySelector('.react-flow__viewport');
    if (canvas === undefined || card === undefined || viewport === null) {
      throw new Error('Canvas is not mounted');
    }
    const transform = new DOMMatrix(getComputedStyle(viewport).transform);
    const top = Math.max(card.bottom - canvas.top + 32, 64);
    return {
      x: (canvas.width / 2 - transform.e) / transform.a,
      y: ((top + canvas.height - 64) / 2 - transform.f) / transform.d,
    };
  });
  await page.locator('.react-flow').focus();
  await page.keyboard.press(await commandChord(page, 'ControlOrMeta+v'));
  await expect(page.locator('.react-flow__node')).toHaveCount(4);
  const after = await savedModel(page);
  const diagram = after.diagrams[0];
  expect(diagram).toBeDefined();
  if (diagram === undefined) {
    return;
  }
  const copied = {
    ...diagram,
    placements: diagram.placements.filter(
      (placement) => !originalIds.has(placement.element),
    ),
  };
  const bounds = layoutDiagram(copied, after).bounds;
  expect(bounds.x + bounds.width / 2).toBeCloseTo(target.x, 2);
  expect(bounds.y + bounds.height / 2).toBeCloseTo(target.y, 2);
  const original = before.diagrams[0];
  if (original === undefined) {
    throw new Error('Original diagram is missing');
  }
  const originalNodes = layoutDiagram(original, before).nodes;
  const copiedNodes = layoutDiagram(copied, after).nodes;
  const [first, second] = originalNodes;
  const [copiedFirst, copiedSecond] = copiedNodes;
  expect(copiedNodes).toHaveLength(2);
  if (
    first === undefined ||
    second === undefined ||
    copiedFirst === undefined ||
    copiedSecond === undefined
  ) {
    throw new Error('Copied endpoints are missing');
  }
  expect(copiedSecond.position.x - copiedFirst.position.x).toBeCloseTo(
    second.position.x - first.position.x,
    2,
  );
  expect(copiedSecond.position.y - copiedFirst.position.y).toBeCloseTo(
    second.position.y - first.position.y,
    2,
  );
  expect(drawnAt(after)).toHaveLength(drawnAt(before).length * 2);
  expect(await viewportZoom(page)).toBe(zoom);
});
