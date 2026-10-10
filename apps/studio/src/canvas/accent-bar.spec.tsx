import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ElementId } from '@saerskriven/model';
import {
  drawnAs,
  iconOnly,
  tooltipOnFocus,
} from '../commands/commands.fixtures.js';
import { withLanguage } from '../messages/locale.fixtures.js';
import { Action } from '../store/actions.js';
import { elementById } from '../store/selectors.js';
import { actorElement, processElement } from '../store/store.fixtures.js';
import { dispatch, modelStore } from '../store/store.js';
import { AccentBar } from './accent-bar.js';
import {
  boundaryElement,
  canvasModel,
  noteElement,
  openCanvas,
  requestFlow,
} from './canvas.fixtures.js';

const names = [
  'No accent',
  'Strong accent 1',
  'Strong accent 2',
  'Strong accent 3',
  'Strong accent 4',
  'Light accent 1',
  'Light accent 2',
  'Light accent 3',
  'Light accent 4',
];

const swatches = (): HTMLElement[] => screen.getAllByRole('button');

const swatch = (name: string): HTMLElement =>
  screen.getByRole('button', { name });

const pressed = (): (string | null)[] =>
  swatches()
    .filter((control) => control.getAttribute('aria-pressed') === 'true')
    .map((control) => control.getAttribute('aria-label'));

const accentOf = (id: ElementId) => {
  const element = elementById(modelStore.getState(), id);
  return element !== undefined && 'accent' in element
    ? element.accent
    : undefined;
};

const accentable = [actorElement, requestFlow, boundaryElement];

describe('AccentBar', () => {
  it('offers no accent, the four strong keys and the four light ones, in that order, each as an icon button', () => {
    openCanvas([actorElement]);
    render(<AccentBar />);

    expect(
      swatches().map((control) => control.getAttribute('aria-label')),
    ).toEqual(names);
    for (const control of swatches()) {
      expect(drawnAs(control)).toEqual(iconOnly);
    }
    expect(screen.getByRole('region', { name: 'Accent' })).toBeDefined();
  });

  it.each([
    ['nothing is selected', []],
    ['only a note is selected', [noteElement]],
  ] as const)('is disabled while %s', (_, selection) => {
    openCanvas(selection);
    render(<AccentBar />);

    expect(
      swatches().filter((control) => !control.hasAttribute('disabled')),
    ).toEqual([]);
    expect(pressed()).toEqual([]);
  });

  it('gives the key to every selected element and flow that takes one as one undo step, leaving a selected note as it was', async () => {
    openCanvas([...accentable, noteElement]);
    const user = userEvent.setup();
    render(<AccentBar />);

    await user.click(swatch('Strong accent 2'));

    expect(accentable.map(accentOf)).toEqual(['s2', 's2', 's2']);
    expect(accentOf(noteElement)).toBeUndefined();
    expect(accentOf(processElement)).toBeUndefined();
    expect(modelStore.getState().past).toHaveLength(1);
    expect(modelStore.getState().lastFailure).toBeUndefined();
    expect(modelStore.getState().selection).toEqual([
      ...accentable,
      noteElement,
    ]);
    act(() => {
      dispatch(Action.Undo());
    });
    expect(modelStore.getState().present).toBe(canvasModel);
  });

  it('presses the swatch the selection holds, No accent where it holds none, and none where it is mixed', async () => {
    openCanvas(accentable);
    const user = userEvent.setup();
    render(<AccentBar />);
    expect(pressed()).toEqual(['No accent']);

    await user.click(swatch('Light accent 3'));
    expect(pressed()).toEqual(['Light accent 3']);

    act(() => {
      dispatch(Action.SetAccent({ elementIds: [requestFlow], accent: 's1' }));
    });
    expect(pressed()).toEqual([]);

    act(() => {
      dispatch(Action.Select({ elementIds: [requestFlow, noteElement] }));
    });
    expect(pressed()).toEqual(['Strong accent 1']);
  });

  it('clears every selected accent with No accent, as one undo step', async () => {
    openCanvas(accentable);
    const user = userEvent.setup();
    render(<AccentBar />);
    await user.click(swatch('Strong accent 4'));

    await user.click(swatch('No accent'));

    expect(accentable.map(accentOf)).toEqual([undefined, undefined, undefined]);
    expect(modelStore.getState().present).toEqual(canvasModel);
    expect(modelStore.getState().past).toHaveLength(2);
  });

  it('applies a key with Enter on its swatch', async () => {
    openCanvas([actorElement]);
    const user = userEvent.setup();
    render(<AccentBar />);
    swatch('Light accent 1').focus();

    await user.keyboard('{Enter}');

    expect(accentOf(actorElement)).toBe('l1');
  });

  it('names a swatch in its tooltip, and declares no shortcut for it', async () => {
    openCanvas([actorElement]);
    render(<AccentBar />);

    const { tooltip, label, chord } = await tooltipOnFocus('accent-s3');
    expect(chord).toBe('');
    expect(tooltip.textContent).toBe(label);
    expect(swatch(label).hasAttribute('aria-keyshortcuts')).toBe(false);
  });
});

describe.each([
  [
    'fr-CA',
    'Accentuation',
    ['Aucune accentuation', 'Accentuation forte 1', 'Accentuation légère 4'],
  ],
  ['sv', 'Accent', ['Ingen accent', 'Stark accent 1', 'Lätt accent 4']],
] as const)('the accent bar in %s', (locale, region, [none, strong, light]) => {
  withLanguage(locale);

  it('names the row and each swatch in that language', () => {
    openCanvas([actorElement]);
    render(<AccentBar />);

    expect(screen.getByRole('region', { name: region })).toBeDefined();
    const labels = swatches().map((control) =>
      control.getAttribute('aria-label'),
    );
    expect(labels).toHaveLength(names.length);
    expect(new Set(labels).size).toBe(names.length);
    expect([labels.at(0), labels.at(1), labels.at(-1)]).toEqual([
      none,
      strong,
      light,
    ]);
  });
});
