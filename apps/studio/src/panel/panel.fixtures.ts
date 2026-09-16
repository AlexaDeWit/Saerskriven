import type { Threat } from '@saerskriven/model';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { Accordion } from 'radix-ui';
import { recordedModel, sampleThreat } from '../store/store.fixtures.js';
import { noop } from '../ui/ui.fixtures.js';
import { ThreatEditor, type ThreatEditorProps } from './threat-editor.js';

/**
 * How long a spec that drives the threat editor is given, past the root
 * `vitest.shared.mts` sets. The editor's own suite renders three text fields,
 * three Radix listboxes and the accordion around them into jsdom, and the
 * panel's suite renders the panel around all of that; both drive it through
 * `userEvent`, which commits and rerenders at every step. Three runs on a
 * host at load average 37 to 55 put the worst at 9.1 s against the 10 s root,
 * and which test tops out moves between runs, so the bound is the suite's
 * rather than one test's.
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

/** The numbers a text says, in the order it says them. */
export const numbersIn = (text: string | null | undefined): readonly number[] =>
  (text?.match(/\d+/gu) ?? []).map(Number);

/** The numbers in the text that describes a control, in the order they are said. */
export const describedNumbers = (control: HTMLElement): readonly number[] =>
  numbersIn(
    document.getElementById(control.getAttribute('aria-describedby') ?? '')
      ?.textContent,
  );

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
 * `expanded` is false. Every prop defaults to the sample threat with no
 * attachments and handlers that do nothing.
 */
export const showThreatEditor = (
  overrides: Partial<ThreatEditorProps> = {},
  expanded = true,
): void => {
  const props: ThreatEditorProps = {
    threat: sampleThreat,
    attachments: [],
    focus: undefined,
    held: undefined,
    onChange: noop,
    onCommit: noop,
    onRefusal: noop,
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
