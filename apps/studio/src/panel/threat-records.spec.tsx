import { mitigationId, softHyphen } from '@saerskriven/model/fixtures';
import { act, cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Action } from '../store/actions.js';
import { initialState } from '../store/state.js';
import {
  firstAssumption,
  firstMitigation,
  firstThreat,
  recordedModel,
  secondThreat,
} from '../store/store.fixtures.js';
import {
  currentAnnouncement,
  recordQuoteLength,
  resetAnnouncements,
} from '../canvas/announcements.js';
import { dispatch, modelStore } from '../store/store.js';
import { present, undoable } from '../store/store.fixtures.js';
import {
  chooseFrom,
  editorTimeout,
  recordedThreat,
  showThreatEditor,
} from './panel.fixtures.js';
import type { RefusedField } from './refusals.js';
import { button, describedNumbers, textbox } from '../ui/ui.fixtures.js';

const linkFirstOffered = async (noun: string): Promise<void> => {
  const user = userEvent.setup();
  await user.click(screen.getByRole('combobox', { name: `Existing ${noun}` }));
  await user.click(screen.getAllByRole('option')[0]);
  await user.click(button(`Link existing ${noun}`));
};

const assumptionRows = (): readonly (string | undefined)[] =>
  screen
    .queryAllByRole('textbox', { name: /^Assumption \d+$/u })
    .map(
      (_, index) =>
        textbox(`Assumption ${String(index + 1)}`).closest<HTMLElement>(
          '[data-record-row]',
        )?.dataset['recordRow'],
    );

describe(
  'the records of a threat',
  () => {
    beforeEach(() => {
      modelStore.setState(initialState(recordedModel), true);
      resetAnnouncements();
    });

    it('opens an empty first row with focus in its first field, and leaves the model alone', async () => {
      const user = userEvent.setup();
      showThreatEditor({ threat: recordedThreat(secondThreat) });

      await user.click(button('Add mitigation'));

      expect(document.activeElement).toBe(textbox('Mitigation 1 title'));
      expect(present()).toBe(recordedModel);
    });

    it('leaves no record and no undo entry when the empty row is left', async () => {
      const user = userEvent.setup();
      showThreatEditor({ threat: recordedThreat(secondThreat) });

      await user.click(button('Add mitigation'));
      for (const _ of ['description', 'status', 'discard', 'add']) {
        await user.tab();
      }
      expect(document.activeElement).toBe(button('Add mitigation'));

      expect(
        screen.queryByRole('textbox', { name: 'Mitigation 1 title' }),
      ).toBeNull();
      expect(present()).toBe(recordedModel);
      expect(undoable()).toBe(0);
    });

    it('creates one proposed mitigation on the threat at the first commit, which one undo takes back and one redo returns', async () => {
      const user = userEvent.setup();
      showThreatEditor({ threat: recordedThreat(secondThreat) });

      await user.click(button('Add mitigation'));
      await user.keyboard('Sign every share link');
      await user.tab();

      expect(present().mitigations).toHaveLength(2);
      expect(present().mitigations.at(-1)).toMatchObject({
        title: 'Sign every share link',
        status: 'proposed',
        threats: [secondThreat],
      });
      expect(document.activeElement).toBe(textbox('Mitigation 1 description'));
      expect(undoable()).toBe(1);

      act(() => {
        dispatch(Action.Undo());
      });
      expect(present()).toBe(recordedModel);
      expect(
        screen.queryByRole('textbox', { name: 'Mitigation 1 title' }),
      ).toBeNull();

      act(() => {
        dispatch(Action.Redo());
      });
      expect(screen.getByDisplayValue('Sign every share link')).toBe(
        textbox('Mitigation 1 title'),
      );
    });

    it('creates a new assumption unconfirmed', async () => {
      const user = userEvent.setup();
      showThreatEditor({ threat: recordedThreat(secondThreat) });

      await user.click(button('Add assumption'));
      await user.keyboard('Share links expire.');
      await user.tab();

      expect(present().assumptions.at(-1)).toMatchObject({
        prose: 'Share links expire.',
        status: 'unconfirmed',
        threats: [secondThreat],
      });
    });

    it('removes a record unlinked from its only threat, and one undo restores it with its link', async () => {
      const user = userEvent.setup();
      showThreatEditor({ threat: recordedThreat(firstThreat) });

      await user.click(button('Unlink mitigation 1'));

      expect(present().mitigations).toEqual([]);
      expect(document.activeElement).toBe(button('Add mitigation'));
      expect(currentAnnouncement().message).toContain(
        recordedModel.mitigations[0].title,
      );
      act(() => {
        dispatch(Action.Undo());
      });
      expect(present().mitigations).toEqual(recordedModel.mitigations);
    });

    it('announces a record kept on another threat differently from one the unlink removed', async () => {
      const user = userEvent.setup();
      act(() => {
        dispatch(
          Action.LinkMitigation({
            mitigationId: firstMitigation,
            threatId: secondThreat,
          }),
        );
      });
      showThreatEditor({ threat: recordedThreat(firstThreat) });

      await user.click(button('Unlink mitigation 1'));
      expect(present().mitigations).toHaveLength(1);
      const kept = currentAnnouncement().message;
      act(() => {
        dispatch(Action.Undo());
        dispatch(
          Action.UnlinkMitigation({
            mitigationId: firstMitigation,
            threatId: secondThreat,
          }),
        );
      });
      await user.click(button('Unlink mitigation 1'));
      expect(present().mitigations).toEqual([]);
      const removed = currentAnnouncement().message;

      expect(kept).toContain(recordedModel.mitigations[0].title);
      expect(removed).toContain(recordedModel.mitigations[0].title);
      expect(removed).not.toBe(kept);
    });

    it('names a record with a long first line by a bounded prefix when it is unlinked', async () => {
      const user = userEvent.setup();
      const long = `${'Every share link is signed and expires '.repeat(8)}soon.`;
      act(() => {
        dispatch(
          Action.ReplaceMitigation({
            mitigation: { ...recordedModel.mitigations[0], title: long },
          }),
        );
      });
      showThreatEditor({ threat: recordedThreat(firstThreat) });

      await user.click(button('Unlink mitigation 1'));

      const message = currentAnnouncement().message;
      expect(message).toContain(long.slice(0, recordQuoteLength / 2));
      expect(message).not.toContain(long);
      expect(message.length).toBeLessThan(long.length);
    });

    it('keeps a shared record on its other threats when it is unlinked here', async () => {
      const user = userEvent.setup();
      act(() => {
        dispatch(
          Action.LinkAssumption({
            assumptionId: firstAssumption,
            threatId: secondThreat,
          }),
        );
      });
      showThreatEditor({ threat: recordedThreat(firstThreat) });

      await user.click(button('Unlink assumption 1'));

      expect(present().assumptions).toMatchObject([
        { id: firstAssumption, threats: [secondThreat] },
      ]);
      expect(currentAnnouncement().message).toContain(
        recordedModel.assumptions[0].prose.slice(0, recordQuoteLength / 2),
      );
    });

    it('describes the unlink control of an assumption that also applies to the model, and keeps that assumption in the model when it leaves its only threat', async () => {
      const user = userEvent.setup();
      showThreatEditor({ threat: recordedThreat(firstThreat) });
      const unlink = button('Unlink assumption 1');
      expect(unlink.getAttribute('aria-describedby')).toBeNull();

      act(() => {
        dispatch(
          Action.LinkAssumptionToModel({ assumptionId: firstAssumption }),
        );
      });
      expect(
        document.getElementById(unlink.getAttribute('aria-describedby') ?? ''),
      ).not.toBeNull();

      await user.click(unlink);

      expect(present().assumptions).toMatchObject([
        { id: firstAssumption, threats: [], appliesToModel: true },
      ]);
      expect(currentAnnouncement().message).toContain(
        recordedModel.assumptions[0].prose.slice(0, recordQuoteLength / 2),
      );
    });

    it('offers to link only records not on the threat, and names by number the other threats that hold a linked one', async () => {
      const user = userEvent.setup();
      showThreatEditor({ threat: recordedThreat(secondThreat) });

      await user.click(
        screen.getByRole('combobox', { name: 'Existing mitigation' }),
      );
      expect(
        screen.getAllByRole('option').map((option) => option.textContent),
      ).toEqual([expect.stringContaining('Read-only share links')]);
      await user.keyboard('{Escape}');
      const link = button('Link existing mitigation');
      expect(link.getAttribute('aria-disabled')).toBe('true');
      await user.click(link);
      expect(present()).toBe(recordedModel);

      await user.click(
        screen.getByRole('combobox', { name: 'Existing mitigation' }),
      );
      await user.click(screen.getByRole('option'));
      expect(link.getAttribute('aria-disabled')).toBe('false');
      await user.click(link);

      expect(present().mitigations).toMatchObject([
        { id: firstMitigation, threats: [firstThreat, secondThreat] },
      ]);
      expect(document.activeElement).toBe(textbox('Mitigation 1 title'));
      expect(describedNumbers(button('Unlink mitigation 1'))).toEqual([1]);
      expect(
        screen.queryByRole('combobox', { name: 'Existing mitigation' }),
      ).toBeNull();
    });

    it('starts the Existing picker with nothing chosen, and returns it to nothing chosen after a link', async () => {
      const user = userEvent.setup();
      act(() => {
        dispatch(
          Action.AddMitigation({
            mitigation: {
              ...recordedModel.mitigations[0],
              id: mitigationId('mitigation-second'),
              title: 'Rotate share links',
            },
          }),
        );
      });
      showThreatEditor({ threat: recordedThreat(secondThreat) });
      const existing = screen.getByRole('combobox', {
        name: 'Existing mitigation',
      });
      expect(existing.hasAttribute('data-placeholder')).toBe(true);

      await chooseFrom('Existing mitigation', 'Rotate share links');
      expect(existing.hasAttribute('data-placeholder')).toBe(false);
      await user.click(button('Link existing mitigation'));

      expect(present().mitigations[1].threats).toContain(secondThreat);
      expect(
        screen
          .getByRole('combobox', { name: 'Existing mitigation' })
          .hasAttribute('data-placeholder'),
      ).toBe(true);
      const disabled = button('Link existing mitigation');
      expect(disabled.getAttribute('aria-disabled')).toBe('true');
      expect(
        document.getElementById(
          disabled.getAttribute('aria-describedby') ?? '',
        ),
      ).not.toBeNull();
    });

    it('sends focus into a new row still holding a refused draft when Add is pressed, opening no second row', async () => {
      const user = userEvent.setup();
      showThreatEditor({
        threat: recordedThreat(secondThreat),
        held: {
          field: 'new-mitigation/title/mitigation-drafted',
          text: `Pasted${softHyphen}title`,
          said: 'A refusal',
        },
      });

      await user.click(button('Add mitigation'));

      expect(document.activeElement).toBe(textbox('Mitigation 1 title'));
      expect(screen.queryByRole('group', { name: 'Mitigation 2' })).toBeNull();
    });

    it('names each record card as a group holding its controls, and keeps their names', () => {
      showThreatEditor({ threat: recordedThreat(firstThreat) });

      const card = screen.getByRole('group', { name: 'Mitigation 1' });
      expect(
        within(card).getByRole('combobox', { name: 'Mitigation 1 status' }),
      ).toBeDefined();
      expect(
        within(screen.getByRole('group', { name: 'Assumption 1' })).getByRole(
          'textbox',
          { name: 'Assumption 1' },
        ),
      ).toBeDefined();
    });

    it('changes a status in place as one undo step that moves no threat status', async () => {
      showThreatEditor({ threat: recordedThreat(firstThreat) });

      await chooseFrom('Mitigation 1 status', 'Verified');

      expect(present().mitigations[0].status).toBe('verified');
      expect(present().threats).toBe(recordedModel.threats);
      expect(undoable()).toBe(1);
    });

    it('holds a refused draft in the empty row and keeps the row open', async () => {
      const user = userEvent.setup();
      const onRefusal = vi.fn<(refused: RefusedField | undefined) => void>();
      showThreatEditor({
        threat: recordedThreat(secondThreat),
        onRefusal: onRefusal,
      });

      await user.click(button('Add assumption'));
      await user.keyboard(`Pasted${softHyphen}prose`);
      await user.click(button('Add mitigation'));

      expect(present()).toBe(recordedModel);
      expect(textbox('Assumption 1').getAttribute('aria-invalid')).toBe('true');
      const reported = onRefusal.mock.lastCall?.[0];
      expect(reported?.text).toBe(`Pasted${softHyphen}prose`);
      expect(reported?.field.startsWith('new-assumption/prose/')).toBe(true);
    });

    it.each([
      {
        named: 'an assumption prose',
        field: 'new-assumption/prose/assumption-drafted',
        text: `Pasted${softHyphen}prose`,
        row: 'Assumption 1',
      },
      {
        named: 'a mitigation title',
        field: 'new-mitigation/title/mitigation-drafted',
        text: `Pasted${softHyphen}title`,
        row: 'Mitigation 1 title',
      },
    ] as const)(
      'puts a held draft of $named back in the empty row it was typed in',
      ({ field, text, row }) => {
        showThreatEditor({
          threat: recordedThreat(secondThreat),
          held: { field, text, said: 'A refusal' },
        });

        expect(screen.getByDisplayValue(text)).toBe(textbox(row));
        expect(present()).toBe(recordedModel);
      },
    );

    it('drops a refusal whose row another edit took away', async () => {
      const user = userEvent.setup();
      const onRefusal = vi.fn<(refused: RefusedField | undefined) => void>();
      showThreatEditor({
        threat: recordedThreat(firstThreat),
        onRefusal: onRefusal,
      });

      await user.click(textbox('Mitigation 1 title'));
      await user.keyboard(`{End}${softHyphen}`);
      await user.tab();
      expect(onRefusal.mock.lastCall?.[0]).toBeDefined();

      act(() => {
        dispatch(
          Action.UnlinkMitigation({
            mitigationId: firstMitigation,
            threatId: firstThreat,
          }),
        );
      });

      expect(onRefusal).toHaveBeenLastCalledWith(undefined);
    });

    it('edits a mitigation title and description in place, each as one replace', async () => {
      const user = userEvent.setup();
      showThreatEditor({ threat: recordedThreat(firstThreat) });

      await user.click(textbox('Mitigation 1 title'));
      await user.keyboard(' for readers');
      await user.tab();
      await user.keyboard('Links carry a scope.');
      await user.tab();

      expect(present().mitigations).toMatchObject([
        {
          id: firstMitigation,
          title: 'Read-only share links for readers',
          prose: 'Links carry a scope.',
          threats: [firstThreat],
        },
      ]);
      expect(undoable()).toBe(2);
      act(() => {
        dispatch(Action.Undo());
      });
      expect(present().mitigations[0]).toMatchObject({
        title: 'Read-only share links for readers',
        prose: '',
      });
    });

    it('links an existing assumption and changes its status in place', async () => {
      const user = userEvent.setup();
      showThreatEditor({ threat: recordedThreat(secondThreat) });

      await user.click(
        screen.getByRole('combobox', { name: 'Existing assumption' }),
      );
      await user.click(screen.getByRole('option'));
      await user.click(button('Link existing assumption'));
      expect(present().assumptions[0].threats).toEqual([
        firstThreat,
        secondThreat,
      ]);

      await chooseFrom('Assumption 1 status', 'Invalidated');

      expect(present().assumptions[0].status).toBe('invalidated');
      expect(present().threats).toBe(recordedModel.threats);
      expect(undoable()).toBe(2);
    });

    it('keeps shown rows in place while a record is added, linked, undone, redone or edited in another tab, and mounts again in model order', async () => {
      const user = userEvent.setup();
      showThreatEditor({ threat: recordedThreat(secondThreat) });

      await user.click(button('Add assumption'));
      await user.keyboard('Share links expire.');
      await user.tab();
      const added = present().assumptions.at(-1)?.id;
      await linkFirstOffered('assumption');

      expect(assumptionRows()).toEqual([added, firstAssumption]);
      expect(document.activeElement).toBe(textbox('Assumption 2'));

      act(() => {
        dispatch(Action.Undo());
      });
      expect(assumptionRows()).toEqual([added]);
      act(() => {
        dispatch(Action.Redo());
      });
      expect(assumptionRows()).toEqual([added, firstAssumption]);

      const { present: model, ...synced } = modelStore.getState();
      act(() => {
        dispatch(
          Action.Followed({
            state: {
              ...synced,
              present: {
                ...model,
                assumptions: model.assumptions.map((assumption) =>
                  assumption.id === firstAssumption
                    ? { ...assumption, prose: 'Edited in another tab.' }
                    : assumption,
                ),
              },
            },
          }),
        );
      });
      expect(assumptionRows()).toEqual([added, firstAssumption]);

      cleanup();
      showThreatEditor({ threat: recordedThreat(secondThreat) });
      expect(assumptionRows()).toEqual([firstAssumption, added]);
    });

    it('gives a row brought back by undoing its unlink its old slot', async () => {
      const user = userEvent.setup();
      showThreatEditor({ threat: recordedThreat(secondThreat) });
      await linkFirstOffered('assumption');
      await user.click(button('Add assumption'));
      await user.keyboard('Share links expire.');
      await user.tab();
      const added = present().assumptions.at(-1)?.id;
      expect(assumptionRows()).toEqual([firstAssumption, added]);

      await user.click(button('Unlink assumption 1'));
      expect(assumptionRows()).toEqual([added]);
      act(() => {
        dispatch(Action.Undo());
      });

      expect(assumptionRows()).toEqual([firstAssumption, added]);
    });

    it('gives a record linked again after its unlink its old slot', async () => {
      const user = userEvent.setup();
      showThreatEditor({ threat: recordedThreat(secondThreat) });
      await linkFirstOffered('assumption');
      await user.click(button('Add assumption'));
      await user.keyboard('Share links expire.');
      await user.tab();
      const added = present().assumptions.at(-1)?.id;

      await user.click(button('Unlink assumption 1'));
      await linkFirstOffered('assumption');

      expect(assumptionRows()).toEqual([firstAssumption, added]);
      expect(document.activeElement).toBe(textbox('Assumption 1'));
    });

    it('drops a held draft for a record no longer on the threat, rather than reopening it', () => {
      const onRefusal = vi.fn<(refused: RefusedField | undefined) => void>();
      showThreatEditor({
        threat: recordedThreat(secondThreat),
        held: {
          field: 'mitigation/title/mitigation-culled',
          text: `Pasted${softHyphen}title`,
          said: 'A refusal',
        },
        onRefusal: onRefusal,
      });

      expect(
        screen.queryByRole('textbox', { name: 'Mitigation 1 title' }),
      ).toBeNull();
      expect(onRefusal).toHaveBeenLastCalledWith(undefined);
    });

    it('keeps focus in the group when an undo takes the focused row away', async () => {
      const user = userEvent.setup();
      showThreatEditor({ threat: recordedThreat(secondThreat) });

      await user.click(button('Add mitigation'));
      await user.keyboard('Sign every share link');
      await user.tab();
      expect(document.activeElement).toBe(textbox('Mitigation 1 description'));

      act(() => {
        dispatch(Action.Undo());
      });

      expect(document.activeElement).toBe(button('Add mitigation'));
    });

    it('starts a record on the status chosen in its empty row, and Discard leaves nothing', async () => {
      const user = userEvent.setup();
      showThreatEditor({ threat: recordedThreat(secondThreat) });

      await user.click(button('Add mitigation'));
      await chooseFrom('Mitigation 1 status', 'Implemented');
      expect(present()).toBe(recordedModel);
      await user.click(button('Discard mitigation 1'));

      expect(
        screen.queryByRole('textbox', { name: 'Mitigation 1 title' }),
      ).toBeNull();
      expect(document.activeElement).toBe(button('Add mitigation'));
      expect(present()).toBe(recordedModel);

      await user.click(button('Add mitigation'));
      await chooseFrom('Mitigation 1 status', 'Implemented');
      await user.click(textbox('Mitigation 1 title'));
      await user.keyboard('Sign every share link');
      await user.tab();

      expect(present().mitigations.at(-1)).toMatchObject({
        title: 'Sign every share link',
        status: 'implemented',
      });
      expect(undoable()).toBe(1);
    });

    it('discards typed text in a new row on a pointer press of Discard, with no record and no undo entry', async () => {
      const user = userEvent.setup();
      showThreatEditor({ threat: recordedThreat(secondThreat) });

      await user.click(button('Add mitigation'));
      await user.keyboard('Sign every share link');
      await user.click(button('Discard mitigation 1'));

      expect(present()).toBe(recordedModel);
      expect(undoable()).toBe(0);
      expect(document.activeElement).toBe(button('Add mitigation'));
    });

    it('holds the status picked in a new row with its refused draft, and restores both', async () => {
      const user = userEvent.setup();
      const onRefusal = vi.fn<(refused: RefusedField | undefined) => void>();
      showThreatEditor({
        threat: recordedThreat(secondThreat),
        onRefusal: onRefusal,
      });

      await user.click(button('Add assumption'));
      await user.keyboard(`Pasted${softHyphen}prose`);
      await user.tab();
      await chooseFrom('Assumption 1 status', 'Valid');

      const reported = onRefusal.mock.lastCall?.[0];
      expect(reported?.status).toBe('valid');
      cleanup();
      showThreatEditor({
        threat: recordedThreat(secondThreat),
        held: reported,
      });

      expect(
        screen.getByRole('combobox', { name: 'Assumption 1 status' })
          .textContent,
      ).toContain('Valid');
      expect(present()).toBe(recordedModel);
    });

    it('holds a picked status with every refused draft of a new row', async () => {
      const user = userEvent.setup();
      const onRefusal = vi.fn<(refused: RefusedField | undefined) => void>();
      showThreatEditor({
        threat: recordedThreat(secondThreat),
        onRefusal: onRefusal,
      });

      await user.click(button('Add mitigation'));
      await user.keyboard(`Pasted${softHyphen}title`);
      await user.tab();
      await user.keyboard(`Pasted${softHyphen}prose`);
      await user.tab();
      await chooseFrom('Mitigation 1 status', 'Implemented');

      const reported = onRefusal.mock.lastCall?.[0];
      expect(reported?.field.startsWith('new-mitigation/title/')).toBe(true);
      expect(reported?.status).toBe('implemented');
      cleanup();
      showThreatEditor({
        threat: recordedThreat(secondThreat),
        held: reported,
      });

      expect(
        screen.getByRole('combobox', { name: 'Mitigation 1 status' })
          .textContent,
      ).toContain('Implemented');
    });
  },
  editorTimeout,
);
