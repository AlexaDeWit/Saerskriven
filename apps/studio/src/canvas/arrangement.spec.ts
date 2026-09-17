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
import { arrangeSelected } from './arrangement.js';
import { canvasModel, openCanvas, requestFlow } from './canvas.fixtures.js';
import { currentLayout } from './layout.js';

const unequalModel = () => {
  const starts = [0, 70, 300];
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

  it.each(alignments)(
    '%s uses the selected outer bounds and preserves one-step undo',
    (command, expected) => {
      const positions = [
        { x: 0, y: 20 },
        { x: 100, y: 120 },
      ];
      const sizes = [
        { width: 40, height: 30 },
        { width: 80, height: 60 },
      ];
      const model = {
        ...sampleModel,
        diagrams: sampleModel.diagrams.map((diagram) => ({
          ...diagram,
          elements: [actorElement, processElement].map((id, index) => ({
            ...elementIn(sampleModel, id),
            position: positions[index],
            size: sizes[index],
          })),
        })),
      };
      modelStore.setState(
        {
          ...initialState(model),
          selection: model.diagrams[0].elements.map((element) => element.id),
        },
        true,
      );
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
      const model = unequalModel();
      modelStore.setState(
        {
          ...initialState(model),
          selection: model.diagrams[0].elements.map((element) => element.id),
        },
        true,
      );
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
