import { expect, test, type Page } from '@playwright/test';
import { canvasSettled, elementNodes } from './canvas.fixtures.js';
import {
  expectFileShown,
  menuButton,
  menuItem,
  nameField,
  nodeNamed,
  openFile,
  runFromMenu,
  storefront,
  twoDiagramsFile,
} from './studio.fixtures.js';

const shared = async (page: Page): Promise<string> => {
  await runFromMenu(page, 'Share as link');
  await expect(page.getByTestId('share-report')).not.toBeEmpty();
  return page.evaluate(() => navigator.clipboard.readText());
};

const moduleFetches = (page: Page): string[] => {
  const fetched: string[] = [];
  page.on('request', (request) => {
    if (
      request.resourceType() === 'fetch' &&
      request.url().includes('brotli')
    ) {
      fetched.push(request.url());
    }
  });
  return fetched;
};

test('shares a model as a link that opens in a new page, unsaved', async ({
  browser,
  context,
  page,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const fetched = moduleFetches(page);
  await openFile(page, twoDiagramsFile);
  expect(fetched).toEqual([]);

  const link = await shared(page);

  expect(fetched).toHaveLength(1);
  expect(link).toContain('/#share=1.');
  await expect(page.getByTestId('share-report')).toContainText(
    new Intl.NumberFormat('en-CA').format(link.length),
  );
  const reader = await browser.newContext({ locale: 'en-CA' });
  const opened = await reader.newPage();
  await opened.goto(link);
  await canvasSettled(opened);

  await expect(elementNodes(opened)).toHaveCount(7);
  await expect(nodeNamed(opened, storefront.webShop)).toBeVisible();
  await expect(menuButton(opened)).toHaveAccessibleName(
    'Menu, unsaved changes',
  );
  await expectFileShown(opened, 'Two diagrams.yaml', 'Saerskriven YAML');
  expect(new URL(opened.url()).hash).toBe('');
  await reader.close();
});

test('a link opened in a second tab over unsaved work asks rather than losing the work', async ({
  context,
  page,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openFile(page, twoDiagramsFile);
  const link = await shared(page);
  await nodeNamed(page, storefront.webShop).dblclick();
  await nameField(page, 'Web shop').fill('Till');
  await nameField(page, 'Web shop').press('Enter');
  await expect(nodeNamed(page, /^Till, process/u)).toHaveCount(1);

  const other = await context.newPage();
  await other.goto(link);
  await canvasSettled(other);

  await expect(
    menuItem(other, 'Discard changes and open the link'),
  ).toBeFocused();
  await expect(nodeNamed(other, /^Till, process/u)).toHaveCount(1);
  await menuItem(other, 'Cancel').click();

  await expect(other.getByRole('menu')).toHaveCount(0);
  expect(new URL(other.url()).hash).toBe('');
  await expect(nodeNamed(other, /^Till, process/u)).toHaveCount(1);
  await expect(nodeNamed(page, /^Till, process/u)).toHaveCount(1);
  await other.reload();
  await canvasSettled(other);
  await expect(other.getByRole('menu')).toHaveCount(0);
  await expect(nodeNamed(other, /^Till, process/u)).toHaveCount(1);
});
