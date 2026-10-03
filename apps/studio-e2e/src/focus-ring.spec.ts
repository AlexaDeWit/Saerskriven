import { expect, test, type Page } from '@playwright/test';
import { darkPalette, lightPalette, rgbColour } from '@saerskriven/canvas';
import { canvasSettled, focusRingShown } from './canvas.fixtures.js';
import {
  beforeCanvas,
  closeThreats,
  nodeNamed,
  openEveryGlyph,
  selectByKeyboard,
  tabTo,
} from './studio.fixtures.js';

const shownOnAnElement = 0.8;

const shownPastElementsAtItsEnds = 0.5;

const shownOnAControl = 0.9;

const items = [
  ['an actor', /^Customer\sbrowser, actor/u, shownOnAnElement],
  ['a process', /^Order API, process/u, shownOnAnElement],
  ['a store', /^Order database, store/u, shownOnAnElement],
  ['a note', /^Retention note, text/u, shownOnAnElement],
  [
    'a trust boundary box',
    /^Service perimeter, trust boundary/u,
    shownOnAnElement,
  ],
  ['a trust boundary curve', /^Edge zone, trust boundary/u, shownOnAnElement],
  ['a flow', /^Submit order, flow/u, shownPastElementsAtItsEnds],
] as const;

const resized = [
  ['an element', /^Customer\sbrowser, actor/u],
  ['a trust boundary box', /^Service perimeter, trust boundary/u],
  ['a trust boundary curve', /^Edge zone, trust boundary/u],
] as const;

const schemes = [
  ['light', lightPalette],
  ['dark', darkPalette],
] as const;

const openAtFullZoom = async (page: Page): Promise<void> => {
  await openEveryGlyph(page);
  await page.getByRole('button', { name: 'Reset zoom to 100%' }).click();
  await canvasSettled(page);
};

const expectShown = (shown: number, least: number, what: string): void => {
  test.info().annotations.push({
    type: 'focus ring shown',
    description: `${what}: ${shown.toFixed(3)} of at least ${String(least)}`,
  });
  expect.soft(shown, what).toBeGreaterThanOrEqual(least);
};

const expectRingOnItems = async (
  page: Page,
  colour: string | undefined,
): Promise<void> => {
  for (const [kind, name, least] of items) {
    await test.step(kind, async () => {
      const item = nodeNamed(page, name);
      const shown = await focusRingShown(item, beforeCanvas(page), () =>
        tabTo(page, item),
      );
      expectShown(shown, least, kind);
      if (colour !== undefined) {
        await expect(item).toHaveCSS('outline-color', colour);
      }
    });
  }
};

for (const [scheme, palette] of schemes) {
  test(`every kind of canvas item shows the focus ring over its own drawing from the keyboard, ${scheme}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await openAtFullZoom(page);

    await expectRingOnItems(page, rgbColour(palette.actionPrimary));
  });

  for (const [kind, name] of resized) {
    test(`every resize control on ${kind} shows the focus ring from the keyboard, ${scheme}`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await openAtFullZoom(page);
      const node = await selectByKeyboard(page, name);
      await closeThreats(page);
      await expect(node).toBeFocused();
      const controls = node.locator('.react-flow__resize-control > button');
      await expect(controls).toHaveCount(8);

      for (const control of await controls.all()) {
        const shown = await focusRingShown(control, beforeCanvas(page), () =>
          tabTo(page, control, node),
        );
        expectShown(
          shown,
          shownOnAControl,
          (await control.getAttribute('aria-label')) ?? kind,
        );
      }
    });
  }
}

test('the focus ring on every kind of canvas item survives forced colours', async ({
  page,
}) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await openAtFullZoom(page);

  await expectRingOnItems(page, undefined);
});
