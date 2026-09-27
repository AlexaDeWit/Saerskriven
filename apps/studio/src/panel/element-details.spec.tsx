import {
  elementId,
  parsedFixture,
  softHyphen,
  validModelFixture,
} from '@saerskriven/model/fixtures';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  announce,
  currentAnnouncement,
  resetAnnouncements,
} from '../canvas/announcements.js';
import { Action } from '../store/actions.js';
import { elementById } from '../store/selectors.js';
import { initialState } from '../store/state.js';
import { newNote } from '../store/store.fixtures.js';
import { dispatch, modelStore } from '../store/store.js';
import {
  ElementPropertiesEditor,
  type ElementPropertyDrafts,
} from './element-properties.js';
import { chooseFrom, editorTimeout } from './panel.fixtures.js';

const base = parsedFixture(validModelFixture);
const note = newNote('note-plan', 'Rollout plan');
const withNote = {
  ...base,
  diagrams: [
    { ...base.diagrams[0], elements: [...base.diagrams[0].elements, note] },
  ],
};
const api = 'Description of Order API';
const reason = 'Reason out of scope';
const current = (id: string) =>
  elementById(modelStore.getState(), elementId(id));
const undoable = () => modelStore.getState().past.length;
const field = (name: string) => screen.getByRole('textbox', { name });
const disclosure = () =>
  screen
    .getByRole('button', { name: 'Security properties' })
    .getAttribute('aria-expanded');
const show = (id: string, drafts?: ElementPropertyDrafts) =>
  render(<ElementPropertiesEditor drafts={drafts} elementId={elementId(id)} />);

beforeEach(() => {
  modelStore.setState(initialState(withNote), true);
  resetAnnouncements();
});

describe(
  'element details',
  () => {
    it('edits a description as one undo step, and leaves the status alone for text it already holds', async () => {
      const user = userEvent.setup();
      show('element-api');
      expect(field(api)).toHaveProperty(
        'value',
        'Accepts and validates orders.',
      );
      announce(() => 'Moved.');
      await user.click(field(api));
      await user.tab();
      expect(currentAnnouncement().message).toBe('Moved.');
      expect(undoable()).toBe(0);
      await user.clear(field(api));
      await user.type(field(api), 'Takes orders.');
      await user.tab();
      expect(current('element-api')).toHaveProperty(
        'description',
        'Takes orders.',
      );
      expect(undoable()).toBe(1);
      act(() => {
        dispatch(Action.Undo());
      });
      expect(field(api)).toHaveProperty(
        'value',
        'Accepts and validates orders.',
      );
    });

    it('offers Yes and No for the flag, and keeps the flag and the reason independent', async () => {
      const user = userEvent.setup();
      show('element-api');
      expect(screen.queryByRole('textbox', { name: reason })).toBeNull();
      await user.click(screen.getByRole('combobox', { name: 'Out of scope' }));
      expect(screen.getAllByRole('option')).toHaveLength(2);
      expect(screen.getByRole('option', { name: 'No' })).toBeDefined();
      await user.click(screen.getByRole('option', { name: 'Yes' }));
      expect(current('element-api')).toMatchObject({
        outOfScope: true,
        reasonOutOfScope: '',
      });
      await user.type(field(reason), 'Hosted by a vendor.');
      await user.tab();
      await chooseFrom('Out of scope', 'No');
      expect(current('element-api')).toMatchObject({
        outOfScope: false,
        reasonOutOfScope: 'Hosted by a vendor.',
      });
      expect(field(reason)).toHaveProperty('value', 'Hosted by a vendor.');
      expect(undoable()).toBe(3);
      await user.clear(field(reason));
      await user.tab();
      expect(screen.queryByRole('textbox', { name: reason })).toBeNull();
      expect(current('element-api')).toMatchObject({
        outOfScope: false,
        reasonOutOfScope: '',
      });
    });

    it('shows and edits the details of a text note, which has no security properties', async () => {
      const user = userEvent.setup();
      show('note-plan');
      expect(
        screen.queryByRole('button', { name: 'Security properties' }),
      ).toBeNull();
      await user.type(field('Description of the text'), 'Draft only.');
      await user.tab();
      await chooseFrom('Out of scope', 'Yes');
      await user.type(field(reason), 'Not shipped yet.');
      await user.tab();
      expect(current('note-plan')).toMatchObject({
        description: 'Draft only.',
        outOfScope: true,
        reasonOutOfScope: 'Not shipped yet.',
      });
      expect(undoable()).toBe(3);
    });

    it('holds a refused character in the field, names it in the announcement, and keeps the draft through a remount', async () => {
      const drafts: ElementPropertyDrafts = new Map();
      const user = userEvent.setup();
      const shown = show('element-db', drafts);
      expect(field(reason)).toHaveProperty(
        'value',
        'Managed by the cloud provider.',
      );
      await user.type(field(reason), softHyphen);
      await user.tab();
      expect(field(reason).getAttribute('aria-invalid')).toBe('true');
      expect(currentAnnouncement().message).toContain(reason);
      expect(current('element-db')).toHaveProperty(
        'reasonOutOfScope',
        'Managed by the cloud provider.',
      );
      expect(undoable()).toBe(0);
      expect(disclosure()).toBe('false');
      shown.unmount();
      show('element-db', drafts);
      expect(field(reason)).toHaveProperty(
        'value',
        `Managed by the cloud provider.${softHyphen}`,
      );
      expect(disclosure()).toBe('false');
      await user.click(
        screen.getByRole('button', { name: 'Security properties' }),
      );
      expect(disclosure()).toBe('true');
      await user.click(
        screen.getByRole('button', { name: 'Security properties' }),
      );
      expect(disclosure()).toBe('false');
      expect(field(reason).getAttribute('aria-invalid')).toBe('true');
      await user.type(field(reason), '{Backspace}');
      await user.tab();
      expect(field(reason).getAttribute('aria-invalid')).toBe('false');
      expect(drafts.get(elementId('element-db'))?.size).toBe(0);
    });

    it('drops a refused reason when clearing the flag takes its field away', async () => {
      const drafts: ElementPropertyDrafts = new Map();
      const user = userEvent.setup();
      show('element-api', drafts);
      await chooseFrom('Out of scope', 'Yes');
      await user.type(field(reason), `Hosted${softHyphen}`);
      await user.tab();
      expect(drafts.get(elementId('element-api'))?.size).toBe(1);
      await chooseFrom('Out of scope', 'No');
      expect(screen.queryByRole('textbox', { name: reason })).toBeNull();
      expect(drafts.get(elementId('element-api'))?.size).toBe(0);
      await chooseFrom('Out of scope', 'Yes');
      expect(field(reason)).toHaveProperty('value', '');
    });

    it('drops a refused reason when an undo hides its field, so a redo shows no refusal', async () => {
      const drafts: ElementPropertyDrafts = new Map();
      const user = userEvent.setup();
      show('element-api', drafts);
      await chooseFrom('Out of scope', 'Yes');
      await user.type(field(reason), `Hosted${softHyphen}`);
      await user.tab();
      expect(field(reason).getAttribute('aria-invalid')).toBe('true');
      act(() => {
        dispatch(Action.Undo());
      });
      expect(screen.queryByRole('textbox', { name: reason })).toBeNull();
      expect(drafts.get(elementId('element-api'))?.size).toBe(0);
      act(() => {
        dispatch(Action.Redo());
      });
      expect(field(reason)).toHaveProperty('value', '');
      expect(field(reason).getAttribute('aria-invalid')).toBe('false');
    });
  },
  editorTimeout,
);
