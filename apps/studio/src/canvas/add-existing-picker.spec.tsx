import { diagramsOf, type ElementId } from '@saerskriven/model';
import {
  copiesModel,
  diagramId,
  elementId,
  sharedModel,
} from '@saerskriven/model/fixtures';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactFlowProvider } from '@xyflow/react';
import {
  CommandSurfaceProvider,
  unmountedSurface,
} from '../commands/binding.js';
import { Action } from '../store/actions.js';
import { initialState } from '../store/state.js';
import { dispatch, modelStore } from '../store/store.js';
import { closeAddExisting, openAddExisting } from './add-existing.js';
import { AddExistingPicker } from './add-existing-picker.js';
import { openMergeInto } from './merge-into.js';

const overview = diagramId('overview');
const cardVault = elementId('card-vault');
const fraudCheck = elementId('fraud-check');
const score = elementId('score');

const placedOn = (id: ElementId): string[] =>
  diagramsOf(modelStore.getState().present, id).map(({ id: on }) => on);

const describedBy = (control: HTMLElement): string =>
  document.getElementById(control.getAttribute('aria-describedby') ?? '')
    ?.textContent ?? '';

const picker = () =>
  screen.queryByRole('region', { name: 'Add existing element' });

const mounted = () =>
  render(
    <ReactFlowProvider>
      <CommandSurfaceProvider surface={unmountedSurface}>
        <button type="button">Before</button>
        <AddExistingPicker />
      </CommandSurfaceProvider>
    </ReactFlowProvider>,
  );

describe('the Add existing element picker', () => {
  beforeEach(() => {
    modelStore.setState(
      { ...initialState(sharedModel), activeDiagram: overview },
      true,
    );
  });

  afterEach(() => {
    act(closeAddExisting);
  });

  it('lists what the diagram on screen does not place, each described by the diagrams it is on', () => {
    mounted();
    act(openAddExisting);

    const elements = screen.getByRole('group', { name: 'Elements' });
    const flows = screen.getByRole('group', { name: 'Flows' });
    expect(
      [...elements.querySelectorAll('input')].map(
        (box) => box.labels?.[0]?.textContent,
      ),
    ).toEqual(['Card vault', 'Fraud check']);
    expect(
      describedBy(screen.getByRole('checkbox', { name: 'Card vault' })),
    ).toContain('Payments');
    expect(flows.querySelectorAll('input')).toHaveLength(1);
    expect(screen.getByRole('checkbox', { name: 'Score' })).toBeDefined();
    expect(document.activeElement).toBe(
      screen.getByRole('checkbox', { name: 'Card vault' }),
    );
  });

  it('opens on the command key, picks by Space and adds the picks as one undo step', async () => {
    const user = userEvent.setup();
    mounted();

    await user.keyboard('e');
    expect(picker()).not.toBeNull();
    await user.keyboard(' ');
    await user.tab();
    await user.keyboard(' ');
    await user.click(screen.getByRole('button', { name: 'Add 2' }));

    expect(picker()).toBeNull();
    expect(placedOn(cardVault)).toEqual(['overview', 'payments']);
    expect(placedOn(fraudCheck)).toEqual(['overview', 'payments']);
    expect(placedOn(score)).toEqual(['payments']);
    expect(modelStore.getState().past).toHaveLength(1);
    expect(modelStore.getState().selection).toEqual([cardVault, fraudCheck]);
  });

  it('leaves an element alone when Delete follows the undo that took it off the diagram on screen', async () => {
    const user = userEvent.setup();
    mounted();
    act(openAddExisting);
    await user.click(screen.getByRole('checkbox', { name: 'Card vault' }));
    await user.click(screen.getByRole('button', { name: 'Add 1' }));
    expect(modelStore.getState().selection).toEqual([cardVault]);

    act(() => {
      dispatch(Action.Undo());
    });
    expect(modelStore.getState().selection).toEqual([]);
    document.body.focus();
    await user.keyboard('{Delete}');
    act(() => {
      dispatch(
        Action.DeleteFromDiagram({
          diagramId: overview,
          elementIds: [cardVault],
          decimals: 3,
        }),
      );
    });

    expect(modelStore.getState().present).toBe(sharedModel);
    expect(placedOn(cardVault)).toEqual(['payments']);
  });

  it('moves focus back into the open picker on the command key rather than opening a second', async () => {
    const user = userEvent.setup();
    mounted();
    act(openAddExisting);
    screen.getByRole('button', { name: 'Before' }).focus();

    await user.keyboard('e');

    expect(screen.getAllByRole('region')).toHaveLength(1);
    expect(document.activeElement).toBe(
      screen.getByRole('checkbox', { name: 'Card vault' }),
    );
  });

  it('hands focus to the canvas on Escape where what opened the picker is gone', async () => {
    const user = userEvent.setup();
    mounted();
    const canvas = document.createElement('div');
    canvas.className = 'react-flow';
    canvas.tabIndex = -1;
    const opener = document.createElement('button');
    document.body.append(canvas, opener);
    opener.focus();
    act(openAddExisting);
    opener.remove();

    await user.keyboard('{Escape}');

    expect(picker()).toBeNull();
    expect(document.activeElement).toBe(canvas);
    canvas.remove();
  });

  it('adds nothing while nothing is picked, and keeps Add on the Tab path saying why', async () => {
    const user = userEvent.setup();
    mounted();
    act(openAddExisting);

    const add = screen.getByRole('button', { name: 'Add' });
    expect(add.getAttribute('aria-disabled')).toBe('true');
    expect(describedBy(add)).not.toBe('');
    await user.click(add);

    expect(picker()).not.toBeNull();
    expect(modelStore.getState().past).toEqual([]);
  });

  it('closes on Escape with nothing added and hands focus back to where it was', async () => {
    const user = userEvent.setup();
    mounted();
    screen.getByRole('button', { name: 'Before' }).focus();
    act(openAddExisting);
    await user.keyboard(' ');

    await user.keyboard('{Escape}');

    expect(picker()).toBeNull();
    expect(modelStore.getState().present).toBe(sharedModel);
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Before' }),
    );
  });
});

const mergePicker = () => screen.queryByRole('region', { name: /^Merge/u });

const mergeChoices = (): HTMLInputElement[] => [
  ...screen
    .getByRole('group', { name: 'Element to merge' })
    .querySelectorAll('input'),
];

describe('the picker choosing the element to merge into the one selected', () => {
  const storefront = diagramId('storefront');
  const api = elementId('orders-api');

  beforeEach(() => {
    modelStore.setState(
      {
        ...initialState(copiesModel),
        activeDiagram: storefront,
        selection: [api],
      },
      true,
    );
  });

  afterEach(() => {
    act(closeAddExisting);
  });

  it('offers one choice among the other elements of its kind, each described by the diagrams it is on', () => {
    mounted();
    act(openMergeInto);

    const choices = mergeChoices();
    expect(choices.map((choice) => choice.labels?.[0]?.textContent)).toEqual([
      'Web shop',
      'Orders API',
    ]);
    expect(
      describedBy(screen.getByRole('radio', { name: 'Orders API' })),
    ).toContain('Fulfilment');
    expect(screen.queryAllByRole('checkbox')).toEqual([]);
    expect(document.activeElement).toBe(choices[0]);
  });

  it('takes one choice and merges it into the element selected as one undo step', async () => {
    const user = userEvent.setup();
    mounted();
    act(openMergeInto);

    await user.click(screen.getByRole('radio', { name: 'Web shop' }));
    await user.click(screen.getByRole('radio', { name: 'Orders API' }));
    expect(mergeChoices().filter((choice) => choice.checked)).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Merge' }));

    expect(mergePicker()).toBeNull();
    expect(placedOn(api)).toEqual(['storefront', 'fulfilment']);
    expect(placedOn(elementId('orders-api-copy'))).toEqual([]);
    expect(modelStore.getState().past).toHaveLength(1);
    expect(modelStore.getState().selection).toEqual([api]);
  });

  it('merges nothing while nothing is picked, and keeps Merge on the Tab path saying why', async () => {
    const user = userEvent.setup();
    mounted();
    act(openMergeInto);

    const merge = screen.getByRole('button', { name: 'Merge' });
    expect(merge.getAttribute('aria-disabled')).toBe('true');
    expect(describedBy(merge)).not.toBe('');
    await user.click(merge);

    expect(mergePicker()).not.toBeNull();
    expect(modelStore.getState().past).toEqual([]);
  });

  it('goes away when another diagram is shown', () => {
    mounted();
    act(openMergeInto);
    expect(mergePicker()).not.toBeNull();

    act(() => {
      dispatch(Action.SelectDiagram({ diagramId: diagramId('fulfilment') }));
    });

    expect(mergePicker()).toBeNull();
    expect(modelStore.getState().present).toBe(copiesModel);
  });

  it('closes on Escape with nothing merged', async () => {
    const user = userEvent.setup();
    mounted();
    act(openMergeInto);
    await user.keyboard(' ');

    await user.keyboard('{Escape}');

    expect(mergePicker()).toBeNull();
    expect(modelStore.getState().present).toBe(copiesModel);
  });
});
