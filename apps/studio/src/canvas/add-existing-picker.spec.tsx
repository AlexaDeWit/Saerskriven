import { diagramsOf, type ElementId } from '@saerskriven/model';
import {
  copiesModel,
  diagramId,
  elementId,
  sharedModel,
} from '@saerskriven/model/fixtures';
import { act, render, screen, within } from '@testing-library/react';
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

const referenced = (
  control: HTMLElement,
  by: 'aria-describedby' | 'aria-labelledby',
): HTMLElement | null =>
  document.getElementById(control.getAttribute(by) ?? '');

const describedBy = (control: HTMLElement): string =>
  referenced(control, 'aria-describedby')?.textContent ?? '';

const namesIn = (group: HTMLElement, role: 'button' | 'radio'): string[] =>
  within(group)
    .getAllByRole(role)
    .map((box) => referenced(box, 'aria-labelledby')?.textContent ?? '');

const picker = () =>
  screen.queryByRole('region', { name: 'Add existing element' });

const entryBox = (name: string): HTMLElement =>
  screen.getByRole('button', { name });

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

  it('lists the elements the diagram on screen does not place and no flow, each one box described by the diagrams it is on, in a group the heading names', () => {
    mounted();
    act(openAddExisting);

    const group = screen.getByRole('group', { name: 'Add existing element' });
    expect(namesIn(group, 'button')).toEqual(['Card vault', 'Fraud check']);
    expect(describedBy(entryBox('Card vault'))).toContain('Payments');
    expect(screen.queryByRole('button', { name: 'Score' })).toBeNull();
    expect(screen.queryAllByRole('checkbox')).toEqual([]);
    expect(screen.queryAllByRole('group')).toEqual([group]);
    expect(document.activeElement).toBe(entryBox('Card vault'));
  });

  it('picks a box and puts it back at a click anywhere on it, and at Space and Enter while it has focus', async () => {
    const user = userEvent.setup();
    mounted();
    act(openAddExisting);
    const vault = entryBox('Card vault');
    const detail = referenced(vault, 'aria-describedby');
    assert.isNotNull(detail);

    await user.click(detail);
    expect(vault.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Add 1' })).toBeDefined();
    await user.click(vault);
    expect(vault.getAttribute('aria-pressed')).toBe('false');

    expect(document.activeElement).toBe(vault);
    await user.keyboard(' ');
    expect(vault.getAttribute('aria-pressed')).toBe('true');
    await user.keyboard('{Enter}');
    expect(vault.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Add' })).toBeDefined();
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
    await user.click(entryBox('Card vault'));
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
    expect(document.activeElement).toBe(entryBox('Card vault'));
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

const mergeChoices = (): HTMLElement =>
  screen.getByRole('group', { name: /^Merge into/u });

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

  it('offers one choice among the other elements of its kind, each one box described by the diagrams it is on, in a group the heading names', () => {
    mounted();
    act(openMergeInto);

    expect(namesIn(mergeChoices(), 'radio')).toEqual([
      'Web shop',
      'Orders API',
    ]);
    expect(
      describedBy(screen.getByRole('radio', { name: 'Orders API' })),
    ).toContain('Fulfilment');
    expect(screen.queryAllByRole('checkbox')).toEqual([]);
    expect(document.activeElement).toBe(
      screen.getByRole('radio', { name: 'Web shop' }),
    );
  });

  it('takes one choice, at a click anywhere on its box or Enter, and merges it into the element selected as one undo step', async () => {
    const user = userEvent.setup();
    mounted();
    act(openMergeInto);
    const webShop = screen.getByRole('radio', { name: 'Web shop' });
    const copy = screen.getByRole('radio', { name: 'Orders API' });
    const detail = referenced(webShop, 'aria-describedby');
    assert.isNotNull(detail);

    await user.click(detail);
    expect(
      within(mergeChoices()).getAllByRole('radio', { checked: true }),
    ).toEqual([webShop]);
    copy.focus();
    await user.keyboard('{Enter}');
    expect(
      within(mergeChoices()).getAllByRole('radio', { checked: true }),
    ).toEqual([copy]);
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
