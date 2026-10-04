import type { Model, Threat } from '@saerskriven/model';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  currentAnnouncement,
  recordQuoteLength,
  resetAnnouncements,
} from '../canvas/announcements.js';
import { Action } from '../store/actions.js';
import { initialState } from '../store/state.js';
import {
  firstAssumption,
  firstThreat,
  present,
  processElement,
  recordedModel,
  secondThreat,
  storeElement,
  undoable,
} from '../store/store.fixtures.js';
import { dispatch, modelStore } from '../store/store.js';
import { recordingSurface } from '../commands/commands.fixtures.js';
import { commandById, runCommand } from '../commands/registry.js';
import { activeTranslator } from '../messages/locale.js';
import { ModelPanel } from './model-panel.js';
import { chooseFrom, editorTimeout, listedThreats } from './panel.fixtures.js';
import type { RefusedField } from './refusals.js';
import type { HeldDrafts } from './threat-list.js';
import { freshThreat } from './threats.js';
import {
  button,
  describedNumbers,
  detailsTab,
  noop,
  numbersIn,
  textbox,
  threatsTab,
} from '../ui/ui.fixtures.js';
import { softHyphen, threatId } from '@saerskriven/model/fixtures';

const showPanel = ({
  held,
  onHeld = noop,
  onClose = noop,
  drafts = new Map(),
}: {
  readonly held?: RefusedField;
  readonly onHeld?: (draft: RefusedField | undefined) => void;
  readonly onClose?: () => void;
  readonly drafts?: HeldDrafts;
} = {}): void => {
  render(
    <ModelPanel
      drafts={drafts}
      held={held}
      onClose={onClose}
      onHeld={onHeld}
      onToggleWidth={noop}
      wide={false}
    />,
  );
};

const runHistory = (id: 'undo' | 'redo'): void => {
  act(() => {
    runCommand(commandById(id), recordingSurface().surface);
  });
};

const undo = (): void => {
  act(() => {
    dispatch(Action.Undo());
  });
};

const applyToModel = (): void => {
  act(() => {
    dispatch(Action.LinkAssumptionToModel({ assumptionId: firstAssumption }));
  });
};

const showDetails = async (
  user: ReturnType<typeof userEvent.setup>,
): Promise<void> => {
  await user.click(detailsTab());
};

const foldedAssumption = (): HTMLElement =>
  screen.getByRole('button', {
    name: `Assumption 1, ${recordedModel.assumptions[0].prose}`,
    expanded: false,
  });

const openAssumption = async (
  user: ReturnType<typeof userEvent.setup>,
): Promise<void> => {
  await user.click(foldedAssumption());
};

const summary = (title: RegExp): HTMLElement =>
  screen.getByRole('button', { name: title });

const listed = (): readonly (string | undefined)[] =>
  listedThreats(screen.getByRole('region', { name: 'Model' }));

const wholeModel = 'Applies to the whole model';

const looseThreat = threatId('threat-loose');

const mitigatedThreat = threatId('threat-mitigated');

const withLooseThreat = (): void => {
  const base = recordedModel.threats[0];
  const added: readonly Threat[] = [
    {
      ...base,
      id: looseThreat,
      number: 3,
      title: 'A substituted dependency reaches the build',
      severity: 'high',
      elements: [],
    },
    {
      ...base,
      id: mitigatedThreat,
      number: 4,
      title: 'A model file is read past its bounds',
      severity: 'critical',
      status: 'mitigated',
      elements: [storeElement],
    },
  ];
  const model: Model = {
    ...recordedModel,
    threats: [...recordedModel.threats, ...added],
    lastIssuedThreatNumber: 4,
  };
  modelStore.setState(initialState(model), true);
};

describe(
  'the model panel',
  () => {
    beforeEach(() => {
      modelStore.setState(initialState(recordedModel), true);
      resetAnnouncements();
    });

    it('is a region named Model, headed by the model title, on a Threats tab counting every threat beside Details', () => {
      showPanel();

      expect(screen.getByRole('region', { name: 'Model' })).toBe(
        screen.getByRole('region'),
      );
      expect(
        screen.getByRole('heading', { name: recordedModel.metadata.title }),
      ).toBeDefined();
      expect(threatsTab().getAttribute('aria-selected')).toBe('true');
      expect(numbersIn(threatsTab().textContent)).toEqual([
        recordedModel.threats.length,
      ]);
      expect(detailsTab().getAttribute('aria-selected')).toBe('false');
      expect(screen.queryByRole('textbox', { name: 'Title' })).toBeNull();
    });

    it('heads itself Untitled while the model has no title', () => {
      modelStore.setState(
        initialState({
          ...recordedModel,
          metadata: { ...recordedModel.metadata, title: '' },
        }),
        true,
      );
      showPanel();

      expect(
        screen.getByRole('heading', {
          name: activeTranslator().t('defaults.untitled-model'),
        }),
      ).toBeDefined();
    });

    it('lists every threat in the model in review order, whatever element it is on', () => {
      withLooseThreat();
      showPanel();

      expect(listed()).toEqual([
        looseThreat,
        firstThreat,
        secondThreat,
        mitigatedThreat,
      ]);
    });

    it('names the elements each threat is on, and says where one is on none', () => {
      const { t } = activeTranslator();
      withLooseThreat();
      showPanel();

      expect(
        summary(/A substituted dependency/u).textContent?.includes(
          t('panel.on-no-element'),
        ),
      ).toBe(true);
      expect(
        summary(/A reader edits/u).textContent?.includes(
          t('panel.on-elements', { list: ['Reader'] }),
        ),
      ).toBe(true);
    });

    it('adds a threat that applies to the model and names no element, opened on its title, as one undo step, and offers no attach', async () => {
      const user = userEvent.setup();
      const before = present();
      showPanel();

      expect(
        screen.queryByRole('combobox', { name: 'Existing threat' }),
      ).toBeNull();
      await user.click(button('Add a threat'));

      const added = present().threats.at(-1);
      expect(added).toMatchObject({
        number: before.lastIssuedThreatNumber + 1,
        elements: [],
        appliesToModel: true,
      });
      expect(listed().at(-1)).toBe(added?.id);
      expect(document.activeElement).toBe(textbox('Title'));
      expect(undoable()).toBe(1);
      undo();
      expect(present()).toBe(before);
    });

    it('applies a threat to the whole model from its attached elements, keeps it when its last element is detached and says why, and removes it when the model link goes too', async () => {
      const user = userEvent.setup();
      const { t } = activeTranslator();
      showPanel();
      await user.click(summary(/A reader edits/u));

      await chooseFrom(wholeModel, t('enums.yes'));

      expect(present().threats[0]).toMatchObject({
        elements: recordedModel.threats[0].elements,
        appliesToModel: true,
      });
      expect(undoable()).toBe(1);

      await user.click(button('Detach Reader'));

      expect(present().threats[0]).toMatchObject({
        id: firstThreat,
        elements: [],
        appliesToModel: true,
      });
      expect(listed()).toEqual([firstThreat, secondThreat]);
      expect(currentAnnouncement().message).toContain(
        t('canvas.threat-stays-on-model'),
      );
      expect(document.activeElement).toBe(
        screen.getByRole('combobox', { name: wholeModel }),
      );
      const kept = present();

      await chooseFrom(wholeModel, t('enums.no'));

      expect(present().threats.map(({ id }) => id)).toEqual([secondThreat]);
      expect(present().mitigations).toEqual([]);
      expect(listed()).toEqual([secondThreat]);
      expect(currentAnnouncement().message).toBe(
        t('canvas.threat-detach-removed', { number: 1 }),
      );
      expect(document.activeElement).toBe(summary(/A reader sees/u));
      expect(undoable()).toBe(3);
      undo();
      expect(present()).toBe(kept);
    });

    it('ends the key press that chooses No with the removal, leaving the next threat closed under focus and the notice standing', async () => {
      const user = userEvent.setup();
      const { t } = activeTranslator();
      act(() => {
        dispatch(Action.LinkThreatToModel({ threatId: firstThreat }));
        dispatch(
          Action.DetachThreat({
            threatId: firstThreat,
            elementId: recordedModel.threats[0].elements[0],
          }),
        );
      });
      showPanel();
      await user.click(summary(/A reader edits/u));
      resetAnnouncements();

      screen.getByRole('combobox', { name: wholeModel }).focus();
      await user.keyboard('{Enter}');
      await user.keyboard('{ArrowDown}{Enter}');

      const next = summary(/A reader sees/u);
      expect(listed()).toEqual([secondThreat]);
      expect(document.activeElement).toBe(next);
      expect(next.getAttribute('aria-expanded')).toBe('false');
      expect(currentAnnouncement().message).toBe(
        t('canvas.threat-detach-removed', { number: 1 }),
      );
    });

    it('keeps a threat on its elements when its model link goes, and says nothing', async () => {
      const user = userEvent.setup();
      const { t } = activeTranslator();
      act(() => {
        dispatch(Action.LinkThreatToModel({ threatId: firstThreat }));
      });
      showPanel();
      await user.click(summary(/A reader edits/u));

      await chooseFrom(wholeModel, t('enums.no'));

      expect(present().threats[0]).toEqual(recordedModel.threats[0]);
      expect(listed()).toEqual([firstThreat, secondThreat]);
      expect(currentAnnouncement().message).toBe('');
    });

    it('says so where the model holds no threat', () => {
      modelStore.setState(
        initialState({ ...recordedModel, threats: [] }),
        true,
      );
      showPanel();

      expect(numbersIn(threatsTab().textContent)).toEqual([0]);
      expect(
        screen.getByText(activeTranslator().t('panel.no-model-threats')),
      ).toBeDefined();
    });

    it('opens a threat on no element in place and commits an edit to it as one undo step', async () => {
      const user = userEvent.setup();
      withLooseThreat();
      const before = present();
      showPanel();

      await user.click(summary(/A substituted dependency/u));
      expect(
        screen.getByRole('group', { name: 'Attached elements' }),
      ).toBeDefined();
      await chooseFrom('Severity', 'Critical');

      expect(
        present().threats.find(({ id }) => id === looseThreat)?.severity,
      ).toBe('critical');
      expect(undoable()).toBe(1);
      undo();
      expect(present()).toBe(before);
    });

    it('attaches an element to a threat on no element, which stays in its place in the list', async () => {
      const user = userEvent.setup();
      withLooseThreat();
      showPanel();
      const shown = listed();
      await user.click(summary(/A substituted dependency/u));

      await chooseFrom('Existing element', 'Studio');
      await user.click(button('Attach existing element'));

      expect(
        present().threats.find(({ id }) => id === looseThreat)?.elements,
      ).toEqual([processElement]);
      expect(listed()).toEqual(shown);
      expect(numbersIn(currentAnnouncement().message)).toEqual([3]);
    });

    it('keeps a threat a detach leaves on another element, with focus on the attachment that takes its place', async () => {
      const user = userEvent.setup();
      act(() => {
        dispatch(
          Action.AttachThreat({
            threatId: firstThreat,
            elementId: processElement,
          }),
        );
      });
      showPanel();
      const shown = listed();
      await user.click(summary(/A reader edits/u));

      await user.click(button('Detach Reader'));

      expect(present().threats[0].elements).toEqual([processElement]);
      expect(listed()).toEqual(shown);
      expect(document.activeElement).toBe(button('Detach Studio'));
    });

    it('removes a threat when the detach takes its last element, says so, and moves focus to the next threat', async () => {
      const user = userEvent.setup();
      const before = present();
      showPanel();
      await user.click(summary(/A reader edits/u));

      await user.click(button('Detach Reader'));

      expect(present().threats.map(({ id }) => id)).toEqual([secondThreat]);
      expect(listed()).toEqual([secondThreat]);
      expect(numbersIn(currentAnnouncement().message)).toEqual([1]);
      expect(document.activeElement).toBe(summary(/A reader sees/u));
      expect(undoable()).toBe(1);
      undo();
      expect(present()).toBe(before);
    });

    it('hands focus to the Threats tab when the last threat leaves the list', async () => {
      const user = userEvent.setup();
      modelStore.setState(
        initialState({
          ...recordedModel,
          threats: [recordedModel.threats[0]],
          mitigations: [],
          assumptions: [],
        }),
        true,
      );
      showPanel();
      await user.click(summary(/A reader edits/u));

      await user.click(button('Delete threat 1'));

      expect(present().threats).toEqual([]);
      expect(document.activeElement).toBe(threatsTab());
    });

    it('hands focus to the Threats tab when an undo takes away the threat holding it, and back to its title on redo', async () => {
      const user = userEvent.setup();
      act(() => {
        dispatch(
          Action.AddThreat({
            threat: freshThreat(3, storeElement, activeTranslator().t),
          }),
        );
      });
      showPanel();
      await user.click(summary(/New threat/u));
      await user.click(textbox('Title'));

      runHistory('undo');

      expect(present().threats).toHaveLength(2);
      expect(document.activeElement).toBe(threatsTab());

      runHistory('redo');

      expect(present().threats).toHaveLength(3);
      expect(document.activeElement).toBe(textbox('Title'));
    });

    it('hands a refused draft in a threat to the drafts it was given under no element, and opens on it again', async () => {
      const user = userEvent.setup();
      const drafts: HeldDrafts = new Map();
      showPanel({ drafts });
      await user.click(summary(/A reader edits/u));

      await user.click(textbox('Description'));
      await user.keyboard(`Pasted${softHyphen}prose`);
      await user.click(summary(/A reader edits/u));

      expect(drafts.get(undefined)).toMatchObject({
        threatId: firstThreat,
        field: 'Description',
        text: `Pasted${softHyphen}prose`,
      });
      cleanup();
      showPanel({ drafts });

      expect(textbox('Description').getAttribute('aria-invalid')).toBe('true');
    });

    it('keeps a refused draft on screen where an undo brings another threat back, with focus left on the Threats tab', async () => {
      const user = userEvent.setup();
      act(() => {
        dispatch(Action.RemoveThreat({ threatId: secondThreat }));
        dispatch(Action.Undo());
      });
      showPanel();
      await user.click(summary(/A reader edits/u));
      await user.click(textbox('Description'));
      await user.keyboard(`Pasted${softHyphen}prose`);
      await user.click(summary(/A reader sees/u));
      runHistory('redo');
      expect(present().threats).toHaveLength(1);
      expect(document.activeElement).toBe(threatsTab());

      runHistory('undo');

      expect(present().threats).toHaveLength(2);
      expect(summary(/A reader sees/u).getAttribute('aria-expanded')).toBe(
        'false',
      );
      expect(
        screen
          .getByDisplayValue(`Pasted${softHyphen}prose`)
          .getAttribute('aria-invalid'),
      ).toBe('true');
      expect(document.activeElement).toBe(threatsTab());
    });

    it('holds Title, Description and the assumptions group on Details, in that Tab order', async () => {
      const user = userEvent.setup();
      showPanel();

      await showDetails(user);
      await user.click(textbox('Title'));
      await user.tab();
      expect(document.activeElement).toBe(textbox('Description'));
      await user.tab();
      expect(document.activeElement).toBe(button('Add assumption'));
      expect(
        screen
          .getByRole('group', {
            name: (name) =>
              name.startsWith(activeTranslator().t('terms.model-assumptions')),
          })
          .contains(document.activeElement),
      ).toBe(true);
      expect(screen.queryByRole('button', { name: /A reader edits/u })).toBe(
        null,
      );
    });

    it('commits the title and the description as one metadata edit each, and one undo restores each', async () => {
      const user = userEvent.setup();
      showPanel();
      await showDetails(user);
      const { title, description } = recordedModel.metadata;

      await user.clear(textbox('Title'));
      await user.keyboard('Shared models');
      await user.tab();
      await user.keyboard('Who may read what.');
      await user.tab();

      expect(present().metadata).toMatchObject({
        title: 'Shared models',
        description: `${description}Who may read what.`,
      });
      expect(
        screen.getByRole('heading', { name: 'Shared models' }),
      ).toBeDefined();
      expect(undoable()).toBe(2);
      undo();
      expect(present().metadata.description).toBe(description);
      undo();
      expect(present().metadata.title).toBe(title);
    });

    it('dispatches nothing for a field left as it was', async () => {
      const user = userEvent.setup();
      showPanel();
      await showDetails(user);

      await user.click(textbox('Title'));
      await user.tab();

      expect(present()).toBe(recordedModel);
    });

    it('opens an empty row on Add with the model unchanged, and its first commit adds one unconfirmed assumption on the model alone, which one undo removes', async () => {
      const user = userEvent.setup();
      showPanel();
      await showDetails(user);

      await user.click(button('Add assumption'));
      expect(document.activeElement).toBe(textbox('Assumption 1'));
      expect(present()).toBe(recordedModel);

      await user.keyboard('The model is kept by hand.');
      await user.tab();

      expect(present().assumptions).toHaveLength(2);
      expect(present().assumptions.at(-1)).toMatchObject({
        prose: 'The model is kept by hand.',
        status: 'unconfirmed',
        threats: [],
        appliesToModel: true,
      });
      expect(undoable()).toBe(1);
      undo();
      expect(present()).toBe(recordedModel);
    });

    it('offers only assumptions that do not apply to the model, and applying one keeps its threat links and folds it', async () => {
      const user = userEvent.setup();
      showPanel();
      await showDetails(user);

      await user.click(
        screen.getByRole('combobox', { name: 'Existing assumption' }),
      );
      expect(screen.getAllByRole('option')).toHaveLength(1);
      await user.click(screen.getByRole('option'));
      await user.click(button('Link existing assumption'));

      expect(present().assumptions).toMatchObject([
        { id: firstAssumption, threats: [firstThreat], appliesToModel: true },
      ]);
      expect(
        screen.queryByRole('combobox', { name: 'Existing assumption' }),
      ).toBeNull();
      expect(describedNumbers(foldedAssumption())).toEqual([1]);
      expect(screen.queryByRole('textbox', { name: 'Assumption 1' })).toBe(
        null,
      );
    });

    it('keeps an assumption on its threat when its model link is removed', async () => {
      const user = userEvent.setup();
      applyToModel();
      showPanel();
      await showDetails(user);
      await openAssumption(user);

      await user.click(button('Unlink assumption 1'));

      expect(present().assumptions).toMatchObject([
        { id: firstAssumption, threats: [firstThreat], appliesToModel: false },
      ]);
      expect(document.activeElement).toBe(button('Add assumption'));
    });

    it('removes an assumption on no threat with its model link, names it, and one undo restores it', async () => {
      const user = userEvent.setup();
      applyToModel();
      act(() => {
        dispatch(
          Action.UnlinkAssumption({
            assumptionId: firstAssumption,
            threatId: firstThreat,
          }),
        );
      });
      const before = present();
      showPanel();
      await showDetails(user);
      await openAssumption(user);

      await user.click(button('Unlink assumption 1'));

      expect(present().assumptions).toEqual([]);
      expect(currentAnnouncement().message).toContain(
        recordedModel.assumptions[0].prose.slice(0, recordQuoteLength / 2),
      );
      undo();
      expect(present()).toBe(before);
    });

    it('edits the text and the status of an assumption that applies to the model in place as one undo step each, and it still applies to the model', async () => {
      const user = userEvent.setup();
      applyToModel();
      const before = present();
      showPanel();
      await showDetails(user);
      await openAssumption(user);

      await user.click(textbox('Assumption 1'));
      await user.keyboard('{End} Readers are too.');
      await user.tab();

      expect(present().assumptions).toEqual([
        {
          ...before.assumptions[0],
          prose: 'Every editor is signed in. Readers are too.',
        },
      ]);
      expect(undoable()).toBe(2);
      const edited = present();

      await chooseFrom('Assumption 1 status', 'Invalidated');

      expect(present().assumptions).toEqual([
        { ...edited.assumptions[0], status: 'invalidated' },
      ]);
      expect(present().threats).toBe(before.threats);
      expect(undoable()).toBe(3);
      undo();
      expect(present()).toBe(edited);
      undo();
      expect(present()).toBe(before);
    });

    it('holds a refused description in the draft it keeps, and puts it back when the panel opens again', async () => {
      const user = userEvent.setup();
      const onHeld = vi.fn<(draft: RefusedField | undefined) => void>();
      showPanel({ onHeld });
      await showDetails(user);

      await user.click(textbox('Description'));
      await user.keyboard(`Pasted${softHyphen}prose`);
      await user.tab();

      const held = onHeld.mock.lastCall?.[0];
      expect(held).toMatchObject({
        field: 'Description',
        text: `${recordedModel.metadata.description}Pasted${softHyphen}prose`,
      });
      expect(present()).toBe(recordedModel);
      cleanup();
      showPanel({ held });
      await showDetails(user);

      expect(textbox('Description').getAttribute('aria-invalid')).toBe('true');
    });

    it('closes on Escape and on its close control', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn<() => void>();
      showPanel({ onClose });

      await user.click(threatsTab());
      await user.keyboard('{Escape}');
      await user.click(button('Close model panel'));

      expect(onClose).toHaveBeenCalledTimes(2);
    });
  },
  editorTimeout,
);
