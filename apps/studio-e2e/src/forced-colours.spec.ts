import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  canvasClassNames,
  gridSpacing,
  severityToneClass,
} from '@saerskriven/canvas';
import {
  boxOf,
  boxSelect,
  canvasContainer,
  canvasSettled,
  dragBy,
  emptyCanvasPoint,
  filterBoxOf,
  flowBlockOf,
  screenBoxOf,
  screenshotPixels,
  type Point,
  type Box,
} from './canvas.fixtures.js';
import {
  beforeCanvas,
  closeThreats,
  nameField,
  nodeNamed,
  openEveryGlyph,
  openMenu,
  selectByKeyboard,
  tabTo,
  threatPanel,
  toolButton,
} from './studio.fixtures.js';
import { commandChord } from './chords.fixtures.js';

const actorName = /^Customer\sbrowser, actor/u;
const flowName = /^Submit order, flow/u;

const systemColours = (page: Page) =>
  page.evaluate(() => {
    const probe = document.createElement('span');
    probe.style.forcedColorAdjust = 'none';
    document.body.append(probe);
    const read = (name: 'Canvas' | 'CanvasText' | 'Highlight'): string => {
      probe.style.color = name;
      return getComputedStyle(probe).color;
    };
    const colours = {
      Canvas: read('Canvas'),
      CanvasText: read('CanvasText'),
      Highlight: read('Highlight'),
    };
    probe.remove();
    return colours;
  });

const paintedPixels = async (
  page: Page,
  png: Buffer,
  colour: string,
  tolerance = 40,
  mask?: readonly boolean[],
): Promise<number> =>
  page.evaluate(
    ({ pixels, ink, background, tolerance: allowed, mask: included }) => {
      const components = (ink.match(/[\d.]+/gu) ?? []).map(Number);
      const ground = (background.match(/\d+/gu) ?? []).map(Number);
      const alpha = components[3] ?? 1;
      const channels = components
        .slice(0, 3)
        .map((channel, index) =>
          Math.round(channel * alpha + (ground[index] ?? 0) * (1 - alpha)),
        );
      let matching = 0;
      for (let at = 0; at < pixels.data.length; at += 4) {
        if (included !== undefined && !included[at / 4]) {
          continue;
        }
        if (
          channels.every(
            (channel, index) =>
              Math.abs((pixels.data[at + index] ?? 0) - channel) <= allowed,
          )
        ) {
          matching += 1;
        }
      }
      return matching;
    },
    {
      pixels: await screenshotPixels(page, png),
      ink: colour,
      background: (await systemColours(page)).Canvas,
      tolerance,
      mask,
    },
  );

const arrowMask = (target: Locator, clip: Box): Promise<readonly boolean[]> =>
  target.evaluate(
    (arrow, { crop, flowClass }) => {
      if (!(arrow instanceof SVGGeometryElement)) {
        return [];
      }
      const toArrow = (arrow.getScreenCTM() ?? new DOMMatrix()).inverse();
      const line = arrow.parentElement?.querySelector(`path.${flowClass}`);
      const toLine =
        line instanceof SVGGeometryElement
          ? (line.getScreenCTM() ?? new DOMMatrix()).inverse()
          : undefined;
      return Array.from({ length: crop.width * crop.height }, (_, pixel) => {
        const point = new DOMPoint(
          crop.x + (pixel % crop.width) + 0.5,
          crop.y + Math.floor(pixel / crop.width) + 0.5,
        );
        const inside = [-1, 0, 1].every((dx) =>
          [-1, 0, 1].every((dy) =>
            arrow.isPointInFill(
              new DOMPoint(point.x + dx, point.y + dy).matrixTransform(toArrow),
            ),
          ),
        );
        return (
          inside &&
          !(
            line instanceof SVGGeometryElement &&
            toLine !== undefined &&
            line.isPointInStroke(point.matrixTransform(toLine))
          )
        );
      });
    },
    { crop: clip, flowClass: canvasClassNames.flow },
  );

const expectPaint = async (
  target: Locator,
  colour: string,
  {
    interior = false,
    arrowFill = false,
    bounds,
  }: {
    readonly interior?: boolean;
    readonly arrowFill?: boolean;
    readonly bounds?: Box;
  } = {},
): Promise<void> => {
  const box = bounds ?? (await screenBoxOf(target));
  const page = target.page();
  const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
  const x = Math.max(0, Math.floor(box.x + (interior ? box.width / 4 : -2)));
  const y = Math.max(0, Math.floor(box.y + (interior ? box.height / 4 : -2)));
  const clip = {
    x,
    y,
    width: Math.min(
      viewport.width - x,
      Math.ceil(interior ? box.width / 2 : box.width + 4),
    ),
    height: Math.min(
      viewport.height - y,
      Math.ceil(interior ? box.height / 2 : box.height + 4),
    ),
  };
  const mask = arrowFill ? await arrowMask(target, clip) : undefined;
  const png = await page.screenshot({ clip, scale: 'css' });
  expect(
    await paintedPixels(page, png, colour, interior ? 0 : 40, mask),
  ).toBeGreaterThan(2);
};

const capture = async (
  page: Page,
  name: string,
  clearHover = true,
): Promise<void> => {
  await canvasSettled(page);
  if (clearHover) {
    await beforeCanvas(page).hover();
  }
  await test.info().attach(name, {
    body: await canvasContainer(page).screenshot({ scale: 'css' }),
    contentType: 'image/png',
  });
};

for (const scheme of ['light', 'dark'] as const) {
  for (const appearance of ['system', 'light', 'dark'] as const) {
    test(`system paint survives ${scheme} contrast with ${appearance} Appearance`, async ({
      page,
    }) => {
      await page.emulateMedia({ forcedColors: 'active', colorScheme: scheme });
      await page.addInitScript((mode) => {
        localStorage.setItem('saerskrivenColourMode', mode);
      }, appearance);
      await openEveryGlyph(page);
      const colours = await systemColours(page);
      await expect(page.locator('.react-flow__background')).toBeHidden();
      const actor = nodeNamed(page, actorName);
      await expectPaint(
        actor.locator(`.${canvasClassNames.actor}`),
        colours.Canvas,
        { interior: true },
      );
      await expectPaint(
        actor.locator(`.${canvasClassNames.label}`),
        colours.CanvasText,
      );
      for (const tone of Object.values(severityToneClass)) {
        const badge = canvasContainer(page)
          .locator(`.${canvasClassNames.badge} .${tone}`)
          .first();
        await expectPaint(badge, colours.Canvas, { interior: true });
        await expectPaint(badge, colours.CanvasText);
      }
      await expectPaint(
        canvasContainer(page)
          .locator(`.${canvasClassNames.badge} .${canvasClassNames.toneFlag}`)
          .first(),
        colours.CanvasText,
      );
      const flow = nodeNamed(page, flowName);
      const arrow = flow.locator(`.${canvasClassNames.flowArrow}`).first();
      await expectPaint(arrow, colours.CanvasText, { arrowFill: true });
      await expectPaint(
        nodeNamed(page, /^Store order, flow/u)
          .locator(`.${canvasClassNames.flowArrow}`)
          .first(),
        colours.CanvasText,
        { arrowFill: true },
      );
      await expectPaint(
        (await flowBlockOf(flow)).locator(`.${canvasClassNames.flowBacking}`),
        colours.Canvas,
        { interior: true },
      );
      await capture(page, `rest-${scheme}-${appearance}`);
      if (appearance === 'system') {
        const drawing = actor.locator('svg').first();
        const rested = await screenshotPixels(
          page,
          await drawing.screenshot({ scale: 'css' }),
        );
        for (const mode of ['Light', 'Dark', 'System']) {
          await openMenu(page);
          await page
            .getByRole('menuitem', { name: /^Appearance: /u })
            .press('ArrowRight');
          await page
            .getByRole('menuitemradio', { name: mode, exact: true })
            .click();
          await beforeCanvas(page).focus();
          const painted = await screenshotPixels(
            page,
            await drawing.screenshot({ scale: 'css' }),
          );
          expect([painted.width, painted.height]).toEqual([
            rested.width,
            rested.height,
          ]);
          const changed = painted.data.filter(
            (channel, index) =>
              index % 4 !== 3 &&
              Math.abs(channel - (rested.data[index] ?? 0)) > 48,
          ).length;
          test.info().annotations.push({
            type: 'Appearance paint',
            description: `${mode}: ${String(changed)} changed colour channels of ${String(painted.data.length)}`,
          });
          expect(changed / painted.data.length).toBeLessThan(0.01);
        }
      }
      await selectByKeyboard(page, flowName);
      await closeThreats(page);
      await beforeCanvas(page).focus();
      await expectPaint(arrow, colours.Highlight, { arrowFill: true });
      const line = flow.locator(`path.${canvasClassNames.flow}`);
      const at = await line.evaluate<Point, SVGPathElement>((path) => {
        const point = path.getPointAtLength(path.getTotalLength() * 0.2);
        const screen = new DOMPoint(point.x, point.y).matrixTransform(
          path.getScreenCTM() ?? new DOMMatrix(),
        );
        return { x: screen.x, y: screen.y };
      });
      const paint = await page.screenshot({
        clip: { x: at.x - 4, y: at.y - 4, width: 8, height: 8 },
        scale: 'css',
      });
      expect(
        await paintedPixels(page, paint, colours.Highlight),
      ).toBeGreaterThan(2);
    });
  }
}

const states = [
  'selected-element',
  'selected-flow',
  'element-focus',
  'flow-focus',
  'bend',
  'draft-curve',
  'box-selection',
  'rename',
] as const;

for (const state of states) {
  test(`forced colours show ${state}`, async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await openEveryGlyph(page);
    const colours = await systemColours(page);
    const actor = nodeNamed(page, actorName);
    const flow = nodeNamed(page, flowName);
    if (state === 'selected-element') {
      await selectByKeyboard(page, actorName);
      const mark = threatPanel(page).locator('[data-severity] svg').first();
      await expectPaint(
        mark,
        await mark
          .locator('circle')
          .evaluate((circle) => getComputedStyle(circle).fill),
      );
      await closeThreats(page);
      await expect(actor).toHaveClass(/selected/u);
    } else if (state === 'selected-flow' || state === 'bend') {
      await selectByKeyboard(page, flowName);
      await closeThreats(page);
      if (state === 'bend') {
        await page.keyboard.press('+');
        await expect(page.locator('[data-chosen="true"]')).toHaveCount(1);
        await expectPaint(
          page.locator('[data-chosen="true"]'),
          colours.Highlight,
        );
      }
    } else if (state === 'element-focus' || state === 'flow-focus') {
      const target = state === 'element-focus' ? actor : flow;
      await tabTo(page, target);
      await expect(target).toHaveCSS('outline-color', colours.Highlight);
      if (state === 'flow-focus') {
        const ring = flow.locator('.saer-diagram-flow-focus-ring');
        await expectPaint(ring, colours.Highlight, {
          bounds: await filterBoxOf(ring),
        });
      }
    } else if (state === 'draft-curve') {
      const at = await emptyCanvasPoint(page);
      await toolButton(page, 'Trust boundary curve').click();
      await page.mouse.click(at.x, at.y);
      await page.mouse.move(at.x + 80, at.y + 50);
      await expectPaint(page.getByTestId('curve-draft'), colours.CanvasText);
    } else if (state === 'box-selection') {
      await boxSelect(page, [actor], async () => {
        await expect(page.locator('.react-flow__selection')).toHaveCSS(
          'border-color',
          colours.Highlight,
        );
        await capture(page, 'box-selection-drag', false);
      });
      await expect(page.locator('.react-flow__nodesselection-rect')).toHaveCSS(
        'border-color',
        colours.Highlight,
      );
    } else {
      await selectByKeyboard(page, actorName);
      await closeThreats(page);
      await page.keyboard.press('Enter');
      await expect(nameField(page, 'Customer\nbrowser')).toBeFocused();
      await expect(nameField(page, 'Customer\nbrowser')).toHaveCSS(
        'color',
        colours.CanvasText,
      );
      await expect(nameField(page, 'Customer\nbrowser')).toHaveCSS(
        'background-color',
        colours.Canvas,
      );
    }
    await capture(page, state);
  });
}

test('the hidden grid still snaps a moved element', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await openEveryGlyph(page);
  await expect(page.locator('.react-flow__background')).toBeHidden();
  const actor = await selectByKeyboard(page, actorName);
  await closeThreats(page);
  await page.keyboard.press(await commandChord(page, 'ControlOrMeta+Shift+g'));
  await dragBy(page, actor, 37);
  await expect.poll(async () => (await boxOf(actor)).x % gridSpacing).toBe(0);
  await page.keyboard.press(await commandChord(page, 'ControlOrMeta+Shift+g'));
  await dragBy(page, actor, 37);
  await expect
    .poll(async () => (await boxOf(actor)).x % gridSpacing)
    .not.toBe(0);
  expect((await screenBoxOf(actor)).width).toBeGreaterThan(0);
});
