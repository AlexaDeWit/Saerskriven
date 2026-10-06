import { expect, test } from '@playwright/test';
import { canvasClassNames } from '@saerskriven/canvas';
import {
  boxAt,
  flowBetween,
  modelWith,
  threatOf,
} from '@saerskriven/model/fixtures';
import {
  centreOf,
  canvasSettled,
  clickSvgText,
  drawnBy,
  halfwayAlong,
  lineOf,
  reachesAt,
  screenBoxOf,
  turnsOf,
} from './canvas.fixtures.js';
import {
  nameField,
  nodeNamed,
  openModelDocument,
  selectByKeyboard,
} from './studio.fixtures.js';

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
            : [
                boxAt(
                  'el-focus',
                  0,
                  0,
                  'actor',
                  { width: 120, height: 80 },
                  'Focus actor',
                ),
              ]),
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
    } else {
      await nodeNamed(page, /^Focus actor, actor/u).focus();
    }

    await clickSvgText(name);
    await expect(drawnFlow).toHaveClass(/\bselected\b/u);
    await expect(drawnFlow).toBeFocused();
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

test('a flow name and badge stay above a filled element during keyboard resize focus', async ({
  page,
}) => {
  await openModelDocument(
    page,
    modelWith({
      elements: [
        boxAt('el-cover', 0, 0, 'actor', { width: 800, height: 800 }, 'Cover'),
        flow,
      ],
      threats: [threatOf({ number: 1, elements: ['el-flow'] })],
    }),
  );
  const cover = nodeNamed(page, /^Cover, actor/u);
  const name = page.locator(`.${canvasClassNames.flowLabel}`);
  const badge = page.locator(`.${canvasClassNames.badge}`);
  await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
  await canvasSettled(page);
  await selectByKeyboard(page, /^Cover, actor/u);
  await page.keyboard.press('Tab');
  const control = cover.getByRole('button', {
    name: 'Resize Cover from top',
    exact: true,
  });
  await expect(control).toBeFocused();
  expect(
    await control.evaluate((button) => button.matches(':focus-visible')),
  ).toBe(true);
  await expect
    .poll(async () => reachesAt(control, await centreOf(control)))
    .toBe(true);
  await expect
    .poll(async () => reachesAt(name, await centreOf(name)))
    .toBe(true);
  await expect
    .poll(async () => reachesAt(badge, await centreOf(badge)))
    .toBe(true);
  const before = await screenBoxOf(cover);
  await page.keyboard.press('ArrowDown');
  await expect(control).toBeFocused();
  await expect
    .poll(async () => (await screenBoxOf(cover)).y)
    .toBeGreaterThan(before.y);
  await expect
    .poll(async () => reachesAt(name, await centreOf(name)))
    .toBe(true);
  await expect
    .poll(async () => reachesAt(badge, await centreOf(badge)))
    .toBe(true);
  await clickSvgText(name);
  await expect(nodeNamed(page, /^Visible flow, flow/u)).toBeFocused();
});

test('a selected segment takes a press over its name block and previews a bend', async ({
  page,
}) => {
  await openModelDocument(page, modelWith({ elements: [flow] }));
  await selectByKeyboard(page, /^Visible flow, flow/u);
  const line = lineOf(page, /^Visible flow, flow/u);
  const at = await halfwayAlong(line);
  const original = await drawnBy(line);
  const segment = page.locator('[data-bend-segment="0"]');
  await expect.poll(() => reachesAt(segment, at)).toBe(true);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x, at.y + 30, { steps: 4 });
  await expect(page.locator('[data-bend-index]')).toHaveCount(1);
  expect(turnsOf(await drawnBy(line))).toHaveLength(3);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(line).toHaveAttribute('d', original);
});

test('a bend handle keeps its hit area where the name block covers it', async ({
  page,
}) => {
  await openModelDocument(
    page,
    modelWith({
      elements: [
        boxAt('el-cover', 0, 0, 'actor', { width: 800, height: 800 }, 'Cover'),
        {
          ...flow,
          name: 'orders.checkout.request.authorisation.result',
          waypoints: [{ x: 400, y: 400 }],
        },
      ],
    }),
  );
  await selectByKeyboard(
    page,
    /^orders\.checkout\.request\.authorisation\.result, flow/u,
  );
  for (let step = 0; step < 4; step += 1) {
    await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
  }
  await canvasSettled(page);
  const handle = page.getByRole('button', { name: 'Bend 1', exact: true });
  const hitArea = await screenBoxOf(handle);
  const backing = await screenBoxOf(
    page.locator(`.${canvasClassNames.flowBacking}`),
  );
  const left = Math.max(hitArea.x, backing.x);
  const right = Math.min(hitArea.x + hitArea.width, backing.x + backing.width);
  const top = Math.max(hitArea.y, backing.y);
  const bottom = Math.min(
    hitArea.y + hitArea.height,
    backing.y + backing.height,
  );
  expect(right).toBeGreaterThan(left);
  expect(bottom).toBeGreaterThan(top);
  const at = {
    x: (left + right) / 2,
    y: top + Math.min(1, (bottom - top) / 2),
  };
  await expect.poll(() => reachesAt(handle, at)).toBe(true);
});
