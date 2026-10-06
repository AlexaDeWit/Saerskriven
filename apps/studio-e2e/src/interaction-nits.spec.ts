import { expect, test, type Page } from '@playwright/test';
import { canvasClassNames } from '@saerskriven/canvas';
import {
  canvasSettled,
  centreOf,
  emptyCanvasPoint,
  type Point,
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
import { commandChord, registeredChords } from './chords.fixtures.js';

const movedPoint = (page: Page, from: Point): Point => {
  const width = page.viewportSize()?.width ?? 0;
  return {
    x: from.x + (from.x < width / 2 ? 100 : -100),
    y: from.y + 60,
  };
};

test('scroll pans while a modified scroll keeps pinch zoom', async ({
  page,
}) => {
  await openPlaceholder(page);
  const actor = nodeNamed(page, placeholder.actor);
  await actor.click();
  const at = await emptyCanvasPoint(page);
  await page.mouse.move(at.x, at.y);
  const beforePan = await viewportTransform(page);
  const zoom = await viewportZoom(page);

  await page.mouse.wheel(80, 50);

  await expect.poll(() => viewportTransform(page)).not.toBe(beforePan);
  expect(await viewportZoom(page)).toBe(zoom);
  await expect(actor).toHaveClass(/selected/u);

  await page.keyboard.down('Control');
  await page.mouse.wheel(0, 100);
  await page.keyboard.up('Control');

  await expect.poll(() => viewportZoom(page)).not.toBe(zoom);
});

test.describe('on macOS', () => {
  test.use({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  });

  test('holding Control during scroll momentum switches to zoom', async ({
    page,
  }) => {
    await openPlaceholder(page);
    const at = await emptyCanvasPoint(page);
    await page.mouse.move(at.x, at.y);
    const zoom = await viewportZoom(page);
    const start = await viewportTransform(page);

    await page.mouse.wheel(0, 60);
    await page.mouse.wheel(0, 60);
    await expect.poll(() => viewportTransform(page)).not.toBe(start);
    expect(await viewportZoom(page)).toBe(zoom);
    const actor = nodeNamed(page, placeholder.actor);
    const before = await centreOf(actor);

    await page.keyboard.down('Control');
    await page.evaluate(
      async ({ x, y }) => {
        const pane = document.querySelector('.react-flow__pane');
        for (let tick = 0; tick < 5; tick += 1) {
          pane?.dispatchEvent(
            new WheelEvent('wheel', {
              deltaY: 30,
              ctrlKey: false,
              bubbles: true,
              cancelable: true,
              clientX: x,
              clientY: y,
            }),
          );
          await new Promise((resolve) => setTimeout(resolve, 16));
        }
      },
      { x: at.x, y: at.y },
    );
    await expect.poll(() => viewportZoom(page)).not.toBe(zoom);
    await page.keyboard.up('Control');
    await canvasSettled(page);

    const zoomed = await viewportZoom(page);
    const after = await centreOf(actor);
    expect(after.x - at.x).toBeCloseTo(((before.x - at.x) * zoomed) / zoom, 0);
    expect(after.y - at.y).toBeCloseTo(((before.y - at.y) * zoomed) / zoom, 0);
    const panned = await viewportTransform(page);
    await page.mouse.wheel(0, 60);
    await expect.poll(() => viewportTransform(page)).not.toBe(panned);
    expect(await viewportZoom(page)).toBe(zoomed);
  });
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
    await editor.press(await commandChord(page, 'ControlOrMeta+Enter'));
    const note = nodeNamed(page, /^Note, text/u);
    const drawnText = async (): Promise<string> =>
      (
        await note
          .locator(`text.${canvasClassNames.note} tspan`)
          .allTextContents()
      )
        .join('')
        .replace(/\s/gu, '');
    await expect.poll(drawnText).toBe('FirstlineSecondline');

    await page.keyboard.press(
      await commandChord(page, registeredChords.undo[0]),
    );
    await expect.poll(drawnText).toBe('Newnote');
    await page.keyboard.press(
      await commandChord(page, registeredChords.undo[0]),
    );
    await expect(note).toHaveCount(0);
  });
}
