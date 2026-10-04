import { expect, test } from '@playwright/test';
import { canvasClassNames } from '@saerskriven/canvas';
import {
  boxAt,
  flowBetween,
  modelWith,
  threatOf,
} from '@saerskriven/model/fixtures';
import { centreOf, reachesAt, screenBoxOf } from './canvas.fixtures.js';
import { nameField, nodeNamed, openModelDocument } from './studio.fixtures.js';

const flow = {
  ...flowBetween(
    { kind: 'free', position: { x: 200, y: 400 } },
    { kind: 'free', position: { x: 600, y: 400 } },
    [],
  ),
  name: 'Visible flow',
};

for (const covered of [false, true]) {
  test(`a name block ${covered ? 'over a filled element' : 'on a clear line'} keeps its press behaviour`, async ({
    page,
  }) => {
    await openModelDocument(
      page,
      modelWith({
        elements: [
          ...(covered
            ? [
                boxAt(
                  'el-cover',
                  0,
                  0,
                  'actor',
                  { width: 800, height: 800 },
                  'Cover',
                ),
              ]
            : []),
          flow,
        ],
        threats: [threatOf({ number: 1, elements: ['el-flow'] })],
      }),
    );
    const name = page.locator(`.${canvasClassNames.flowLabel}`);
    const backing = page.locator(`.${canvasClassNames.flowBacking}`);
    const badge = page.locator(`.${canvasClassNames.badge}`);
    const drawnFlow = nodeNamed(page, /^Visible flow, flow/u);
    const at = await centreOf(name);
    await expect(name).toBeVisible();
    await expect.poll(() => reachesAt(name, at)).toBe(true);

    if (covered) {
      const cover = nodeNamed(page, /^Cover, actor/u);
      const block = await screenBoxOf(backing);
      const element = await screenBoxOf(cover);
      expect(block.x).toBeGreaterThan(element.x);
      expect(block.y).toBeGreaterThan(element.y);
      expect(block.x + block.width).toBeLessThan(element.x + element.width);
      expect(block.y + block.height).toBeLessThan(element.y + element.height);
      const beside = { x: block.x - 12, y: at.y };
      await expect.poll(() => reachesAt(cover, beside)).toBe(true);
      await page.mouse.click(beside.x, beside.y);
      await expect(cover).toHaveClass(/\bselected\b/u);
    }

    await page.mouse.click(at.x, at.y);
    await expect(drawnFlow).toHaveClass(/\bselected\b/u);
    const badgeAt = await centreOf(badge);
    await page.mouse.click(badgeAt.x, badgeAt.y);
    await expect(drawnFlow).toHaveClass(/\bselected\b/u);
    await page.mouse.dblclick(at.x, at.y);
    await expect(nameField(page, flow.name)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(name).toBeVisible();
    await expect(badge).toHaveCount(1);
  });
}
