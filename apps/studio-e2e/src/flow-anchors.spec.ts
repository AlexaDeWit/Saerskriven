import { expect, test } from '@playwright/test';
import {
  boxOf,
  dragOnto,
  drawnBy,
  handlesOf,
  lineOf,
  turnsOf,
} from './canvas.fixtures.js';
import {
  handleOn,
  nodeNamed,
  openPlaceholder,
  placeholder,
  readBack,
  savedFile,
  selectByKeyboard,
} from './studio.fixtures.js';

const sourceEnd = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'Flow source end', exact: true });

test('pins a flow end to a side by keyboard and by dragging, releases it, and saves the pin', async ({
  page,
}) => {
  await openPlaceholder(page);
  const flow = await selectByKeyboard(page, placeholder.records);
  const line = lineOf(page, placeholder.records);
  const original = await drawnBy(line);
  const [top, , bottom] = handlesOf(
    await boxOf(nodeNamed(page, placeholder.actor)),
  );
  await sourceEnd(page).focus();
  await page.keyboard.press('ArrowDown');
  await expect
    .poll(async () => turnsOf(await drawnBy(line))[0])
    .toEqual(bottom);
  await expect(flow).toHaveAccessibleName(placeholder.records);
  await sourceEnd(page).focus();
  await page.keyboard.press('Delete');
  await expect(line).toHaveAttribute('d', original);
  await dragOnto(
    page,
    sourceEnd(page),
    handleOn(nodeNamed(page, placeholder.actor), 'top'),
  );
  await expect.poll(async () => turnsOf(await drawnBy(line))[0]).toEqual(top);
  await page.keyboard.press('ControlOrMeta+z');
  await expect(line).toHaveAttribute('d', original);
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect.poll(async () => turnsOf(await drawnBy(line))[0]).toEqual(top);
  const written = await savedFile(page);
  expect(written.text).toContain('side: top');
  const saved = readBack(written.text).model;
  expect(
    saved.diagrams[0].elements.find((element) => element.kind === 'flow'),
  ).toMatchObject({ source: { kind: 'attached', side: 'top' } });
});

test('a flow becomes bidirectional by its command, draws two arrowheads, and saves as such', async ({
  page,
}) => {
  await openPlaceholder(page);
  const flow = await selectByKeyboard(page, placeholder.records);
  const arrows = flow.locator('path.saer-flow-arrow');
  await expect(arrows).toHaveCount(1);
  await page.keyboard.press('ControlOrMeta+Shift+3');
  await expect(arrows).toHaveCount(2);
  await expect(flow).toHaveAccessibleName(/between Actor and Store/u);
  await page.keyboard.press('ControlOrMeta+z');
  await expect(arrows).toHaveCount(1);
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(arrows).toHaveCount(2);
  const written = await savedFile(page);
  expect(written.text).toContain('bidirectional: true');
});
