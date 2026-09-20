import { expect, test, type Page } from '@playwright/test';
import {
  canvasSettled,
  emptyCanvasPoint,
  type Point,
  screenBoxOf,
  touchDrag,
  touchSession,
  viewportTransform,
  viewportZoom,
} from './canvas.fixtures.js';
import {
  canvasSurface,
  nodeNamed,
  openPlaceholder,
  placeholder,
  toolButton,
} from './studio.fixtures.js';
import { registeredChords } from './chords.fixtures.js';

const movedPoint = (page: Page, from: Point): Point => {
  const width = page.viewportSize()?.width ?? 0;
  return {
    x: from.x + (from.x < width / 2 ? 100 : -100),
    y: from.y + 60,
  };
};

const anchorSlack = 2;

test('scroll zooms around the pointer while a modified scroll keeps pinch zoom', async ({
  page,
}) => {
  await openPlaceholder(page);
  const actor = nodeNamed(page, placeholder.actor);
  await actor.click();
  await canvasSettled(page);
  const at = await emptyCanvasPoint(page);
  const before = await screenBoxOf(actor, 'the actor');
  const zoom = await viewportZoom(page);

  await page.mouse.move(at.x, at.y);
  await page.mouse.wheel(0, 200);
  await canvasSettled(page);

  const zoomedOut = await viewportZoom(page);
  expect(zoomedOut).toBeLessThan(zoom);
  const after = await screenBoxOf(actor, 'the actor');
  const scaled = after.width / before.width;
  expect(scaled).toBeLessThan(1);
  expect(Math.abs(after.x - (at.x + (before.x - at.x) * scaled))).toBeLessThan(
    anchorSlack,
  );
  expect(Math.abs(after.y - (at.y + (before.y - at.y) * scaled))).toBeLessThan(
    anchorSlack,
  );
  await expect(actor).toHaveClass(/selected/u);

  await page.mouse.move(at.x, at.y);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -100);
  await page.keyboard.up('Control');

  await expect.poll(() => viewportZoom(page)).toBeGreaterThan(zoomedOut);
});

test('middle-button dragging pans without zooming or clearing selection', async ({
  page,
}) => {
  await openPlaceholder(page);
  const actor = nodeNamed(page, placeholder.actor);
  await actor.click();
  const from = await emptyCanvasPoint(page);
  const to = movedPoint(page, from);
  const before = await viewportTransform(page);
  const zoom = await viewportZoom(page);

  await page.mouse.move(from.x, from.y);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up({ button: 'middle' });

  await expect.poll(() => viewportTransform(page)).not.toBe(before);
  expect(await viewportZoom(page)).toBe(zoom);
  await expect(actor).toHaveClass(/selected/u);
});

test('a touch drag pans without becoming a selection click', async ({
  page,
}) => {
  const session = await touchSession(page);
  await openPlaceholder(page);
  const actor = nodeNamed(page, placeholder.actor);
  await actor.click();
  const from = await emptyCanvasPoint(page);
  const before = await viewportTransform(page);

  await touchDrag(session, from, movedPoint(page, from));

  await expect.poll(() => viewportTransform(page)).not.toBe(before);
  await expect(actor).toHaveClass(/selected/u);
  await session.detach();
});

const notePlacements = ['click', 'drag', 'touch', 'keyboard'] as const;

for (const placement of notePlacements) {
  test(`a ${placement} placement opens the new Note for typing`, async ({
    page,
  }) => {
    await openPlaceholder(page);
    const from = await emptyCanvasPoint(page);

    if (placement === 'keyboard') {
      await canvasSurface(page).focus();
      await page.keyboard.press(registeredChords['note-tool'][0]);
      await page.keyboard.press('Enter');
    } else {
      await toolButton(page, 'Note').click();
      if (placement === 'touch') {
        const session = await touchSession(page);
        const before = await viewportTransform(page);
        await touchDrag(session, from, movedPoint(page, from));
        await canvasSettled(page);
        expect(await viewportTransform(page)).toBe(before);
        await session.detach();
      } else if (placement === 'click') {
        await page.mouse.click(from.x, from.y);
      } else {
        const to = movedPoint(page, from);
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(to.x, to.y, { steps: 6 });
        await page.mouse.up();
      }
    }

    const editor = page.getByRole('textbox', { name: 'Note text' });
    await expect(editor).toBeFocused();
    await editor.fill('First line\nSecond line');
    await editor.press('Control+Enter');
    const note = nodeNamed(page, /^Note, text/u);
    const drawnText = async (): Promise<string> =>
      (await note.locator('text.pn-note tspan').allTextContents())
        .join('')
        .replace(/\s/gu, '');
    await expect.poll(drawnText).toBe('FirstlineSecondline');

    await page.keyboard.press(registeredChords.undo[0]);
    await expect.poll(drawnText).toBe('Newnote');
    await page.keyboard.press(registeredChords.undo[0]);
    await expect(note).toHaveCount(0);
  });
}
