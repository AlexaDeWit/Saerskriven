import type { ElementId, Threat } from '@saerskriven/model';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  currentAnnouncement,
  resetAnnouncements,
} from '../canvas/announcements.js';
import { recordingSurface } from '../commands/commands.fixtures.js';
import { commandById, runCommand } from '../commands/registry.js';
import { Action } from '../store/actions.js';
import { initialState } from '../store/state.js';
import {
  actorElement,
  firstThreat,
  present,
  processElement,
  sampleElement,
  sampleModel,
  sampleThreat,
  undoable,
} from '../store/store.fixtures.js';
import { dispatch, modelStore } from '../store/store.js';
import { chooseFrom, editorTimeout } from './panel.fixtures.js';
import {
  ThreatPanel,
  type HeldDraft,
  type ThreatPanelProps,
} from './threat-panel.js';
import {
  addControl,
  button,
  describedNumbers,
  noop,
  numbersIn,
  textbox,
} from '../ui/ui.fixtures.js';
import { softHyphen, threatId } from '@saerskriven/model/fixtures';
import { activeTranslator } from '../messages/locale.js';

const panelProps = (
  overrides: Partial<ThreatPanelProps> = {},
): ThreatPanelProps => ({
  drafts: new Map(),
  focusing: false,
  onClose: noop,
  wide: false,
  onToggleWidth: noop,
  onFocused: noop,
  subject: { kind: 'several', count: 0 },
  ...overrides,
});

const showPanel = (
  selection: ElementId,
  overrides: Partial<ThreatPanelProps> = {},
): void => {
  dispatch(Action.Select({ elementIds: [selection] }));
  render(
    <ThreatPanel
      {...panelProps({
        subject: { kind: 'element', element: sampleElement(selection) },
        ...overrides,
      })}
    />,
  );
};

const titleField = (): HTMLElement =>
  screen.getByRole('textbox', { name: 'Title' });

const severityOf = (): string =>
  screen.getByRole('combobox', { name: 'Severity' }).textContent ?? '';

const threatsInStore = (): number =>
  modelStore.getState().present.threats.length;

const runHistory = (id: 'undo' | 'redo'): void => {
  act(() => {
    runCommand(commandById(id), recordingSurface().surface);
  });
};

const shareThreat = (): void => {
  dispatch(
    Action.ReplaceThreat({
      threat: {
        ...modelStore.getState().present.threats[0],
        elements: [actorElement, processElement],
      },
    }),
  );
};

const addThreat = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(addControl());
};

describe(
  'ThreatPanel',
  () => {
    beforeEach(() => {
      modelStore.setState(initialState(sampleModel), true);
      resetAnnouncements();
    });

    it('says how many are selected where more than one is, and offers no edit', () => {
      render(
        <ThreatPanel
          {...panelProps({ subject: { kind: 'several', count: 3 } })}
        />,
      );

      expect(numbersIn(screen.getByTestId('threat-panel').textContent)).toEqual(
        [3],
      );
      expect(screen.queryByRole('button', { name: 'Add a threat' })).toBeNull();
    });

    it('lists the names of every element sharing a threat', () => {
      shareThreat();
      showPanel(actorElement);
      act(() => {
        screen.getByRole('button', { name: /A reader edits/u }).click();
      });
      const attachments = screen.getByRole('group', {
        name: 'Attached elements',
      });
      expect(attachments.textContent).toContain(
        sampleElement(actorElement).name,
      );
      expect(attachments.textContent).toContain(
        sampleElement(processElement).name,
      );
    });

    it('attaches a threat the register already holds, as one undo step', async () => {
      const user = userEvent.setup();
      showPanel(processElement);

      await chooseFrom('Existing threat', sampleThreat.title);
      await user.click(button('Attach existing threat'));

      expect(present().threats[0].elements).toEqual([
        actorElement,
        processElement,
      ]);
      expect(undoable()).toBe(1);
      expect(numbersIn(currentAnnouncement().message)).toEqual([1]);
    });

    it('offers a threat attached to nothing before the threats attached elsewhere', async () => {
      const user = userEvent.setup();
      const loose: Threat = {
        ...sampleThreat,
        id: threatId('threat-loose'),
        number: 2,
        title: 'A threat that arrived attached to nothing',
        elements: [],
      };
      modelStore.setState(
        initialState({
          ...sampleModel,
          threats: [...sampleModel.threats, loose],
          lastIssuedThreatNumber: 2,
        }),
        true,
      );
      showPanel(processElement);

      await user.click(
        screen.getByRole('combobox', { name: 'Existing threat' }),
      );

      expect(screen.getAllByRole('option')[0]).toBe(
        screen.getByRole('option', { name: loose.title }),
      );
    });

    it('detaches an element from a threat that names others, leaving the threat', async () => {
      const user = userEvent.setup();
      shareThreat();
      showPanel(actorElement);
      await user.click(screen.getByRole('button', { name: /A reader edits/u }));

      await user.click(button('Detach Studio'));

      expect(present().threats[0].elements).toEqual([actorElement]);
      expect(threatsInStore()).toBe(1);
      expect(numbersIn(currentAnnouncement().message)).toEqual([1]);
    });

    it('removes the threat when the detach takes its last element, and one undo brings it back', async () => {
      const user = userEvent.setup();
      showPanel(actorElement);
      await user.click(screen.getByRole('button', { name: /A reader edits/u }));

      await user.click(button('Detach Reader'));

      expect(threatsInStore()).toBe(0);
      expect(undoable()).toBe(1);
      expect(numbersIn(currentAnnouncement().message)).toEqual([1]);
      expect(document.activeElement).toBe(addControl());

      act(() => {
        dispatch(Action.Undo());
      });

      expect(present().threats[0].elements).toEqual([actorElement]);
    });

    it('names the selected element and lists what is recorded against it', () => {
      showPanel(actorElement);

      expect(
        screen.getByRole('heading', { name: 'Threats on Reader' }),
      ).toBeDefined();
      expect(
        screen.getByRole('button', { name: /A reader edits/u }),
      ).toBeDefined();
    });

    it('lists nothing for an element no threat names, and still offers an add', () => {
      showPanel(processElement);

      expect(screen.queryByText(sampleModel.threats[0].title)).toBeNull();
      expect(addControl()).toBeDefined();
    });

    it('adds a threat to the selected element, focused on its title without a duplicate message', async () => {
      const user = userEvent.setup();
      showPanel(processElement);

      await addThreat(user);

      expect(threatsInStore()).toBe(2);
      expect(document.activeElement).toBe(titleField());
      expect(currentAnnouncement().message).toBe('');
    });

    it('deletes a threat, moving focus to the one that takes its place', async () => {
      const user = userEvent.setup();
      showPanel(actorElement);
      await addThreat(user);

      await user.click(screen.getByRole('button', { name: 'Delete threat 2' }));

      expect(threatsInStore()).toBe(1);
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: /A reader edits/u }),
      );
      expect(numbersIn(currentAnnouncement().message)).toEqual([2]);
    });

    it('deletes the last threat of an element, moving focus to the add control', async () => {
      const user = userEvent.setup();
      showPanel(processElement);
      await addThreat(user);

      await user.click(screen.getByRole('button', { name: 'Delete threat 2' }));

      expect(threatsInStore()).toBe(1);
      expect(document.activeElement).toBe(addControl());
    });

    it('hands focus to the add control when an undo takes away the threat holding it, and back to its title on redo', async () => {
      const user = userEvent.setup();
      showPanel(processElement);
      await addThreat(user);

      runHistory('undo');

      expect(threatsInStore()).toBe(1);
      expect(document.activeElement).toBe(addControl());

      runHistory('redo');

      expect(threatsInStore()).toBe(2);
      expect(document.activeElement).toBe(titleField());
    });

    it('leaves focus in another threat when an undo or redo takes away the threat just added', async () => {
      const user = userEvent.setup();
      showPanel(actorElement);
      await addThreat(user);
      await user.click(screen.getByRole('button', { name: /A reader edits/u }));
      const kept = titleField();
      await user.click(kept);

      runHistory('undo');

      expect(threatsInStore()).toBe(1);
      expect(document.activeElement).toBe(kept);

      runHistory('redo');

      expect(threatsInStore()).toBe(2);
      expect(document.activeElement).toBe(kept);
    });

    it('leaves focus outside the panel where an undo or redo moves a threat', async () => {
      const user = userEvent.setup();
      render(<button type="button">Canvas</button>);
      const canvas = screen.getByRole('button', { name: 'Canvas' });
      showPanel(processElement);
      await addThreat(user);
      act(() => {
        canvas.focus();
      });

      runHistory('undo');
      expect(document.activeElement).toBe(canvas);
      runHistory('redo');
      expect(document.activeElement).toBe(canvas);

      await user.click(titleField());
      runHistory('undo');
      expect(document.activeElement).toBe(addControl());
      act(() => {
        canvas.focus();
      });
      runHistory('redo');

      expect(threatsInStore()).toBe(2);
      expect(document.activeElement).toBe(canvas);
    });

    it('forgets an undone threat that came back while focus was elsewhere', async () => {
      const user = userEvent.setup();
      render(<button type="button">Canvas</button>);
      const canvas = screen.getByRole('button', { name: 'Canvas' });
      showPanel(processElement);
      await addThreat(user);
      runHistory('undo');
      act(() => {
        canvas.focus();
      });
      runHistory('redo');
      await user.click(screen.getByRole('button', { name: 'Delete threat 2' }));
      expect(document.activeElement).toBe(addControl());

      runHistory('undo');

      expect(threatsInStore()).toBe(2);
      expect(document.activeElement).toBe(addControl());
    });

    it('commits a severity change as one undoable step', async () => {
      const user = userEvent.setup();
      showPanel(actorElement);
      await user.click(screen.getByRole('button', { name: /A reader edits/u }));

      await user.click(screen.getByRole('combobox', { name: 'Severity' }));
      await user.click(screen.getByRole('option', { name: 'Critical' }));
      expect(severityOf()).toContain('Critical');

      act(() => {
        dispatch(Action.Undo());
      });

      expect(severityOf()).toContain('Medium');
    });

    it('keeps a refused draft on screen where the threat would collapse, and says so', async () => {
      const user = userEvent.setup();
      showPanel(actorElement);
      await user.click(screen.getByRole('button', { name: /A reader edits/u }));

      await user.click(screen.getByRole('textbox', { name: 'Description' }));
      await user.keyboard(`Pasted${softHyphen}prose`);
      await user.click(screen.getByRole('button', { name: /A reader edits/u }));

      expect(
        screen.getByDisplayValue(`Pasted${softHyphen}prose`),
      ).toBeDefined();
      expect(describedNumbers(textbox('Description'))).toEqual([7]);
      expect(currentAnnouncement().message.trim()).not.toBe('');
      expect(modelStore.getState().present.threats[0].description).toBe('');

      await user.click(screen.getByRole('textbox', { name: 'Description' }));
      await user.keyboard('x');

      expect(currentAnnouncement().message).toBe('');
      expect(
        screen
          .getByRole('textbox', { name: 'Description' })
          .getAttribute('aria-invalid'),
      ).toBe('true');
    });

    it('hands a refused draft to the map it was given, keyed by the threat it was typed on', async () => {
      const user = userEvent.setup();
      const drafts = new Map<ElementId, HeldDraft>();
      showPanel(actorElement, { drafts });
      await user.click(screen.getByRole('button', { name: /A reader edits/u }));

      await user.click(screen.getByRole('textbox', { name: 'Description' }));
      await user.keyboard(`Pasted${softHyphen}prose`);
      await user.click(screen.getByRole('button', { name: /A reader edits/u }));

      expect(drafts.get(actorElement)).toMatchObject({
        threatId: firstThreat,
        field: 'Description',
        text: `Pasted${softHyphen}prose`,
      });
      expect(
        drafts.get(actorElement)?.said(activeTranslator().t).trim(),
      ).not.toBe('');
    });

    it('opens on the draft it was given without repeating its past refusal', () => {
      const drafts = new Map<ElementId, HeldDraft>([
        [
          actorElement,
          {
            threatId: firstThreat,
            field: 'Description',
            text: `Pasted${softHyphen}prose`,
            said: () => 'A refusal',
          },
        ],
      ]);
      showPanel(actorElement, { drafts });

      expect(
        screen.getByDisplayValue(`Pasted${softHyphen}prose`),
      ).toBeDefined();
      expect(currentAnnouncement().message).toBe('');
    });

    it('drops a refusal an undo settled, and lets the threat collapse again', async () => {
      const user = userEvent.setup();
      showPanel(actorElement);
      await user.click(screen.getByRole('button', { name: /A reader edits/u }));
      await user.click(screen.getByRole('textbox', { name: 'Description' }));
      await user.keyboard('Prose the model takes');
      await user.tab();

      await user.click(screen.getByRole('textbox', { name: 'Description' }));
      await user.keyboard(softHyphen);
      await user.click(screen.getByRole('button', { name: /A reader edits/u }));
      expect(currentAnnouncement().message.trim()).not.toBe('');

      act(() => {
        dispatch(Action.Undo());
      });

      expect(currentAnnouncement().message).toBe('');

      await user.click(screen.getByRole('button', { name: /A reader edits/u }));

      expect(screen.queryByRole('textbox', { name: 'Description' })).toBeNull();
    });

    it('lets the threat collapse once the refused text is corrected', async () => {
      const user = userEvent.setup();
      showPanel(actorElement);
      await user.click(screen.getByRole('button', { name: /A reader edits/u }));
      await user.click(screen.getByRole('textbox', { name: 'Description' }));
      await user.keyboard(`Pasted${softHyphen}prose`);
      await user.click(screen.getByRole('button', { name: /A reader edits/u }));

      await user.clear(screen.getByRole('textbox', { name: 'Description' }));
      await user.keyboard('Pasted prose');
      await user.click(screen.getByRole('button', { name: /A reader edits/u }));

      expect(screen.queryByRole('textbox', { name: 'Description' })).toBeNull();
      expect(modelStore.getState().present.threats[0].description).toBe(
        'Pasted prose',
      );
    });

    it('moves focus to its first control when it is asked for, and not before', () => {
      const focused = vi.fn<() => void>();
      const props = panelProps({
        onFocused: focused,
        subject: { kind: 'element', element: sampleElement(processElement) },
      });
      dispatch(Action.Select({ elementIds: [processElement] }));
      const { rerender } = render(<ThreatPanel {...props} />);
      expect(document.activeElement).toBe(document.body);

      rerender(<ThreatPanel {...props} focusing />);

      expect(document.activeElement).toBe(addControl());
      expect(focused).toHaveBeenCalled();
    });

    it('closes on Escape, and leaves an open listbox its own', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn<() => void>();
      showPanel(actorElement, { onClose });
      await user.click(screen.getByRole('button', { name: /A reader edits/u }));

      await user.click(screen.getByRole('combobox', { name: 'Severity' }));
      await user.keyboard('{Escape}');
      expect(onClose).not.toHaveBeenCalled();

      await user.click(screen.getByRole('textbox', { name: 'Title' }));
      await user.keyboard('{Escape}');

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  },
  editorTimeout,
);
