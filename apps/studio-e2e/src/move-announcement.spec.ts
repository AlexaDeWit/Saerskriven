import { expect, test, type Locator, type Page } from '@playwright/test';
import type { Model } from '@saerskriven/model';
import { boxSelect, canvasSettled, dragBy } from './canvas.fixtures.js';
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

const actorTypedTo = async (page: Page, at: Shown): Promise<Locator> => {
  const actor = await selectByKeyboard(page, placeholder.actor);
  await page.keyboard.press(registeredChords['edit-geometry'][0]);
  await axisField(page, 'X').fill(at.x);
  await axisField(page, 'Y').fill(at.y);
  await positionAndSize(page)
    .getByRole('button', { name: 'Apply geometry' })
    .click();
  await expect(actor).toBeFocused();
  return actor;
};

const actorPosition = (model: Model) =>
  model.diagrams[0].elements.flatMap((element) =>
    element.kind === 'actor' ? [element.position] : [],
  )[0];

const decimalsOf = (written: number | string): number =>
  String(written).split('.').at(1)?.length ?? 0;

test('each Arrow and Shift+Arrow move says the position Position and size and the saved file then hold', async ({
  page,
}) => {
  await openFallback(page);
  let shown = { x: '28.5', y: '12.25' };
  const actor = await actorTypedTo(page, shown);
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

  expect(shown).toEqual({ x: '68.5', y: '-2.7' });
  const saved = await savedModel(page);
  expect(
    saved.diagrams[0].elements.find((element) => element.kind === 'actor')
      ?.position,
  ).toEqual({ x: Number(shown.x), y: Number(shown.y) });
});

test('a drag stores three decimals at most and the arrow key after it one, said as Position and size shows it, and undo restores each', async ({
  page,
}) => {
  await openFallback(page);
  const actor = await actorTypedTo(page, { x: '28.123456', y: '12.98765' });
  const typed = actorPosition(await savedModel(page));
  expect(decimalsOf(typed?.x ?? 0)).toBeGreaterThan(3);
  expect(decimalsOf(typed?.y ?? 0)).toBeGreaterThan(3);

  await dragBy(page, actor, { x: 37, y: 23 });
  await expect(actor).toHaveClass(/selected/u);
  const dragged = actorPosition(await savedModel(page));
  expect(dragged).not.toEqual(typed);
  expect(decimalsOf(dragged?.x ?? 0)).toBeLessThanOrEqual(3);
  expect(decimalsOf(dragged?.y ?? 0)).toBeLessThanOrEqual(3);

  await actor.focus();
  await page.keyboard.press('ArrowRight');
  const shown = await shownPosition(page);
  await positionAndSize(page).getByRole('button', { name: 'Cancel' }).click();
  expect(decimalsOf(shown.x)).toBeLessThanOrEqual(1);
  expect(decimalsOf(shown.y)).toBeLessThanOrEqual(1);
  await expectSaid(page, shown);
  expect(actorPosition(await savedModel(page))).toEqual({
    x: Number(shown.x),
    y: Number(shown.y),
  });

  await page.keyboard.press(registeredChords.undo[0]);
  expect(actorPosition(await savedModel(page))).toEqual(dragged);
  await page.keyboard.press(registeredChords.undo[0]);
  expect(actorPosition(await savedModel(page))).toEqual(typed);
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
