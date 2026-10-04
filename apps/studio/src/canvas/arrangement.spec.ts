import type { Point, Size } from '@saerskriven/model';
import { elementIn } from '@saerskriven/model/fixtures';
import {
  commandById,
  runCommand,
  type CommandId,
} from '../commands/registry.js';
import { recordingSurface } from '../commands/commands.fixtures.js';
import {
  actorElement,
  processElement,
  sampleModel,
} from '../store/store.fixtures.js';
import { Action } from '../store/actions.js';
import { dispatch } from '../store/store.js';
import { initialState } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { currentAnnouncement, resetAnnouncements } from './announcements.js';
import { arrangeSelected } from './arrangement.js';
import { canvasModel, openCanvas, requestFlow } from './canvas.fixtures.js';
import { currentLayout } from './layout.js';

const unequalModel = (starts: readonly number[] = [0, 70, 300]) => {
  const sizes = [40, 80, 60];
  return {
    ...sampleModel,
    diagrams: sampleModel.diagrams.map((diagram) => ({
      ...diagram,
      elements: diagram.elements.map((element, index) =>
        'position' in element
          ? {
              ...element,
              position: { x: starts[index], y: starts[index] },
              size: { width: sizes[index], height: sizes[index] },
            }
          : element,
      ),
    })),
  };
};

const selectedPair = (
  placed: readonly { readonly position: Point; readonly size?: Size }[],
) => {
  const model = {
    ...sampleModel,
    diagrams: sampleModel.diagrams.map((diagram) => ({
      ...diagram,
      elements: [actorElement, processElement].map((id, index) => ({
        ...elementIn(sampleModel, id),
        ...placed[index],
      })),
    })),
  };
  modelStore.setState(
    { ...initialState(model), selection: [actorElement, processElement] },
    true,
  );
  return model;
};

const selectedAll = (model: ReturnType<typeof unequalModel>) => {
  modelStore.setState(
    {
      ...initialState(model),
      selection: model.diagrams[0].elements.map((element) => element.id),
    },
    true,
  );
  return model;
};

const alignments: readonly (readonly [
  CommandId,
  readonly (readonly [number, number])[],
])[] = [
  [
    'align-left',
    [
      [0, 20],
      [0, 120],
    ],
  ],
  [
    'align-centre',
    [
      [70, 20],
      [50, 120],
    ],
  ],
  [
    'align-right',
    [
      [140, 20],
      [100, 120],
    ],
  ],
  [
    'align-top',
    [
      [0, 20],
      [100, 20],
    ],
  ],
  [
    'align-middle',
    [
      [0, 85],
      [100, 70],
    ],
  ],
  [
    'align-bottom',
    [
      [0, 150],
      [100, 120],
    ],
  ],
];

describe('arrangeSelected', () => {
  it('aligns against outer bounds without changing flow metadata or creating a no-op history entry', () => {
    openCanvas(canvasModel.diagrams[0].elements.map((element) => element.id));
    arrangeSelected('left');
    const state = modelStore.getState();
    expect(state.past).toEqual([canvasModel]);
    expect(elementIn(state.present, requestFlow)).toEqual(
      elementIn(canvasModel, requestFlow),
    );
    arrangeSelected('left');
    expect(modelStore.getState().present).toBe(state.present);
  });

  it('stores what an alignment works out at three decimals, with none of the noise of its offset', () => {
    selectedPair([
      { position: { x: 0.1, y: 20 } },
      { position: { x: 5.1, y: 120 } },
    ]);

    arrangeSelected('left');

    expect(5.1 + (0.1 - 5.1)).not.toBe(0.1);
    expect(
      elementIn(modelStore.getState().present, processElement),
    ).toMatchObject({ position: { x: 0.1, y: 120 } });
  });

  it('stores every aligned element at three decimals in one undo step, the one the others align to among them', () => {
    const model = selectedPair([
      { position: { x: 10.12345, y: 20 } },
      { position: { x: 300, y: 120 } },
    ]);

    arrangeSelected('left');
    const aligned = modelStore.getState().present;

    expect(
      [actorElement, processElement].map((id) => elementIn(aligned, id)),
    ).toMatchObject([
      { position: { x: 10.123, y: 20 } },
      { position: { x: 10.123, y: 120 } },
    ]);
    expect(modelStore.getState().past).toEqual([model]);
    arrangeSelected('left');
    expect(modelStore.getState().present).toBe(aligned);
  });

  it.each([
    {
      operation: 'centre',
      landing: 'the widest node',
      placed: [
        { position: { x: 0, y: 20 }, size: { width: 100.001, height: 60 } },
        { position: { x: 200, y: 120 }, size: { width: 50, height: 60 } },
      ],
      aligned: [
        { x: 74.999, y: 20 },
        { x: 99.999, y: 120 },
      ],
    },
    {
      operation: 'middle',
      landing: 'the tallest node',
      placed: [
        { position: { x: 20, y: 0 }, size: { width: 60, height: 100.001 } },
        { position: { x: 120, y: 200 }, size: { width: 60, height: 50 } },
      ],
      aligned: [
        { x: 20, y: 74.999 },
        { x: 120, y: 99.999 },
      ],
    },
    {
      operation: 'centre',
      landing: 'a narrower node',
      placed: [
        {
          position: { x: -206.63, y: 20 },
          size: { width: 78.837, height: 60 },
        },
        {
          position: { x: -3.45, y: 120 },
          size: { width: 300.214, height: 60 },
        },
      ],
      aligned: [
        { x: 5.648, y: 20 },
        { x: -105.04, y: 120 },
      ],
    },
  ] as const)(
    'aligns on the $operation line in one undo step and moves nothing on a second press, where $landing lands on a half thousandth',
    ({ operation, placed, aligned }) => {
      const model = selectedPair(placed);

      arrangeSelected(operation);
      const once = modelStore.getState().present;

      expect(
        [actorElement, processElement].map((id) => elementIn(once, id)),
      ).toMatchObject(aligned.map((position) => ({ position })));
      arrangeSelected(operation);
      expect(modelStore.getState().present).toBe(once);
      expect(modelStore.getState().past).toEqual([model]);
    },
  );

  it('adds no undo step and says nothing for an alignment already in place, though its offsets are not exactly zero', () => {
    const model = selectedPair([
      { position: { x: 0.1, y: 20 }, size: { width: 120, height: 60 } },
      { position: { x: 200.3, y: 120 }, size: { width: 80, height: 60 } },
    ]);

    arrangeSelected('centre');
    const aligned = modelStore.getState().present;
    resetAnnouncements();
    for (const repeat of [1, 2, 3]) {
      arrangeSelected('centre');
      expect(modelStore.getState().present, `press ${String(repeat)}`).toBe(
        aligned,
      );
    }

    expect(modelStore.getState().past).toEqual([model]);
    expect(currentAnnouncement().message).toBe('');
  });

  it.each(alignments)(
    '%s uses the selected outer bounds and preserves one-step undo',
    (command, expected) => {
      const model = selectedPair([
        { position: { x: 0, y: 20 }, size: { width: 40, height: 30 } },
        { position: { x: 100, y: 120 }, size: { width: 80, height: 60 } },
      ]);
      runCommand(commandById(command), recordingSurface().surface);
      expect(
        modelStore
          .getState()
          .present.diagrams[0].elements.filter(
            (element) => 'position' in element,
          )
          .map((element) =>
            'position' in element
              ? [element.position.x, element.position.y]
              : [],
          ),
      ).toEqual(expected);
      expect(modelStore.getState().past).toEqual([model]);
      dispatch(Action.Undo());
      expect(modelStore.getState().present).toBe(model);
    },
  );

  it.each(['distribute-horizontal', 'distribute-vertical'] as const)(
    '%s fixes the outer nodes, leaves equal gaps and keeps the other axis',
    (command) => {
      const model = selectedAll(unequalModel());
      runCommand(commandById(command), recordingSurface().surface);
      const nodes = currentLayout(modelStore.getState()).nodes;
      const [axis, across] =
        command === 'distribute-horizontal'
          ? (['x', 'y'] as const)
          : (['y', 'x'] as const);
      expect(nodes.map((node) => node.position[axis])).toEqual([0, 130, 300]);
      expect(nodes.map((node) => node.position[across])).toEqual([0, 70, 300]);
      expect(modelStore.getState().past).toEqual([model]);
    },
  );

  it('leaves the outer nodes of a distribution as stored, stores the one between at three decimals, and moves nothing on a second press', () => {
    const model = selectedAll(unequalModel([0.12345, 70, 300.56789]));

    arrangeSelected('horizontal');
    const distributed = modelStore.getState().present;

    expect(
      currentLayout(modelStore.getState()).nodes.map((node) => node.position.x),
    ).toEqual([0.12345, 130.346, 300.56789]);
    expect(modelStore.getState().past).toEqual([model]);
    arrangeSelected('horizontal');
    expect(modelStore.getState().present).toBe(distributed);
  });

  it.each([
    { command: 'align-left', model: canvasModel, selected: 0 },
    { command: 'distribute-horizontal', model: unequalModel(), selected: 2 },
  ] as const)(
    'leaves the store alone for $command over $selected selected nodes, too few to arrange',
    ({ command, model, selected }) => {
      openCanvas(
        model.diagrams[0].elements
          .slice(0, selected)
          .map((element) => element.id),
        model,
      );
      const before = modelStore.getState();
      runCommand(commandById(command), recordingSurface().surface);
      expect(modelStore.getState()).toBe(before);
    },
  );
});
