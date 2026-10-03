import { expect, test, type Locator, type Page } from '@playwright/test';
import { darkPalette, lightPalette, rgbColour } from '@saerskriven/canvas';
import { committedText } from '@saerskriven/model/fixtures';
import { canvasSettled, focusRingShown } from './canvas.fixtures.js';
import {
  beforeCanvas,
  nodeNamed,
  openModelDocument,
  tabTo,
  threatPanel,
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

const openEveryGlyph = async (page: Page): Promise<void> => {
  await openModelDocument(
    page,
    JSON.parse(committedText('every-glyph.model.json')),
  );
  await page.getByRole('button', { name: 'Reset zoom to 100%' }).click();
  await canvasSettled(page);
};

const selectWithThreatsClosed = async (
  page: Page,
  node: Locator,
): Promise<void> => {
  await tabTo(page, node);
  await page.keyboard.press('Enter');
  await expect(node).toHaveClass(/selected/u);
  await threatPanel(page)
    .getByRole('button', { name: 'Close threats', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await expect(threatPanel(page)).toHaveCount(0);
  await expect(node).toBeFocused();
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
      expect.soft(shown, kind).toBeGreaterThanOrEqual(least);
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
    await openEveryGlyph(page);

    await expectRingOnItems(page, rgbColour(palette.actionPrimary));
  });

  for (const [kind, name] of resized) {
    test(`every resize control on ${kind} shows the focus ring from the keyboard, ${scheme}`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await openEveryGlyph(page);
      const node = nodeNamed(page, name);
      await selectWithThreatsClosed(page, node);
      const controls = node.locator('.react-flow__resize-control > button');
      await expect(controls).toHaveCount(8);

      for (const control of await controls.all()) {
        const shown = await focusRingShown(
          control,
          beforeCanvas(page),
          async () => {
            await node.focus();
            for (
              let pressed = 0;
              pressed < 8 &&
              !(await control.evaluate(
                (element) => element === document.activeElement,
              ));
              pressed += 1
            ) {
              await page.keyboard.press('Tab');
            }
          },
        );
        expect
          .soft(shown, (await control.getAttribute('aria-label')) ?? undefined)
          .toBeGreaterThanOrEqual(shownOnAControl);
      }
    });
  }
}

test('the focus ring on every kind of canvas item survives forced colours', async ({
  page,
}) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await openEveryGlyph(page);

  await expectRingOnItems(page, undefined);
});
