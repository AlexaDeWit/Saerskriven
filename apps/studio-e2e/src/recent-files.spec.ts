import { expect, test, type Page } from '@playwright/test';
import { committedText } from '@saerskriven/model/fixtures';
import {
  canvasContainer,
  canvasSettled,
  elementNodes,
} from './canvas.fixtures.js';
import {
  closeMenu,
  expectFileShown,
  menuItem,
  openFallback,
  openMenu,
  openPlaceholder,
  runFromMenu,
  twoDiagramsFile,
} from './studio.fixtures.js';

const recentFiles = 'Recent files';

const picked = {
  asked: 'saerskrivenOpenPickerAsked',
  name: 'two-diagrams.yaml',
  text: committedText(twoDiagramsFile),
} as const;

type Picked = {
  readonly asked: string;
  readonly name: string;
  readonly text: string;
};

const pickFromPrivateFileSystem = ({ asked, name, text }: Picked): void => {
  const calls: { id: unknown; startIn: unknown }[] = [];
  Object.defineProperty(globalThis, asked, { value: calls });
  Object.defineProperty(globalThis, 'showOpenFilePicker', {
    value: async (options: {
      readonly id?: unknown;
      readonly startIn?: { readonly name: string };
    }) => {
      calls.push({ id: options.id, startIn: options.startIn?.name });
      const root = await navigator.storage.getDirectory();
      const handle = await root.getFileHandle(name, { create: true });
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      return [handle];
    },
  });
};

const askedOf = (page: Page): Promise<unknown> =>
  page.evaluate((key): unknown => Reflect.get(globalThis, key), picked.asked);

const openPicked = async (page: Page): Promise<void> => {
  await page.addInitScript(pickFromPrivateFileSystem, picked);
  await openPlaceholder(page);
  await runFromMenu(page, 'Open');
  await expectFileShown(page, picked.name, 'Saerskriven YAML');
};

const openRecent = async (page: Page): Promise<void> => {
  await openMenu(page);
  await expect(menuItem(page, recentFiles)).toBeEnabled();
  await menuItem(page, recentFiles).press('ArrowRight');
  await expect(page.getByRole('menu', { name: recentFiles })).toBeVisible();
};

const listEmpty = async (page: Page): Promise<void> => {
  await openMenu(page);
  await expect(menuItem(page, recentFiles)).toBeDisabled();
  await closeMenu(page);
};

test.describe('where the browser keeps file handles', () => {
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Recent files exists in Chrome and Edge alone, the browsers that keep a file handle.',
  );

  test('lists a file opened through the picker, keeps it through a reload and in another tab, and reopens it by keyboard', async ({
    context,
    page,
  }) => {
    await openPicked(page);

    await page.reload();
    await expect(canvasContainer(page)).toBeVisible();
    await canvasSettled(page);
    await runFromMenu(page, 'New model');
    await openRecent(page);
    await expect(menuItem(page, picked.name)).toBeFocused();
    await page.keyboard.press('Enter');

    await expectFileShown(page, picked.name, 'Saerskriven YAML');
    await expect(elementNodes(page)).toHaveCount(7);

    const other = await context.newPage();
    await openPlaceholder(other);
    await openRecent(other);
    await expect(menuItem(other, picked.name)).toBeVisible();
  });

  test('drops a file that is gone under a notice, and the next Open starts beside it', async ({
    page,
  }) => {
    await openPicked(page);
    await page.evaluate(async (name) => {
      const root = await navigator.storage.getDirectory();
      await root.removeEntry(name);
    }, picked.name);

    await openRecent(page);
    await menuItem(page, picked.name).click();

    await expect(page.getByTestId('failure-notice')).toContainText(picked.name);
    await listEmpty(page);
    await runFromMenu(page, 'Open');
    await expectFileShown(page, picked.name, 'Saerskriven YAML');
    const asked = await askedOf(page);
    expect(asked).toEqual([
      { id: expect.any(String), startIn: undefined },
      { id: expect.any(String), startIn: picked.name },
    ]);
  });

  test('empties the list on Clear recent files, and it stays empty after a reload', async ({
    page,
  }) => {
    await openPicked(page);

    await openRecent(page);
    await menuItem(page, 'Clear recent files').click();
    await listEmpty(page);

    await page.reload();
    await expect(canvasContainer(page)).toBeVisible();
    await listEmpty(page);
  });
});

test('offers no Recent files where the browser has no file picker', async ({
  page,
}) => {
  await openFallback(page);

  await openMenu(page);

  await expect(menuItem(page, 'Open')).toBeVisible();
  await expect(page.getByRole('menuitem', { name: recentFiles })).toHaveCount(
    0,
  );
});
