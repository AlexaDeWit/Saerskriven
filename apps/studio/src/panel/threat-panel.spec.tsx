import {
  renameElement,
  type ElementId,
  type Severity,
  type Threat,
  type ThreatStatus,
} from '@saerskriven/model';
import { Either } from 'effect';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  currentAnnouncement,
  resetAnnouncements,
} from '../canvas/announcements.js';
import { runRegistered } from '../commands/commands.fixtures.js';
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
import { chooseFrom, editorTimeout, listedThreats } from './panel.fixtures.js';
import type { HeldDraft } from './threat-list.js';
import { ThreatPanel, type ThreatPanelProps } from './threat-panel.js';
import {
  addControl,
  button,
  describedNumbers,
  detailsTab,
  noop,
  numbersIn,
  textbox,
  threatsTab,
} from '../ui/ui.fixtures.js';
import { elementIn, softHyphen, threatId } from '@saerskriven/model/fixtures';
import { canvasModel, requestFlow } from '../canvas/canvas.fixtures.js';
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

const readerThreat = (): HTMLElement =>
  screen.getByRole('button', { name: /A reader edits/u });

const refusedProse = `Pasted${softHyphen}prose`;

const refusedDraft = (): HTMLElement => screen.getByDisplayValue(refusedProse);

const typeRefusedProse = async (
  user: ReturnType<typeof userEvent.setup>,
): Promise<void> => {
  await user.click(textbox('Description'));
  await user.keyboard(refusedProse);
};

const severityOf = (): string =>
  screen.getByRole('combobox', { name: 'Severity' }).textContent ?? '';

const threatsInStore = (): number =>
  modelStore.getState().present.threats.length;

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

const reviewedThreats: readonly Threat[] = (
  [
    ['threat-mitigated-high', 'mitigated', 'high'],
    ['threat-open-low', 'open', 'low'],
    ['threat-accepted-critical', 'accepted-risk', 'critical'],
    ['threat-open-critical', 'open', 'critical'],
  ] as const satisfies readonly (readonly [string, ThreatStatus, Severity])[]
).map(([id, status, severity], index) => ({
  ...sampleThreat,
  id: threatId(id),
  number: index + 1,
  title: id,
  status,
  severity,
}));

const withReviewedThreats = (): void => {
  modelStore.setState(
    initialState({
      ...sampleModel,
      threats: [...reviewedThreats],
      lastIssuedThreatNumber: reviewedThreats.length,
    }),
    true,
  );
};

const listed = (): readonly (string | undefined)[] =>
  listedThreats(screen.getByTestId('threat-panel'));

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
        readerThreat().click();
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

    it('attaches an element from the threat editor, as one undo step', async () => {
      const user = userEvent.setup();
      showPanel(actorElement);
      await user.click(readerThreat());

      await chooseFrom('Existing element', 'Studio');
      await user.click(button('Attach existing element'));

      expect(present().threats[0].elements).toEqual([
        actorElement,
        processElement,
      ]);
      expect(undoable()).toBe(1);
      expect(numbersIn(currentAnnouncement().message)).toEqual([1]);

      act(() => {
        dispatch(Action.Undo());
      });

      expect(present().threats[0].elements).toEqual([actorElement]);
    });

    it('leaves focus on the attachment above when the last one is detached', async () => {
      const user = userEvent.setup();
      shareThreat();
      showPanel(actorElement);
      await user.click(readerThreat());

      await user.click(button('Detach Studio'));

      expect(present().threats[0].elements).toEqual([actorElement]);
      expect(document.activeElement).toBe(button('Detach Reader'));
    });

    it('detaches an element from a threat that names others, leaving the threat and focus on the next attachment', async () => {
      const user = userEvent.setup();
      shareThreat();
      showPanel(processElement);
      await user.click(readerThreat());

      await user.click(button('Detach Reader'));

      expect(present().threats[0].elements).toEqual([processElement]);
      expect(threatsInStore()).toBe(1);
      expect(numbersIn(currentAnnouncement().message)).toEqual([1]);
      expect(document.activeElement).toBe(button('Detach Studio'));
    });

    it('takes a threat off the list when the detach takes the element shown, keeping it on its other element, with focus on the add control', async () => {
      const user = userEvent.setup();
      shareThreat();
      showPanel(actorElement);
      await user.click(readerThreat());

      await user.click(button('Detach Reader'));

      expect(present().threats[0].elements).toEqual([processElement]);
      expect(listed()).toEqual([]);
      expect(document.activeElement).toBe(addControl());
    });

    it('removes the threat when the detach takes its last element, and one undo brings it back', async () => {
      const user = userEvent.setup();
      showPanel(actorElement);
      await user.click(readerThreat());

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

      expect(screen.getByRole('heading', { name: 'Reader' })).toBeDefined();
      expect(readerThreat()).toBeDefined();
    });

    it('opens on a Threats tab carrying the threat count, beside a Details tab', () => {
      showPanel(actorElement);

      expect(threatsTab().getAttribute('aria-selected')).toBe('true');
      expect(detailsTab().getAttribute('aria-selected')).toBe('false');
      expect(addControl()).toBeDefined();
      expect(
        screen.queryByRole('textbox', { name: 'Description of Reader' }),
      ).toBeNull();
    });

    it('holds the element description, scope and security properties on Details', async () => {
      const user = userEvent.setup();
      showPanel(actorElement);

      await user.click(detailsTab());

      expect(textbox('Description of Reader')).toBeDefined();
      expect(
        screen.getByRole('combobox', { name: 'Out of scope' }),
      ).toBeDefined();
      expect(button('Security properties')).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Add a threat' })).toBeNull();
      expect(
        screen.queryByRole('button', { name: /A reader edits/u }),
      ).toBeNull();
    });

    it('moves between its tabs from the keyboard as a tab list does', async () => {
      const user = userEvent.setup();
      showPanel(actorElement);
      act(() => {
        threatsTab().focus();
      });

      await user.keyboard('{ArrowRight}');
      expect(document.activeElement).toBe(detailsTab());
      expect(detailsTab().getAttribute('aria-selected')).toBe('true');
      await user.keyboard('{Home}');
      expect(document.activeElement).toBe(threatsTab());
      expect(threatsTab().getAttribute('aria-selected')).toBe('true');
      await user.keyboard('{Tab}');

      expect(document.activeElement).toBe(addControl());
    });

    it('keeps an open threat open through a visit to Details', async () => {
      const user = userEvent.setup();
      showPanel(actorElement);
      await user.click(readerThreat());

      await user.click(detailsTab());
      await user.click(threatsTab());

      expect(titleField()).toBeDefined();
    });

    it('counts the threats on its Threats tab as one is added', async () => {
      const user = userEvent.setup();
      showPanel(processElement);
      expect(numbersIn(threatsTab().textContent)).toEqual([0]);

      await addThreat(user);

      expect(numbersIn(threatsTab().textContent)).toEqual([1]);
    });

    it('names a flow left unlabelled from its ends in its heading', () => {
      const unlabelled = Either.getOrThrow(
        renameElement(canvasModel, requestFlow, ''),
      );
      modelStore.setState(
        { ...initialState(unlabelled), selection: [requestFlow] },
        true,
      );
      render(
        <ThreatPanel
          {...panelProps({
            subject: {
              kind: 'element',
              element: elementIn(unlabelled, requestFlow),
            },
          })}
        />,
      );

      expect(
        screen.getByRole('heading', { name: 'Flow from Reader to Studio' }),
      ).toBeDefined();
    });

    it('heads an element called nothing by its kind, opening with a capital', () => {
      const nameless = { ...sampleElement(processElement), name: '' };
      modelStore.setState(
        {
          ...initialState({
            ...sampleModel,
            diagrams: sampleModel.diagrams.map((diagram) => ({
              ...diagram,
              elements: diagram.elements.map((element) =>
                element.id === processElement ? nameless : element,
              ),
            })),
          }),
          selection: [processElement],
        },
        true,
      );
      render(
        <ThreatPanel
          {...panelProps({ subject: { kind: 'element', element: nameless } })}
        />,
      );

      expect(
        screen.getByRole('heading', { name: 'The process' }),
      ).toBeDefined();
    });

    it('lists the threats still open first, each status from the highest severity down', () => {
      withReviewedThreats();
      showPanel(actorElement);

      expect(listed()).toEqual([
        'threat-open-critical',
        'threat-open-low',
        'threat-accepted-critical',
        'threat-mitigated-high',
      ]);
    });

    it('holds its order while it is open, and sorts again when it opens next', async () => {
      const user = userEvent.setup();
      withReviewedThreats();
      showPanel(actorElement);
      const shown = listed();

      act(() => {
        dispatch(
          Action.ReplaceThreat({
            threat: { ...reviewedThreats[0], status: 'open' },
          }),
        );
      });
      await addThreat(user);

      expect(listed()).toEqual([...shown, present().threats.at(-1)?.id]);
      cleanup();
      showPanel(actorElement);
      expect(listed().slice(0, 2)).toEqual([
        'threat-open-critical',
        'threat-mitigated-high',
      ]);
    });

    it('moves focus to the threat listed after a deleted one', async () => {
      const user = userEvent.setup();
      withReviewedThreats();
      showPanel(actorElement);
      await user.click(
        screen.getByRole('button', { name: /threat-open-critical/u }),
      );

      await user.click(button('Delete threat 4'));

      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: /threat-open-low/u }),
      );
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
      expect(document.activeElement).toBe(readerThreat());
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

      runRegistered('undo');

      expect(threatsInStore()).toBe(1);
      expect(document.activeElement).toBe(addControl());

      runRegistered('redo');

      expect(threatsInStore()).toBe(2);
      expect(document.activeElement).toBe(titleField());
    });

    it('leaves focus in another threat when an undo or redo takes away the threat just added', async () => {
      const user = userEvent.setup();
      showPanel(actorElement);
      await addThreat(user);
      await user.click(readerThreat());
      const kept = titleField();
      await user.click(kept);

      runRegistered('undo');

      expect(threatsInStore()).toBe(1);
      expect(document.activeElement).toBe(kept);

      runRegistered('redo');

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

      runRegistered('undo');
      expect(document.activeElement).toBe(canvas);
      runRegistered('redo');
      expect(document.activeElement).toBe(canvas);

      await user.click(titleField());
      runRegistered('undo');
      expect(document.activeElement).toBe(addControl());
      act(() => {
        canvas.focus();
      });
      runRegistered('redo');

      expect(threatsInStore()).toBe(2);
      expect(document.activeElement).toBe(canvas);
    });

    it('forgets an undone threat that came back while focus was elsewhere', async () => {
      const user = userEvent.setup();
      render(<button type="button">Canvas</button>);
      const canvas = screen.getByRole('button', { name: 'Canvas' });
      showPanel(processElement);
      await addThreat(user);
      runRegistered('undo');
      act(() => {
        canvas.focus();
      });
      runRegistered('redo');
      await user.click(screen.getByRole('button', { name: 'Delete threat 2' }));
      expect(document.activeElement).toBe(addControl());

      runRegistered('undo');

      expect(threatsInStore()).toBe(2);
      expect(document.activeElement).toBe(addControl());
    });

    it('commits a severity change as one undoable step', async () => {
      const user = userEvent.setup();
      showPanel(actorElement);
      await user.click(readerThreat());

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
      await user.click(readerThreat());

      await typeRefusedProse(user);
      await user.click(readerThreat());

      expect(refusedDraft()).toBeDefined();
      expect(describedNumbers(textbox('Description'))).toEqual([7]);
      expect(currentAnnouncement().message.trim()).not.toBe('');
      expect(modelStore.getState().present.threats[0].description).toBe('');

      await user.click(textbox('Description'));
      await user.keyboard('x');

      expect(currentAnnouncement().message).toBe('');
      expect(textbox('Description').getAttribute('aria-invalid')).toBe('true');
    });

    it('keeps a refused draft on screen where a threat the register already holds is attached, and leaves that threat collapsed', async () => {
      const user = userEvent.setup();
      showPanel(processElement);
      await addThreat(user);
      await typeRefusedProse(user);

      await chooseFrom('Existing threat', sampleThreat.title);
      await user.click(button('Attach existing threat'));

      expect(present().threats[0].elements).toEqual([
        actorElement,
        processElement,
      ]);
      expect(readerThreat().getAttribute('aria-expanded')).toBe('false');
      expect(refusedDraft().getAttribute('aria-invalid')).toBe('true');
    });

    it('keeps a refused draft on screen where a redo brings another threat back, with focus left on the add control', async () => {
      const user = userEvent.setup();
      showPanel(actorElement);
      await addThreat(user);
      await user.click(readerThreat());
      await typeRefusedProse(user);
      await user.click(screen.getByRole('button', { name: /New threat/u }));
      runRegistered('undo');
      expect(threatsInStore()).toBe(1);
      expect(document.activeElement).toBe(addControl());

      runRegistered('redo');

      expect(threatsInStore()).toBe(2);
      expect(
        screen
          .getByRole('button', { name: /New threat/u })
          .getAttribute('aria-expanded'),
      ).toBe('false');
      expect(refusedDraft().getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(addControl());
    });

    it('adds nothing while another threat holds a refused draft, moves focus to the field holding it and says nothing more, and adds again once the text is cleared', async () => {
      const user = userEvent.setup();
      const drafts = new Map<ElementId, HeldDraft>();
      showPanel(actorElement, { drafts });
      await user.click(readerThreat());
      await typeRefusedProse(user);
      await user.tab();
      resetAnnouncements();
      const before = present();

      await addThreat(user);

      expect(present()).toBe(before);
      expect(refusedDraft().getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(refusedDraft());
      expect(drafts.get(actorElement)).toMatchObject({
        threatId: firstThreat,
        text: refusedProse,
      });
      expect(currentAnnouncement().message).toBe('');

      await user.clear(refusedDraft());
      await addThreat(user);

      expect(threatsInStore()).toBe(2);
      expect(readerThreat().getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(titleField());
    });

    it('hands a refused draft to the map it was given, keyed by the threat it was typed on', async () => {
      const user = userEvent.setup();
      const drafts = new Map<ElementId, HeldDraft>();
      showPanel(actorElement, { drafts });
      await user.click(readerThreat());

      await typeRefusedProse(user);
      await user.click(readerThreat());

      expect(drafts.get(actorElement)).toMatchObject({
        threatId: firstThreat,
        field: 'Description',
        text: refusedProse,
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
            text: refusedProse,
            said: () => 'A refusal',
          },
        ],
      ]);
      showPanel(actorElement, { drafts });

      expect(refusedDraft()).toBeDefined();
      expect(currentAnnouncement().message).toBe('');
    });

    it('drops a refusal an undo settled, and lets the threat collapse again', async () => {
      const user = userEvent.setup();
      showPanel(actorElement);
      await user.click(readerThreat());
      await user.click(textbox('Description'));
      await user.keyboard('Prose the model takes');
      await user.tab();

      await user.click(textbox('Description'));
      await user.keyboard(softHyphen);
      await user.click(readerThreat());
      expect(currentAnnouncement().message.trim()).not.toBe('');

      act(() => {
        dispatch(Action.Undo());
      });

      expect(currentAnnouncement().message).toBe('');

      await user.click(readerThreat());

      expect(screen.queryByRole('textbox', { name: 'Description' })).toBeNull();
    });

    it('lets the threat collapse once the refused text is corrected', async () => {
      const user = userEvent.setup();
      showPanel(actorElement);
      await user.click(readerThreat());
      await typeRefusedProse(user);
      await user.click(readerThreat());

      await user.clear(textbox('Description'));
      await user.keyboard('Pasted prose');
      await user.click(readerThreat());

      expect(screen.queryByRole('textbox', { name: 'Description' })).toBeNull();
      expect(modelStore.getState().present.threats[0].description).toBe(
        'Pasted prose',
      );
    });

    it('lets the threat collapse once refused text typed in a new record row is corrected in place, which keeps the record', async () => {
      const user = userEvent.setup();
      showPanel(actorElement);
      await user.click(readerThreat());
      await user.click(button('Add assumption'));
      await user.keyboard(`Assumed${softHyphen}prose`);
      await user.tab();
      expect(textbox('Assumption 1').getAttribute('aria-invalid')).toBe('true');

      await user.clear(textbox('Assumption 1'));
      await user.keyboard('Assumed prose');
      await user.click(readerThreat());

      expect(present().assumptions).toHaveLength(1);
      expect(readerThreat().getAttribute('aria-expanded')).toBe('false');
    });

    it('shows Threats again when focus is asked for while Details shows', async () => {
      const user = userEvent.setup();
      const props = panelProps({
        subject: { kind: 'element', element: sampleElement(actorElement) },
      });
      dispatch(Action.Select({ elementIds: [actorElement] }));
      const { rerender } = render(<ThreatPanel {...props} />);
      await user.click(detailsTab());

      rerender(<ThreatPanel {...props} focusing />);

      expect(threatsTab().getAttribute('aria-selected')).toBe('true');
      expect(document.activeElement).toBe(addControl());
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
      await user.click(readerThreat());

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
