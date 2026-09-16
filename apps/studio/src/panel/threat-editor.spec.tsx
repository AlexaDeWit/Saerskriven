import { chooseFrom } from './panel.fixtures.js';
import type { Threat } from '@saerskriven/model';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  processElement,
  sampleThreat,
  sampleElement,
  storeElement,
} from '../store/store.fixtures.js';
import { editorTimeout, showThreatEditor } from './panel.fixtures.js';
import type { RefusedField } from './refusals.js';
import { textbox } from '../ui/ui.fixtures.js';
import { softHyphen } from '@saerskriven/model/fixtures';

const commits = () => vi.fn<(patch: Partial<Threat>) => void>();

const disclosure = (): HTMLElement =>
  screen.getByRole('button', { name: /A reader edits/u });

const typeInto = async (field: string, text: string): Promise<void> => {
  const user = userEvent.setup();
  await user.click(textbox(field));
  await user.keyboard(text);
  await user.tab();
};

describe(
  'ThreatEditor',
  () => {
    it('is named by its number and title while it is collapsed', () => {
      showThreatEditor({}, false);

      expect(disclosure().textContent).toContain('1');
      expect(screen.queryByRole('textbox', { name: 'Title' })).toBeNull();
    });

    it('shows every field of the threat once it is expanded', () => {
      showThreatEditor();

      for (const name of ['Title', 'Description']) {
        expect(textbox(name)).toBeDefined();
      }
      expect(screen.queryByRole('textbox', { name: 'Mitigation' })).toBeNull();
      for (const name of ['Category', 'Severity', 'Status']) {
        expect(screen.getByRole('combobox', { name })).toBeDefined();
      }
      expect(
        screen.getByRole('button', { name: 'Delete threat 1' }),
      ).toBeDefined();
    });

    it('commits a title left behind as a patch of that field alone', async () => {
      const user = userEvent.setup();
      const onCommit = commits();
      showThreatEditor({ onCommit });

      await user.clear(textbox('Title'));
      await user.keyboard('A reader edits a model{Enter}');

      expect(onCommit).toHaveBeenCalledWith({
        title: 'A reader edits a model',
      });
    });

    it('commits a description left behind as a patch of that field alone', async () => {
      const onCommit = commits();
      showThreatEditor({ onCommit });

      await typeInto(
        'Description',
        'The reader has a token they may only read with.',
      );

      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(onCommit).toHaveBeenCalledWith({
        description: 'The reader has a token they may only read with.',
      });
    });

    it('commits a severity chosen as a patch of that field alone', async () => {
      const onCommit = commits();
      showThreatEditor({ onCommit });

      await chooseFrom('Severity', 'critical');

      expect(onCommit).toHaveBeenCalledWith({ severity: 'critical' });
    });

    it('commits a status chosen as a patch of that field alone', async () => {
      const onCommit = commits();
      showThreatEditor({ onCommit });

      await chooseFrom('Status', 'mitigated');

      expect(onCommit).toHaveBeenCalledWith({ status: 'mitigated' });
    });

    it('commits a category chosen as a patch of that field alone', async () => {
      const onCommit = commits();
      showThreatEditor({ onCommit });

      await chooseFrom('Category', 'STRIDE spoofing');

      expect(onCommit).toHaveBeenCalledWith({
        category: { methodology: 'STRIDE', category: 'spoofing' },
      });
    });

    it('reports a refused draft, and keeps reporting it while a clean field commits beside it', async () => {
      const onRefusal = vi.fn<(refused: RefusedField | undefined) => void>();
      showThreatEditor({ onRefusal });

      await typeInto('Description', `Pasted${softHyphen}prose`);
      const refusedDescription = onRefusal.mock.lastCall?.[0];
      expect(refusedDescription).toMatchObject({
        field: 'Description',
        text: `Pasted${softHyphen}prose`,
      });
      expect(refusedDescription?.said).toContain('7');

      await typeInto('Title', ' by token');

      expect(onRefusal).toHaveBeenLastCalledWith(refusedDescription);
    });

    it('opens the field a held draft was typed in on that draft, refusal and all', () => {
      showThreatEditor({
        held: {
          field: 'Description',
          text: `Pasted${softHyphen}prose`,
          said: 'A refusal',
        },
      });

      expect(
        screen.getByDisplayValue(`Pasted${softHyphen}prose`),
      ).toBeDefined();
      expect(
        screen
          .getByRole('textbox', { name: 'Description' })
          .getAttribute('aria-invalid'),
      ).toBe('true');
    });

    it('says that deleting a threat several elements name takes it off all of them', () => {
      showThreatEditor({
        threat: { ...sampleThreat, elements: [processElement, storeElement] },
        attachments: [
          sampleElement(processElement),
          sampleElement(storeElement),
        ],
      });

      expect(screen.getByText(/names 2 elements/u)).toBeDefined();
      expect(
        screen.getByRole('list', { name: 'Attached elements' }).textContent,
      ).toContain(sampleElement(processElement).name);
      expect(
        screen.getByRole('list', { name: 'Attached elements' }).textContent,
      ).toContain(sampleElement(storeElement).name);
      expect(
        screen
          .getByRole('button', { name: 'Delete threat 1' })
          .getAttribute('aria-describedby'),
      ).not.toBeNull();
    });

    it('takes the focus the panel sends into the title, and reports it', () => {
      const onFocused = vi.fn<() => void>();
      showThreatEditor({ focus: 'title', onFocused });

      expect(document.activeElement).toBe(textbox('Title'));
      expect(onFocused).toHaveBeenCalledTimes(1);
    });

    it('takes the focus the panel sends onto the control that expands it', () => {
      showThreatEditor({ focus: 'disclosure' }, false);

      expect(document.activeElement).toBe(disclosure());
    });
  },
  editorTimeout,
);
