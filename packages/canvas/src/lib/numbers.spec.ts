import { svgNumber } from './numbers.js';

const magnitudes = Array.from({ length: 69 }, (_, step) => 10 ** (step - 8));

const plainNumber = /^-?\d+(\.\d{1,3})?$/u;

describe('svgNumber', () => {
  it.each([
    {
      named: 'a whole coordinate without a decimal part',
      value: 120,
      written: '120',
    },
    {
      named: 'the decimals a coordinate carries',
      value: 12.5,
      written: '12.5',
    },
    {
      named: 'what binary arithmetic leaves behind rounded off',
      value: 0.1 + 0.2,
      written: '0.3',
    },
    {
      named: 'a negative coordinate as negative',
      value: -40.25,
      written: '-40.25',
    },
    {
      named: 'a value that rounds to negative zero as zero',
      value: -0.0001,
      written: '0',
    },
    { named: 'zero as zero', value: 0, written: '0' },
    {
      named: 'the trailing zeros of a whole hundred',
      value: 1200,
      written: '1200',
    },
  ])('writes $named ($value as $written)', ({ value, written }) => {
    expect(svgNumber(value)).toBe(written);
  });

  it('writes out the magnitude where toFixed turns exponential', () => {
    expect(svgNumber(1e21)).toBe('1000000000000000000000');
    expect(Number(svgNumber(1e21))).toBe(1e21);
  });

  it('writes out a magnitude far past that one', () => {
    expect(svgNumber(1e30)).toBe(`1${'0'.repeat(30)}`);
    expect(Number(svgNumber(1e30))).toBe(1e30);
  });

  it('writes out the digits of a mantissa, not just the leading one', () => {
    expect(Number(svgNumber(1.5e21))).toBe(1.5e21);
    expect(Number(svgNumber(-1e30))).toBe(-1e30);
  });

  it('writes no exponent and no separator at any magnitude', () => {
    expect([magnitudes[0], magnitudes.at(-1)]).toEqual([1e-8, 1e60]);
    const written = magnitudes.flatMap((magnitude) =>
      [1, 1.5, -3.25, 7].map((factor) => svgNumber(factor * magnitude)),
    );
    expect(written.filter((value) => !plainNumber.test(value))).toEqual([]);
  });
});
