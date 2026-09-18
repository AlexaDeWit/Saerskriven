import { threatCategorySchema, type ThreatCategory } from '@saerskriven/model';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  CategoryField,
  categoryCommitter,
  categoryKey,
  enumeratedCategoryKeys,
} from './category-field.js';
import { listboxTimeout, noop } from './ui.fixtures.js';

const stride: ThreatCategory = {
  methodology: 'STRIDE',
  category: 'tampering',
};

const custom: ThreatCategory = {
  methodology: 'custom',
  methodologyName: 'House rules',
  category: 'billing abuse',
};

describe('categoryKey', () => {
  it('pairs an enumerated methodology with its category', () => {
    expect(categoryKey(stride)).toBe('STRIDE tampering');
  });

  it('keeps a custom methodology out of the enumerated keys', () => {
    expect(enumeratedCategoryKeys).not.toContain(categoryKey(custom));
  });
});

describe('categoryCommitter', () => {
  it('commits the category a key names', () => {
    const onCommit = vi.fn<(category: ThreatCategory) => void>();

    categoryCommitter(onCommit)('LINDDUN linking');

    expect(onCommit).toHaveBeenCalledWith({
      methodology: 'LINDDUN',
      category: 'linking',
    });
  });

  it('commits nothing for a key no enumerated pair names', () => {
    const onCommit = vi.fn<(category: ThreatCategory) => void>();

    categoryCommitter(onCommit)(categoryKey(custom));

    expect(onCommit).toHaveBeenCalledTimes(0);
  });
});

describe(
  'CategoryField',
  () => {
    it('names its trigger Category, as a combobox showing the category', () => {
      render(<CategoryField onCommit={noop} value={stride} />);

      expect(
        screen.getByRole('combobox', { name: 'Category' }).textContent,
      ).toContain('Tampering');
    });

    it('offers every enumerated pair', async () => {
      const user = userEvent.setup();
      render(<CategoryField onCommit={noop} value={stride} />);

      await user.tab();
      await user.keyboard('{Enter}');

      expect(screen.getAllByRole('option')).toHaveLength(
        enumeratedCategoryKeys.length,
      );
    });

    it('groups the pairs under the methodology each belongs to', async () => {
      const user = userEvent.setup();
      render(<CategoryField onCommit={noop} value={stride} />);

      await user.tab();
      await user.keyboard('{Enter}');

      expect(screen.getAllByRole('group')).toHaveLength(
        threatCategorySchema.options.length - 1,
      );
      expect(
        screen.getByRole('group', { name: 'STRIDE' }).textContent,
      ).toContain('Tampering');
    });

    it('shows a custom category the file carried, beside the enumerated pairs', async () => {
      const user = userEvent.setup();
      render(<CategoryField onCommit={noop} value={custom} />);

      await user.tab();
      await user.keyboard('{Enter}');

      expect(
        screen.getByRole('group', { name: 'House rules' }).textContent,
      ).toContain('billing abuse');
      expect(
        screen.getByRole('option', { name: 'billing abuse' }),
      ).toBeDefined();
      expect(screen.getAllByRole('option')).toHaveLength(
        enumeratedCategoryKeys.length + 1,
      );
    });

    it('commits the pair chosen with the keyboard alone', async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn<(category: ThreatCategory) => void>();
      render(<CategoryField onCommit={onCommit} value={stride} />);

      await user.tab();
      await user.keyboard('{Enter}{ArrowDown}{Enter}');

      expect(onCommit).toHaveBeenCalledWith({
        methodology: 'STRIDE',
        category: 'repudiation',
      });
    });
  },
  listboxTimeout,
);
