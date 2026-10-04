import { expect, test } from '@playwright/test';
import { commandChord } from './chords.fixtures.js';
import { audit } from './accessibility.fixtures.js';
import {
  boxesOverlap,
  screenBoxOf,
  centreOf,
  canvasSettled,
  drawnBy,
  halfwayAlong,
  lineOf,
  touchDrag,
  touchSession,
  turnsOf,
  viewportTransform,
} from './canvas.fixtures.js';
import {
  editAnnouncement,
  menuButton,
  menuItem,
  nodeNamed,
  openPlaceholder,
  placeholder,
  selectByKeyboard,
  threatPanel,
} from './studio.fixtures.js';

test(
  'touch selection exposes deletion with the drawer collapsed or expanded, and Undo restores the element',
  { tag: '@phone-only' },
  async ({ page }) => {
    await openPlaceholder(page);
    const remove = page.getByRole('button', {
      name: 'Delete selection',
      exact: true,
    });
    await expect(remove).toBeDisabled();

    for (const expanded of [false, true]) {
      const actor = nodeNamed(page, placeholder.actor);
      await canvasSettled(page);
      await actor.tap();
      await expect(actor).toHaveClass(/selected/u);
      const panel = threatPanel(page);
      const expand = panel.getByRole('button', {
        name: 'Expand pane',
        exact: true,
      });
      await expect(expand).toHaveAttribute('aria-expanded', 'false');
      if (expanded) {
        await expand.tap();
      }
      const bounds = await screenBoxOf(remove);
      expect(bounds.width).toBeGreaterThanOrEqual(44);
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      expect(boxesOverlap(bounds, await screenBoxOf(panel))).toBe(false);

      await remove.tap();

      await expect(actor).toHaveCount(0);
      await expect(remove).toBeDisabled();
      await expect(editAnnouncement(page)).not.toBeEmpty();
      await menuButton(page).tap();
      await menuItem(page, 'Undo').tap();
      await expect(actor).toHaveCount(1);
    }
  },
);

test(
  'activity stays available to screen readers without covering the canvas',
  { tag: '@phone' },
  async ({ page }) => {
    await openPlaceholder(page);
    await selectByKeyboard(page, placeholder.actor);
    await page.keyboard.press('Delete');
    const announcement = editAnnouncement(page);
    await expect(announcement).not.toBeEmpty();
    await expect(announcement).toHaveAttribute('aria-live', 'polite');
    const bounds = await announcement.boundingBox();
    expect(bounds?.height).toBe(0);
    await expect(announcement.locator('span')).toHaveCSS(
      'clip-path',
      'inset(50%)',
    );
  },
);

test(
  'selection leaves a high side drawer that expands and preserves drafts when collapsed',
  { tag: '@phone-only' },
  async ({ page }) => {
    await openPlaceholder(page);
    await selectByKeyboard(page, placeholder.actor);
    const panel = threatPanel(page);
    const expand = panel.getByRole('button', {
      name: 'Expand pane',
      exact: true,
    });
    await expect(expand).toBeVisible();
    await expect(expand).toHaveAttribute('aria-expanded', 'false');
    await expect(
      panel.getByRole('button', { name: 'Add a threat', exact: true }),
    ).toHaveCount(0);
    const collapsed = await panel.boundingBox();
    const chrome = await page.getByTestId('chrome-card').boundingBox();
    expect(collapsed?.width).toBeLessThan(70);
    expect(collapsed?.y).toBeLessThan(
      (chrome?.y ?? 0) + (chrome?.height ?? 0) + 24,
    );
    const viewport = await viewportTransform(page);
    await expand.tap();
    await expect(
      panel.getByRole('button', { name: 'Collapse pane', exact: true }),
    ).toHaveAttribute('aria-expanded', 'true');
    await panel
      .getByRole('button', { name: 'Add a threat', exact: true })
      .tap();
    const title = panel.getByRole('textbox', { name: 'Title', exact: true });
    await title.fill('A retained draft');
    await panel
      .getByRole('button', { name: 'Collapse pane', exact: true })
      .tap();
    await expect(expand).toBeVisible();
    await expand.tap();
    await expect(title).toHaveValue('A retained draft');
    expect(await viewportTransform(page)).toBe(viewport);
    await audit(page, 'expanded mobile threat drawer');
    await panel
      .getByRole('button', { name: 'Collapse pane', exact: true })
      .tap();
    await nodeNamed(page, placeholder.actor).focus();
    await page.keyboard.press('t');
    await expect(
      panel.getByRole('button', { name: 'Add a threat', exact: true }),
    ).toBeFocused();
  },
);

test(
  'one compact toolbar sits near the flow and touch drags insert and move bends',
  { tag: '@phone-only' },
  async ({ page }) => {
    await openPlaceholder(page);
    await selectByKeyboard(page, placeholder.records);
    const toolbar = page.getByRole('group', {
      name: 'Flow route',
      exact: true,
    });
    await expect(
      toolbar.getByRole('button', { name: 'Add bend', exact: true }),
    ).toBeVisible();
    await expect(
      toolbar.getByRole('button', { name: 'Reverse flow', exact: true }),
    ).toBeVisible();
    const box = await screenBoxOf(toolbar);
    const drawer = await screenBoxOf(threatPanel(page));
    expect(box).not.toBeNull();
    expect(drawer).not.toBeNull();
    expect(boxesOverlap(box, drawer)).toBe(false);
    expect(box?.height).toBeLessThan(65);
    expect(box?.x).toBeGreaterThanOrEqual(0);
    const line = lineOf(page, placeholder.records);
    const original = await drawnBy(line);
    const at = await halfwayAlong(line);
    expect(Math.abs((box?.y ?? 0) - at.y)).toBeLessThan(100);
    const session = await touchSession(page);
    await touchDrag(session, at, { x: at.x - 30, y: at.y - 65 });
    const inserted = await drawnBy(line);
    expect(turnsOf(inserted)).toHaveLength(3);
    const bend = page.getByRole('button', { name: 'Bend 1', exact: true });
    const centre = await centreOf(bend);
    await touchDrag(session, centre, { x: centre.x + 25, y: centre.y - 25 });
    await expect(line).not.toHaveAttribute('d', inserted);
    await page.keyboard.press(await commandChord(page, 'ControlOrMeta+z'));
    await expect(line).toHaveAttribute('d', inserted);
    await page.keyboard.press(await commandChord(page, 'ControlOrMeta+z'));
    await expect(line).toHaveAttribute('d', original);
    await toolbar.getByRole('button', { name: 'Add bend', exact: true }).tap();
    await canvasSettled(page);
    const chosenAt = await halfwayAlong(line);
    await touchDrag(session, chosenAt, {
      x: chosenAt.x - 30,
      y: chosenAt.y - 65,
    });
    expect(turnsOf(await drawnBy(line))).toHaveLength(3);
    await page.keyboard.press(await commandChord(page, 'ControlOrMeta+z'));
    await expect(line).toHaveAttribute('d', original);
    await toolbar.getByRole('button', { name: 'Add bend', exact: true }).tap();
    await page.keyboard.press('Enter');
    const start = await centreOf(bend);
    await touchDrag(session, start, { x: start.x - 20, y: start.y - 60 });
    expect(turnsOf(await drawnBy(line))).toHaveLength(3);
    await page.keyboard.press(await commandChord(page, 'ControlOrMeta+z'));
    await expect(line).toHaveAttribute('d', original);
  },
);
