import { expect, test, type Locator, type Page } from '@playwright/test';
import { boxSelect, canvasSettled } from './canvas.fixtures.js';
import { registeredChords } from './chords.fixtures.js';
import {
  nodeNamed,
  openFallback,
  openPlaceholder,
  placeholder,
  savedModel,
  selectByKeyboard,
} from './studio.fixtures.js';

const flowLiveMessage = (page: Page): Locator =>
  page.locator('[id^="react-flow__aria-live"]');

const positionAndSize = (page: Page): Locator =>
  page.getByRole('region', { name: 'Position and size' });

const axisField = (page: Page, axis: 'X' | 'Y'): Locator =>
  positionAndSize(page).getByRole('spinbutton', { name: axis, exact: true });

type Shown = { readonly x: string; readonly y: string };

const shownPosition = async (page: Page): Promise<Shown> => {
  await page.keyboard.press(registeredChords['edit-geometry'][0]);
  return {
    x: await axisField(page, 'X').inputValue(),
    y: await axisField(page, 'Y').inputValue(),
  };
};

const expectSaid = async (page: Page, shown: Shown): Promise<void> => {
  await expect(flowLiveMessage(page)).toContainText(shown.x);
  await expect(flowLiveMessage(page)).toContainText(shown.y);
};

test('each Arrow and Shift+Arrow move says the position Position and size and the saved file then hold', async ({
  page,
}) => {
  await openFallback(page);
  const actor = await selectByKeyboard(page, placeholder.actor);
  await page.keyboard.press(registeredChords['edit-geometry'][0]);
  await axisField(page, 'X').fill('28.5');
  await axisField(page, 'Y').fill('12.25');
  await positionAndSize(page)
    .getByRole('button', { name: 'Apply geometry' })
    .click();
  await expect(actor).toBeFocused();

  let shown = { x: '28.5', y: '12.25' };
  for (const chord of [
    'ArrowRight',
    'Shift+ArrowRight',
    'ArrowDown',
    'Shift+ArrowUp',
    'ArrowLeft',
    'Shift+ArrowRight',
  ]) {
    await test.step(chord, async () => {
      await page.keyboard.press(chord);
      shown = await shownPosition(page);
      await positionAndSize(page)
        .getByRole('button', { name: 'Cancel' })
        .click();
      await expect(actor).toBeFocused();

      await expectSaid(page, shown);
    });
  }

  expect(shown).toEqual({ x: '68.5', y: '-2.75' });
  const saved = await savedModel(page);
  expect(
    saved.diagrams[0].elements.find((element) => element.kind === 'actor')
      ?.position,
  ).toEqual({ x: Number(shown.x), y: Number(shown.y) });
});

test('an arrow move of a box selection says where Position and size then places the group', async ({
  page,
}) => {
  await openPlaceholder(page);
  await canvasSettled(page);
  await boxSelect(page, [
    nodeNamed(page, placeholder.actor),
    nodeNamed(page, placeholder.store),
  ]);
  await expect(page.locator('.react-flow__nodesselection-rect')).toBeFocused();

  await page.keyboard.press('ArrowDown');

  await expectSaid(page, await shownPosition(page));
});
