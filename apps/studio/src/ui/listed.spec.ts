import { locales } from '@saerskriven/i18n';
import { listed } from './listed.js';

const items = [
  { label: 'High level' },
  { label: 'Payments' },
  { label: 'Ledger' },
];

describe('listed', () => {
  it.each(locales)(
    'keeps each item itself, in order, with text between them in %s',
    (locale) => {
      const parts = listed(items, locale);

      expect(parts.filter((part) => typeof part !== 'string')).toEqual(items);
      expect(parts.filter((_, index) => index % 2 === 1)).toEqual([
        expect.any(String),
        expect.any(String),
      ]);
    },
  );
});
