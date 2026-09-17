import { expect, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Box, Point } from './canvas-geometry.fixtures.js';

const developmentModelKey = 'saerskrivenDevelopmentModel';

/** A file of the repository, named from the root, as a path on disk. */
export const vendored = (path: string): string =>
  join(__dirname, '../../..', path);

/** The box the diagram is drawn in, chrome and graph paper included. */
export const canvasContainer = (page: Page): Locator =>
  page.getByTestId('canvas-container');

/** Waits for consecutive matching viewport transforms before a canvas gesture. */
export const canvasSettled = async (page: Page): Promise<void> => {
  const viewport = page.locator('.react-flow__viewport');
  let before = '';
  await expect
    .poll(async () => {
      const now = (await viewport.getAttribute('style')) ?? '';
      const settled = now !== '' && now === before;
      before = now;
      return settled;
    })
    .toBe(true);
};

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

/** Opens a model document through the development hook. Existing recovery still takes precedence. */
export const openModelDocument = async (
  page: Page,
  model: unknown,
): Promise<void> => {
  await page.addInitScript(
    ({ key, model: document }) => {
      Object.defineProperty(globalThis, key, { value: document });
    },
    { key: developmentModelKey, model },
  );
  await page.goto('/');
  await expect(canvasContainer(page)).toBeVisible();
  await canvasSettled(page);
};

/** The native file of the two-diagram model, for a spec that opens it through the picker. */
export const twoDiagramsFile = 'test-data/saerskriven/two-diagrams.yaml';

/** A Threat Dragon file that uses every construct the format carries, for a spec that opens one through the picker. */
export const featureCompleteFile =
  'test-data/threat-dragon/feature-complete.json';

/**
 * Opens the studio on `test-data/two-diagrams.model.json` through
 * {@link openModelDocument}, with its first diagram, `Taking an order`, on
 * screen.
 */
export const openTwoDiagrams = async (page: Page): Promise<void> => {
  await openModelDocument(
    page,
    JSON.parse(
      readFileSync(vendored('test-data/two-diagrams.model.json'), 'utf8'),
    ),
  );
};

/** What the two-diagram model's diagrams are called, and an element drawn on each. */
export const twoDiagrams = {
  first: {
    title: 'Taking an order',
    drawn: /^Web shop, process/u,
  },
  second: {
    title: 'Shipping an order',
    drawn: /^Dispatch, process/u,
  },
} as const;

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

/** Opens the studio on the model it carries until a file can be opened. */
export const openPlaceholder = async (page: Page): Promise<void> => {
  await page.goto('/');
  await expect(canvasContainer(page)).toBeVisible();
  await canvasSettled(page);
};

/** Removes native picker APIs so tests use the file input and download fallback. */
export const withoutPickers = (): void => {
  Reflect.deleteProperty(globalThis, 'showOpenFilePicker');
  Reflect.deleteProperty(globalThis, 'showSaveFilePicker');
};

/** Opens a vendored file through the fallback picker and waits for its canvas. */
export const openFile = async (
  page: Page,
  path: string,
  entry = '/',
): Promise<void> => {
  await page.addInitScript(withoutPickers);
  await page.goto(entry);
  await expect(canvasContainer(page)).toBeVisible();
  await page.getByTestId('file-input').setInputFiles(vendored(path));
  await expect(page.getByTestId('failure-notice')).toBeEmpty();
  await canvasSettled(page);
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
  page.getByRole('button', { name: /^Menu/u });

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

type SavedFile = {
  readonly name: string;
  readonly text: string;
};

/** Saves through that download path, and reads back what was written. */
export const savedFile = async (page: Page): Promise<SavedFile> => {
  await openMenu(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    menuItem(page, 'Save').click(),
  ]);
  return {
    name: download.suggestedFilename(),
    text: readFileSync(await download.path(), 'utf8'),
  };
};

type ExportedFile = {
  readonly name: string;
  readonly bytes: Buffer;
};

/** Opens the Export menu, chooses one item and reads its download. */
export const exportedFile = async (
  page: Page,
  item: string,
): Promise<ExportedFile> => {
  await openMenu(page);
  await menuItem(page, 'Export').hover();
  const chosen = menuItem(page, item);
  await expect(chosen).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    chosen.click(),
  ]);
  return {
    name: download.suggestedFilename(),
    bytes: readFileSync(await download.path()),
  };
};

/** Visible box elements exclude the hidden anchors of free flow ends. */
export const elementNodes = (page: Page): Locator =>
  page.locator('.react-flow__nodes').getByRole('group');

/** One element or flow, by the name assistive technology has for it. */
export const nodeNamed = (page: Page, name: string | RegExp): Locator =>
  page.getByRole('group', { name });

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

/** Expands the panel's threat whose summary matches `title`. */
export const expandThreat = async (
  page: Page,
  title: RegExp,
): Promise<void> => {
  const disclosure = threatPanel(page).getByRole('button', { name: title });
  await disclosure.click();
  await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
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

/** Scrolls a control into view and fails where it is off screen or something else covers its centre. */
export const onScreen = async (target: Locator): Promise<void> => {
  await target.scrollIntoViewIfNeeded();
  await expect(target).toBeInViewport();
  const reached = await reachesAt(target, await centreOf(target));
  expect(reached, 'the control is covered').toBe(true);
};

/** Whether the menu offers Undo, read by opening the menu and putting it away again. */
export const undoOffered = async (page: Page): Promise<boolean> => {
  await openMenu(page);
  const disabled = await menuItem(page, 'Undo').getAttribute('aria-disabled');
  await closeMenu(page);
  return disabled !== 'true';
};

/** Reads a node position from its transform without including the selection-dependent stacking style. */
export const placeOf = async (node: Locator): Promise<string> => {
  const style = (await node.getAttribute('style')) ?? '';
  return /translate\([^)]*\)/u.exec(style)?.[0] ?? style;
};

/** Whether the topmost element at a screen point is `target` or inside it. */
export const reachesAt = (target: Locator, at: Point): Promise<boolean> =>
  target.evaluate(
    (node, point) => node.contains(document.elementFromPoint(point.x, point.y)),
    at,
  );

/** How far every ancestor of `target` is scrolled, summed, so a scroll anywhere above it shows. */
export const scrolledAbove = (target: Locator): Promise<number> =>
  target.evaluate((element) => {
    let scrolled = 0;
    for (let node = element.parentElement; node; node = node.parentElement) {
      scrolled += node.scrollTop;
    }
    return scrolled;
  });

/** Where a control is drawn on screen, held to be drawn at all. */
export const screenBoxOf = async (
  target: Locator,
  called?: string,
): Promise<Box> => {
  const box = await target.boundingBox();
  expect(
    box,
    called === undefined ? undefined : `${called} is on the page`,
  ).not.toBeNull();
  return box ?? { x: 0, y: 0, width: 0, height: 0 };
};

/** The centre of where a control is drawn on screen. */
export const centreOf = async (target: Locator): Promise<Point> => {
  const box = await screenBoxOf(target);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

/** Drags from the centre of `target` by the given screen-pixel offset. */
export const dragBy = async (
  page: Page,
  target: Locator,
  by: number | Point,
): Promise<void> => {
  const start = await centreOf(target);
  const offset = typeof by === 'number' ? { x: by, y: by } : by;
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + offset.x, start.y + offset.y, { steps: 8 });
  await page.mouse.up();
};

/** Drags from the centre of a locator to a point on the page. */
export const dragTo = async (
  page: Page,
  from: Locator,
  to: Point,
): Promise<void> => {
  const start = await centreOf(from);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
};

/** Drags from the centre of one locator to the centre of another. */
export const dragOnto = async (
  page: Page,
  from: Locator,
  onto: Locator,
): Promise<void> => {
  await dragTo(page, from, await centreOf(onto));
};

/** Draws one selection box around every node in `targets`. */
export const boxSelect = async (
  page: Page,
  targets: readonly [Locator, ...Locator[]],
): Promise<void> => {
  const boxes = await Promise.all(
    targets.map((target) => target.boundingBox()),
  );
  expect(boxes.every((box) => box !== null)).toBe(true);
  const drawn = boxes.filter((box): box is Box => box !== null);
  const margin = 16;
  const from = {
    x: Math.min(...drawn.map((box) => box.x)) - margin,
    y: Math.min(...drawn.map((box) => box.y)) - margin,
  };
  const to = {
    x: Math.max(...drawn.map((box) => box.x + box.width)) + margin,
    y: Math.max(...drawn.map((box) => box.y + box.height)) + margin,
  };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await expect(page.locator('.react-flow__selection')).toBeVisible();
  await page.mouse.up();
};

const clearBy = 48;

const steps = 8;

const chromeFree = 0.75;

const grid = Array.from({ length: steps - 1 }, (unused, step) => step + 1);

const clearOf = (boxes: readonly (Box | null)[], at: Point): boolean =>
  boxes.every(
    (box) =>
      box === null ||
      at.x < box.x - clearBy ||
      at.x > box.x + box.width + clearBy ||
      at.y < box.y - clearBy ||
      at.y > box.y + box.height + clearBy,
  );

/** Finds a point clear of drawn elements, connection snap distance and the lower chrome area. */
export const emptyCanvasPoint = async (page: Page): Promise<Point> => {
  const canvas = await canvasContainer(page).boundingBox();
  expect(canvas).not.toBeNull();
  const corner = { x: canvas?.x ?? 0, y: canvas?.y ?? 0 };
  const room = {
    width: canvas?.width ?? 0,
    height: (canvas?.height ?? 0) * chromeFree,
  };
  const drawn = await Promise.all(
    (await elementNodes(page).all()).map(async (node) => node.boundingBox()),
  );
  const candidates = grid
    .flatMap((column) =>
      grid.map((row) => ({
        x: corner.x + (room.width * column) / steps,
        y: corner.y + (room.height * row) / steps,
      })),
    )
    .filter((at) => clearOf(drawn, at));
  const clear = await page.evaluate(
    (points) =>
      points.find(
        (at) =>
          document
            .elementFromPoint(at.x, at.y)
            ?.closest('.react-flow__pane') instanceof Element,
      ),
    candidates,
  );

  expect(clear, 'the canvas has no point clear of every element').toBeDefined();
  return clear ?? corner;
};

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
