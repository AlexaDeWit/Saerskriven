import { threatStatusSchema } from '@saerskriven/model';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { statusMessages } from '../messages/enum-labels.js';
import { activeTranslator } from '../messages/locale.js';
import { StatusField } from './status-field.js';
import { noop } from './ui.fixtures.js';

const { t } = activeTranslator();

describe('StatusField', () => {
  it('offers every status the model names under its own label', async () => {
    const user = userEvent.setup();
    render(<StatusField onCommit={noop} value="open" />);

    await user.tab();
    await user.keyboard('{Enter}');

    expect(screen.getAllByRole('option')).toHaveLength(
      threatStatusSchema.options.length,
    );
    for (const status of threatStatusSchema.options) {
      expect(
        screen.getByRole('option', { name: t(statusMessages[status]) }),
      ).toBeDefined();
    }
  });
});
