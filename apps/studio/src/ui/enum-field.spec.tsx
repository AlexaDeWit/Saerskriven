import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { EnumField, enumCommitter } from './enum-field.js';
import { noop } from './ui.fixtures.js';

const options = ['first', 'second', 'third'] as const;

type Option = (typeof options)[number];

const commits = () => vi.fn<(chosen: Option) => void>();

describe('enumCommitter', () => {
  it('commits a value the options name', () => {
    const onCommit = commits();

    enumCommitter(options, onCommit)('second');

    expect(onCommit).toHaveBeenCalledWith('second');
  });

  it('commits nothing for a value the options do not name', () => {
    const onCommit = commits();

    enumCommitter(options, onCommit)('fourth');

    expect(onCommit).toHaveBeenCalledTimes(0);
  });
});

describe('EnumField', () => {
  it('names the trigger from its visible label, as a combobox', () => {
    render(
      <EnumField
        label="Rank"
        onCommit={noop}
        options={options}
        value="first"
        labelOf={(option) => option}
      />,
    );

    expect(screen.getByRole('combobox', { name: 'Rank' })).toBeDefined();
  });

  it('puts the trigger on the tab path', async () => {
    const user = userEvent.setup();
    render(
      <EnumField
        label="Rank"
        onCommit={noop}
        options={options}
        value="first"
        labelOf={(option) => option}
      />,
    );

    await user.tab();

    expect(document.activeElement).toBe(screen.getByRole('combobox'));
  });

  it('offers every option it was given, named by its text', async () => {
    const user = userEvent.setup();
    render(
      <EnumField
        label="Rank"
        onCommit={noop}
        options={options}
        value="first"
        labelOf={(option) => option}
      />,
    );

    await user.tab();
    await user.keyboard('{Enter}');

    for (const option of options) {
      expect(screen.getByRole('option', { name: option })).toBeDefined();
    }
  });

  it('draws a suffix outside the label it tells apart, keeps both in the option name, and describes the option by its detail', async () => {
    const user = userEvent.setup();
    render(
      <EnumField
        label="Rank"
        labelOf={(option) => ({
          label: 'Same long label',
          suffix: `(${option})`,
          detail: `detail of ${option}`,
        })}
        onCommit={noop}
        options={options}
        value="first"
      />,
    );

    expect(
      screen
        .getByRole('combobox', { name: 'Rank' })
        .querySelector('[data-option-suffix]')?.textContent,
    ).toBe('(first)');

    await user.tab();
    await user.keyboard('{Enter}');

    const option = screen.getByRole('option', {
      name: 'Same long label (second)',
    });
    expect(option.querySelector('[data-option-suffix]')?.textContent).toBe(
      '(second)',
    );
    expect(
      document.getElementById(option.getAttribute('aria-describedby') ?? '')
        ?.textContent,
    ).toContain('second');
  });

  it('shows its placeholder with nothing chosen while it has no value', async () => {
    const user = userEvent.setup();
    render(
      <EnumField
        label="Rank"
        onCommit={noop}
        options={options}
        placeholder="Pick a rank"
        value={undefined}
        labelOf={(option) => option}
      />,
    );

    const trigger = screen.getByRole('combobox', { name: 'Rank' });
    expect(trigger.textContent).toContain('Pick a rank');

    await user.tab();
    await user.keyboard('{Enter}');

    expect(
      screen
        .getAllByRole('option')
        .filter((option) => option.getAttribute('aria-selected') === 'true'),
    ).toHaveLength(0);
  });

  it('keeps its accessible name when the label drawn is replaced or left out', () => {
    render(
      <>
        <EnumField
          label="Rank of the first"
          onCommit={noop}
          options={options}
          shownLabel="Rank"
          value="first"
          labelOf={(option) => option}
        />
        <EnumField
          label="Rank of the second"
          onCommit={noop}
          options={options}
          shownLabel=""
          value="first"
          labelOf={(option) => option}
        />
      </>,
    );

    expect(
      screen.getByRole('combobox', { name: 'Rank of the first' }),
    ).toBeDefined();
    expect(
      screen.getByRole('combobox', { name: 'Rank of the second' }),
    ).toBeDefined();
    expect(screen.queryByText('Rank of the second')).toBeNull();
  });

  it('puts the options under the heading each was grouped under', async () => {
    const user = userEvent.setup();
    render(
      <EnumField
        groupOf={(chosen) => (chosen === 'first' ? 'Early' : 'Late')}
        label="Rank"
        onCommit={noop}
        options={options}
        value="first"
        labelOf={(option) => option}
      />,
    );

    await user.tab();
    await user.keyboard('{Enter}');

    expect(screen.getAllByRole('group')).toHaveLength(2);
    expect(screen.getByRole('group', { name: 'Late' }).textContent).toContain(
      'second',
    );
  });

  it('commits the value chosen with the keyboard alone', async () => {
    const user = userEvent.setup();
    const onCommit = commits();
    render(
      <EnumField
        label="Rank"
        onCommit={onCommit}
        options={options}
        value="first"
        labelOf={(option) => option}
      />,
    );

    await user.tab();
    await user.keyboard('{Enter}');
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('second');
  });

  it('commits nothing when the listbox is dismissed', async () => {
    const user = userEvent.setup();
    const onCommit = commits();
    render(
      <EnumField
        label="Rank"
        onCommit={onCommit}
        options={options}
        value="first"
        labelOf={(option) => option}
      />,
    );

    await user.tab();
    await user.keyboard('{Enter}');
    await user.keyboard('{ArrowDown}{Escape}');

    expect(onCommit).toHaveBeenCalledTimes(0);
  });

  it('commits nothing when the value already set is chosen again', async () => {
    const user = userEvent.setup();
    const onCommit = commits();
    render(
      <EnumField
        label="Rank"
        onCommit={onCommit}
        options={options}
        value="first"
        labelOf={(option) => option}
      />,
    );

    await user.tab();
    await user.keyboard('{Enter}');
    await user.keyboard('{Enter}');

    expect(onCommit).toHaveBeenCalledTimes(0);
  });

  it('sizes the open listbox to the box the field scrolls in, not the viewport', async () => {
    const user = userEvent.setup();
    render(
      <div data-testid="scroll-box" style={{ overflowY: 'auto' }}>
        <EnumField
          label="Rank"
          onCommit={noop}
          options={options}
          value="first"
          labelOf={(option) => option}
        />
      </div>,
    );
    const box = screen.getByTestId('scroll-box');
    const room = { x: 0, y: 0, width: 300, height: 120 };
    const viewport = document.documentElement;
    Object.defineProperties(viewport, {
      clientWidth: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 1000 },
    });
    onTestFinished(() => {
      Reflect.deleteProperty(viewport, 'clientWidth');
      Reflect.deleteProperty(viewport, 'clientHeight');
    });
    box.getBoundingClientRect = () => DOMRect.fromRect(room);
    Object.defineProperties(box, {
      clientWidth: { value: room.width },
      clientHeight: { value: room.height },
    });

    await user.tab();
    await user.keyboard('{Enter}');

    const placed = screen.getByRole('listbox').parentElement;
    const available = (): number =>
      Number.parseFloat(
        placed?.style.getPropertyValue('--radix-popper-available-height') ?? '',
      );
    await vi.waitFor(() => {
      expect(available()).toBeLessThanOrEqual(room.height);
    });
  });
});
