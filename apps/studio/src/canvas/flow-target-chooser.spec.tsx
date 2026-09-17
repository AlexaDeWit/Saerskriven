import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { actorElement, heldElements } from '../store/store.fixtures.js';
import { openCanvas } from './canvas.fixtures.js';
import { startFlow } from './connecting.js';
import { FlowTargetChooser } from './flow-target-chooser.js';
import { Toolbox } from './toolbox.js';

describe('FlowTargetChooser', () => {
  beforeEach(() => {
    openCanvas([actorElement]);
    startFlow();
  });

  it('opens the connector command chooser without adding a flow tool', () => {
    render(
      <>
        <Toolbox />
        <FlowTargetChooser />
      </>,
    );

    expect(screen.getByRole('listbox')).toBeDefined();
    expect(screen.queryByRole('button', { name: /flow tool/iu })).toBeNull();
  });

  it('commits the connector command target directly', async () => {
    const user = userEvent.setup();
    render(<FlowTargetChooser />);

    await user.click(screen.getByRole('option', { name: 'Studio' }));

    expect(heldElements()).toBe(7);
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
