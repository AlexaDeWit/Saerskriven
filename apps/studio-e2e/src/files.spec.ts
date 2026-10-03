import { expect, test, type Page } from '@playwright/test';
import {
  canvasContainer,
  canvasSettled,
  elementNodes,
} from './canvas.fixtures.js';
import {
  chooseFile,
  expectFileShown,
  featureCompleteFile,
  menuButton,
  nameField,
  nodeNamed,
  openFile,
  openPlaceholder,
  runFromMenu,
  savedFile,
  storefront,
  twoDiagramsFile,
} from './studio.fixtures.js';

const savePicker = {
  asked: 'saerskrivenSavePickerAsked',
  written: 'saerskrivenSavePickerWritten',
  dismissNext: 'saerskrivenSavePickerDismissNext',
} as const;

type SavePickerKeys = typeof savePicker;

type SaveOptions = {
  readonly suggestedName: string;
  readonly types: readonly { readonly description: string }[];
};

const stubSavePicker = (keys: SavePickerKeys): void => {
  const asked: { name: string; formats: string[] }[] = [];
  const written: string[] = [];
  Object.defineProperty(globalThis, keys.asked, { value: asked });
  Object.defineProperty(globalThis, keys.written, { value: written });
  Object.defineProperty(globalThis, 'showSaveFilePicker', {
    value: (options: SaveOptions) => {
      asked.push({
        name: options.suggestedName,
        formats: options.types.map(({ description }) => description),
      });
      if (Reflect.get(globalThis, keys.dismissNext) === true) {
        Reflect.set(globalThis, keys.dismissNext, false);
        return Promise.reject(new DOMException('Dismissed', 'AbortError'));
      }
      return Promise.resolve({
        name: 'chosen.json',
        createWritable: () =>
          Promise.resolve({
            write: (text: string) => {
              written.push(text);
              return Promise.resolve();
            },
            close: () => Promise.resolve(),
          }),
      });
    },
  });
};

const recorded = (page: Page, key: string): Promise<unknown> =>
  page.evaluate((name): unknown => Reflect.get(globalThis, name), key);

const writtenBySavePicker = async (page: Page): Promise<string[]> => {
  const written = await recorded(page, savePicker.written);
  return Array.isArray(written) ? written.map(String) : [];
};

const rename = async (
  page: Page,
  node: RegExp,
  was: string,
  now: string,
): Promise<void> => {
  await nodeNamed(page, node).dblclick();
  await nameField(page, was).fill(now);
  await nameField(page, was).press('Enter');
};

test('opens a model, saves it back, and writes a file that parses again', async ({
  page,
}) => {
  await openFile(page, featureCompleteFile);

  await expectFileShown(page, 'feature-complete.json', 'Threat Dragon JSON');
  await expect(elementNodes(page)).toHaveCount(6);
  await expect(page.locator('.react-flow__edge')).toHaveCount(3);
  const report = page.getByTestId('loss-report');
  await expect(report).toContainText("The clerk's session token is guessable");
  await expect(report).not.toContainText('threat-card');

  const written = await savedFile(page);

  expect(written.name).toBe('feature-complete.json');
  expect(JSON.parse(written.text)).toMatchObject({
    version: '2.6.2',
    summary: { title: 'Clinic booking' },
  });
  await expect(page.getByTestId('loss-report')).toBeEmpty();
});

test('opens the native format by its content, and draws its diagram', async ({
  page,
}) => {
  await openFile(page, twoDiagramsFile);

  await expectFileShown(page, 'two-diagrams.yaml', 'Saerskriven YAML');
  await expect(elementNodes(page)).toHaveCount(7);
  await expect(page.locator('.react-flow__edge')).toHaveCount(7);
  await expect(nodeNamed(page, storefront.shopNetwork)).toBeVisible();
  await expect(nodeNamed(page, storefront.webShop)).toBeVisible();
});

test('after a reload, Save asks once through the save picker and writes there after, and a dismissed picker leaves the work unsaved', async ({
  page,
}) => {
  const downloads: string[] = [];
  page.on('download', (download) => {
    downloads.push(download.suggestedFilename());
  });
  await page.addInitScript(stubSavePicker, savePicker);
  await openPlaceholder(page);
  await chooseFile(page, featureCompleteFile);
  await rename(
    page,
    /^Booking service, process/u,
    'Booking service',
    'Recovered booking',
  );

  await page.reload();
  await expect(canvasContainer(page)).toBeVisible();
  await canvasSettled(page);
  await expect(menuButton(page)).toHaveAccessibleName(/unsaved changes/u);

  const asked = {
    name: 'feature-complete.json',
    formats: ['Threat Dragon JSON', 'Saerskriven YAML'],
  };
  await page.evaluate((key) => {
    Reflect.set(globalThis, key, true);
  }, savePicker.dismissNext);
  await runFromMenu(page, 'Save');
  await expect.poll(() => recorded(page, savePicker.asked)).toEqual([asked]);
  await expectFileShown(page, 'feature-complete.json', 'Threat Dragon JSON');
  await expect(menuButton(page)).toHaveAccessibleName(/unsaved changes/u);
  expect(await writtenBySavePicker(page)).toEqual([]);

  await runFromMenu(page, 'Save');
  await expect.poll(() => writtenBySavePicker(page)).toHaveLength(1);
  await expect(menuButton(page)).not.toHaveAccessibleName(/unsaved changes/u);
  await expectFileShown(page, 'chosen.json', 'Threat Dragon JSON');

  await rename(
    page,
    /^Recovered booking, process/u,
    'Recovered booking',
    'Booking desk',
  );
  await expect(menuButton(page)).toHaveAccessibleName(/unsaved changes/u);
  await runFromMenu(page, 'Save');
  await expect.poll(() => writtenBySavePicker(page)).toHaveLength(2);
  await expect(menuButton(page)).not.toHaveAccessibleName(/unsaved changes/u);

  expect(await recorded(page, savePicker.asked)).toEqual([asked, asked]);
  const written = await writtenBySavePicker(page);
  expect(written[0]).toContain('"Recovered booking"');
  expect(written[1]).toContain('"Booking desk"');
  expect(downloads).toEqual([]);
});
