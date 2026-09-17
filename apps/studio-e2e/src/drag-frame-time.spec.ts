import { expect, test } from '@playwright/test';
import type {
  Element,
  FlowEndpoint,
  Model,
  Point as ModelPoint,
} from '@saerskriven/model';
import {
  committedModel,
  elementId,
  threatId,
} from '@saerskriven/model/fixtures';
import {
  canvasSettled,
  elementNodes,
  placeOf,
  type Point,
  pressOn,
} from './canvas.fixtures.js';
import { openModelDocument } from './studio.fixtures.js';
import {
  displayPeriod,
  gapsRecorded,
  nextFrame,
  recordGaps,
} from './frame-time.fixtures.js';

type Direction = 1 | -1;

const copies = 3;
const copyGap = 600;

const lowered = (point: ModelPoint, by: number): ModelPoint => ({
  x: point.x,
  y: point.y + by,
});

const copyOf = (element: Element, copy: number): Element => {
  const by = copy * copyGap;
  const renamed = (id: string) => elementId(`${id}-copy-${String(copy)}`);
  const end = (endpoint: FlowEndpoint): FlowEndpoint =>
    endpoint.kind === 'attached'
      ? { ...endpoint, element: renamed(endpoint.element) }
      : { ...endpoint, position: lowered(endpoint.position, by) };
  if (element.kind === 'flow') {
    return {
      ...element,
      id: renamed(element.id),
      source: end(element.source),
      target: end(element.target),
      waypoints: element.waypoints.map((point) => lowered(point, by)),
    };
  }
  if (element.kind === 'trust-boundary') {
    return {
      ...element,
      id: renamed(element.id),
      shape:
        element.shape.kind === 'box'
          ? { ...element.shape, position: lowered(element.shape.position, by) }
          : {
              ...element.shape,
              waypoints: element.shape.waypoints.map((point) =>
                lowered(point, by),
              ),
            },
    };
  }
  return {
    ...element,
    id: renamed(element.id),
    position: lowered(element.position, by),
  };
};

const crowdedStorefront = (): Model => {
  const model = committedModel('two-diagrams.model.json');
  const [storefront, ...others] = model.diagrams;
  const drawn = new Set<string>(storefront.elements.map(({ id }) => id));
  const threatened = model.threats.filter(
    ({ elements }) =>
      elements.length > 0 && elements.every((id) => drawn.has(id)),
  );
  const added = Array.from(
    { length: copies - 1 },
    (unused, index) => index + 1,
  );
  const threats = added.flatMap((copy, copyIndex) =>
    threatened.map((threat, threatIndex) => ({
      ...threat,
      id: threatId(`${threat.id}-copy-${String(copy)}`),
      number:
        model.lastIssuedThreatNumber +
        copyIndex * threatened.length +
        threatIndex +
        1,
      elements: threat.elements.map((id) =>
        elementId(`${id}-copy-${String(copy)}`),
      ),
    })),
  );
  return {
    ...model,
    diagrams: [
      {
        ...storefront,
        elements: [
          ...storefront.elements,
          ...added.flatMap((copy) =>
            storefront.elements.map((element) => copyOf(element, copy)),
          ),
        ],
      },
      ...others,
    ],
    threats: [...model.threats, ...threats],
    lastIssuedThreatNumber: model.lastIssuedThreatNumber + threats.length,
  };
};

const longGapPeriods = 1.5;
const longGapShare = 0.05;
const longestPeriods = 5;
const framesAtLeast = 60;
const periodFrames = 20;

const moves = 90;
const warmUpMoves = 30;
const rightPerMove = 4;
const downPerMove = 1;
const across: Direction = 1;
const back: Direction = -1;
const dragWithin = 12_000;
const warmUpWithin = 6_000;
const roomForTheRest = 30_000;

test('a drag of an element with flows at both ends drops no frames, after a warm-up drag', async ({
  page,
}) => {
  test.setTimeout(warmUpWithin + dragWithin + roomForTheRest);
  const scene = crowdedStorefront();
  const [drawn] = scene.diagrams;
  await openModelDocument(page, scene);
  await expect(elementNodes(page)).toHaveCount(
    drawn.elements.filter(({ kind }) => kind !== 'flow').length,
  );
  await expect(page.locator('.react-flow__edge')).toHaveCount(
    drawn.elements.filter(({ kind }) => kind === 'flow').length,
  );
  const dragged = page.locator('.react-flow__node[data-id="el-web-shop"]');
  const period = await displayPeriod(page, periodFrames);
  const longEnough = longGapPeriods * period;
  const worstAllowed = longestPeriods * period;

  const drag = async (
    from: Point,
    count: number,
    way: Direction,
    within: number,
  ): Promise<void> => {
    const deadline = Date.now() + within;
    for (let move = 1; move <= count && Date.now() < deadline; move += 1) {
      await page.mouse.move(
        from.x + way * move * rightPerMove,
        from.y + way * move * downPerMove,
      );
      await nextFrame(page);
    }
  };

  const warm = await pressOn(page, dragged);
  await drag(warm, warmUpMoves, back, warmUpWithin);
  await page.mouse.up();
  await canvasSettled(page);
  const placed = await placeOf(dragged);

  const at = await pressOn(page, dragged);
  await recordGaps(page);
  await drag(at, moves, across, dragWithin);
  const gaps = await gapsRecorded(page);
  await page.mouse.up();

  await expect.poll(() => placeOf(dragged)).not.toBe(placed);

  const long = gaps.filter((gap) => gap > longEnough).length;
  const share = gaps.length === 0 ? 1 : long / gaps.length;
  const longest = gaps.reduce((most, gap) => Math.max(most, gap), 0);
  const reading = `${gaps.length} frame gaps, ${long} over ${longGapPeriods} display periods (${(share * 100).toFixed(1)} percent), longest ${longest.toFixed(2)} ms, display period ${period.toFixed(2)} ms`;
  console.log(reading);

  expect(
    gaps.length,
    `the drag gave too few frames to judge: ${reading}`,
  ).toBeGreaterThanOrEqual(framesAtLeast);
  expect(
    share,
    `more than ${longGapShare * 100} percent of the drag's frames came late: ${reading}`,
  ).toBeLessThanOrEqual(longGapShare);
  expect(
    longest,
    `a frame came more than ${longestPeriods} display periods late: ${reading}`,
  ).toBeLessThanOrEqual(worstAllowed);
});
