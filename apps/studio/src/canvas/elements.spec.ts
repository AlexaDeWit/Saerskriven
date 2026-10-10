import { layoutDiagram, minimumNodeExtent } from '@saerskriven/canvas';
import { addElement } from '@saerskriven/model';
import { Either } from 'effect';
import { canvasModel } from './canvas.fixtures.js';
import {
  centredPlacement,
  defaultSize,
  draggedPlacement,
  elementTools,
  flowEnds,
  freshElement,
  freshFlow,
  placeholderNames,
  pointerPlacement,
  switchedShape,
} from './elements.js';
import {
  actorElement,
  mainDiagram,
  processElement,
} from '../store/store.fixtures.js';
import { activeTranslator } from '../messages/locale.js';

const layout = layoutDiagram(canvasModel.diagrams[0], canvasModel);

describe('placement geometry', () => {
  it.each(elementTools)('centres a default-sized %s on a click', (kind) => {
    const placed = centredPlacement(kind, { x: 100, y: 80 });
    const size = defaultSize(kind);

    expect(placed).toEqual({
      position: { x: 100 - size.width / 2, y: 80 - size.height / 2 },
      size,
    });
  });

  it.each([
    ['actor', { x: 21, y: 31 }, { width: 158, height: 88 }],
    ['process', { x: 21, y: 31 }, { width: 158, height: 88 }],
    ['store', { x: 20, y: 31.25 }, { width: 160, height: 87.5 }],
    ['boundary-box', { x: 21, y: 31 }, { width: 158, height: 88 }],
  ] as const)(
    'draws a %s between either ordering of its corners',
    (kind, position, size) => {
      expect(
        draggedPlacement(kind, { x: 180, y: 120 }, { x: 20, y: 30 }),
      ).toEqual({
        position,
        size,
      });
      expect(
        draggedPlacement(kind, { x: 20, y: 120 }, { x: 180, y: 30 }),
      ).toEqual({
        position,
        size,
      });
    },
  );

  it('places a drag of 200 by 20 at 60 high, its stroke inside the drawn box', () => {
    expect(
      draggedPlacement('actor', { x: 0, y: 0 }, { x: 200, y: 20 }),
    ).toEqual({
      position: { x: 1, y: 1 },
      size: { width: 198, height: 60 },
    });
  });

  it.each([
    ['up and left', { x: 70, y: 60 }, { x: 40, y: 20 }],
    ['up and right', { x: 130, y: 60 }, { x: 100, y: 20 }],
    ['down and right', { x: 130, y: 100 }, { x: 100, y: 80 }],
    ['down and left', { x: 70, y: 100 }, { x: 40, y: 80 }],
  ] as const)(
    'grows a short drag %s to the floor from the pressed corner',
    (_, to, position) => {
      expect(draggedPlacement('note', { x: 100, y: 80 }, to)).toEqual({
        position,
        size: { width: minimumNodeExtent, height: minimumNodeExtent },
      });
    },
  );

  it.each(['actor', 'process', 'store', 'boundary-box', 'note'] as const)(
    'the %s tool places a drag across no distance at the floor, right and down from the press',
    (kind) => {
      const press = { x: 7, y: 7 };
      const { position, size } = draggedPlacement(kind, press, press);

      expect(size).toEqual({
        width: minimumNodeExtent,
        height: minimumNodeExtent,
      });
      expect(position.x).toBeGreaterThanOrEqual(press.x);
      expect(position.y).toBeGreaterThanOrEqual(press.y);
    },
  );

  it.each([
    [
      'right, three screen pixels above the press line',
      { x: 300, y: 77 },
      { x: 200, y: -3 },
      { position: { x: 100, y: 80 }, size: { width: 200, height: 60 } },
    ],
    [
      'right, three screen pixels below the press line',
      { x: 300, y: 83 },
      { x: 200, y: 3 },
      { position: { x: 100, y: 80 }, size: { width: 200, height: 60 } },
    ],
    [
      'down, three screen pixels left of the press line',
      { x: 97, y: 280 },
      { x: -3, y: 200 },
      { position: { x: 100, y: 80 }, size: { width: 60, height: 200 } },
    ],
    [
      'right at half zoom, three screen pixels and six units above the press line',
      { x: 500, y: 74 },
      { x: 200, y: -3 },
      { position: { x: 100, y: 80 }, size: { width: 400, height: 60 } },
    ],
  ] as const)(
    'keeps the short axis right and down of the press for a drag %s',
    (_, to, moved, placed) => {
      expect(pointerPlacement('note', { x: 100, y: 80 }, to, moved)).toEqual(
        placed,
      );
    },
  );

  it('grows a short axis toward a pointer four screen pixels along it', () => {
    expect(
      pointerPlacement(
        'note',
        { x: 100, y: 80 },
        { x: 300, y: 76 },
        { x: 200, y: -4 },
      ),
    ).toEqual({
      position: { x: 100, y: 20 },
      size: { width: 200, height: 60 },
    });
  });

  it('treats movement below four screen pixels as a click', () => {
    expect(
      pointerPlacement(
        'actor',
        { x: 100, y: 80 },
        { x: 103.9, y: 80 },
        { x: 3.9, y: 0 },
      ),
    ).toEqual(centredPlacement('actor', { x: 100, y: 80 }));
  });

  it('places a four-screen-pixel drag at the floor rather than the default size', () => {
    expect(
      pointerPlacement(
        'actor',
        { x: 100, y: 80 },
        { x: 104, y: 80 },
        { x: 4, y: 0 },
      ),
    ).toEqual({
      position: { x: 101, y: 81 },
      size: { width: minimumNodeExtent, height: minimumNodeExtent },
    });
  });
});

describe('freshElement', () => {
  it.each(elementTools)('builds a %s the model accepts', (kind) => {
    const added = addElement(
      canvasModel,
      mainDiagram,
      freshElement(kind, { x: 0, y: 400 }),
    );

    expect(Either.isRight(added)).toBe(true);
  });

  it('gives a placed element its placeholder name in the active language', () => {
    expect(freshElement('actor', { x: 0, y: 0 }).name).toBe(
      activeTranslator().t(placeholderNames.actor),
    );
  });

  it('gives every element an id of its own', () => {
    const first = freshElement('process', { x: 0, y: 0 });
    const second = freshElement('process', { x: 0, y: 0 });

    expect(first.id).not.toBe(second.id);
  });

  it('draws a boundary curve through waypoints rather than as a box', () => {
    const boundary = freshElement('boundary-curve', { x: 10, y: 20 });

    expect(boundary).toMatchObject({
      kind: 'trust-boundary',
      shape: { kind: 'curve' },
    });
  });
});

describe('freshFlow', () => {
  it('attaches both ends to the elements it runs between', () => {
    const flow = freshFlow(actorElement, processElement);

    expect(flow).toMatchObject({
      kind: 'flow',
      source: { kind: 'attached', element: actorElement },
      target: { kind: 'attached', element: processElement },
      waypoints: [],
      bidirectional: false,
    });
  });

  it('pins an end to the side it is given and leaves the other automatic', () => {
    const flow = freshFlow(actorElement, processElement, { source: 'right' });

    expect(flow).toMatchObject({
      source: { kind: 'attached', side: 'right' },
      target: { kind: 'attached' },
    });
    expect(flow.kind === 'flow' && 'side' in flow.target).toBe(false);
  });

  it('builds a flow the model accepts', () => {
    expect(
      Either.isRight(
        addElement(
          canvasModel,
          mainDiagram,
          freshFlow(actorElement, processElement, { target: 'top' }),
        ),
      ),
    ).toBe(true);
  });
});

describe('flowEnds', () => {
  it('offers the actor and the process a flow runs between, and no trust boundary or note', () => {
    expect(flowEnds(layout).map((node) => node.id)).toEqual([
      actorElement,
      processElement,
    ]);
  });
});

describe('switchedShape', () => {
  const box = {
    kind: 'box',
    position: { x: 10, y: 20 },
    size: { width: 200, height: 60 },
  } as const;

  it('turns a box into the arch the curve tool places in it', () => {
    expect(switchedShape(box)).toEqual({
      kind: 'curve',
      waypoints: [
        { x: 10, y: 80 },
        { x: 110, y: 20 },
        { x: 210, y: 80 },
      ],
    });
  });

  it('turns a curve back into the box it was drawn in', () => {
    expect(switchedShape(switchedShape(box))).toEqual(box);
  });

  it('grows a curve that spans less than the minimum extent about its middle', () => {
    expect(
      switchedShape({
        kind: 'curve',
        waypoints: [
          { x: 0, y: 50 },
          { x: 100, y: 50 },
        ],
      }),
    ).toEqual({
      kind: 'box',
      position: { x: 0, y: 50 - minimumNodeExtent / 2 },
      size: { width: 100, height: minimumNodeExtent },
    });
  });

  it('boxes a curve through a million points', () => {
    const waypoints = Array.from({ length: 1_000_000 }, (_, index) => ({
      x: index,
      y: 0 - index,
    }));

    expect(switchedShape({ kind: 'curve', waypoints })).toEqual({
      kind: 'box',
      position: { x: 0, y: -999_999 },
      size: { width: 999_999, height: 999_999 },
    });
  });
});
