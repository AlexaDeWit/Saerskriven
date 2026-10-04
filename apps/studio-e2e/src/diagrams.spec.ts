import { expect, test, type Page } from '@playwright/test';
import { registeredChords } from './chords.fixtures.js';
import {
  canvasContainer,
  canvasSettled,
  elementNodes,
} from './canvas.fixtures.js';
import {
  diagramChoice,
  diagramSwitcher,
  diagramTitleField,
  editAnnouncement,
  menuButton,
  menuItem,
  nodeNamed,
  openFallback,
  openMenu,
  openPlaceholder,
  openSwitcher,
  openTwoDiagrams,
  placeByClick,
  savedModel,
  tabTo,
  twoDiagrams,
  withoutPickers,
} from './studio.fixtures.js';

const { first, second } = twoDiagrams;
const firstTitle = first.title;
const secondTitle = second.title;
const onFirst = first.drawn;
const onSecond = second.drawn;

const drawnLineHeight = async (page: Page): Promise<number | undefined> =>
  (await editAnnouncement(page).boundingBox())?.height;

const messageExtent = async (page: Page): Promise<number | undefined> => {
  const box = await editAnnouncement(page).locator(':scope > *').boundingBox();
  return box === null ? undefined : Math.max(box.width, box.height);
};

const saidUndrawn = async (page: Page, title: string): Promise<void> => {
  const status = page.getByRole('status');
  await expect(status).toContainText(title);
  await expect.poll(() => status.ariaSnapshot()).toContain(title);
  await expect.poll(() => drawnLineHeight(page)).toBe(0);
  await expect.poll(() => messageExtent(page)).toBeLessThanOrEqual(1);
};

test('the switcher names the one diagram of the placeholder, and the menu holds no diagram group', async ({
  page,
}) => {
  await openPlaceholder(page);

  await expect(diagramSwitcher(page)).toHaveAccessibleName(
    'Diagram: Untitled diagram',
  );
  await openMenu(page);
  await expect(menuItem(page, 'Next diagram')).toHaveCount(0);
  await expect(page.getByRole('menuitemradio')).toHaveCount(0);
  await page.keyboard.press('Escape');

  await openSwitcher(page);
  await expect(diagramChoice(page, 'Untitled diagram')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(menuItem(page, 'New diagram')).toBeVisible();
  await expect(menuItem(page, 'Rename diagram')).toBeVisible();
});

test('the switcher lists the diagrams by title, and a choice draws the one chosen', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  await expect(nodeNamed(page, onFirst)).toHaveCount(1);
  await expect(nodeNamed(page, onSecond)).toHaveCount(0);
  await expect(diagramSwitcher(page)).toHaveAccessibleName(
    `Diagram: ${firstTitle}`,
  );

  await openSwitcher(page);
  await expect(diagramChoice(page, firstTitle)).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(diagramChoice(page, secondTitle)).toHaveAttribute(
    'aria-checked',
    'false',
  );
  await diagramChoice(page, secondTitle).click();

  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(nodeNamed(page, onSecond)).toHaveCount(1);
  await expect(nodeNamed(page, onFirst)).toHaveCount(0);
  await expect(diagramSwitcher(page)).toHaveAccessibleName(
    `Diagram: ${secondTitle}`,
  );
  await expect(diagramSwitcher(page)).toBeFocused();
  await expect(editAnnouncement(page)).toHaveText('');
});

test('a switcher choice ends the line a chord drew', async ({ page }) => {
  await openTwoDiagrams(page);
  await page.keyboard.press(registeredChords['next-diagram'][0]);
  await expect(editAnnouncement(page)).toContainText(secondTitle.slice(0, 12));

  await openSwitcher(page);
  await expect(editAnnouncement(page)).toContainText(secondTitle.slice(0, 12));
  await diagramChoice(page, firstTitle).click();

  await expect(diagramSwitcher(page)).toHaveAccessibleName(
    `Diagram: ${firstTitle}`,
  );
  await expect(editAnnouncement(page)).toHaveText('');
});

test('the next and previous chords step through the diagrams and wrap', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  const switcher = diagramSwitcher(page);

  await page.keyboard.press(registeredChords['next-diagram'][0]);
  await expect(switcher).toHaveAccessibleName(`Diagram: ${secondTitle}`);
  await expect(nodeNamed(page, onSecond)).toHaveCount(1);
  await expect(editAnnouncement(page)).toContainText(secondTitle.slice(0, 12));

  await page.keyboard.press(registeredChords['next-diagram'][0]);
  await expect(switcher).toHaveAccessibleName(`Diagram: ${firstTitle}`);

  await page.keyboard.press(registeredChords['previous-diagram'][0]);
  await expect(switcher).toHaveAccessibleName(`Diagram: ${secondTitle}`);
});

test('a step with focus on the switcher says the diagram in the status region and draws no line', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  const switcher = diagramSwitcher(page);
  const status = page.getByRole('status');

  await page.keyboard.press(registeredChords['next-diagram'][0]);
  await expect(status).toContainText(secondTitle);
  await expect.poll(() => drawnLineHeight(page)).toBe(0);

  await tabTo(page, switcher, menuButton(page));
  await page.keyboard.press(registeredChords['next-diagram'][0]);

  await expect(switcher).toHaveAccessibleName(`Diagram: ${firstTitle}`);
  await expect(switcher).toBeFocused();
  await expect(nodeNamed(page, onFirst)).toHaveCount(1);
  await saidUndrawn(page, firstTitle);

  await page.keyboard.press(registeredChords['previous-diagram'][0]);

  await expect(switcher).toHaveAccessibleName(`Diagram: ${secondTitle}`);
  await expect(switcher).toBeFocused();
  await saidUndrawn(page, secondTitle);

  await openSwitcher(page);
  await diagramChoice(page, firstTitle).click();

  await expect(switcher).toHaveAccessibleName(`Diagram: ${firstTitle}`);
  await expect(status).toHaveText('');
});

test('switching clears the selection and adds no history, so undo has nothing to do', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  const process = nodeNamed(page, onFirst);
  await process.click();
  await expect(process).toHaveClass(/selected/u);

  await page.keyboard.press(registeredChords['next-diagram'][0]);
  await expect(nodeNamed(page, onSecond)).toHaveCount(1);
  await page.keyboard.press(registeredChords.undo[0]);

  await expect(nodeNamed(page, onSecond)).toHaveCount(1);
  await openMenu(page);
  await expect(menuItem(page, 'Undo')).toHaveAttribute('data-disabled', '');
  await page.keyboard.press('Escape');
  await page.keyboard.press(registeredChords['previous-diagram'][0]);
  await expect(process).toHaveCount(1);
  await expect(process).not.toHaveClass(/selected/u);
});

test('a new diagram is named as it is made, drawn empty, and saved with its title', async ({
  page,
}) => {
  await openFallback(page);
  await expect(elementNodes(page)).toHaveCount(2);

  await openSwitcher(page);
  await menuItem(page, 'New diagram').click();

  const field = diagramTitleField(page);
  await expect(field).toBeFocused();
  await expect(field).toHaveValue('Untitled diagram');
  await page.keyboard.type('Request forgery');
  await page.keyboard.press('Enter');

  await expect(diagramSwitcher(page)).toHaveAccessibleName(
    'Diagram: Request forgery',
  );
  await expect(elementNodes(page)).toHaveCount(0);
  await placeByClick(page, 'Actor', /^New actor, actor/u);
  await page.keyboard.press('Enter');

  const written = await savedModel(page);
  expect(written.diagrams.map((diagram) => diagram.title)).toEqual([
    'Untitled diagram',
    'Request forgery',
  ]);

  await page.keyboard.press(registeredChords['previous-diagram'][0]);
  await expect(elementNodes(page)).toHaveCount(2);
});

test('a diagram is renamed in place, Escape keeps the old title, and undo takes the new one back', async ({
  page,
}) => {
  await openTwoDiagrams(page);

  await openSwitcher(page);
  await menuItem(page, 'Rename diagram').click();
  await expect(diagramTitleField(page)).toBeFocused();
  await page.keyboard.type('Abandoned');
  await page.keyboard.press('Escape');
  await expect(diagramSwitcher(page)).toHaveAccessibleName(
    `Diagram: ${firstTitle}`,
  );
  await expect(diagramSwitcher(page)).toBeFocused();

  await openSwitcher(page);
  await menuItem(page, 'Rename diagram').click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Enter');
  await expect(diagramTitleField(page)).toHaveAttribute('aria-invalid', 'true');
  const described =
    (await diagramTitleField(page).getAttribute('aria-describedby')) ?? '';
  await expect(page.locator(`[id="${described}"]`)).toBeVisible();
  await expect(page.locator(`[id="${described}"]`)).not.toBeEmpty();
  await page.keyboard.press('Escape');

  await openSwitcher(page);
  await menuItem(page, 'Rename diagram').click();
  await page.keyboard.type('Taking payment');
  await page.keyboard.press('Enter');
  await expect(diagramSwitcher(page)).toHaveAccessibleName(
    'Diagram: Taking payment',
  );
  await expect(diagramSwitcher(page)).toBeFocused();
  await openSwitcher(page);
  await expect(diagramChoice(page, 'Taking payment')).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.keyboard.press('Escape');

  await page.keyboard.press(registeredChords.undo[0]);
  await expect(diagramSwitcher(page)).toHaveAccessibleName(
    `Diagram: ${firstTitle}`,
  );

  await openSwitcher(page);
  await menuItem(page, 'Rename diagram').click();
  await page.keyboard.type('Clicked away');
  const process = nodeNamed(page, onFirst);
  await process.click();

  await expect(diagramSwitcher(page)).toHaveAccessibleName(
    'Diagram: Clicked away',
  );
  await expect(process).toBeFocused();
  await expect(diagramSwitcher(page)).not.toBeFocused();
});

test('a title committed with Enter returns focus to its name, and leaving the field announces it without drawing a line', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  await page.keyboard.press(registeredChords['next-diagram'][0]);
  await expect(editAnnouncement(page)).toContainText(secondTitle.slice(0, 12));

  await openSwitcher(page);
  await menuItem(page, 'Rename diagram').click();
  await expect(diagramTitleField(page)).toBeFocused();
  await page.keyboard.type('Dispatching');
  await page.keyboard.press('Enter');

  await expect(diagramSwitcher(page)).toHaveAccessibleName(
    'Diagram: Dispatching',
  );
  await expect(diagramSwitcher(page)).toBeFocused();
  await expect(editAnnouncement(page)).toHaveText('');

  await openSwitcher(page);
  await menuItem(page, 'Rename diagram').click();
  await expect(diagramTitleField(page)).toBeFocused();
  await page.keyboard.type('Tabbed away');
  await page.keyboard.press('Tab');

  await expect(diagramSwitcher(page)).toHaveAccessibleName(
    'Diagram: Tabbed away',
  );
  await expect(diagramSwitcher(page)).not.toBeFocused();
  await expect(editAnnouncement(page)).toContainText('Tabbed away');
  await expect.poll(() => drawnLineHeight(page)).toBe(0);
});

test('an edit lands on the diagram on screen, the saved file holds it there, and a reload comes back to that diagram', async ({
  page,
}) => {
  await page.addInitScript(withoutPickers);
  await openTwoDiagrams(page);
  await page.keyboard.press(registeredChords['next-diagram'][0]);
  await expect(nodeNamed(page, onSecond)).toHaveCount(1);
  await canvasSettled(page);

  await placeByClick(page, 'Actor', /^New actor, actor/u);
  await page.keyboard.press('Enter');

  const model = await savedModel(page);
  const named = (id: string): readonly string[] =>
    model.diagrams
      .find((diagram) => diagram.id === id)
      ?.elements.map((element) => element.name) ?? [];
  expect(named('fulfilment')).toContain('New actor');
  expect(named('storefront')).not.toContain('New actor');

  await page.reload();
  await expect(canvasContainer(page)).toBeVisible();
  await canvasSettled(page);

  await expect(diagramSwitcher(page)).toHaveAccessibleName(
    `Diagram: ${secondTitle}`,
  );
  await expect(nodeNamed(page, /^New actor, actor/u)).toHaveCount(1);
});
