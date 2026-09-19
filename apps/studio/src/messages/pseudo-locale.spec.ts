import { pseudoText } from '@saerskriven/i18n';

const translatedAt = async (address: string): Promise<string> => {
  globalThis.history.replaceState(null, '', address);
  vi.resetModules();
  const { activeTranslator } = await import('./locale.js');
  return activeTranslator().t('menu.menu');
};

afterEach(() => {
  globalThis.history.replaceState(null, '', '/');
  vi.resetModules();
});

describe('the pseudo-locale', () => {
  it('reads every message through it in a session opened with ?pseudo-locale', async () => {
    expect(await translatedAt('/?pseudo-locale')).toBe(pseudoText('Menu'));
  });

  it('stays out of a session opened without it', async () => {
    expect(await translatedAt('/?other')).toBe('Menu');
  });
});
