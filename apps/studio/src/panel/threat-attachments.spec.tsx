import type { ElementId } from '@saerskriven/model';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  } = {},
): void => {
  render(
    <AttachmentGroup
      onAttach={handlers.onAttach ?? noop}
      onDetach={handlers.onDetach ?? noop}
      threat={{ ...sampleThreat, elements }}
    />,
  );
};

describe(
  'the attachments of a threat',
  () => {
    beforeEach(() => {
      modelStore.setState(initialState(sampleModel), true);
    });

    it('holds one control per element the threat names, under its own name', () => {
      showAttachments([actorElement, processElement]);

      expect(
        screen.getByRole('group', { name: 'Attached elements' }),
      ).toBeDefined();
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

    it('offers the elements the threat does not name, and hands back the one chosen', async () => {
      const user = userEvent.setup();
      const onAttach = detaches();
      showAttachments([actorElement, processElement], { onAttach });

      await user.click(
        screen.getByRole('combobox', { name: 'Existing element' }),
      );
      expect(screen.getAllByRole('option')).toHaveLength(1);
      await user.keyboard('{Escape}');

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
  },
  editorTimeout,
);
