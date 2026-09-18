import { severitySchema } from '@saerskriven/model';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { severityMessages } from '../messages/enum-labels.js';
import { activeTranslator } from '../messages/locale.js';
import { SeverityField } from './severity-field.js';
import { noop } from './ui.fixtures.js';

const { t } = activeTranslator();

describe('SeverityField', () => {
  it('offers every severity the model names under its own label', async () => {
    const user = userEvent.setup();
    render(<SeverityField onCommit={noop} value="high" />);

    await user.tab();
    await user.keyboard('{Enter}');

    expect(screen.getAllByRole('option')).toHaveLength(
      severitySchema.options.length,
    );
    for (const severity of severitySchema.options) {
      expect(
        screen.getByRole('option', { name: t(severityMessages[severity]) }),
      ).toBeDefined();
    }
  });
});
