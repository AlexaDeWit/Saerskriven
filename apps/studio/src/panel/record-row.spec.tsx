import { mitigationId, softHyphen } from '@saerskriven/model/fixtures';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  currentAnnouncement,
  resetAnnouncements,
} from '../canvas/announcements.js';
import { activeTranslator } from '../messages/locale.js';
import { Action } from '../store/actions.js';
import { initialState } from '../store/state.js';
import {
  firstMitigation,
  firstThreat,
  recordedModel,
  secondThreat,
} from '../store/store.fixtures.js';
import { dispatch, modelStore } from '../store/store.js';
import {
  button,
  describedNumbers,
  numbersIn,
  textbox,
} from '../ui/ui.fixtures.js';
import {
  editorTimeout,
  recordedThreat,
  recordRow,
  showThreatEditor,
} from './panel.fixtures.js';

const { t } = activeTranslator();

const readOnly = 'Mitigation 1, Read-only share links';

const signedIn = 'Assumption 1, Every editor is signed in.';

const expiring = 'Assumption 2, Share links expire.';

const folded = (name: string): HTMLElement =>
  screen.getByRole('button', { name, expanded: false });

const opened = (name: string): HTMLElement =>
  screen.getByRole('button', { name, expanded: true });

const lineOf = (toggle: string): string | undefined =>
  recordRow(toggle).querySelector('p')?.textContent ?? undefined;

const addedMark = (row: HTMLElement): Element | null =>
  row.querySelector('[data-added]');

const threatSummary = (): HTMLElement =>
  screen.getByRole('button', { name: /A reader edits/u });

const linkToSecondThreat = (): void => {
  act(() => {
    dispatch(
      Action.LinkMitigation({
        mitigationId: firstMitigation,
        threatId: secondThreat,
      }),
    );
  });
};

describe(
  'a record row',
  () => {
    beforeEach(() => {
      modelStore.setState(initialState(recordedModel), true);
      resetAnnouncements();
    });

    it('starts folded to its title and its status, with no field and no Unlink', () => {
      showThreatEditor({ threat: recordedThreat(firstThreat) });

      expect(folded(readOnly)).toBeDefined();
      expect(folded(signedIn)).toBeDefined();
      expect(
        screen.getByRole('combobox', { name: 'Mitigation 1 status' }),
      ).toBeDefined();
      expect(
        screen.queryByRole('textbox', { name: 'Mitigation 1 title' }),
      ).toBeNull();
      expect(
        screen.queryByRole('button', { name: 'Unlink mitigation 1' }),
      ).toBeNull();
      expect(screen.queryByRole('button', { name: /open all/iu })).toBeNull();
    });

    it('names its toggle by its name and headline folded and open, drawing the headline folded and the name open', async () => {
      const user = userEvent.setup();
      showThreatEditor({ threat: recordedThreat(firstThreat) });
      expect(folded(readOnly).textContent).toBe('Read-only share links');

      await user.click(folded(readOnly));

      expect(opened(readOnly).textContent).toBe('Mitigation 1');
    });

    it('names its toggle by its name alone where it has no title and no text', () => {
      modelStore.setState(
        initialState({
          ...recordedModel,
          mitigations: [{ ...recordedModel.mitigations[0], title: '' }],
        }),
        true,
      );
      showThreatEditor({ threat: recordedThreat(firstThreat) });

      expect(folded('Mitigation 1').textContent).toBe('Mitigation 1');
    });

    it('is a group with no name of its own, kept or new', async () => {
      const user = userEvent.setup();
      showThreatEditor({ threat: recordedThreat(firstThreat) });
      await user.click(button('Add assumption'));

      expect(
        screen.queryAllByRole('group', {
          name: /^(?:Mitigation|Assumption) \d+$/u,
        }),
      ).toEqual([]);
      expect(
        within(recordRow(readOnly)).getByRole('combobox', {
          name: 'Mitigation 1 status',
        }),
      ).toBeDefined();
      expect(
        within(recordRow('Assumption 2', 'textbox')).getByRole('button', {
          name: 'Discard assumption 2',
        }),
      ).toBeDefined();
    });

    it('is the same group once Return keeps a new record and it draws its toggle', async () => {
      const user = userEvent.setup();
      showThreatEditor({ threat: recordedThreat(firstThreat) });
      await user.click(button('Add mitigation'));

      const row = recordRow('Mitigation 2 title', 'textbox');
      expect(
        within(row).queryByRole('button', { name: 'Mitigation 2' }),
      ).toBeNull();

      await user.keyboard('Sign every share link{Enter}');

      expect(recordRow('Mitigation 2, Sign every share link')).toBe(row);
    });

    it('reads the start of its text where it has no title', () => {
      act(() => {
        dispatch(
          Action.ReplaceMitigation({
            mitigation: {
              ...recordedModel.mitigations[0],
              title: '',
              prose: 'Links carry a scope.\nThe scope is read-only.',
            },
          }),
        );
      });
      showThreatEditor({ threat: recordedThreat(firstThreat) });

      expect(folded('Mitigation 1, Links carry a scope.')).toBeDefined();
    });

    it('changes its status while folded, staying folded', async () => {
      const user = userEvent.setup();
      showThreatEditor({ threat: recordedThreat(firstThreat) });

      await user.click(
        screen.getByRole('combobox', { name: 'Mitigation 1 status' }),
      );
      await user.click(screen.getByRole('option', { name: 'Implemented' }));

      expect(modelStore.getState().present.mitigations[0].status).toBe(
        'implemented',
      );
      expect(folded(readOnly)).toBeDefined();
    });

    it('counts the other threats a folded record is on, on a line of its own', () => {
      showThreatEditor({ threat: recordedThreat(firstThreat) });
      expect(lineOf(readOnly)).toBeUndefined();
      linkToSecondThreat();

      expect(describedNumbers(folded(readOnly))).toEqual([1]);
      expect(
        lineOf(readOnly)?.startsWith(
          t('panel.also-on-other-threats', { count: 1 }),
        ),
      ).toBe(true);
    });

    it('opens in place, names the other threats under its name row, and folds again', async () => {
      const user = userEvent.setup();
      linkToSecondThreat();
      showThreatEditor({ threat: recordedThreat(firstThreat) });

      await user.click(folded(readOnly));

      const toggle = opened(readOnly);
      expect(textbox('Mitigation 1 title')).toHaveProperty(
        'value',
        'Read-only share links',
      );
      expect(button('Unlink mitigation 1')).toBeDefined();
      expect(numbersIn(lineOf(readOnly))).toEqual([2]);

      await user.click(toggle);

      expect(folded(readOnly)).toBeDefined();
      expect(
        screen.queryByRole('textbox', { name: 'Mitigation 1 title' }),
      ).toBeNull();
    });

    it('stays open until its threat closes, and shows folded when the threat opens again', async () => {
      const user = userEvent.setup();
      showThreatEditor({ threat: recordedThreat(firstThreat) });
      await user.click(folded(readOnly));
      await user.click(folded(signedIn));

      await user.click(threatSummary());
      await user.click(threatSummary());

      expect(folded(readOnly)).toBeDefined();
      expect(folded(signedIn)).toBeDefined();
    });

    it('will not fold while one of its fields holds a refused draft', async () => {
      const user = userEvent.setup();
      showThreatEditor({ threat: recordedThreat(firstThreat) });
      await user.click(folded(readOnly));
      await user.click(textbox('Mitigation 1 title'));
      await user.keyboard(`{End}${softHyphen}`);

      await user.click(opened(readOnly));

      expect(textbox('Mitigation 1 title').getAttribute('aria-invalid')).toBe(
        'true',
      );
      expect(opened(readOnly)).toBeDefined();
    });

    it('opens on a draft held for it', () => {
      showThreatEditor({
        threat: recordedThreat(firstThreat),
        held: {
          field: `mitigation/title/${firstMitigation}`,
          text: `Read-only${softHyphen} share links`,
          said: () => 'A refusal',
        },
      });

      expect(
        screen.getByDisplayValue(`Read-only${softHyphen} share links`),
      ).toBe(textbox('Mitigation 1 title'));
    });

    it("hands focus to the next record's toggle when the one above it is unlinked while that one is folded", async () => {
      const user = userEvent.setup();
      act(() => {
        dispatch(
          Action.AddMitigation({
            mitigation: {
              ...recordedModel.mitigations[0],
              id: mitigationId('mitigation-rotated'),
              title: 'Rotate share links',
            },
          }),
        );
      });
      showThreatEditor({ threat: recordedThreat(firstThreat) });
      await user.click(folded(readOnly));

      await user.click(button('Unlink mitigation 1'));

      expect(document.activeElement).toBe(
        folded('Mitigation 1, Rotate share links'),
      );
    });

    it('marks a new record Added once Return keeps it, with Unlink in place of Discard, the heading counting it and the change announced', async () => {
      const user = userEvent.setup();
      showThreatEditor({ threat: recordedThreat(firstThreat) });
      await user.click(button('Add mitigation'));
      const row = recordRow('Mitigation 2 title', 'textbox');
      expect(
        within(row).getByRole('button', { name: 'Discard mitigation 2' }),
      ).toBeDefined();
      expect(addedMark(row)).toBeNull();
      expect(
        screen.getByRole('group', { name: 'Mitigations 1' }),
      ).toBeDefined();

      await user.keyboard('Sign every share link{Enter}');

      expect(addedMark(row)).not.toBeNull();
      expect(
        within(row).getByRole('button', { name: 'Unlink mitigation 2' }),
      ).toBeDefined();
      expect(
        within(row).queryByRole('button', { name: 'Discard mitigation 2' }),
      ).toBeNull();
      expect(
        screen.getByRole('group', { name: 'Mitigations 2' }),
      ).toBeDefined();
      expect(currentAnnouncement().message).toBe(
        t('canvas.mitigation-added', { number: 2 }),
      );
      expect(document.activeElement).toBe(textbox('Mitigation 2 title'));
    });

    it('marks an assumption kept by leaving its text, until its threat closes', async () => {
      const user = userEvent.setup();
      showThreatEditor({ threat: recordedThreat(firstThreat) });
      await user.click(button('Add assumption'));
      await user.keyboard('Share links expire.');

      await user.tab();

      expect(opened(expiring)).toBeDefined();
      expect(addedMark(recordRow(expiring))).not.toBeNull();
      expect(currentAnnouncement().message).toBe(
        t('canvas.assumption-added', { number: 2 }),
      );

      await user.click(threatSummary());
      await user.click(threatSummary());

      expect(folded(expiring)).toBeDefined();
      expect(addedMark(recordRow(expiring))).toBeNull();
    });
  },
  editorTimeout,
);
