import { z } from 'zod';
import { undeclaredDivergences } from './undeclared.js';

const schema = z.object({ kept: z.object({ inner: z.string() }) });

const reportOn = (given: unknown): readonly string[] =>
  undeclaredDivergences(given, schema.parse(given)).flatMap((divergence) =>
    divergence.detail.code === 'key-undeclared'
      ? [divergence.detail.parameters.path]
      : [],
  );

describe('undeclaredDivergences', () => {
  it('reports nothing where the schema declared every key', () => {
    expect(reportOn({ kept: { inner: 'yes' } })).toEqual([]);
  });

  it('names where in the document a stripped key sat', () => {
    expect(reportOn({ kept: { inner: 'yes', b: 1 } })).toEqual(['kept.b']);
  });

  it('reports a stripped key whose name is a prototype member', () => {
    expect(
      reportOn(
        Object.fromEntries<unknown>([
          ['kept', { inner: 'yes' }],
          ['__proto__', { pwn: 1 }],
          ['toString', 'no'],
        ]),
      ),
    ).toEqual(['__proto__', 'toString']);
  });

  it('escapes a dot in a key, so it cannot read as a path through two', () => {
    expect(reportOn({ kept: { inner: 'yes' }, 'a.b': 1 })).toEqual(['a\\.b']);
  });

  it('escapes a backslash in a key, so no key renders as another', () => {
    expect(reportOn({ kept: { inner: 'yes' }, 'a\\.b': 1 })).toEqual([
      'a\\\\\\.b',
    ]);
  });
});
