import { indexedRecentStore } from './recent-store.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('indexedRecentStore', () => {
  it.each([
    ['offers no IndexedDB', undefined],
    [
      'refuses to open it',
      {
        open: () => {
          throw new DOMException('Site data is blocked.', 'SecurityError');
        },
      },
    ],
  ])(
    'answers an empty list, and takes a write, where the browser %s',
    async (_, database) => {
      vi.stubGlobal('indexedDB', database);

      await indexedRecentStore.write([]);

      expect(await indexedRecentStore.read()).toEqual([]);
    },
  );
});
