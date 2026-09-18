import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DropdownMenu } from 'radix-ui';
import type { ReactNode } from 'react';
import { chooseLanguage } from '../messages/locale.js';
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

afterEach(() => {
  chooseLanguage('browser');
  globalThis.localStorage.clear();
});

describe('the language submenu', () => {
  it('names every language in its own language, whatever the active one', async () => {
    const user = userEvent.setup();
    openPanel(<LanguageMenu />);

    await openSubmenu(user, /^Language /u);

    expect(choice('English (Canada)')).toBeDefined();
    expect(choice('Français (Canada)')).toBeDefined();
    expect(choice('Svenska')).toBeDefined();
    expect(choice('Follow the browser').getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  it('marks the chosen language and translates its own words', async () => {
    const user = userEvent.setup();
    openPanel(<LanguageMenu />);
    await openSubmenu(user, /^Language /u);

    await user.click(choice('Svenska'));
    await openSubmenu(user, /^Språk /u);

    expect(choice('Svenska').getAttribute('aria-checked')).toBe('true');
    expect(choice('Följ webbläsaren')).toBeDefined();
    expect(choice('Français (Canada)')).toBeDefined();
  });
});

describe('the appearance submenu', () => {
  it('reports the mode chosen from its options', async () => {
    const user = userEvent.setup();
    const chosen = vi.fn<(mode: ColourMode) => void>();
    openPanel(<AppearanceMenu mode="system" onChange={chosen} />);

    await openSubmenu(user, /^Appearance /u);
    await user.click(choice('Dark'));

    expect(chosen).toHaveBeenCalledWith('dark');
  });
});
