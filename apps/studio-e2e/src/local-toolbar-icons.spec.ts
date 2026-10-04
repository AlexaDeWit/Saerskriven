import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  contrastRatio,
  darkPalette,
  lightPalette,
  rgbColour,
} from '@saerskriven/canvas';
import { audit } from './accessibility.fixtures.js';
import { registeredChords } from './chords.fixtures.js';
import {
  canvasSettled,
  centreOf,
  pointHandles,
  reachesAt,
  screenBoxOf,
} from './canvas.fixtures.js';
import {
  languageStorageKey,
  openFallback,
  openTwoDiagrams,
  placeholder,
  savedModel,
  selectByKeyboard,
  withoutPickers,
} from './studio.fixtures.js';

const iconTooltip = async (page: Page, control: Locator): Promise<void> => {
  const name = await control.getAttribute('aria-label');
  expect(name).not.toBeNull();
  await expect(control.locator('svg[aria-hidden="true"]')).toHaveCount(1);
  expect(await control.textContent()).toBe('');
  await control.focus();
  await control.blur();
  await page.mouse.move(0, 0);
  await control.hover();
  await expect(page.getByRole('tooltip')).toHaveText(name ?? '');
  await control.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(control).toBeFocused();
  await expect(page.getByRole('tooltip')).toHaveText(name ?? '');
  await expect(control).toHaveCSS('outline-style', 'solid');
};

for (const scheme of ['light', 'dark'] as const) {
  test(`connection icons preserve anchors, automatic routing, close and undo in ${scheme}`, async ({
    page,
  }, info) => {
    await page.emulateMedia({ colorScheme: scheme });
    await openFallback(page);
    const flow = await selectByKeyboard(page, placeholder.records);
    const before = await savedModel(page);
    const end = page.getByRole('button', {
      name: 'Flow source end',
      exact: true,
    });
    const actions = page.getByRole('group', { name: 'Flow end actions' });
    for (const [side, label] of [
      ['top', 'Top'],
      ['right', 'Right'],
      ['bottom', 'Bottom'],
      ['left', 'Left'],
    ] as const) {
      await end.focus();
      await end.press('Enter');
      const automatic = actions.getByRole('button', {
        name: 'Follow the route',
        exact: true,
      });
      await expect(automatic).toHaveAttribute('aria-pressed', 'true');
      await expect(automatic).toHaveText('Follow the route');
      const choice = actions.getByRole('button', { name: label, exact: true });
      await expect(choice).toHaveAttribute('aria-pressed', 'false');
      await iconTooltip(page, choice);
      await choice.press('Enter');
      await expect(actions).toHaveCount(0);
      await expect(flow).toBeFocused();
      expect((await savedModel(page)).diagrams[0].elements).toContainEqual(
        expect.objectContaining({
          kind: 'flow',
          source: { kind: 'attached', element: 'placeholder-actor', side },
        }),
      );
      await end.focus();
      await end.press('Enter');
      await expect(choice).toHaveAttribute('aria-pressed', 'true');
      await expect(automatic).toHaveAttribute('aria-pressed', 'false');
      const colours = await choice.evaluate((control) => ({
        background: getComputedStyle(control).backgroundColor,
        text: getComputedStyle(control).color,
      }));
      expect(colours.background).not.toBe(
        await automatic.evaluate(
          (control) => getComputedStyle(control).backgroundColor,
        ),
      );
      expect(colours.text).not.toBe(colours.background);
      if (side === 'left') {
        await iconTooltip(page, choice);
        const palette = scheme === 'light' ? lightPalette : darkPalette;
        expect(
          await choice.evaluate((control) => control.matches(':hover')),
        ).toBe(true);
        await expect(choice).toHaveCSS(
          'background-color',
          rgbColour(palette.actionPrimary),
        );
        await expect(choice).toHaveCSS('color', rgbColour(palette.actionText));
        await expect(choice).toHaveCSS(
          'outline-color',
          rgbColour(palette.actionText),
        );
        expect(
          contrastRatio(palette.actionPrimary, palette.actionText),
        ).toBeGreaterThanOrEqual(3);
        await info.attach(`connection-icons-${scheme}`, {
          body: await page.screenshot(),
          contentType: 'image/png',
        });
        await audit(page, `with connection icons in ${scheme}`);
        await page.emulateMedia({ forcedColors: 'active' });
        expect(
          await choice.evaluate(
            (control) => getComputedStyle(control).backgroundColor,
          ),
        ).not.toBe(
          await automatic.evaluate(
            (control) => getComputedStyle(control).backgroundColor,
          ),
        );
        await page.emulateMedia({ forcedColors: 'none' });
      }
      const close = actions.getByRole('button', { name: 'Close', exact: true });
      await iconTooltip(page, close);
      await close.press('Enter');
      await expect(actions).toHaveCount(0);
      await expect(flow).toBeFocused();
      await page.keyboard.press(registeredChords.undo[0]);
      expect(await savedModel(page)).toEqual(before);
    }
    await end.focus();
    await end.press('ArrowLeft');
    await end.focus();
    await end.press('Enter');
    await actions
      .getByRole('button', { name: 'Follow the route', exact: true })
      .press('Enter');
    expect(await savedModel(page)).toEqual(before);
    await page.keyboard.press(registeredChords.undo[0]);
    expect((await savedModel(page)).diagrams[0].elements).toContainEqual(
      expect.objectContaining({
        source: {
          kind: 'attached',
          element: 'placeholder-actor',
          side: 'left',
        },
      }),
    );
    await page.mouse.move(700, 600);
    await page.mouse.wheel(0, 600);
    await canvasSettled(page);
    expect((await screenBoxOf(end)).y).toBeLessThan(120);
    await end.click();
    for (const control of await actions.getByRole('button').all()) {
      expect(await reachesAt(control, await centreOf(control))).toBe(true);
    }
    const bounds = await screenBoxOf(actions);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(
      page.viewportSize()?.height ?? 0,
    );
  });

  test(`bend icons preserve movement, cancellation, removal and undo in ${scheme}`, async ({
    page,
  }, info) => {
    await page.emulateMedia({ colorScheme: scheme });
    await openFallback(page);
    const flow = await selectByKeyboard(page, placeholder.records);
    await flow.press('+');
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    const before = await savedModel(page);
    const bend = page.getByRole('button', { name: 'Bend 1', exact: true });
    await bend.focus();
    await bend.press('Enter');
    const actions = page.getByRole('group', { name: 'Bend actions' });
    const remove = actions.getByRole('button', {
      name: 'Remove bend',
      exact: true,
    });
    const move = actions.getByRole('button', {
      name: 'Move bend',
      exact: true,
    });
    await iconTooltip(page, remove);
    await iconTooltip(page, move);
    await info.attach(`bend-icons-${scheme}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await move.press('Enter');
    await page.keyboard.press('ArrowDown');
    const cancel = page.getByRole('button', { name: 'Cancel', exact: true });
    await cancel.hover();
    await expect(page.getByRole('tooltip')).toHaveText('Cancel');
    await page.keyboard.press('Shift');
    await cancel.focus();
    await expect(page.getByRole('tooltip')).toHaveText('Cancel');
    await expect(cancel).toHaveCSS('outline-style', 'solid');
    await cancel.click();
    await expect(flow).toBeFocused();
    expect(await savedModel(page)).toEqual(before);
    await bend.focus();
    await bend.press('Enter');
    await remove.press('Enter');
    await expect(bend).toHaveCount(0);
    await expect(flow).toBeFocused();
    await page.keyboard.press(registeredChords.undo[0]);
    expect(await savedModel(page)).toEqual(before);
  });

  test(`curve icons preserve point edits, close and undo in ${scheme}`, async ({
    page,
  }, info) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.addInitScript(withoutPickers);
    await openTwoDiagrams(page);
    await page.keyboard.press(registeredChords['next-diagram'][0]);
    const boundary = await selectByKeyboard(
      page,
      /^Warehouse floor, trust boundary/u,
    );
    const before = await savedModel(page);
    const point = page.getByRole('button', { name: 'Point 2', exact: true });
    await point.focus();
    await point.press('Enter');
    const actions = page.getByRole('group', { name: 'Point actions' });
    const remove = actions.getByRole('button', {
      name: 'Remove point',
      exact: true,
    });
    const add = actions.getByRole('button', { name: 'Add point', exact: true });
    const close = actions.getByRole('button', { name: 'Close', exact: true });
    await iconTooltip(page, remove);
    await iconTooltip(page, add);
    await iconTooltip(page, close);
    await info.attach(`curve-icons-${scheme}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    });
    await audit(page, `with curve icons in ${scheme}`);
    await close.press('Enter');
    await expect(boundary).toBeFocused();
    expect(await savedModel(page)).toEqual(before);
    await point.focus();
    await point.press('Enter');
    await add.press('Enter');
    await expect(pointHandles(page)).toHaveCount(4);
    await page.keyboard.press(registeredChords.undo[0]);
    await expect(pointHandles(page)).toHaveCount(3);
    expect(await savedModel(page)).toEqual(before);
    await point.focus();
    await point.press('Enter');
    await remove.press('Enter');
    await expect(pointHandles(page)).toHaveCount(2);
    await page.keyboard.press(registeredChords.undo[0]);
    expect(await savedModel(page)).toEqual(before);
  });
}

test('local icon names and tooltips follow the chosen language', async ({
  page,
}) => {
  await page.addInitScript((key) => {
    localStorage.setItem(key, 'fr-CA');
  }, languageStorageKey);
  await openFallback(page);
  await page.evaluate(() => document.fonts.ready);
  const flow = page.locator('.react-flow__edge').first();
  await flow.focus();
  await flow.press('Enter');
  await canvasSettled(page);
  const end = page.getByRole('button', {
    name: 'Extrémité source du flux',
    exact: true,
  });
  await end.focus();
  await end.press('Enter');
  const actions = page.getByRole('group', {
    name: 'Actions de l’extrémité du flux',
  });
  for (const name of ['Haut', 'Droite', 'Bas', 'Gauche', 'Fermer']) {
    const control = actions.getByRole('button', { name, exact: true });
    expect(await reachesAt(control, await centreOf(control))).toBe(true);
    await iconTooltip(page, control);
  }
});

test('French local actions remain reachable beside the pane on a narrow desktop', async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 720 });
  await page.addInitScript((key) => {
    localStorage.setItem(key, 'fr-CA');
  }, languageStorageKey);
  await openFallback(page);
  await page.evaluate(() => document.fonts.ready);
  const flow = page.locator('.react-flow__edge').first();
  await flow.focus();
  await flow.press('Enter');
  await canvasSettled(page);
  const end = page.getByRole('button', {
    name: 'Extrémité source du flux',
    exact: true,
  });
  await end.focus();
  await end.press('Enter');
  const actions = page.getByRole('group', {
    name: 'Actions de l’extrémité du flux',
  });
  const bounds = await screenBoxOf(actions);
  const pane = await screenBoxOf(page.getByTestId('threat-panel'));
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(pane.x);
  for (const control of await actions.getByRole('button').all()) {
    const reached = await reachesAt(control, await centreOf(control));
    expect(reached, (await control.getAttribute('aria-label')) ?? '').toBe(
      true,
    );
  }
});
