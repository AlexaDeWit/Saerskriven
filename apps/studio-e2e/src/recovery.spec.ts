import { expect, test } from '@playwright/test';
import { committedText } from '@saerskriven/model/fixtures';
import { canvasContainer, canvasSettled } from './canvas.fixtures.js';
import {
  featureCompleteFile,
  menuItem,
  nameField,
  nodeNamed,
  openMenu,
  openPlaceholder,
  placeholder,
  recoverySnapshot,
  runFromMenu,
  savedFile,
  withRecoverySnapshot,
} from './studio.fixtures.js';

const handleWriteKey = 'saerskrivenRecoveryTestHandleWrite';

test('reload restores the last completed edit', async ({ page }) => {
  const sourceText = committedText(featureCompleteFile);
  await page.addInitScript(
    ({ handleWriteKey: recoveryHandleWriteKey, sourceText: openedText }) => {
      Reflect.deleteProperty(globalThis, 'showSaveFilePicker');
      Object.defineProperty(globalThis, 'showOpenFilePicker', {
        value: () =>
          Promise.resolve([
            {
              name: 'feature-complete.json',
              getFile: () =>
                Promise.resolve(
                  new File([openedText], 'feature-complete.json'),
                ),
              createWritable: () =>
                Promise.resolve({
                  write: () => {
                    localStorage.setItem(recoveryHandleWriteKey, 'written');
                  },
                  close: () => undefined,
                }),
            },
          ]),
      });
    },
    { handleWriteKey, sourceText },
  );
  await openPlaceholder(page);
  await runFromMenu(page, 'Open');
  await expect(nodeNamed(page, /^Booking service, process/u)).toBeVisible();
  await canvasSettled(page);

  await nodeNamed(page, /^Booking service, process/u).dblclick();
  const name = nameField(page, 'Booking service');
  await name.fill('Recovered booking');
  await name.press('Enter');

  await page.reload();
  await expect(canvasContainer(page)).toBeVisible();
  await canvasSettled(page);

  await expect(nodeNamed(page, /^Recovered booking, process/u)).toHaveCount(1);

  const written = await savedFile(page);
  expect(written.name).toBe('feature-complete.json');
  expect(sourceText).toContain('"containedElements"');
  expect(written.text).toContain('"containedElements"');
  expect(
    await page.evaluate((key) => localStorage.getItem(key), handleWriteKey),
  ).toBeNull();
});

test('two tabs follow each other, so the one in view is the one that is right', async ({
  context,
  page,
}) => {
  const other = await context.newPage();
  await openPlaceholder(page);
  await openPlaceholder(other);

  await nodeNamed(page, placeholder.store).dblclick();
  await nameField(page, 'Store').fill('Ledger');
  await nameField(page, 'Store').press('Enter');

  await expect(nodeNamed(other, /^Ledger, store/u)).toHaveCount(1);

  await nodeNamed(other, placeholder.actor).dblclick();
  await nameField(other, 'Actor').fill('Clerk');
  await nameField(other, 'Actor').press('Enter');

  await expect(nodeNamed(page, /^Clerk, actor/u)).toHaveCount(1);
  await expect(nodeNamed(page, /^Ledger, store/u)).toHaveCount(1);

  await runFromMenu(page, 'Undo');
  await expect(nodeNamed(page, placeholder.actor)).toHaveCount(1);
  await expect(nodeNamed(other, placeholder.actor)).toHaveCount(1);
  await runFromMenu(other, 'Undo');
  await expect(nodeNamed(other, placeholder.store)).toHaveCount(1);
  await expect(nodeNamed(page, placeholder.store)).toHaveCount(1);
});

const undrawnSession = JSON.stringify({
  version: 2,
  document: {
    formatVersion: 2,
    metadata: {
      title: 'Undrawn',
      owner: '',
      description: '',
      contributors: [],
    },
    diagrams: [
      {
        id: 'diagram-main',
        title: 'Main',
        elements: [
          {
            kind: 'trust-boundary',
            id: 'boundary-perimeter',
            name: 'Perimeter',
            description: '',
            outOfScope: false,
            reasonOutOfScope: '',
            shape: {
              kind: 'curve',
              waypoints: [
                { x: -1e308, y: 0 },
                { x: 1e308, y: 0 },
              ],
            },
          },
        ],
      },
    ],
    threats: [],
    lastIssuedThreatNumber: 0,
    mitigations: [],
    assumptions: [],
  },
  writtenBy: { studioVersion: 'spec' },
  dirty: true,
  file: { _tag: 'NoFile' },
});

test('a stored session the studio cannot draw stops one start, and the next opens the placeholder, says so, and asks before New model clears it', async ({
  page,
}) => {
  await withRecoverySnapshot(page, undrawnSession);

  await page.goto('/');
  await expect(
    page.getByRole('region', { name: 'Saerskriven stopped' }),
  ).toBeVisible();

  await page.reload();
  await expect(canvasContainer(page)).toBeVisible();
  await canvasSettled(page);

  await expect(nodeNamed(page, placeholder.actor)).toBeVisible();
  await expect(page.getByTestId('failure-notice')).not.toBeEmpty();
  expect(await recoverySnapshot(page)).toBe(undrawnSession);

  await openMenu(page);
  await menuItem(page, 'New model').click();
  await expect(
    menuItem(page, 'Discard changes and create new model'),
  ).toBeVisible();
  await menuItem(page, 'Cancel').click();

  await expect(page.getByRole('menu')).toHaveCount(0);
  expect(await recoverySnapshot(page)).toBe(undrawnSession);
});
