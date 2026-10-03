import type { Threat } from '@saerskriven/model';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { Accordion } from 'radix-ui';
import { recordedModel, sampleThreat } from '../store/store.fixtures.js';
import { noop } from '../ui/ui.fixtures.js';
import { marked } from './marked.js';
import { ThreatEditor, type ThreatEditorProps } from './threat-editor.js';

/**
 * How long a spec that drives the panel's editors is given, past the root
 * `vitest.shared.mts` sets. The threat editor's own suite renders three text
 * fields, three Radix listboxes and the accordion around them into jsdom, and
 * the panel's suite renders the panel around all of that. Both drive it
 * through `userEvent`, which commits and rerenders at every step. Three runs
 * on a host at load average 37 to 55 put the worst at 9.1 s against the 10 s
 * root, and which test tops out moves between runs, so the bound is the
 * suite's rather than one test's. The model panel, threat records,
 * element properties and element details suites drive their fields and
 * listboxes the same way. At load average near 2.5 the element properties
 * suite's worst takes 0.65 s against the editor and panel suites' 0.35 s.
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

/**
 * The ids of the threats listed under `root`, in the order the list shows
 * them: a panel's threat items, or the threat register's rows where `marker`
 * names them.
 */
export const listedThreats = (
  root: HTMLElement,
  marker: 'threatItem' | 'registerRow' = 'threatItem',
): readonly (string | undefined)[] =>
  [...root.querySelectorAll<HTMLElement>(marked[marker])].map(
    (item) => item.dataset[marker],
  );

/**
 * The row of the record holding the control `named`: the group with no name
 * of its own around it. The control is the row's toggle unless `role` says
 * otherwise, as for a new row, which draws no toggle and is found by its
 * first field.
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
 * A threat {@link recordedModel} holds, the first where it holds no such id,
 * with its status replaced where one is given.
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
 * Renders the threat editor inside the accordion it lives in, open unless
 * `expanded` is false. Every prop defaults to the sample threat and handlers
 * that do nothing.
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
