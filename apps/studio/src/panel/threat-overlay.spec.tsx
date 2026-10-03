import * as panelSelectors from './threats.js';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Action } from '../store/actions.js';
import { initialState } from '../store/state.js';
import {
  actorElement,
  nativeSource,
  processElement,
  sampleModel,
} from '../store/store.fixtures.js';
import { dispatch, modelStore } from '../store/store.js';
import { focusThreatPanel, toggleModelPanel } from './panel-focus.js';
import { ThreatOverlay } from './threat-overlay.js';
import { addControl } from '../ui/ui.fixtures.js';
import { softHyphen } from '@saerskriven/model/fixtures';

const panel = () => screen.queryByRole('region', { name: 'Threats' });

const showModelPanel = (): void => {
  act(() => {
    dispatch(Action.ShowModelPanel());
  });
};

const modelPanel = () => screen.queryByRole('region', { name: 'Model' });

const modelThreatsTab = (): HTMLElement =>
  screen.getByRole('tab', { name: /^Threats \d+$/u });

const description = (): HTMLElement =>
  screen.getByRole('textbox', { name: 'Description' });

const select = (elementId = actorElement): void => {
  act(() => {
    dispatch(Action.Select({ elementIds: [elementId] }));
  });
};

const refuseADraft = async (
  user: ReturnType<typeof userEvent.setup>,
): Promise<void> => {
  await user.click(screen.getByRole('button', { name: /A reader edits/u }));
  await user.click(description());
  await user.keyboard(`Pasted${softHyphen}prose`);
  await user.click(screen.getByRole('button', { name: /A reader edits/u }));
};

describe('ThreatOverlay', () => {
  beforeEach(() => {
    modelStore.setState(initialState(sampleModel), true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('draws no panel while nothing is selected, and one on the element selected', () => {
    render(<ThreatOverlay />);
    expect(panel()).toBeNull();

    select();

    expect(screen.getByRole('heading', { name: 'Reader' })).toBeDefined();
  });

  it('opens every selection on its Threats tab', async () => {
    const user = userEvent.setup();
    render(<ThreatOverlay />);
    select();
    await user.click(screen.getByRole('tab', { name: 'Details' }));

    select(processElement);

    expect(
      screen.getByRole('tab', { selected: true }).textContent,
    ).not.toContain('Details');
    expect(addControl()).toBeDefined();
  });

  it('takes the panel away again when the selection clears', () => {
    render(<ThreatOverlay />);
    select();

    act(() => {
      dispatch(Action.Select({ elementIds: [] }));
    });

    expect(panel()).toBeNull();
  });

  it('leaves focus where it was when a panel opens', () => {
    render(<ThreatOverlay />);

    select();

    expect(document.activeElement).toBe(document.body);
  });

  it('moves focus in when it is asked for, and opens a panel Escape closed', async () => {
    const user = userEvent.setup();
    render(<ThreatOverlay />);
    select();

    act(() => {
      expect(focusThreatPanel()).toBe(true);
    });
    expect(document.activeElement).toBe(addControl());

    await user.keyboard('{Escape}');
    expect(panel()).toBeNull();
    expect(modelStore.getState().selection).toEqual([actorElement]);

    act(() => {
      expect(focusThreatPanel()).toBe(true);
    });

    expect(document.activeElement).toBe(addControl());
  });

  it('stays closed while the element it was closed on is edited', async () => {
    const user = userEvent.setup();
    render(<ThreatOverlay />);
    select();
    act(() => {
      expect(focusThreatPanel()).toBe(true);
    });
    await user.keyboard('{Escape}');

    act(() => {
      dispatch(
        Action.MoveElement({
          elementId: actorElement,
          offset: { x: 20, y: 0 },
        }),
      );
    });

    expect(panel()).toBeNull();
  });

  it('is asked for nothing while no panel is open', () => {
    render(<ThreatOverlay />);

    expect(focusThreatPanel()).toBe(false);
  });

  it('puts a refused draft back when its element is selected again', async () => {
    const user = userEvent.setup();
    render(<ThreatOverlay />);
    select();
    await refuseADraft(user);
    expect(screen.getByDisplayValue(`Pasted${softHyphen}prose`)).toBeDefined();

    select(processElement);
    expect(screen.queryByDisplayValue(`Pasted${softHyphen}prose`)).toBeNull();
    select();

    expect(screen.getByDisplayValue(`Pasted${softHyphen}prose`)).toBeDefined();
    expect(description().getAttribute('aria-invalid')).toBe('true');
  });

  it('keeps a refused draft through a panel Escape closed', async () => {
    const user = userEvent.setup();
    render(<ThreatOverlay />);
    select();
    await refuseADraft(user);

    await user.keyboard('{Escape}');
    expect(panel()).toBeNull();
    act(() => {
      expect(focusThreatPanel()).toBe(true);
    });

    expect(screen.getByDisplayValue(`Pasted${softHyphen}prose`)).toBeDefined();
  });

  it('drops the drafts of a file that was closed, so the next open starts on the model', async () => {
    const user = userEvent.setup();
    render(<ThreatOverlay />);
    select();
    await refuseADraft(user);

    act(() => {
      dispatch(Action.Closed());
    });
    act(() => {
      dispatch(
        Action.Opened({
          model: sampleModel,
          name: 'store-fixture.yaml',
          source: nativeSource,
          divergences: [],
        }),
      );
    });
    select();
    await user.click(screen.getByRole('button', { name: /A reader edits/u }));

    expect(description()).toHaveProperty('value', '');
  });

  it('drops the draft the panel corrected, so the element opens on the model again', async () => {
    const user = userEvent.setup();
    render(<ThreatOverlay />);
    select();
    await refuseADraft(user);

    await user.clear(description());
    await user.keyboard('Pasted prose');
    await user.click(screen.getByRole('button', { name: /A reader edits/u }));
    select(processElement);
    select();

    expect(screen.queryByRole('textbox', { name: 'Description' })).toBeNull();
    expect(modelStore.getState().present.threats[0].description).toBe(
      'Pasted prose',
    );
  });
  it('shows the model panel in place of the selection panel, clearing the selection, and opens it with nothing selected', () => {
    render(<ThreatOverlay />);
    act(() => {
      dispatch(Action.ShowModelPanel());
    });
    expect(modelPanel()).not.toBeNull();
    act(() => {
      dispatch(Action.HideModelPanel());
    });
    select();

    act(() => {
      dispatch(Action.ShowModelPanel());
    });

    expect(panel()).toBeNull();
    expect(modelPanel()).not.toBeNull();
    expect(modelStore.getState().selection).toEqual([]);
  });

  it('widens the model panel, and keeps a refused draft through closing and opening it again', async () => {
    const user = userEvent.setup();
    render(<ThreatOverlay />);
    showModelPanel();
    await user.click(screen.getByRole('button', { name: 'Widen pane' }));
    expect(
      screen
        .getByRole('button', { name: 'Restore pane width' })
        .getAttribute('aria-pressed'),
    ).toBe('true');

    await user.click(screen.getByRole('tab', { name: 'Details' }));
    await user.click(screen.getByRole('textbox', { name: 'Description' }));
    await user.keyboard(`Pasted${softHyphen}prose`);
    await user.click(screen.getByRole('textbox', { name: 'Title' }));
    act(() => {
      dispatch(Action.HideModelPanel());
    });
    showModelPanel();
    await user.click(screen.getByRole('tab', { name: 'Details' }));

    expect(
      screen
        .getByDisplayValue(`Pasted${softHyphen}prose`)
        .getAttribute('aria-invalid'),
    ).toBe('true');
  });

  it('gives way to the selection panel when an element is selected', () => {
    render(<ThreatOverlay />);
    act(() => {
      dispatch(Action.ShowModelPanel());
    });

    select();

    expect(modelPanel()).toBeNull();
    expect(panel()).not.toBeNull();
  });

  it('closes the model panel on Escape and on Close, handing focus to the canvas each time', async () => {
    const user = userEvent.setup();
    render(
      <>
        <div className="react-flow" data-testid="canvas" tabIndex={-1} />
        <ThreatOverlay />
      </>,
    );
    showModelPanel();
    await user.click(modelThreatsTab());
    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(screen.getByTestId('canvas'));

    showModelPanel();
    await user.click(screen.getByRole('button', { name: 'Close model panel' }));
    expect(modelPanel()).toBeNull();
    expect(document.activeElement).toBe(screen.getByTestId('canvas'));
  });

  it('focuses the Threats tab when the toggle opens the model panel, and hands focus to the canvas when it closes it', () => {
    render(
      <>
        <div className="react-flow" data-testid="canvas" tabIndex={-1} />
        <ThreatOverlay />
      </>,
    );
    showModelPanel();
    expect(document.activeElement).toBe(document.body);

    act(() => {
      toggleModelPanel();
    });
    expect(modelPanel()).toBeNull();
    expect(document.activeElement).toBe(screen.getByTestId('canvas'));

    act(() => {
      toggleModelPanel();
    });
    expect(document.activeElement).toBe(modelThreatsTab());
    expect(modelThreatsTab().getAttribute('aria-selected')).toBe('true');
  });

  it('closes the model panel on Escape, which Focus threats does not open again', async () => {
    const user = userEvent.setup();
    render(<ThreatOverlay />);
    act(() => {
      dispatch(Action.ShowModelPanel());
    });
    expect(focusThreatPanel()).toBe(false);

    await user.click(modelThreatsTab());
    await user.keyboard('{Escape}');

    expect(modelPanel()).toBeNull();
    expect(modelStore.getState().modelPanel).toBe(false);
  });

  it('skips field rendering for canvas-only parent updates and still follows model edits', async () => {
    const user = userEvent.setup();
    const shown = render(<ThreatOverlay />);
    select(processElement);
    await user.click(screen.getByRole('tab', { name: 'Details' }));
    await user.click(
      screen.getByRole('button', { name: 'Security properties' }),
    );
    const labels = vi.spyOn(panelSelectors, 'elementLabel');
    for (let frame = 0; frame < 20; frame += 1)
      shown.rerender(<ThreatOverlay />);
    expect(labels).not.toHaveBeenCalled();
    act(() => {
      dispatch(
        Action.SetElementProperties({
          elementId: processElement,
          properties: { kind: 'process', isWebApplication: true },
        }),
      );
    });
    expect(
      screen.getByRole('combobox', { name: 'Web application' }).textContent,
    ).toContain('Yes');
    expect(labels).toHaveBeenCalled();
  });
});
