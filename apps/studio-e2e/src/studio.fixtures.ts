import { expect, type Locator, type Page } from '@playwright/test';
import { readAnyFormat, type DetectedRead } from '@saerskriven/formats';
import type { Model } from '@saerskriven/model';
import { committedText, testDataPath } from '@saerskriven/model/fixtures';
import { Either } from 'effect';
import { readFileSync } from 'node:fs';
import {
  canvasContainer,
  canvasSettled,
  centreOf,
  emptyCanvasPoint,
  reachesAt,
} from './canvas.fixtures.js';

const developmentModelKey = 'saerskrivenDevelopmentModel';

const recoveryStorageKey = 'saerskriven:studio:recovery';

/** The local storage key the studio keeps the chosen language under. */
export const languageStorageKey = 'saerskrivenLanguage';

/** A Saerskriven YAML document every format refuses, for a spec that needs a failure notice on screen. */
export const refusedYaml = ['formatVersion: 1', 'diagrams: none'].join('\n');

/** The recovery snapshot the studio last wrote, as stored, or `null` before its first write. */
export const recoverySnapshot = (page: Page): Promise<string | null> =>
  page.evaluate((key) => localStorage.getItem(key), recoveryStorageKey);

/** What the placeholder model draws, by the names assistive technology has for them. */
export const placeholder = {
  actor: /^Actor, actor/u,
  store: /^Store, store/u,
  records: /^Records, flow/u,
} as const;

/** Elements of the two-diagram model's storefront diagram by accessible name, and threats on them by title. */
export const storefront = {
  shopper: /^Shopper, actor/u,
  webShop: /^Web shop, process/u,
  catalogue: /^Catalogue, store/u,
  ledger: /^Order ledger, store/u,
  shopNetwork: /^Shop network, trust boundary/u,
  takeover: /Account takeover/u,
  basketPrice: /Basket price changed/u,
  orderDenied: /Shopper denies placing an order/u,
} as const;

/** What the two-diagram model's diagrams are called, and an element drawn on each. */
export const twoDiagrams = {
  first: {
    title: 'Taking an order',
    drawn: storefront.webShop,
  },
  second: {
    title: 'Shipping an order',
    drawn: /^Dispatch, process/u,
  },
} as const;

/** The native file of the two-diagram model under `test-data`, for a spec that opens it through the picker. */
export const twoDiagramsFile = 'saerskriven/two-diagrams.yaml';

/** A Threat Dragon file under `test-data` that uses every construct the format carries, for a spec that opens one through the picker. */
export const featureCompleteFile = 'threat-dragon/feature-complete.json';

/** Waits until `target` has held focus over two consecutive readings. */
export const focusSettled = async (target: Locator): Promise<void> => {
  let before = false;
  await expect
    .poll(async () => {
      const now = await target.evaluate(
        (element) => element === document.activeElement,
      );
      const settled = now && before;
      before = now;
      return settled;
    })
    .toBe(true);
};

const landed = async (page: Page): Promise<void> => {
  await expect(canvasContainer(page)).toBeVisible();
  await canvasSettled(page);
};

/** Opens a model document at `entry` through the development hook. Existing recovery still takes precedence. */
export const openModelDocument = async (
  page: Page,
  model: unknown,
  entry = '/',
): Promise<void> => {
  await page.addInitScript(
    ({ key, model: document }) => {
      Object.defineProperty(globalThis, key, { value: document });
    },
    { key: developmentModelKey, model },
  );
  await page.goto(entry);
  await landed(page);
};

/**
 * Opens the studio on `test-data/two-diagrams.model.json` through
 * {@link openModelDocument}, with its first diagram, `Taking an order`, on
 * screen.
 */
export const openTwoDiagrams = async (page: Page): Promise<void> => {
  await openModelDocument(
    page,
    JSON.parse(committedText('two-diagrams.model.json')),
  );
};

/** Opens the studio on the model it carries until a file can be opened. */
export const openPlaceholder = async (page: Page): Promise<void> => {
  await page.goto('/');
  await landed(page);
};

/** Removes native picker APIs so tests use the file input and download fallback. */
export const withoutPickers = (): void => {
  Reflect.deleteProperty(globalThis, 'showOpenFilePicker');
  Reflect.deleteProperty(globalThis, 'showSaveFilePicker');
};

/** Opens the studio at `entry` on its placeholder model, with the picker APIs removed so files go through the input and downloads. */
export const openFallback = async (page: Page, entry = '/'): Promise<void> => {
  await page.addInitScript(withoutPickers);
  await page.goto(entry);
  await landed(page);
};

/** Hands the fallback picker a file under `test-data`, and waits for its canvas. */
export const chooseFile = async (page: Page, path: string): Promise<void> => {
  await page.getByTestId('file-input').setInputFiles(testDataPath(path));
  await expect(page.getByTestId('failure-notice')).toBeEmpty();
  await canvasSettled(page);
};

/** Opens a file under `test-data` through the fallback picker and waits for its canvas. */
export const openFile = async (
  page: Page,
  path: string,
  entry = '/',
): Promise<void> => {
  await openFallback(page, entry);
  await chooseFile(page, path);
};

/**
 * Hands the fallback picker text under a name, for a file the repository does
 * not hold: a refusal to word, or a model a spec has just written.
 */
export const openText = async (
  page: Page,
  name: string,
  text: string,
): Promise<void> => {
  await page.getByTestId('file-input').setInputFiles({
    name,
    mimeType: 'text/plain',
    buffer: Buffer.from(text),
  });
};

/** The button the studio's one menu opens from. */
export const menuButton = (page: Page): Locator =>
  page.getByRole('button', { name: /^(?:Menu|Meny)/u });

/** One command of the open menu, by the words it runs under. */
export const menuItem = (page: Page, name: string): Locator =>
  page.getByRole('menuitem', { name, exact: true });

/** Opens the menu only when closed, making its file-dependent items available. */
export const openMenu = async (page: Page): Promise<void> => {
  if (await page.getByRole('menu').isVisible()) {
    return;
  }
  await menuButton(page).click();
  await expect(page.getByRole('menu')).toBeVisible();
};

/** Puts the menu away, and does nothing where it is already away. */
export const closeMenu = async (page: Page): Promise<void> => {
  if ((await page.getByRole('menu').count()) === 0) {
    return;
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
};

/** Runs one menu command, which puts the menu away as it runs. */
export const runFromMenu = async (page: Page, name: string): Promise<void> => {
  await openMenu(page);
  await menuItem(page, name).click();
  await expect(page.getByRole('menu')).toHaveCount(0);
};

/** Whether the menu offers Undo, read by opening the menu and putting it away again. */
export const undoOffered = async (
  page: Page,
  undo = 'Undo',
): Promise<boolean> => {
  await openMenu(page);
  const disabled = await menuItem(page, undo).getAttribute('aria-disabled');
  await closeMenu(page);
  return disabled !== 'true';
};

/** Checks, in the menu, the name and the format of the file the studio holds, and puts the menu away again. */
export const expectFileShown = async (
  page: Page,
  name: string,
  format: string,
): Promise<void> => {
  await openMenu(page);
  await expect(page.getByTestId('file-state')).toContainText(name);
  await expect(page.getByTestId('file-state')).toContainText(format);
  await closeMenu(page);
};

type Downloaded = {
  readonly name: string;
  readonly bytes: Buffer;
  readonly text: string;
};

/** Runs `start`, and reads back the file the download it sets off wrote. */
export const downloaded = async (
  page: Page,
  start: () => Promise<void>,
): Promise<Downloaded> => {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    start(),
  ]);
  const bytes = readFileSync(await download.path());
  return {
    name: download.suggestedFilename(),
    bytes,
    text: bytes.toString('utf8'),
  };
};

/** Saves from the menu through the download path, and reads back what was written. */
export const savedFile = async (page: Page): Promise<Downloaded> => {
  await openMenu(page);
  return downloaded(page, () => menuItem(page, 'Save').click());
};

/** Presses `chord` and reads back the file the studio wrote through it. */
export const savedByKey = async (
  page: Page,
  chord: string,
): Promise<Downloaded> => downloaded(page, () => page.keyboard.press(chord));

/**
 * Answers the format question the menu asks where the browser has no save
 * picker, and reads back the file that went out. The question stands in the
 * menu whether a chord or an item put it there, so this waits for the item
 * rather than for the menu.
 */
export const savedFromMenu = async (
  page: Page,
  item: string,
): Promise<Downloaded> => {
  const chosen = menuItem(page, item);
  await expect(chosen).toBeVisible();
  return downloaded(page, () => chosen.click());
};

/** Opens the Export menu, under its name in the active language, chooses one item and reads its download. */
export const exportedFile = async (
  page: Page,
  item: string,
  exportMenu = 'Export',
): Promise<Downloaded> => {
  await openMenu(page);
  await menuItem(page, exportMenu).hover();
  const chosen = menuItem(page, item);
  await expect(chosen).toBeVisible();
  return downloaded(page, () => chosen.click());
};

/** Reads a written or committed file in whichever format claims it, and fails the test where none does. */
export const readBack = (text: string): DetectedRead =>
  Either.getOrThrowWith(
    readAnyFormat(text),
    () => new Error(`no format claimed the file: ${text.slice(0, 200)}`),
  );

/** Saves through the download path and reads the model back out of the file. */
export const savedModel = async (page: Page): Promise<Model> =>
  readBack((await savedFile(page)).text).model;

/** One element or flow, by the name assistive technology has for it. */
export const nodeNamed = (page: Page, name: string | RegExp): Locator =>
  page.getByRole('group', { name });

/** The in-place field that renames the element or flow called `was`. */
export const nameField = (page: Page, was: string): Locator =>
  page.getByRole('textbox', { name: `Name of ${was}`, exact: true });

/** Finds an attachment handle by the element side used as its ID. */
export const handleOn = (
  node: Locator,
  side: 'top' | 'right' | 'bottom' | 'left',
): Locator => node.locator(`[data-handleid="${side}"]`);

/** The diagram application receives focus after deleting its focused element. */
export const canvasSurface = (page: Page): Locator =>
  page.getByRole('application', { name: 'Diagram' });

/** What the canvas last said an edit did. */
export const editAnnouncement = (page: Page): Locator =>
  page.getByTestId('canvas-announcement');

/** One icon in the toolbox, row two of the chrome card. */
export const toolButton = (page: Page, name: string): Locator =>
  page.getByRole('button', { name, exact: true });

/** The card holding the menu button, the diagram control and the toolbox. */
export const chromeCard = (page: Page): Locator =>
  page.getByTestId('chrome-card');

/** The control joined to the menu button that names the diagram on screen. */
export const diagramSwitcher = (page: Page): Locator =>
  page.getByTestId('diagram-switcher');

/** The field the switcher becomes while a diagram's title is being edited. */
export const diagramTitleField = (page: Page): Locator =>
  page.getByRole('textbox', { name: 'Diagram title' });

/** Opens the switcher's list, and does nothing where it is already open. */
export const openSwitcher = async (page: Page): Promise<void> => {
  if (await page.getByRole('menu').isVisible()) {
    return;
  }
  await diagramSwitcher(page).click();
  await expect(page.getByRole('menu')).toBeVisible();
};

/** One diagram in the open menu or the open switcher, by its title. */
export const diagramChoice = (page: Page, title: string): Locator =>
  page.getByRole('menuitemradio', { name: title, exact: true });

const toolNames = [
  'Select',
  'Actor',
  'Process',
  'Store',
  'Trust boundary',
  'Trust boundary curve',
  'Note',
  'Hand',
] as const;

/** Checks viewport bounds and hit targets, because visible controls can still be covered. */
export const cardControlsClear = async (page: Page): Promise<void> => {
  const controls = [
    menuButton(page),
    diagramSwitcher(page),
    ...toolNames.map((name) => toolButton(page, name)),
  ];
  for (const control of controls) {
    await expect(control).toBeInViewport();
    const reached = await reachesAt(control, await centreOf(control));
    const named = await control.getAttribute('aria-label');
    expect(reached, `${named ?? 'a card control'} is covered`).toBe(true);
  }
};

/** The Hand tool is the last persistent control before the canvas in the tab order. */
export const beforeCanvas = (page: Page): Locator => toolButton(page, 'Hand');

/**
 * Selects an element tool and clicks a clear point on the canvas. The placed
 * element is returned with its placeholder name open in the in-place field.
 */
export const placeByClick = async (
  page: Page,
  tool: 'Actor' | 'Process' | 'Store' | 'Trust boundary',
  named: RegExp,
): Promise<Locator> => {
  const at = await emptyCanvasPoint(page);
  await toolButton(page, tool).click();
  await page.mouse.click(at.x, at.y);
  const placed = nodeNamed(page, named);
  await expect(placed).toHaveCount(1);
  return placed;
};

/** Waits for canvas layout and sends one click. A missed selection fails instead of retrying the gesture. */
export const selectNode = async (
  page: Page,
  name: RegExp,
): Promise<Locator> => {
  const node = nodeNamed(page, name);
  await expect(node).toBeVisible();
  await canvasSettled(page);
  await node.click();
  await expect(node).toHaveClass(/selected/u);
  return node;
};

/** Selects an element by focusing it and pressing Enter, then waits for the canvas to settle. */
export const selectByKeyboard = async (
  page: Page,
  name: RegExp,
): Promise<Locator> => {
  const node = nodeNamed(page, name);
  await expect(node).toBeVisible();
  await canvasSettled(page);
  await node.focus();
  await page.keyboard.press('Enter');
  await expect(node).toHaveClass(/selected/u);
  await canvasSettled(page);
  return node;
};

/** The panel holding the threats of whatever the canvas has selected. */
export const threatPanel = (page: Page): Locator =>
  page.getByRole('region', { name: 'Threats' });

/** One of the panel's fields, by its exact accessible name. */
export const panelField = (
  page: Page,
  role: 'textbox' | 'combobox',
  name: string,
): Locator => threatPanel(page).getByRole(role, { name, exact: true });

/** One of the panel's buttons, by its exact accessible name. */
export const panelControl = (page: Page, name: string): Locator =>
  threatPanel(page).getByRole('button', { name, exact: true });

/** The summary button of the panel's threat whose accessible name matches `title`. */
export const threatSummary = (page: Page, title: string | RegExp): Locator =>
  threatPanel(page).getByRole('button', { name: title });

/** Scrolls the nearest scrolling ancestor alone so `target` meets its top or bottom edge, and says whether it reached there. */
export const scrollPaneTo = (
  target: Locator,
  edge: 'top' | 'bottom',
): Promise<boolean> =>
  target.evaluate((element, side) => {
    let pane = element.parentElement;
    while (pane !== null && getComputedStyle(pane).overflowY !== 'auto') {
      pane = pane.parentElement;
    }
    if (pane === null) {
      return false;
    }
    const drawn = element.getBoundingClientRect();
    const port = pane.getBoundingClientRect().top + pane.clientTop;
    const wanted =
      pane.scrollTop +
      (side === 'top'
        ? drawn.top - port
        : drawn.bottom - port - pane.clientHeight);
    pane.scrollTop = wanted;
    return Math.abs(pane.scrollTop - wanted) < 1;
  }, edge);

/** Expands the panel's threat whose summary matches `title`. */
export const expandThreat = async (
  page: Page,
  title: RegExp,
): Promise<void> => {
  const summary = threatSummary(page, title);
  await summary.click();
  await expect(summary).toHaveAttribute('aria-expanded', 'true');
};

/** Adds a record through the panel's Add control, typing its first field and, when given, a mitigation's description, each left by Tab. */
export const addRecord = async (
  page: Page,
  kind: 'mitigation' | 'assumption',
  text: string,
  description?: string,
): Promise<void> => {
  await panelControl(page, `Add ${kind}`).click();
  await page.keyboard.type(text);
  await page.keyboard.press('Tab');
  if (description !== undefined) {
    await page.keyboard.type(description);
    await page.keyboard.press('Tab');
  }
};

/** Chooses an option in one listbox of a panel, the threat panel unless another region is named, by pointer, and waits for the listbox to close. */
export const chooseInPanel = async (
  page: Page,
  field: string,
  option: string | RegExp,
  region: Locator = threatPanel(page),
): Promise<void> => {
  await region.getByRole('combobox', { name: field, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
};

/**
 * Whether an "Existing" combobox offers a record under `label`, read by
 * opening its listbox and putting it away again. A combobox the panel does
 * not draw offers nothing.
 */
export const offeredToLink = async (
  page: Page,
  existing: Locator,
  label: string,
): Promise<boolean> => {
  if ((await existing.count()) === 0) {
    return false;
  }
  await existing.click();
  await expect(page.getByRole('listbox')).toBeVisible();
  const found = await page
    .getByRole('option', { name: label, exact: true })
    .count();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  return found > 0;
};

/** Follows real listbox focus because Radix marks aria-selected only for an already selected focused option. */
export const focusedOption = (page: Page): Locator =>
  page.locator('[role="option"]:focus');

/** Retries arrow navigation until focus moves, accounting for Radix restoring focus after popup positioning. */
export const stepThroughOptions = async (
  page: Page,
  step: 'ArrowDown' | 'ArrowUp',
): Promise<string> => {
  await expect(focusedOption(page)).toHaveCount(1);
  const already = (await focusedOption(page).textContent()) ?? '';
  await expect(async () => {
    await page.keyboard.press(step);
    await expect(focusedOption(page)).not.toHaveText(already, {
      timeout: 250,
    });
  }).toPass();
  return (await focusedOption(page).textContent()) ?? '';
};

/**
 * Chooses the option one step from the one already set, from the focused
 * listbox trigger, by keyboard alone.
 */
export const chooseByKeyboard = async (
  page: Page,
  step: 'ArrowDown' | 'ArrowUp',
): Promise<void> => {
  await page.keyboard.press('Enter');
  await stepThroughOptions(page, step);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox')).toHaveCount(0);
};
