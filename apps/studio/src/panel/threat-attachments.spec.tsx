import type { ElementId } from '@saerskriven/model';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { activeTranslator } from '../messages/locale.js';
import { initialState } from '../store/state.js';
import {
  actorElement,
  processElement,
  sampleModel,
  sampleThreat,
  storeElement,
} from '../store/store.fixtures.js';
import { modelStore } from '../store/store.js';
import { button, noop } from '../ui/ui.fixtures.js';
import { chooseFrom, editorTimeout } from './panel.fixtures.js';
import { AttachmentGroup } from './threat-attachments.js';

const detaches = () => vi.fn<(elementId: ElementId) => void>();

const showAttachments = (
  elements: ElementId[],
  handlers: {
    readonly onAttach?: (elementId: ElementId) => void;
    readonly onDetach?: (elementId: ElementId) => void;
    readonly onModelLink?: (applies: boolean) => void;
  } = {},
  appliesToModel = false,
): void => {
  render(
    <AttachmentGroup
      onAttach={handlers.onAttach ?? noop}
      onDetach={handlers.onDetach ?? noop}
      onModelLink={handlers.onModelLink ?? noop}
      threat={{ ...sampleThreat, elements, appliesToModel }}
    />,
  );
};

const wholeModel = 'Applies to the whole model';

describe(
  'the attachments of a threat',
  () => {
    beforeEach(() => {
      modelStore.setState(initialState(sampleModel), true);
    });

    it('holds one control per element the threat names, under its own name', () => {
      showAttachments([actorElement, processElement]);

      expect(
        within(
          screen.getByRole('group', { name: 'Attached elements' }),
        ).getAllByRole('listitem'),
      ).toHaveLength(2);
      expect(button('Detach Reader')).toBeDefined();
      expect(button('Detach Studio')).toBeDefined();
      expect(
        screen.queryByRole('button', { name: 'Detach Models' }),
      ).toBeNull();
    });

    it('hands back the element the control it was given names', async () => {
      const user = userEvent.setup();
      const onDetach = detaches();
      showAttachments([actorElement, processElement], { onDetach });

      await user.click(button('Detach Studio'));

      expect(onDetach).toHaveBeenCalledWith(processElement);
    });

    it('offers the elements the threat does not name below the ones it names, and hands back the one chosen', async () => {
      const user = userEvent.setup();
      const onAttach = detaches();
      showAttachments([actorElement, processElement], { onAttach });

      await user.click(
        screen.getByRole('combobox', { name: 'Existing element' }),
      );
      expect(screen.getAllByRole('option')).toHaveLength(1);
      await user.keyboard('{Escape}');

      expect(
        button('Detach Studio').compareDocumentPosition(
          screen.getByRole('combobox', { name: 'Existing element' }),
        ) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).not.toBe(0);
      await chooseFrom('Existing element', 'Models');
      await user.click(button('Attach existing element'));

      expect(onAttach).toHaveBeenCalledWith(storeElement);
    });

    it('offers no picker where the threat already names every element', () => {
      showAttachments([actorElement, processElement, storeElement]);

      expect(
        screen.queryByRole('combobox', { name: 'Existing element' }),
      ).toBeNull();
    });

    it('says whether the threat applies to the whole model, ahead of its elements, and hands back the answer chosen', async () => {
      const onModelLink = vi.fn<(applies: boolean) => void>();
      const { t } = activeTranslator();
      showAttachments([actorElement], { onModelLink });
      const control = within(
        screen.getByRole('group', { name: 'Attached elements' }),
      ).getByRole('combobox', { name: wholeModel });

      expect(control.textContent).toContain(t('enums.no'));
      expect(
        control.compareDocumentPosition(button('Detach Reader')) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).not.toBe(0);

      await chooseFrom(wholeModel, t('enums.yes'));

      expect(onModelLink).toHaveBeenCalledExactlyOnceWith(true);
    });

    it('offers to stop a threat applying to the whole model while it names no element', async () => {
      const onModelLink = vi.fn<(applies: boolean) => void>();
      const { t } = activeTranslator();
      showAttachments([], { onModelLink }, true);

      expect(
        screen.getByRole('combobox', { name: wholeModel }).textContent,
      ).toContain(t('enums.yes'));
      expect(screen.queryByRole('button', { name: /^Detach / })).toBeNull();
      expect(screen.queryByRole('list')).toBeNull();

      await chooseFrom(wholeModel, t('enums.no'));

      expect(onModelLink).toHaveBeenCalledExactlyOnceWith(false);
    });
  },
  editorTimeout,
);
