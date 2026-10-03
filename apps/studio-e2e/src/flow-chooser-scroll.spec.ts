import { expect, test, type Page } from '@playwright/test';
import { committedText } from '@saerskriven/model/fixtures';
import { edgesOf } from './canvas.fixtures.js';
import { registeredChords } from './chords.fixtures.js';
import {
  focusedOption,
  openModelDocument,
  scrollCue,
  scrolledOffItsStart,
  selectByKeyboard,
  storefront,
} from './studio.fixtures.js';

const crowd = 40;

const extraActor = (index: number): string =>
  JSON.stringify({
    kind: 'actor',
    id: `el-extra-${String(index)}`,
    name: `Extra ${String(index)}`,
    description: '',
    outOfScope: false,
    reasonOutOfScope: '',
    position: { x: 0, y: 600 },
    size: { width: 140, height: 80 },
  });

const crowdedModel = (): unknown => {
  const extras = Array.from({ length: crowd }, (_, index) =>
    extraActor(index),
  ).join(',');
  return JSON.parse(
    committedText('two-diagrams.model.json').replace(
      '"elements": [',
      `"elements": [${extras},`,
    ),
  );
};

const openChooser = async (page: Page): Promise<void> => {
  await openModelDocument(page, crowdedModel());
  await selectByKeyboard(page, storefront.webShop);
  await page.keyboard.press(registeredChords['start-flow'][0]);
  await expect(page.getByRole('listbox')).toBeVisible();
};

const scrolledOffItsEnd = async (page: Page): Promise<void> => {
  await expect(async () => {
    await page.keyboard.press('ArrowUp');
    await expect(scrollCue(page, 'later')).toBeVisible({ timeout: 100 });
  }).toPass({ intervals: [0], timeout: 5_000 });
};

const chooserCapsAndScrolls = async (page: Page): Promise<void> => {
  await openChooser(page);
  const list = page.getByRole('listbox');
  await expect(scrollCue(page, 'later')).toBeVisible();
  await expect(scrollCue(page, 'earlier')).toHaveCount(0);
  const window = page.viewportSize();
  expect((await edgesOf(list)).bottom).toBeLessThanOrEqual(
    (window?.height ?? 0) + 0.5,
  );

  await expect(focusedOption(page)).toHaveCount(1);
  await scrolledOffItsStart(page);
  await expect(focusedOption(page)).toHaveCount(1);
  expect((await edgesOf(focusedOption(page))).bottom).toBeLessThanOrEqual(
    (await edgesOf(scrollCue(page, 'later'))).top + 0.5,
  );

  await page.keyboard.press('End');
  await expect(scrollCue(page, 'later')).toHaveCount(0);
  await scrolledOffItsEnd(page);
  await expect(focusedOption(page)).toHaveCount(1);
  expect((await edgesOf(focusedOption(page))).top).toBeGreaterThanOrEqual(
    (await edgesOf(scrollCue(page, 'earlier'))).bottom - 0.5,
  );
};

test.describe('in a short window', () => {
  test.use({ viewport: { width: 1280, height: 400 } });

  test('the Start a flow chooser stays inside the window, shows where it scrolls on, and keeps the keyboard cursor in view', async ({
    page,
  }) => {
    await chooserCapsAndScrolls(page);
  });
});

test(
  'the Start a flow chooser stays inside a phone window and keeps the keyboard cursor in view',
  { tag: '@phone' },
  async ({ page }) => {
    await chooserCapsAndScrolls(page);
  },
);
