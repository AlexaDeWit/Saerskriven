import { expect, test, type Locator } from '@playwright/test';
import { canvasClassNames } from '@saerskriven/canvas';
import { registeredChords } from './chords.fixtures.js';
import {
  boxOf,
  dragOnto,
  dragTo,
  drawnBy,
  emptyCanvasPoint,
  handlesOf,
  lineOf,
  turnsOf,
} from './canvas.fixtures.js';
import {
  handleOn,
  nodeNamed,
  openFallback,
  placeholder,
  readBack,
  savedFile,
  savedModel,
  selectByKeyboard,
} from './studio.fixtures.js';

const sourceEnd = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'Flow source end', exact: true });

const targetEnd = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'Flow target end', exact: true });

const savedFlow = async (page: import('@playwright/test').Page) =>
  (await savedModel(page)).diagrams[0].elements.find(
    (element) => element.kind === 'flow',
  );

const groundOf = (locator: Locator): Promise<string> =>
  locator.evaluate((element) => getComputedStyle(element).backgroundColor);

const freeTargetX = (flow: Awaited<ReturnType<typeof savedFlow>>): number =>
  flow?.kind === 'flow' && flow.target.kind === 'free'
    ? flow.target.position.x
    : Number.NaN;

test('pins a flow end to a side by keyboard and by dragging, releases it, and saves the pin', async ({
  page,
}) => {
  await openFallback(page);
  const flow = await selectByKeyboard(page, placeholder.records);
  const line = lineOf(page, placeholder.records);
  const original = await drawnBy(line);
  const [top, , bottom] = handlesOf(
    await boxOf(nodeNamed(page, placeholder.actor)),
  );
  await sourceEnd(page).focus();
  await page.keyboard.press('ArrowDown');
  await expect
    .poll(async () => turnsOf(await drawnBy(line))[0])
    .toEqual(bottom);
  await expect(flow).toHaveAccessibleName(placeholder.records);
  await sourceEnd(page).focus();
  await page.keyboard.press('Delete');
  await expect(line).toHaveAttribute('d', original);
  await dragOnto(
    page,
    sourceEnd(page),
    handleOn(nodeNamed(page, placeholder.actor), 'top'),
  );
  await expect.poll(async () => turnsOf(await drawnBy(line))[0]).toEqual(top);
  await page.keyboard.press('ControlOrMeta+z');
  await expect(line).toHaveAttribute('d', original);
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect.poll(async () => turnsOf(await drawnBy(line))[0]).toEqual(top);
  const written = await savedFile(page);
  expect(written.text).toContain('side: top');
  const saved = readBack(written.text).model;
  expect(
    saved.diagrams[0].elements.find((element) => element.kind === 'flow'),
  ).toMatchObject({ source: { kind: 'attached', side: 'top' } });
});

test('a flow becomes bidirectional by its command, draws two arrowheads, and saves as such', async ({
  page,
}) => {
  await openFallback(page);
  const flow = await selectByKeyboard(page, placeholder.records);
  const arrows = flow.locator(`path.${canvasClassNames.flowArrow}`);
  await expect(arrows).toHaveCount(1);
  await page.keyboard.press(registeredChords['toggle-flow-direction'][0]);
  await expect(arrows).toHaveCount(2);
  await expect(flow).toHaveAccessibleName(/between Actor and Store/u);
  await page.keyboard.press('ControlOrMeta+z');
  await expect(arrows).toHaveCount(1);
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(arrows).toHaveCount(2);
  const written = await savedFile(page);
  expect(written.text).toContain('bidirectional: true');
});

test(
  'the Reconnect flow card draws its commands as one row of icons, names each in a tooltip, and presses the two-way one while the flow runs both ways, in forced colours too',
  { tag: '@phone' },
  async ({ page }) => {
    await openFallback(page);
    await selectByKeyboard(page, placeholder.records);
    const card = page.getByRole('region', { name: 'Reconnect flow' });
    const commands = card.getByRole('button');
    await expect(commands).toHaveCount(4);
    const rows = await commands.evaluateAll((controls) =>
      controls.map((control) => control.getBoundingClientRect().top),
    );
    expect(new Set(rows).size).toBe(1);
    const both = card.getByRole('button', {
      name: 'Toggle bidirectional flow',
      exact: true,
    });
    await both.focus();
    await expect(page.getByRole('tooltip')).toHaveText(
      /^Toggle bidirectional flow \S/u,
    );
    await expect(both).toHaveAttribute('aria-pressed', 'false');
    await both.click();
    await expect(both).toHaveAttribute('aria-pressed', 'true');
    await page.emulateMedia({ forcedColors: 'active' });
    expect(await groundOf(both)).not.toBe(await groundOf(card));
    await both.click();
    await expect(both).toHaveAttribute('aria-pressed', 'false');
  },
);

test('a flow reverses by its chord and its command, one undo step each, and saves the swap', async ({
  page,
}) => {
  await openFallback(page);
  const flow = await selectByKeyboard(page, placeholder.records);
  await expect(flow).toHaveAccessibleName(/from Actor to Store/u);
  await page.keyboard.press(registeredChords['reverse-flow'][0]);
  await expect(flow).toHaveAccessibleName(/from Store to Actor/u);
  await page
    .getByRole('region', { name: 'Reconnect flow' })
    .getByRole('button', { name: 'Reverse flow', exact: true })
    .click();
  await expect(flow).toHaveAccessibleName(/from Actor to Store/u);
  await page.keyboard.press('ControlOrMeta+z');
  await expect(flow).toHaveAccessibleName(/from Store to Actor/u);
  expect(await savedFlow(page)).toMatchObject({
    source: { kind: 'attached', element: 'placeholder-store' },
    target: { kind: 'attached', element: 'placeholder-actor' },
  });
});

test('a flow end dragged onto empty canvas goes free there, moves by arrow key, and attaches where it is dropped on an element', async ({
  page,
}) => {
  await openFallback(page);
  const flow = await selectByKeyboard(page, placeholder.records);
  const original = await drawnBy(lineOf(page, placeholder.records));
  await dragTo(page, targetEnd(page), await emptyCanvasPoint(page));
  await expect(flow).toHaveAccessibleName(/from Actor to a free point/u);
  const freed = await savedFlow(page);
  expect(freed).toMatchObject({ target: { kind: 'free' } });
  await targetEnd(page).focus();
  await page.keyboard.press('ArrowRight');
  expect(freeTargetX(await savedFlow(page)) - freeTargetX(freed)).toBeCloseTo(
    5,
  );
  await dragOnto(page, targetEnd(page), nodeNamed(page, placeholder.actor));
  await expect(flow).toHaveAccessibleName(/from Actor to a free point/u);
  await dragOnto(page, targetEnd(page), nodeNamed(page, placeholder.store));
  await expect(flow).toHaveAccessibleName(/from Actor to Store/u);
  await expect(lineOf(page, placeholder.records)).toHaveAttribute(
    'd',
    original,
  );
  await page.keyboard.press('ControlOrMeta+z');
  await expect(flow).toHaveAccessibleName(/from Actor to a free point/u);
});
