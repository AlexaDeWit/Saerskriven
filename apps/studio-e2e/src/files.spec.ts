import { expect, test, type Page } from '@playwright/test';
import { saerskrivenYamlCodec } from '@saerskriven/formats';
import { testDataPath } from '@saerskriven/model/fixtures';
import { Either } from 'effect';
import { savePicker, stubSavePicker } from './save-picker.fixtures.js';
import {
  canvasContainer,
  canvasSettled,
  dragOnto,
  elementNodes,
} from './canvas.fixtures.js';
import {
  chooseFile,
  expectFileShown,
  featureCompleteFile,
  handleOn,
  menuButton,
  nameField,
  nodeNamed,
  openFallback,
  openFile,
  openPlaceholder,
  runFromMenu,
  savedFile,
  storefront,
  twoDiagramsFile,
} from './studio.fixtures.js';

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

test('opens an OTM file through Open as a new model, and saves native YAML under its stem', async ({
  page,
}) => {
  await openFallback(page);
  const chooser = page.waitForEvent('filechooser');
  await runFromMenu(page, 'Open');
  await (await chooser).setFiles(testDataPath('otm', 'example.json'));
  await expect(page.getByTestId('failure-notice')).toBeEmpty();
  await expect(page.getByTestId('loss-report')).not.toBeEmpty();
  await expect(page.locator('.react-flow__edge')).toHaveCount(2);
  await expect(menuButton(page)).toHaveAccessibleName('Menu, unsaved changes');
  const source = nodeNamed(page, /^Class CustomerDatabase, process/u);
  const target = nodeNamed(page, /^Customer Database, process/u);
  await source.hover();
  await dragOnto(page, handleOn(source, 'left'), handleOn(target, 'right'));
  await expect(page.locator('.react-flow__edge')).toHaveCount(3);
  const output = await savedFile(page);
  expect(output.name).toBe('example.yaml');
  const read = Either.getOrThrow(saerskrivenYamlCodec.read(output.text));
  expect(read.model.threats).toHaveLength(2);
  await expect(menuButton(page)).toHaveAccessibleName('Menu');
});

test('after a TM-BOM file opens, Save asks through the save picker with YAML under its stem', async ({
  page,
}) => {
  await page.addInitScript(stubSavePicker, savePicker);
  await openPlaceholder(page);
  await chooseFile(page, 'tmbom/example.json');
  await expect(menuButton(page)).toHaveAccessibleName('Menu, unsaved changes');

  await runFromMenu(page, 'Save');

  await expect.poll(() => writtenBySavePicker(page)).toHaveLength(1);
  expect(await recorded(page, savePicker.asked)).toEqual([
    {
      name: 'example.yaml',
      formats: ['Saerskriven YAML', 'Threat Dragon JSON'],
    },
  ]);
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
