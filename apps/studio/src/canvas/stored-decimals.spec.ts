import { storedNumber } from '@saerskriven/model';
import { typedDecimals } from './stored-decimals.js';

describe('typedDecimals', () => {
  it.each([
    [[100, 20], 3],
    [[10.5, 20.25], 3],
    [[530.189, 80.1234], 4],
    [[10.123456, 20], 6],
    [[530.189, 80.1234567890123], 6],
    [[], 3],
  ])(
    'stores a form showing %j at %d decimals: the most shown, from three to six',
    (shown, decimals) => {
      expect(typedDecimals(shown)).toBe(decimals);
    },
  );

  it.each([7, 0.5, -12.25, 3.125, 40.1234, -0.12345, 530.123456])(
    'stores a typed %d as typed, whatever the other fields show',
    (typed) => {
      for (const beside of [0, 20.5, 80.1234567890123]) {
        expect(storedNumber(typed, typedDecimals([typed, beside]))).toBe(typed);
      }
    },
  );
});
