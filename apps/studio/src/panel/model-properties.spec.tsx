import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  currentAnnouncement,
  resetAnnouncements,
} from '../canvas/announcements.js';
import { Action } from '../store/actions.js';
import { initialState } from '../store/state.js';
import {
  firstAssumption,
  firstThreat,
  recordedModel,
} from '../store/store.fixtures.js';
import { dispatch, modelStore } from '../store/store.js';
import { ModelPropertiesPanel } from './model-properties.js';
import { sectionLabel } from '@saerskriven/render';
import {
  chooseFrom,
  describedNumbers,
  editorTimeout,
  present,
  undoable,
} from './panel.fixtures.js';
import type { RefusedField } from './refusals.js';

const softHyphen = '­';

const noop = (): void => undefined;

const showPanel = ({
  held,
  onHeld = noop,
  onClose = noop,
}: {
  readonly held?: RefusedField;
  readonly onHeld?: (draft: RefusedField | undefined) => void;
  readonly onClose?: () => void;
} = {}): void => {
  render(
    <ModelPropertiesPanel
      held={held}
      onClose={onClose}
      onHeld={onHeld}
      onToggleWidth={noop}
      wide={false}
    />,
  );
};

const button = (name: string): HTMLElement =>
  screen.getByRole('button', { name });

const textbox = (name: string): HTMLElement =>
  screen.getByRole('textbox', { name });

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

describe(
  'the model properties panel',
  () => {
    beforeEach(() => {
      modelStore.setState(initialState(recordedModel), true);
      resetAnnouncements();
    });

    it('is a named region whose Tab order runs from Title through Description to the assumptions group', async () => {
      const user = userEvent.setup();
      showPanel();

      expect(screen.getByRole('region', { name: 'Model properties' })).toBe(
        screen.getByRole('region'),
      );
      await user.click(textbox('Title'));
      await user.tab();
      expect(document.activeElement).toBe(textbox('Description'));
      await user.tab();
      expect(document.activeElement).toBe(button('Add assumption'));
      expect(
        screen
          .getByRole('group', { name: sectionLabel('model-assumptions') })
          .contains(document.activeElement),
      ).toBe(true);
    });

    it('commits the title and the description as one metadata edit each, and one undo restores each', async () => {
      const user = userEvent.setup();
      showPanel();
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
      expect(undoable()).toBe(2);
      undo();
      expect(present().metadata.description).toBe(description);
      undo();
      expect(present().metadata.title).toBe(title);
    });

    it('dispatches nothing for a field left as it was', async () => {
      const user = userEvent.setup();
      showPanel();

      await user.click(textbox('Title'));
      await user.tab();

      expect(present()).toBe(recordedModel);
    });

    it('opens an empty row on Add with the model unchanged, and its first commit adds one unconfirmed assumption on the model alone, which one undo removes', async () => {
      const user = userEvent.setup();
      showPanel();

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

    it('offers only assumptions that do not apply to the model, and applying one keeps its threat links', async () => {
      const user = userEvent.setup();
      showPanel();

      await user.click(
        screen.getByRole('combobox', { name: 'Existing assumption' }),
      );
      expect(screen.getAllByRole('option')).toHaveLength(1);
      await user.keyboard('{Escape}');
      await user.click(button('Link existing assumption'));

      expect(present().assumptions).toMatchObject([
        { id: firstAssumption, threats: [firstThreat], appliesToModel: true },
      ]);
      expect(
        screen.queryByRole('combobox', { name: 'Existing assumption' }),
      ).toBeNull();
      expect(describedNumbers(button('Unlink assumption 1'))).toEqual([1]);
    });

    it('keeps an assumption on its threat when its model link is removed', async () => {
      const user = userEvent.setup();
      applyToModel();
      showPanel();

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

      await user.click(button('Unlink assumption 1'));

      expect(present().assumptions).toEqual([]);
      expect(currentAnnouncement().message).toContain(
        recordedModel.assumptions[0].prose,
      );
      undo();
      expect(present()).toBe(before);
    });

    it('changes a status in place as one undo step that moves no threat status', async () => {
      applyToModel();
      const before = present();
      showPanel();

      await chooseFrom('Assumption 1 status', 'invalidated');

      expect(present().assumptions[0].status).toBe('invalidated');
      expect(present().threats).toBe(before.threats);
      expect(undoable()).toBe(2);
    });

    it('holds a refused description in the draft it keeps, and puts it back when the panel opens again', async () => {
      const user = userEvent.setup();
      const onHeld = vi.fn<(draft: RefusedField | undefined) => void>();
      showPanel({ onHeld });

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

      expect(textbox('Description').getAttribute('aria-invalid')).toBe('true');
    });

    it('closes on Escape and on its close control', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn<() => void>();
      showPanel({ onClose });

      await user.click(textbox('Title'));
      await user.keyboard('{Escape}');
      await user.click(button('Close model properties'));

      expect(onClose).toHaveBeenCalledTimes(2);
    });
  },
  editorTimeout,
);
