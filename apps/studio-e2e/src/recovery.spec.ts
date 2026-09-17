import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
  canvasContainer,
  canvasSettled,
  featureCompleteFile,
  nodeNamed,
  openPlaceholder,
  runFromMenu,
  savedFile,
  vendored,
} from './studio.fixtures.js';

const sourceText = readFileSync(vendored(featureCompleteFile), 'utf8');
const handleWriteKey = 'saerskrivenRecoveryTestHandleWrite';

test('reload restores the last completed edit', async ({ page }) => {
  await page.addInitScript(
    ({ handleWriteKey: recoveryHandleWriteKey, sourceText: openedText }) => {
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
  const name = page.getByRole('textbox', { name: 'Name of Booking service' });
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

  await nodeNamed(page, /^Store, store/u).dblclick();
  await page.getByRole('textbox', { name: 'Name of Store' }).fill('Ledger');
  await page.getByRole('textbox', { name: 'Name of Store' }).press('Enter');

  await expect(nodeNamed(other, /^Ledger, store/u)).toHaveCount(1);

  await nodeNamed(other, /^Actor, actor/u).dblclick();
  await other.getByRole('textbox', { name: 'Name of Actor' }).fill('Clerk');
  await other.getByRole('textbox', { name: 'Name of Actor' }).press('Enter');

  await expect(nodeNamed(page, /^Clerk, actor/u)).toHaveCount(1);
  await expect(nodeNamed(page, /^Ledger, store/u)).toHaveCount(1);

  await runFromMenu(page, 'Undo');
  await expect(nodeNamed(page, /^Actor, actor/u)).toHaveCount(1);
  await expect(nodeNamed(other, /^Actor, actor/u)).toHaveCount(1);
  await runFromMenu(other, 'Undo');
  await expect(nodeNamed(other, /^Store, store/u)).toHaveCount(1);
  await expect(nodeNamed(page, /^Store, store/u)).toHaveCount(1);
});
