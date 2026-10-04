import type { Threat } from '@saerskriven/model';
import { softHyphen } from '@saerskriven/model/fixtures';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { Accordion } from 'radix-ui';
import { recordedModel, sampleThreat } from '../store/store.fixtures.js';
import { noop, textbox } from '../ui/ui.fixtures.js';
import { marked } from './marked.js';
import { ThreatEditor, type ThreatEditorProps } from './threat-editor.js';

/**
 * Panel editor timeout above the 10 s root ceiling in `vitest.shared.mts`.
 * Under host load average 37 to 55, userEvent-driven specs took up to 9.1 s.
 * The slowest test varied, so the timeout applies to each editor suite.
 */
export const editorTimeout = 30_000;

/** Chooses a labelled option through the shared listbox control. */
export const chooseFrom = async (
  field: string,
  option: string,
): Promise<void> => {
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox', { name: field }));
  await user.click(screen.getByRole('option', { name: option }));
};

/** Text containing a character the model refuses. */
export const refusedProse: string = `Pasted${softHyphen}prose`;

/** Finds the field that retains the refused prose. */
export const refusedDraft = (): HTMLElement =>
  screen.getByDisplayValue(refusedProse);

/** Types refused prose into Description without committing it. */
export const typeRefusedProse = async (
  user: ReturnType<typeof userEvent.setup>,
): Promise<void> => {
  await user.click(textbox('Description'));
  await user.keyboard(refusedProse);
};

/**
 * Lists threat ids in display order, using panel items or register rows.
 */
export const listedThreats = (
  root: HTMLElement,
  marker: 'threatItem' | 'registerRow' = 'threatItem',
): readonly (string | undefined)[] =>
  [...root.querySelectorAll<HTMLElement>(marked[marker])].map(
    (item) => item.dataset[marker],
  );

/**
 * Finds a record's unnamed group by its toggle or a new row's first field.
 */
export const recordRow = (
  named: string,
  role: 'button' | 'textbox' = 'button',
): HTMLElement => {
  const control = screen.getByRole(role, { name: named });
  return screen.getByRole('group', {
    name: (name, group) => name === '' && group.contains(control),
  });
};

/**
 * Finds a recorded threat, falling back to the first, with an optional status.
 */
export const recordedThreat = (
  id: Threat['id'],
  status?: Threat['status'],
): Threat => {
  const threat =
    recordedModel.threats.find((held) => held.id === id) ??
    recordedModel.threats[0];
  return { ...threat, status: status ?? threat.status };
};

/**
 * Renders the sample threat in its accordion, open by default, with inert handlers.
 */
export const showThreatEditor = (
  overrides: Partial<ThreatEditorProps> = {},
  expanded = true,
): void => {
  const props: ThreatEditorProps = {
    threat: sampleThreat,
    on: sampleThreat.elements[0],
    focus: undefined,
    held: undefined,
    onChange: noop,
    onCommit: noop,
    onRefusal: noop,
    onAttach: noop,
    onDetach: noop,
    onModelLink: noop,
    onDelete: noop,
    onFocused: noop,
    ...overrides,
  };
  render(
    createElement(
      Accordion.Root,
      {
        collapsible: true,
        defaultValue: expanded ? props.threat.id : '',
        type: 'single',
      },
      createElement(ThreatEditor, props),
    ),
  );
};
