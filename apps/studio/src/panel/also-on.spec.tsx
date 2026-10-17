import { diagramId, elementId, sharedModel } from '@saerskriven/model/fixtures';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { activeDiagramId } from '../store/selectors.js';
import { initialState } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { AlsoOn } from './also-on.js';

const overview = diagramId('overview');
const paymentsApi = elementId('payments-api');

describe('the Also on line', () => {
  beforeEach(() => {
    modelStore.setState(
      {
        ...initialState(sharedModel),
        activeDiagram: overview,
        selection: [paymentsApi],
      },
      true,
    );
  });

  it('names each other diagram the element is on, and leaves out the one on screen', () => {
    render(<AlsoOn elementId={paymentsApi} />);

    expect(
      screen.getAllByRole('button').map((button) => button.textContent),
    ).toEqual(['Payments']);
  });

  it('shows that diagram with the element selected, from the keyboard', async () => {
    const user = userEvent.setup();
    render(<AlsoOn elementId={paymentsApi} />);

    screen.getByRole('button', { name: 'Show on Payments' }).focus();
    await user.keyboard('{Enter}');

    expect(activeDiagramId(modelStore.getState())).toBe('payments');
    expect(modelStore.getState().selection).toEqual([paymentsApi]);
  });

  it('draws nothing for an element on the diagram on screen alone', () => {
    const { container } = render(<AlsoOn elementId={elementId('customer')} />);

    expect(container.childElementCount).toBe(0);
  });
});
