import { expect, test } from '@playwright/test';
import {
  boxOf,
  drawnBy,
  endsOn,
  handlesOf,
  lineOf,
  placeOf,
  pressOn,
} from './canvas.fixtures.js';
import { nodeNamed, openTwoDiagrams, storefront } from './studio.fixtures.js';

const outward = /^read the product listings, flow/u;
const inward = /^confirm the authorisation, flow/u;
const elsewhere = /^card network callback, flow/u;
const badged = /^browse the catalogue and fill a basket, flow/u;

test('a flow follows the element it attaches to through a drag, at either end', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  const dragged = nodeNamed(page, storefront.webShop);
  const attached = [lineOf(page, outward), lineOf(page, inward)];
  const detached = lineOf(page, elsewhere);
  const badgedFlow = nodeNamed(page, badged);
  const badgedLabel = badgedFlow.locator('.pn-flow-label');
  const badgedBadge = badgedFlow.locator('.pn-badge');
  const outwardLabel = nodeNamed(page, outward).locator('.pn-flow-label');
  const settled = await Promise.all(attached.map(drawnBy));
  const untouched = await drawnBy(detached);
  const labelSettled = await badgedLabel.boundingBox();
  const badgeSettled = await badgedBadge.boundingBox();
  const outwardLabelSettled = await outwardLabel.boundingBox();
  const placed = await placeOf(dragged);

  const at = await pressOn(page, dragged);
  await page.mouse.move(at.x + 70, at.y + 55, { steps: 8 });
  await expect.poll(() => placeOf(dragged)).not.toBe(placed);

  const handles = handlesOf(await boxOf(dragged));
  const inFlight = await Promise.all(attached.map(drawnBy));
  const labelInFlight = await badgedLabel.boundingBox();
  const badgeInFlight = await badgedBadge.boundingBox();
  const outwardLabelInFlight = await outwardLabel.boundingBox();
  for (const [index, drawn] of inFlight.entries()) {
    expect(drawn, 'the flow was redrawn during the drag').not.toBe(
      settled[index],
    );
    expect(
      endsOn(drawn, handles),
      `${drawn} ends on a handle of ${JSON.stringify(handles)}`,
    ).toHaveLength(1);
  }
  expect(
    await drawnBy(detached),
    'a flow attached to neither end stayed where it was',
  ).toBe(untouched);
  expect(labelInFlight).not.toEqual(labelSettled);
  expect(badgeInFlight).not.toEqual(badgeSettled);
  expect(outwardLabelInFlight).not.toEqual(outwardLabelSettled);

  await page.mouse.up();

  for (const [index, line] of attached.entries()) {
    await expect(line).toHaveAttribute('d', inFlight[index]);
  }
  expect(await badgedLabel.boundingBox()).toEqual(labelInFlight);
  expect(await badgedBadge.boundingBox()).toEqual(badgeInFlight);
  expect(await outwardLabel.boundingBox()).toEqual(outwardLabelInFlight);
});

test('a group drag carries an attached flow, its label and its badge before pointer-up', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  const source = nodeNamed(page, storefront.webShop);
  const target = nodeNamed(page, storefront.catalogue);
  const flow = nodeNamed(page, outward);
  const line = lineOf(page, outward);
  const label = flow.locator('.pn-flow-label');
  const badge = nodeNamed(page, elsewhere).locator('.pn-badge');

  await page.keyboard.press('ControlOrMeta+a');

  const sourceBefore = await boxOf(source);
  const targetBefore = await boxOf(target);
  const sourceScreenBefore = await source.boundingBox();
  const lineBefore = await line.boundingBox();
  const labelBefore = await label.boundingBox();
  const badgeBefore = await badge.boundingBox();
  expect(lineBefore).not.toBeNull();
  expect(labelBefore).not.toBeNull();
  expect(badgeBefore).not.toBeNull();
  expect(sourceScreenBefore).not.toBeNull();

  const at = await pressOn(page, source);
  await page.mouse.move(at.x + 70, at.y + 55, { steps: 8 });
  await expect
    .poll(async () => (await boxOf(source)).x)
    .not.toBe(sourceBefore.x);

  const sourceLive = await boxOf(source);
  const targetLive = await boxOf(target);
  const sourceScreenLive = await source.boundingBox();
  const offset = {
    x: sourceLive.x - sourceBefore.x,
    y: sourceLive.y - sourceBefore.y,
  };
  expect(targetLive.x - targetBefore.x).toBeCloseTo(offset.x);
  expect(targetLive.y - targetBefore.y).toBeCloseTo(offset.y);
  expect(endsOn(await drawnBy(line), handlesOf(sourceLive))).toHaveLength(1);
  expect(endsOn(await drawnBy(line), handlesOf(targetLive))).toHaveLength(1);

  expect(sourceScreenLive).not.toBeNull();
  const screenOffset = {
    x: (sourceScreenLive?.x ?? 0) - (sourceScreenBefore?.x ?? 0),
    y: (sourceScreenLive?.y ?? 0) - (sourceScreenBefore?.y ?? 0),
  };
  for (const [part, before, current] of [
    ['line', lineBefore, line],
    ['label', labelBefore, label],
    ['badge', badgeBefore, badge],
  ] as const) {
    for (const axis of ['x', 'y'] as const) {
      await expect
        .poll(
          async () =>
            ((await current.boundingBox())?.[axis] ?? Number.NaN) -
            (before?.[axis] ?? Number.NaN),
          `${part} ${axis} translation`,
        )
        .toBeCloseTo(screenOffset[axis]);
    }
  }
  const lineLive = await line.boundingBox();
  const labelLive = await label.boundingBox();
  const badgeLive = await badge.boundingBox();

  await page.mouse.up();
  expect(await line.boundingBox()).toEqual(lineLive);
  expect(await label.boundingBox()).toEqual(labelLive);
  expect(await badge.boundingBox()).toEqual(badgeLive);
});

test('a quick release keeps the last live label placement', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  const dragged = nodeNamed(page, storefront.webShop);
  const label = nodeNamed(page, outward).locator('.pn-flow-label');

  const at = await pressOn(page, dragged);
  await page.mouse.move(at.x + 70, at.y + 55, { steps: 8 });
  const live = await label.boundingBox();
  expect(live).not.toBeNull();
  await page.mouse.up();

  expect(await label.boundingBox()).toEqual(live);
});

test('a one-endpoint move settles its attached label before release', async ({
  page,
}) => {
  await openTwoDiagrams(page);
  const store = nodeNamed(page, storefront.catalogue);
  const label = nodeNamed(page, /^read the product listings, flow/u).locator(
    '.pn-flow-label',
  );

  const at = await pressOn(page, store);
  await page.mouse.move(at.x + 20, at.y);
  const live = await label.boundingBox();
  expect(live).not.toBeNull();
  await page.mouse.up();

  expect(await label.boundingBox()).toEqual(live);
});
