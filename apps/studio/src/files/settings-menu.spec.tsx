import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DropdownMenu } from 'radix-ui';
import type { ReactNode } from 'react';
import { withLanguage } from '../messages/locale.fixtures.js';
import type { ColourMode } from '../theme-preference.js';
import { AppearanceMenu, LanguageMenu } from './settings-menu.js';

type User = ReturnType<typeof userEvent.setup>;

const openPanel = (children: ReactNode): void => {
  render(
    <DropdownMenu.Root modal={false} open>
      <DropdownMenu.Trigger>Menu</DropdownMenu.Trigger>
      <DropdownMenu.Content>{children}</DropdownMenu.Content>
    </DropdownMenu.Root>,
  );
};

const openSubmenu = async (user: User, name: RegExp): Promise<void> => {
  await user.hover(screen.getByRole('menuitem', { name }));
  await screen.findAllByRole('menuitemradio');
};

const choice = (name: string): HTMLElement =>
  screen.getByRole('menuitemradio', { name });

describe('the language submenu', () => {
  withLanguage('en-CA');

  it('lists exactly the three supported locales, each in its own language', async () => {
    const user = userEvent.setup();
    openPanel(<LanguageMenu />);

    await openSubmenu(user, /^Language: /u);

    expect(screen.getAllByRole('menuitemradio')).toHaveLength(3);
    expect(choice('English (Canada)')).toBeDefined();
    expect(choice('Français (Canada)')).toBeDefined();
    expect(choice('Svenska')).toBeDefined();
    expect(choice('English (Canada)').getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  it('marks the chosen language and translates its own words', async () => {
    const user = userEvent.setup();
    openPanel(<LanguageMenu />);
    await openSubmenu(user, /^Language: /u);

    await user.click(choice('Svenska'));
    await openSubmenu(user, /^Språk: /u);

    expect(choice('Svenska').getAttribute('aria-checked')).toBe('true');
    expect(choice('Français (Canada)')).toBeDefined();
  });
});

describe('the appearance submenu', () => {
  it('reports the mode chosen from its options', async () => {
    const user = userEvent.setup();
    const chosen = vi.fn<(mode: ColourMode) => void>();
    openPanel(<AppearanceMenu mode="system" onChange={chosen} />);

    await openSubmenu(user, /^Appearance: /u);
    await user.click(choice('Dark'));

    expect(chosen).toHaveBeenCalledWith('dark');
  });
});

describe.each([
  ['en-CA', 'Appearance: Dark', 'Language: English (Canada)'],
  ['fr-CA', 'Apparence : Sombre', 'Langue : Français (Canada)'],
  ['sv', 'Utseende: Mörkt', 'Språk: Svenska'],
] as const)('the settings rows in %s', (locale, appearance, language) => {
  withLanguage(locale);

  it('names each row by its setting, a colon and the label of the option chosen', () => {
    openPanel(
      <>
        <AppearanceMenu mode="dark" />
        <LanguageMenu />
      </>,
    );

    expect(screen.getByRole('menuitem', { name: appearance })).toBeDefined();
    expect(screen.getByRole('menuitem', { name: language })).toBeDefined();
  });
});
