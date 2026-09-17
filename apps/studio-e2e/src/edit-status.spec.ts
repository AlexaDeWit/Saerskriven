import { expect, test } from '@playwright/test';
import { registeredChords } from './chords.fixtures.js';
import {
  editAnnouncement,
  nameField,
  nodeNamed,
  openPlaceholder,
  placeByClick,
} from './studio.fixtures.js';

test('edit status follows focus and lasts until the next edit', async ({
  page,
}) => {
  await openPlaceholder(page);
  await placeByClick(page, 'Actor', /^New actor, actor/u);

  await expect(nameField(page, 'New actor')).toBeFocused();
  await expect(editAnnouncement(page)).toBeEmpty();

  await page.keyboard.press('Enter');
  await page.keyboard.press('Delete');

  await expect(nodeNamed(page, /^New actor, actor/u)).toHaveCount(0);
  await expect(editAnnouncement(page)).toContainText('Removed');

  await placeByClick(page, 'Actor', /^New actor, actor/u);

  await expect(editAnnouncement(page)).toBeEmpty();

  await page.keyboard.press(registeredChords.undo[0]);

  await expect(nodeNamed(page, /^New actor, actor/u)).toHaveCount(0);
  await expect(editAnnouncement(page)).toContainText('Undo');
});
