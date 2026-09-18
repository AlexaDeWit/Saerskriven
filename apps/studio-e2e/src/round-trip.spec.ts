import { type DetectedRead } from '@saerskriven/formats';
import { expect, test } from '@playwright/test';
import { committedText } from '@saerskriven/model/fixtures';
import { registeredChords } from './chords.fixtures.js';
import { differingPaths, identified } from './differing-paths.fixtures.js';
import { dragBy, placeOf } from './canvas.fixtures.js';
import {
  chooseInPanel,
  expectFileShown,
  featureCompleteFile,
  menuButton,
  openFile,
  openMenu,
  placeByClick,
  readBack,
  runFromMenu,
  savedFile,
  selectByKeyboard,
  threatPanel,
} from './studio.fixtures.js';

const addedTitle = 'Paper archive holds records nobody filed';

const idNamed = (model: DetectedRead['model'], name: string): string => {
  const element = model.diagrams[0].elements.find((one) => one.name === name);
  expect(element, `${name} is not in the fixture`).toBeDefined();
  return element?.id ?? '';
};

const byIdentity = (model: DetectedRead['model']): unknown => ({
  ...model,
  diagrams: model.diagrams.map((diagram) => ({
    ...diagram,
    elements: identified(diagram.elements),
  })),
  threats: identified(model.threats),
});

test('opens a Threat Dragon file, edits it on both surfaces, and saves a valid, lossless file that parses to the source with the edits and nothing else', async ({
  page,
}) => {
  await openFile(page, featureCompleteFile);

  const booking = await selectByKeyboard(page, /^Booking service, process/u);
  const placed = await placeOf(booking);
  await dragBy(page, booking, 60);
  await expect.poll(() => placeOf(booking)).not.toBe(placed);
  await expectFileShown(page, 'feature-complete.json', 'Threat Dragon JSON');
  await expect(menuButton(page)).toHaveAccessibleName('Menu, unsaved changes');

  await placeByClick(page, 'Store', /^New store, store/u);
  await page.keyboard.press('Enter');
  await page.keyboard.press(registeredChords['start-flow'][0]);
  await page
    .getByRole('option', { name: 'Booking service', exact: true })
    .click();
  await expect(page.locator('.react-flow__edge')).toHaveCount(4);

  const archive = await selectByKeyboard(page, /^Paper archive, store/u);
  await threatPanel(page).getByRole('button', { name: 'Add a threat' }).click();
  const title = threatPanel(page).getByRole('textbox', { name: 'Title' });
  await expect(title).toBeFocused();
  await title.press('ControlOrMeta+a');
  await page.keyboard.type(addedTitle);
  await title.press('Enter');
  await chooseInPanel(page, 'Severity', 'Critical');

  await expect(archive).toHaveAccessibleName(
    'Paper archive, store, 1 open threat, highest severity Critical',
  );
  await expect(archive.locator('.pn-badge-mark')).toHaveText('C');

  await runFromMenu(page, 'Undo');

  await expect(
    threatPanel(page).getByRole('combobox', { name: 'Severity' }),
  ).toContainText('Undecided');
  await expect(archive).toHaveAccessibleName(
    'Paper archive, store, 1 open threat, severity not assessed',
  );
  await expect(archive.locator('.pn-badge-mark')).toHaveText('?');

  const written = await savedFile(page);

  const source = committedText(featureCompleteFile);
  const before = readBack(source);
  const after = readBack(written.text);
  const addedNumber = before.model.lastIssuedThreatNumber + 1;

  await openMenu(page);
  await expect(menuButton(page)).not.toHaveAccessibleName(/unsaved changes/u);
  await expect(page.getByTestId('loss-report')).toContainText(
    String(addedNumber),
  );

  expect(written.name).toBe('feature-complete.json');
  expect(after.format).toBe('threat-dragon');
  expect(after.divergences).toStrictEqual(before.divergences);

  const held = before.model.diagrams[0].elements;
  const bookingId = idNamed(before.model, 'Booking service');
  const archiveId = idNamed(before.model, 'Paper archive');
  const cellOf = (id: string): number => held.findIndex((one) => one.id === id);

  expect(
    differingPaths(JSON.parse(source), JSON.parse(written.text)),
    'the parsed documents are compared, never the bytes',
  ).toStrictEqual([
    `detail.diagrams[0].cells[${cellOf(bookingId)}].position.x`,
    `detail.diagrams[0].cells[${cellOf(bookingId)}].position.y`,
    `detail.diagrams[0].cells[${cellOf(archiveId)}].data.threats[0]`,
    `detail.diagrams[0].cells[${held.length}]`,
    `detail.diagrams[0].cells[${held.length + 1}]`,
    'detail.threatTop',
  ]);

  const kept = new Set(held.map((one) => one.id));
  const [store, flow] = after.model.diagrams[0].elements.filter(
    (one) => !kept.has(one.id),
  );
  const [threat] = after.model.threats.filter(
    (one) => one.number > before.model.lastIssuedThreatNumber,
  );

  expect([store, flow]).toMatchObject([
    { kind: 'store', name: 'New store' },
    {
      kind: 'flow',
      name: 'New flow',
      source: { kind: 'attached', element: store?.id },
      target: { kind: 'attached', element: bookingId },
    },
  ]);
  expect(threat).toMatchObject({
    number: addedNumber,
    title: addedTitle,
    severity: 'undecided',
    status: 'open',
    elements: [archiveId],
  });

  expect(
    differingPaths(byIdentity(before.model), byIdentity(after.model)),
  ).toStrictEqual([
    `diagrams[0].elements.${bookingId}.position.x`,
    `diagrams[0].elements.${bookingId}.position.y`,
    `diagrams[0].elements.${store?.id ?? ''}`,
    `diagrams[0].elements.${flow?.id ?? ''}`,
    `threats.${threat?.id ?? ''}`,
    'lastIssuedThreatNumber',
  ]);
});
