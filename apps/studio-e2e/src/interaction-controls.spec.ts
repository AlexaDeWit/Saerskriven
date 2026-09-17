import { expect, test } from '@playwright/test';
import { gridSpacing } from '@saerskriven/canvas';
import { audit } from './accessibility.fixtures.js';
import { registeredChords } from './chords.fixtures.js';
import {
  boxOf,
  canvasSettled,
  dragBy,
  emptyCanvasPoint,
  touchDrag,
  touchSession,
} from './canvas.fixtures.js';
import {
  editAnnouncement,
  featureCompleteFile,
  menuItem,
  nodeNamed,
  openFallback,
  openFile,
  openMenu,
  openPlaceholder,
  openText,
  placeholder,
  readBack,
  savedFile,
  savedModel,
  selectByKeyboard,
  storefront,
  twoDiagramsFile,
} from './studio.fixtures.js';

for (const mode of ['select', 'hand', 'space'] as const) {
  test(`a stationary background click clears a node, a flow and a group in ${mode}`, async ({
    page,
  }) => {
    await openPlaceholder(page);

    for (const selection of ['node', 'flow', 'several'] as const) {
      await test.step(selection, async () => {
        await page.keyboard.press(registeredChords['select-tool'][0]);
        if (selection === 'several') {
          await page.keyboard.press('ControlOrMeta+a');
        } else {
          await selectByKeyboard(
            page,
            selection === 'node' ? placeholder.actor : placeholder.records,
          );
        }
        await canvasSettled(page);
        if (mode === 'hand') {
          await page.keyboard.press('h');
        }
        if (mode === 'space') {
          await page.keyboard.down('Space');
        }
        const at = await emptyCanvasPoint(page);
        await page.mouse.click(at.x, at.y);
        if (mode === 'space') {
          await page.keyboard.up('Space');
        }
        await expect(
          page.locator(
            '.react-flow__node.selected, .react-flow__edge.selected',
          ),
        ).toHaveCount(0);
        await expect(page.locator('.react-flow')).toBeFocused();
        await expect(
          page.getByRole('button', { name: /^Menu/u }),
        ).toHaveAccessibleName('Menu');
      });
    }
  });
}

test('pans retain selection, while touch taps clear it', async ({ page }) => {
  await openPlaceholder(page);
  const actor = await selectByKeyboard(page, placeholder.actor);
  await page.keyboard.press('h');
  let at = await emptyCanvasPoint(page);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x + 60, at.y + 60, { steps: 6 });
  await page.mouse.up();
  await expect(actor).toHaveClass(/selected/u);
  const session = await touchSession(page);
  at = await emptyCanvasPoint(page);
  await touchDrag(session, at, { x: at.x + 60, y: at.y + 60 });
  await expect(actor).toHaveClass(/selected/u);
  at = await emptyCanvasPoint(page);
  await touchDrag(session, at, at);
  await expect(actor).not.toHaveClass(/selected/u);
});

test('Tab keeps selection and a click inside an empty boundary clears it', async ({
  page,
}) => {
  await openFallback(page);
  await selectByKeyboard(page, placeholder.actor);
  await page.keyboard.press('Tab');
  await expect(nodeNamed(page, placeholder.actor)).toHaveClass(/selected/u);
  await page.keyboard.press('Escape');
  await page.keyboard.press('b');
  const at = await emptyCanvasPoint(page);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x + 180, at.y + 120, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.press('Escape');
  const boundary = nodeNamed(page, /^New trust boundary, trust boundary/u);
  await boundary.focus();
  await page.keyboard.press('Enter');
  await canvasSettled(page);
  const box = await boundary.boundingBox();
  expect(box).not.toBeNull();
  if (box === null) {
    return;
  }
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.75);
  await expect(boundary).not.toHaveClass(/selected/u);
});

test('clipboard commands preserve graph references and leave text fields their own keys', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openFallback(page);
  await selectByKeyboard(page, placeholder.records);
  await page.keyboard.press('ControlOrMeta+c');
  await expect(editAnnouncement(page)).not.toBeEmpty();
  await page.keyboard.press('ControlOrMeta+v');
  await expect(page.locator('.react-flow__node')).toHaveCount(4);
  await expect(page.locator('.react-flow__edge')).toHaveCount(2);
  const copied = await savedModel(page);
  expect(
    new Set(copied.diagrams[0].elements.map((element) => element.id)).size,
  ).toBe(6);
  expect(new Set(copied.threats.map((threat) => threat.id)).size).toBe(2);
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  await selectByKeyboard(page, placeholder.actor);
  await page.keyboard.press('Enter');
  const name = page.getByRole('textbox', { name: /^Name of/u });
  await name.fill('Text copy');
  await name.selectText();
  await page.keyboard.press('ControlOrMeta+c');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    'Text copy',
  );
  await page.keyboard.press('ControlOrMeta+v');
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  await page.keyboard.press('Escape');
});

test('geometry fields support movement and resizing, cancellation, and one undo step', async ({
  page,
}) => {
  await openFallback(page);
  const actor = await selectByKeyboard(page, placeholder.actor);
  await page.keyboard.press(registeredChords['edit-geometry'][0]);
  const panel = page.getByRole('region', { name: 'Position and size' });
  await expect(
    panel.getByRole('spinbutton', { name: 'X', exact: true }),
  ).toBeFocused();
  await audit(page, 'showing the geometry fields');
  await panel.getByRole('button', { name: 'Increase X', exact: true }).click();
  await panel
    .getByRole('button', { name: 'Increase Width', exact: true })
    .click();
  await panel.getByRole('button', { name: 'Apply geometry' }).click();
  await expect(actor).toBeFocused();
  const after = await savedModel(page);
  expect(after.diagrams[0].elements[0]).toMatchObject({
    position: { x: 41, y: 40 },
    size: { width: 101, height: 50 },
  });
  await page.keyboard.press('ControlOrMeta+z');
  const undone = await savedModel(page);
  expect(undone.diagrams[0].elements[0]).toMatchObject({
    position: { x: 40, y: 40 },
    size: { width: 100, height: 50 },
  });
  await test.step('Escape from a field cancels the edit', async () => {
    await actor.focus();
    await page.keyboard.press('ControlOrMeta+Shift+p');
    await panel.getByRole('spinbutton', { name: 'X', exact: true }).fill('900');
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(actor).toBeFocused();
  });

  await test.step('Escape from a geometry button keeps the selection and returns focus', async () => {
    await page.keyboard.press('ControlOrMeta+Shift+p');
    await expect(
      panel.getByRole('spinbutton', { name: 'X', exact: true }),
    ).toBeFocused();
    await panel.getByRole('button', { name: 'Cancel' }).focus();
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(actor).toHaveClass(/selected/u);
    await expect(actor).toBeFocused();
  });
});

test('reconnection uses keyboard controls and preserves flow identity, bends, and threats', async ({
  page,
}) => {
  await openFallback(page);
  await selectByKeyboard(page, placeholder.actor);
  await page.keyboard.press('ControlOrMeta+d');
  await expect(page.locator('.react-flow__node')).toHaveCount(3);
  await selectByKeyboard(page, placeholder.records);
  await page.keyboard.press('ControlOrMeta+Shift+1');
  const panel = page.getByRole('region', { name: 'Flow endpoint' });
  const source = panel.getByRole('combobox', { name: 'Source' });
  await expect(source).toBeFocused();
  await source.press('End');
  await source.press('Tab');
  await expect(panel.getByRole('combobox', { name: 'Side' })).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(panel).toHaveCount(0);
  const after = await savedModel(page);
  const flow = after.diagrams[0].elements.find(
    (element) => element.kind === 'flow',
  );
  expect(flow).toMatchObject({
    id: 'placeholder-flow',
    name: 'Records',
    waypoints: [],
    target: { kind: 'attached', element: 'placeholder-store' },
  });
  expect(
    flow?.kind === 'flow' &&
      flow.source.kind === 'attached' &&
      flow.source.element !== 'placeholder-actor',
  ).toBe(true);
  await page.keyboard.press('ControlOrMeta+z');
  const before = await savedModel(page);
  expect(
    before.diagrams[0].elements.find((element) => element.kind === 'flow'),
  ).toMatchObject({
    source: { kind: 'attached', element: 'placeholder-actor' },
  });
});

test('arrangement and view controls use the registry without view edits entering history', async ({
  page,
}) => {
  await openFallback(page);
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('ControlOrMeta+Shift+ArrowLeft');
  const arranged = await savedModel(page);
  expect(
    arranged.diagrams[0].elements
      .filter((element) => 'position' in element)
      .map((element) => ('position' in element ? element.position.x : 0)),
  ).toEqual([40, 40]);
  await page.keyboard.press('ControlOrMeta+1');
  await expect(
    page.getByRole('button', { name: 'Reset zoom to 100%' }),
  ).toHaveText('100%');
  await page.keyboard.press('ControlOrMeta+Shift+0');
  await expect(
    page.getByRole('button', { name: /^Menu/u }),
  ).toHaveAccessibleName('Menu');
  await page.keyboard.press('ControlOrMeta+z');
  const undone = await savedModel(page);
  expect(undone.diagrams[0].elements[1]).toMatchObject({
    position: { x: 280 },
  });
  await page.keyboard.press('ControlOrMeta+Shift+g');
  await openMenu(page);
  await expect(menuItem(page, 'Snap to grid: on')).toBeVisible();
});

for (const { fixture, duplicated, retargeted } of [
  {
    fixture: featureCompleteFile,
    duplicated: /^Booking service, process/u,
    retargeted: /^Book appointment, flow/u,
  },
  {
    fixture: twoDiagramsFile,
    duplicated: storefront.webShop,
    retargeted: /^record the paid order, flow/u,
  },
]) {
  test(`document edits survive save and reopen in ${fixture}`, async ({
    page,
  }) => {
    await openFile(page, fixture);
    await selectByKeyboard(page, duplicated);
    await page.keyboard.press('ControlOrMeta+d');
    await expect(editAnnouncement(page)).not.toBeEmpty();
    await page.keyboard.press('ControlOrMeta+Shift+p');
    const geometry = page.getByRole('region', { name: 'Position and size' });
    await geometry
      .getByRole('button', { name: 'Increase X', exact: true })
      .click();
    await geometry
      .getByRole('button', { name: 'Increase Width', exact: true })
      .click();
    await geometry.getByRole('button', { name: 'Apply geometry' }).click();
    await selectByKeyboard(page, retargeted);
    await page.keyboard.press('ControlOrMeta+Shift+2');
    const endpoint = page.getByRole('region', { name: 'Flow endpoint' });
    const target = endpoint.getByRole('combobox', { name: 'Target' });
    await target.selectOption({ index: 0 });
    await endpoint.getByRole('button', { name: 'Apply endpoint' }).click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('ControlOrMeta+Shift+ArrowUp');
    const written = await savedFile(page);
    const before = readBack(written.text).model;
    await openText(page, written.name, written.text);
    await canvasSettled(page);
    const reread = await savedModel(page);
    expect(reread).toEqual(before);
  });
}

test('snapping is optional and preserves manual placement when disabled', async ({
  page,
}) => {
  await openPlaceholder(page);
  const actor = await selectByKeyboard(page, placeholder.actor);
  await page.keyboard.press('ControlOrMeta+Shift+g');
  await dragBy(page, actor, 37);
  await expect.poll(async () => (await boxOf(actor)).x % gridSpacing).toBe(0);
  await page.keyboard.press('ControlOrMeta+Shift+g');
  await dragBy(page, actor, 37);
  await expect
    .poll(async () => (await boxOf(actor)).x % gridSpacing)
    .not.toBe(0);
});

test('endpoint typeahead keeps its keyboard ownership', async ({ page }) => {
  await openPlaceholder(page);
  await selectByKeyboard(page, placeholder.records);
  await page.keyboard.press('ControlOrMeta+Shift+1');
  const select = page.getByRole('combobox', { name: 'Source' });
  await expect(select).toBeFocused();
  await page.keyboard.press('a');
  await expect(select).toBeVisible();
  await expect(page.getByTestId('canvas-container')).toHaveAttribute(
    'data-active-tool',
    'select',
  );
});

test('the reset control exposes the current scale to assistive technology', async ({
  page,
}) => {
  await openPlaceholder(page);
  const reset = page.getByRole('button', { name: 'Reset zoom to 100%' });
  await reset.click();
  await expect(reset).toHaveAccessibleDescription(/Current zoom: 100%/u);
  await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
  await reset.focus();
  await expect(reset).not.toHaveAccessibleDescription(/Current zoom: 100%/u);
  await expect(reset).toHaveAccessibleDescription(/Current zoom: \d+%/u);
});

for (const command of ['fit-selection', 'fit-to-view'] as const) {
  test(`${command} keeps a node clear of the widened threat pane`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPlaceholder(page);
    const actor = await selectByKeyboard(page, placeholder.store);
    const panel = page.getByTestId('threat-panel');
    await panel.getByRole('button', { name: 'Widen pane' }).click();
    await canvasSettled(page);
    await page.keyboard.press(registeredChords[command][0]);
    await canvasSettled(page);
    const node = await actor.boundingBox();
    const pane = await panel.boundingBox();
    expect(node).not.toBeNull();
    expect(pane).not.toBeNull();
    expect((node?.x ?? 0) + (node?.width ?? 0)).toBeLessThanOrEqual(
      pane?.x ?? 0,
    );
    await expect(
      page.getByRole('button', { name: /^Menu/u }),
    ).toHaveAccessibleName('Menu');
  });
}
