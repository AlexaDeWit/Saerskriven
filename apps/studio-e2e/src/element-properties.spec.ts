import { expect, test, type Page } from '@playwright/test';
import { audit } from './accessibility.fixtures.js';
import { canvasSettled } from './canvas.fixtures.js';
import {
  chooseByKeyboard,
  chooseInPanel,
  openFile,
  savedModel,
  selectByKeyboard,
  storefront,
  threatPanel,
  twoDiagramsFile,
} from './studio.fixtures.js';

async function properties(page: Page, name: RegExp) {
  await selectByKeyboard(page, name);
  await threatPanel(page)
    .getByRole('button', { name: 'Security properties' })
    .click();
}

test('edits every element kind and preserves security facts through save, undo, redo and reload', async ({
  page,
}) => {
  test.setTimeout(60_000);
  test.info().annotations.push({
    type: 'timeout',
    description:
      'This scenario commits all 16 properties across five element kinds, then saves and reloads.',
  });
  await openFile(page, twoDiagramsFile);
  await properties(page, storefront.shopper);
  const authentication = threatPanel(page).getByRole('combobox', {
    name: 'Provides authentication',
  });
  await expect(authentication).toContainText('Not recorded');
  await authentication.focus();
  await chooseByKeyboard(page, 'ArrowDown');
  await expect(authentication).toContainText('Yes');
  await chooseInPanel(page, 'Provides authentication', 'No');

  await properties(page, storefront.webShop);
  await chooseInPanel(page, 'Handles card payments', 'No');
  await chooseInPanel(page, 'Handles goods or services', 'Yes');
  await chooseInPanel(page, 'Web application', 'No');
  await chooseInPanel(page, 'Privilege level recording', 'Recorded');
  const privilege = threatPanel(page).getByRole('textbox', {
    name: 'Privilege level',
  });
  await privilege.fill('operator');
  await privilege.press('Enter');
  await chooseInPanel(page, 'Privilege level recording', 'Not recorded');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(privilege).toHaveValue('operator');
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(privilege).toHaveCount(0);
  await chooseInPanel(page, 'Privilege level recording', 'Recorded');
  await expect(privilege).toHaveValue('');

  await properties(page, storefront.catalogue);
  for (const label of [
    'Log store',
    'Encrypted storage',
    'Signed storage',
    'Stores credentials',
    'Stores inventory',
  ]) {
    await chooseInPanel(page, label, 'No');
  }
  await chooseInPanel(page, 'Encrypted storage', 'Yes');

  await properties(page, /^browse the catalogue and fill a basket, flow/u);
  await chooseInPanel(page, 'Encrypted flow', 'Yes');
  await chooseInPanel(page, 'Public network', 'No');
  await chooseInPanel(page, 'Protocol recording', 'Recorded');
  await threatPanel(page)
    .getByRole('textbox', { name: 'Protocol' })
    .fill('HTTPS');
  await threatPanel(page)
    .getByRole('textbox', { name: 'Protocol' })
    .press('Enter');
  await chooseInPanel(page, 'Crossed trust boundaries recording', 'Recorded');
  await chooseInPanel(page, 'Add to crossed trust boundaries', 'Shop network');
  await threatPanel(page)
    .getByRole('group', { name: 'Crossed trust boundaries', exact: true })
    .getByRole('button', { name: 'Add relationship' })
    .click();

  await properties(page, storefront.shopNetwork);
  await chooseInPanel(page, 'Contained elements recording', 'Recorded');
  await chooseInPanel(page, 'Add to contained elements', 'Catalogue');
  await threatPanel(page)
    .getByRole('group', { name: 'Contained elements', exact: true })
    .getByRole('button', { name: 'Add relationship' })
    .click();
  await chooseInPanel(page, 'Crossing flows recording', 'Recorded');
  await chooseInPanel(
    page,
    'Add to crossing flows',
    'browse the catalogue and fill a basket',
  );
  await threatPanel(page)
    .getByRole('group', { name: 'Crossing flows', exact: true })
    .getByRole('button', { name: 'Add relationship' })
    .click();

  const saved = await savedModel(page);
  const elements = saved.diagrams[0].elements;
  expect(elements.find((element) => element.id === 'el-shopper')).toMatchObject(
    {
      providesAuthentication: false,
    },
  );
  expect(
    elements.find((element) => element.id === 'el-web-shop'),
  ).toMatchObject({
    handlesCardPayment: false,
    handlesGoodsOrServices: true,
    isWebApplication: false,
    privilegeLevel: '',
  });
  expect(
    elements.find((element) => element.id === 'el-catalogue'),
  ).toMatchObject({
    isALog: false,
    isEncrypted: true,
    isSigned: false,
    storesCredentials: false,
    storesInventory: false,
  });
  expect(elements.find((element) => element.id === 'el-browse')).toMatchObject({
    protocol: 'HTTPS',
    isEncrypted: true,
    isPublicNetwork: false,
    trustBoundaryIds: ['el-shop-network'],
  });
  expect(
    elements.find((element) => element.id === 'el-shop-network'),
  ).toMatchObject({
    containedElements: ['el-catalogue'],
    crossingFlows: ['el-browse'],
  });
  await page.reload();
  await canvasSettled(page);
  await properties(page, /^browse the catalogue and fill a basket, flow/u);
  await expect(
    threatPanel(page).getByRole('textbox', { name: 'Protocol' }),
  ).toHaveValue('HTTPS');
  await expect(
    threatPanel(page).getByRole('combobox', {
      name: 'Crossed trust boundaries 1',
      exact: true,
    }),
  ).toContainText('Shop network');
});

test('shows recorded and absent states at wide and narrow widths with accessible keyboard controls', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await openFile(page, twoDiagramsFile);
  await properties(page, /^browse the catalogue and fill a basket, flow/u);
  await chooseInPanel(page, 'Encrypted flow', 'No');
  await chooseInPanel(page, 'Protocol recording', 'Recorded');
  await chooseInPanel(page, 'Crossed trust boundaries recording', 'Recorded');
  await chooseInPanel(page, 'Add to crossed trust boundaries', 'Shop network');
  await threatPanel(page)
    .getByRole('button', { name: 'Add relationship' })
    .click();
  await expect(
    threatPanel(page).getByRole('combobox', { name: 'Public network' }),
  ).toContainText('Not recorded');
  await expect(
    threatPanel(page).getByRole('textbox', { name: 'Protocol' }),
  ).toHaveValue('');
  await audit(
    page,
    'showing security properties at desktop width',
    '[data-testid="threat-panel"]',
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await properties(page, storefront.shopNetwork);
  await chooseInPanel(page, 'Contained elements recording', 'Recorded');
  await expect(
    threatPanel(page).getByRole('combobox', {
      name: 'Crossing flows recording',
    }),
  ).toContainText('Not recorded');
  const target = threatPanel(page).getByRole('combobox', {
    name: 'Add to contained elements',
  });
  await target.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('option', { name: 'Shop network', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('option', { name: 'Dispatch', exact: true }),
  ).toHaveCount(0);
  await audit(
    page,
    'showing a relationship listbox at phone width',
    '[role="listbox"]',
  );
  await page.keyboard.press('Escape');
  await expect(target).toBeFocused();
  const bounds = await threatPanel(page).boundingBox();
  expect(bounds).not.toBeNull();
  expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(390);
  expect(
    await threatPanel(page).evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
});

test('deletion and copying update declared relationships through the editor', async ({
  page,
}) => {
  await openFile(page, twoDiagramsFile);
  await properties(page, /^browse the catalogue and fill a basket, flow/u);
  await chooseInPanel(page, 'Crossed trust boundaries recording', 'Recorded');
  await chooseInPanel(page, 'Add to crossed trust boundaries', 'Shop network');
  await threatPanel(page)
    .getByRole('button', { name: 'Add relationship' })
    .click();
  await properties(page, storefront.shopNetwork);
  await chooseInPanel(page, 'Contained elements recording', 'Recorded');
  await chooseInPanel(page, 'Add to contained elements', 'Catalogue');
  await threatPanel(page)
    .getByRole('group', { name: 'Contained elements', exact: true })
    .getByRole('button', { name: 'Add relationship' })
    .click();
  await chooseInPanel(page, 'Crossing flows recording', 'Recorded');
  await chooseInPanel(
    page,
    'Add to crossing flows',
    'browse the catalogue and fill a basket',
  );
  await threatPanel(page)
    .getByRole('group', { name: 'Crossing flows', exact: true })
    .getByRole('button', { name: 'Add relationship' })
    .click();

  await selectByKeyboard(page, storefront.catalogue);
  await page.keyboard.press('Delete');
  await properties(page, storefront.shopNetwork);
  const contained = threatPanel(page).getByRole('combobox', {
    name: 'Contained elements 1',
    exact: true,
  });
  await expect(contained).toHaveCount(0);
  await page.keyboard.press('ControlOrMeta+z');
  await expect(contained).toContainText('Catalogue');
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(contained).toHaveCount(0);

  const boundary = page.locator('.react-flow__node[data-id="el-shop-network"]');
  await boundary.focus();
  await page.keyboard.press('ControlOrMeta+d');
  const copied = (await savedModel(page)).diagrams[0].elements;
  const boundaries = copied.filter(
    (element) =>
      element.kind === 'trust-boundary' && element.name === 'Shop network',
  );
  expect(boundaries).toHaveLength(2);
  expect(
    boundaries.find((element) => element.id === 'el-shop-network'),
  ).toMatchObject({ containedElements: [], crossingFlows: ['el-browse'] });
  expect(
    boundaries.find((element) => element.id !== 'el-shop-network'),
  ).toMatchObject({ containedElements: [], crossingFlows: [] });

  await boundary.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Delete');
  const removed = await savedModel(page);
  expect(
    removed.diagrams[0].elements.find((element) => element.id === 'el-browse'),
  ).toMatchObject({ trustBoundaryIds: [] });
});
