import { threatStatusSchema } from '@saerskriven/model';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { StatusField } from './status-field.js';
import { noop } from './ui.fixtures.js';

describe('StatusField', () => {
  it('offers every status the model names and nothing else', async () => {
    const user = userEvent.setup();
    render(<StatusField onCommit={noop} value="open" />);

    await user.tab();
    await user.keyboard('{Enter}');

    expect(screen.getAllByRole('option')).toHaveLength(
      threatStatusSchema.options.length,
    );
    for (const status of threatStatusSchema.options) {
      expect(screen.getByRole('option', { name: status })).toBeDefined();
    }
  });
});
