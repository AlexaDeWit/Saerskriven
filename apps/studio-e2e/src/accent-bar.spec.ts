import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  accentClassNames,
  canvasClassNames,
  darkPalette,
  lightPalette,
  rgbColour,
} from '@saerskriven/canvas';
import { committedText } from '@saerskriven/model/fixtures';
import { audit } from './accessibility.fixtures.js';
import {
  boxesOverlap,
  halfwayAlong,
  lineOf,
  reachesAt,
  screenBoxOf,
} from './canvas.fixtures.js';
import { commandChord, registeredChords } from './chords.fixtures.js';
import {
  beforeCanvas,
  chromeCard,
  expandPane,
  nodeNamed,
  openModelDocument,
  openTwoDiagrams,
  selectByKeyboard,
  storefront,
  threatPanel,
  toolButton,
} from './studio.fixtures.js';

const swatchNames = [
  'No accent',
  'Strong accent 1',
  'Strong accent 2',
  'Strong accent 3',
  'Strong accent 4',
  'Light accent 1',
  'Light accent 2',
  'Light accent 3',
  'Light accent 4',
] as const;

const drawn = {
  strongActor: /^Strong 1, actor/u,
  lightActor: /^Light 1, actor/u,
  strongStore: /^Strong 3, store/u,
  strongFlow: /^Strong flow, flow/u,
  plainActor: /^No accent, actor/u,
  note: /^Note, text/u,
} as const;

const accentBar = (page: Page): Locator => page.getByTestId('accent-bar');

const swatch = (page: Page, name: (typeof swatchNames)[number]): Locator =>
  accentBar(page).getByRole('button', { name, exact: true });

const swatches = (page: Page): Locator => accentBar(page).getByRole('button');

const pressedSwatches = (page: Page): Locator =>
  accentBar(page).locator('button[aria-pressed="true"]');

const openAccents = (page: Page): Promise<void> =>
  openModelDocument(page, JSON.parse(committedText('accents.model.json')));

const shapeOf = (node: Locator): Locator =>
  node.locator(`.${canvasClassNames.shape}`).first();

const paintOf = (shape: Locator) =>
  shape.evaluate((element) => {
    const { fill, stroke, strokeWidth } = getComputedStyle(element);
    return { fill, stroke, weight: Number.parseFloat(strokeWidth) };
  });

const accentedGroups = (page: Page): Locator =>
  page.locator(
    `.${canvasClassNames.element}.${accentClassNames.slot1}.${accentClassNames.strong}`,
  );

const selectAll = async (page: Page): Promise<void> => {
  await page.keyboard.press(
    await commandChord(page, registeredChords['select-all'][0]),
  );
};

test(
  'the card holds the accent bar as its third row, inactive with nothing selected, each swatch as large as a tool and clear of the panel',
  { tag: '@phone' },
  async ({ page }) => {
    await openTwoDiagrams(page);

    const card = await screenBoxOf(chromeCard(page));
    const tools = await screenBoxOf(page.getByTestId('toolbox'));
    const bar = await screenBoxOf(accentBar(page));
    const viewport = page.viewportSize();
    expect(card.x).toBeGreaterThanOrEqual(0);
    expect(card.x + card.width).toBeLessThanOrEqual(viewport?.width ?? 0);
    expect(bar.y).toBeGreaterThanOrEqual(tools.y + tools.height);
    expect(bar.y + bar.height).toBeLessThanOrEqual(card.y + card.height);
    await expect(swatches(page)).toHaveCount(swatchNames.length);
    for (const name of swatchNames) {
      await expect(swatch(page, name)).toBeDisabled();
    }
    await expect(pressedSwatches(page)).toHaveCount(0);

    await selectByKeyboard(page, storefront.webShop);

    const tool = await screenBoxOf(toolButton(page, 'Hand'));
    for (const name of swatchNames) {
      await expect(swatch(page, name)).toBeEnabled();
    }
    for (const expanded of [false, true]) {
      if (expanded) {
        await expandPane(page);
      }
      const panel = await screenBoxOf(threatPanel(page));
      for (const name of swatchNames) {
        const control = swatch(page, name);
        const box = await screenBoxOf(control);
        expect(box.width).toBeGreaterThanOrEqual(tool.width);
        expect(box.height).toBeGreaterThanOrEqual(tool.height);
        expect(boxesOverlap(box, panel), `${name} is under the panel`).toBe(
          false,
        );
        expect(
          await reachesAt(control, {
            x: box.x + box.width / 2,
            y: box.y + box.height / 2,
          }),
          `${name} is covered or off screen`,
        ).toBe(true);
      }
    }
    await expect(pressedSwatches(page)).toHaveAccessibleName('No accent');
    await audit(page, 'the accent bar over a selection');
  },
);

test('one press gives the key to every selected element and flow, drawn in the slot, and one undo takes it back', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await openTwoDiagrams(page);
  const takers = page.locator(
    `.${canvasClassNames.element}:has(.${canvasClassNames.shape})`,
  );
  const drawnBefore = await takers.count();
  const process = nodeNamed(page, storefront.webShop);
  const plain = await paintOf(shapeOf(process));

  await selectByKeyboard(page, storefront.webShop);
  await selectAll(page);
  await swatch(page, 'Strong accent 1').click();

  await expect(accentedGroups(page)).toHaveCount(drawnBefore);
  await expect(pressedSwatches(page)).toHaveAccessibleName('Strong accent 1');
  const strong = await paintOf(shapeOf(process));
  expect(strong.stroke).toBe(rgbColour(darkPalette.slot1));
  expect(strong.fill).toBe(rgbColour(darkPalette.slot1Tint));
  expect(strong.weight).toBeGreaterThan(plain.weight);

  await swatch(page, 'Light accent 4').click();

  await expect(accentedGroups(page)).toHaveCount(0);
  const light = await paintOf(shapeOf(process));
  expect(light.stroke).toBe(rgbColour(darkPalette.slot4));
  expect(light.fill).toBe(plain.fill);
  expect(light.weight).toBe(plain.weight);

  await page.keyboard.press(await commandChord(page, registeredChords.undo[0]));
  await expect(accentedGroups(page)).toHaveCount(drawnBefore);
  await page.keyboard.press(await commandChord(page, registeredChords.undo[0]));
  await expect(accentedGroups(page)).toHaveCount(0);
  expect(await paintOf(shapeOf(process))).toEqual(plain);
});

test('the pressed swatch is the accent the selection holds, none where it is mixed, and a note alone leaves the row inactive', async ({
  page,
}) => {
  await openAccents(page);

  await selectByKeyboard(page, drawn.strongActor);
  await expect(pressedSwatches(page)).toHaveAccessibleName('Strong accent 1');

  await selectByKeyboard(page, drawn.plainActor);
  await expect(pressedSwatches(page)).toHaveAccessibleName('No accent');

  await selectAll(page);
  await expect(swatch(page, 'No accent')).toBeEnabled();
  await expect(pressedSwatches(page)).toHaveCount(0);

  await selectByKeyboard(page, drawn.note);
  await expect(swatch(page, 'No accent')).toBeDisabled();
  await expect(pressedSwatches(page)).toHaveCount(0);
});

test('the swatches follow the tools in the tab order while a selection holds, each showing its focus, and Enter applies one', async ({
  page,
}) => {
  await openAccents(page);
  const actor = await selectByKeyboard(page, drawn.plainActor);

  await beforeCanvas(page).focus();
  for (const name of swatchNames) {
    await page.keyboard.press('Tab');
    await expect(swatch(page, name)).toBeFocused();
    await expect(swatch(page, name)).toHaveCSS('outline-style', 'solid');
  }
  await page.keyboard.press('Enter');

  await expect(pressedSwatches(page)).toHaveAccessibleName('Light accent 4');
  await expect(actor.locator(`.${accentClassNames.slot4}`)).toHaveCount(1);
  await expect(swatch(page, 'Light accent 4')).toBeFocused();
});

test('a strong flow reads heavier under the pointer, and heavier again once it is selected', async ({
  page,
}) => {
  await openAccents(page);
  const flow = nodeNamed(page, drawn.strongFlow);
  const line = lineOf(page, drawn.strongFlow);
  const weightOf = async (): Promise<number> => (await paintOf(line)).weight;
  const rested = await weightOf();
  expect(rested).toBeGreaterThan(
    (await paintOf(lineOf(page, /^Light flow, flow/u))).weight,
  );

  const on = await halfwayAlong(line);
  await page.mouse.move(on.x, on.y);
  await expect.poll(weightOf).toBeGreaterThan(rested);
  const hovered = await weightOf();

  await page.mouse.click(on.x, on.y);
  await expect(flow).toHaveClass(/selected/u);
  await expect.poll(weightOf).toBeGreaterThan(hovered);
});

for (const scheme of ['light', 'dark'] as const) {
  test(`forced colours over the ${scheme} scheme draw no slot colour and no tint, and keep the strong weight`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme, forcedColors: 'active' });
    await openAccents(page);
    const palette = scheme === 'dark' ? darkPalette : lightPalette;
    const slotColours = new Set(
      [
        palette.slot1,
        palette.slot2,
        palette.slot3,
        palette.slot4,
        palette.slot1Tint,
        palette.slot2Tint,
        palette.slot3Tint,
        palette.slot4Tint,
      ].map(rgbColour),
    );
    const plain = await paintOf(shapeOf(nodeNamed(page, drawn.plainActor)));

    const strong = await paintOf(shapeOf(nodeNamed(page, drawn.strongActor)));
    const light = await paintOf(shapeOf(nodeNamed(page, drawn.lightActor)));
    const band = await paintOf(
      nodeNamed(page, drawn.strongStore).locator(
        `.${accentClassNames.storeBand}`,
      ),
    );
    const line = await paintOf(lineOf(page, drawn.strongFlow));

    expect(strong.stroke).toBe(plain.stroke);
    expect(strong.fill).toBe(plain.fill);
    expect(strong.weight).toBeGreaterThan(plain.weight);
    expect(light).toEqual(plain);
    expect(band.fill).toBe('none');
    expect(line.stroke).toBe(plain.stroke);
    expect(line.weight).toBeGreaterThan(plain.weight);
    for (const paint of [strong, light, line]) {
      expect(slotColours.has(paint.stroke)).toBe(false);
      expect(slotColours.has(paint.fill)).toBe(false);
    }
  });
}
