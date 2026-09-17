import { Either } from 'effect';
import { parse } from 'yaml';
import type { ReadFailure } from './codec.js';
import {
  adversarialText,
  corpusTexts,
  corpusTimeout,
} from './corpus.fixtures.js';
import { readSaerskrivenYaml } from './saerskriven-yaml-read.js';
import { nativeFixtures } from './saerskriven-yaml.fixtures.js';
import {
  parseWithinLimits,
  readLimits,
  withinTextBytes,
  type ReadLimit,
} from './read-limits.js';
import { readThreatDragon } from './threat-dragon-read.js';

type Read = (text: string) => Either.Either<unknown, ReadFailure>;

const nestedBy = (steps: number): string =>
  `${'['.repeat(steps + 1)}${']'.repeat(steps + 1)}`;

const sharedFromDepths = (elements: number, depths: number): string =>
  [
    `shared: &shared [${'x,'.repeat(elements - 1)}x]`,
    'deep:',
    ...Array.from(
      { length: depths },
      (_, step) =>
        `${' '.repeat(step + 1)}at: *shared\n${' '.repeat(step + 1)}in:`,
    ),
    `${' '.repeat(depths + 1)}end: done`,
    '',
  ].join('\n');

const nestedAnchors = (anchors: number): string => {
  const named = Array.from({ length: anchors }, (_, step) => step + 1);
  return [
    ...named.map((step) => `n${String(step)}: &n${String(step)} x`),
    'nest: &c1',
    ...named
      .slice(1)
      .map((step) => `${' '.repeat(step - 1)}in: &c${String(step)}`),
    `${' '.repeat(anchors)}[${named.map((step) => `*n${String(step)}`).join(', ')}]`,
    `use: [${named.map((step) => `*c${String(step)}`).join(', ')}]`,
    '',
  ].join('\n');
};

const fixtures: readonly {
  readonly name: string;
  readonly text: string;
  readonly asYaml: ReadLimit;
  readonly observed: number;
  readonly asJson: string;
}[] = [
  {
    name: 'deep-nesting.json',
    text: adversarialText('deep-nesting.json'),
    asYaml: 'maxNestingDepth',
    observed: readLimits.maxNestingDepth + 1,
    asJson: 'maxNestingDepth',
  },
  {
    name: 'deep-block.yaml',
    text: adversarialText('deep-block.yaml'),
    asYaml: 'maxNestingDepth',
    observed: readLimits.maxNestingDepth + 1,
    asJson: 'MalformedText',
  },
  {
    name: 'cyclic-anchor.yaml',
    text: adversarialText('cyclic-anchor.yaml'),
    asYaml: 'maxAliasCount',
    observed: readLimits.maxAliasCount + 1,
    asJson: 'MalformedText',
  },
  {
    name: 'alias-expansion.yaml',
    text: adversarialText('alias-expansion.yaml'),
    asYaml: 'maxAliasCount',
    observed: readLimits.maxAliasCount + 1,
    asJson: 'MalformedText',
  },
  {
    name: 'branching-cycle.yaml',
    text: adversarialText('branching-cycle.yaml'),
    asYaml: 'maxAliasCount',
    observed: readLimits.maxAliasCount + 1,
    asJson: 'MalformedText',
  },
  {
    name: 'wide-cycle.yaml',
    text: adversarialText('wide-cycle.yaml'),
    asYaml: 'maxAliasCount',
    observed: readLimits.maxAliasCount + 1,
    asJson: 'MalformedText',
  },
  {
    name: 'shared-anchor.yaml',
    text: adversarialText('shared-anchor.yaml'),
    asYaml: 'maxAliasExpansion',
    observed: readLimits.maxAliasExpansion + 1,
    asJson: 'MalformedText',
  },
  {
    name: 'nested-anchors.yaml',
    text: adversarialText('nested-anchors.yaml'),
    asYaml: 'maxAliasCount',
    observed: readLimits.maxAliasCount + 1,
    asJson: 'MalformedText',
  },
  {
    name: 'a branching cycle written as a block mapping',
    text: 'a: &a\n  l: *a\n  r: *a\n',
    asYaml: 'maxAliasCount',
    observed: readLimits.maxAliasCount + 1,
    asJson: 'MalformedText',
  },
  {
    name: 'a text one byte past the size bound',
    text: 'a'.repeat(readLimits.maxTextBytes + 1),
    asYaml: 'maxTextBytes',
    observed: readLimits.maxTextBytes + 1,
    asJson: 'maxTextBytes',
  },
];

function refusalOf(read: Read, text: string): string {
  const result = read(text);
  if (Either.isRight(result)) {
    return 'accepted';
  }
  return result.left._tag === 'ExceededReadLimit'
    ? result.left.limit
    : result.left._tag;
}

function failureOf(read: Read, text: string): ReadFailure | undefined {
  const result = read(text);
  return Either.isLeft(result) ? result.left : undefined;
}

describe('the read limits against the files the repository vendors', () => {
  it(
    'stop no Threat Dragon file in the corpus, through either read',
    () => {
      const stopped = corpusTexts.flatMap((file) =>
        [readThreatDragon, readSaerskrivenYaml].flatMap((read) =>
          refusalOf(read, file.text).startsWith('max') ? [file.name] : [],
        ),
      );
      expect(stopped).toEqual([]);
    },
    corpusTimeout,
  );

  it('stop none of the Saerskriven YAML files this repository writes', () => {
    expect(
      nativeFixtures.map((file) => [
        file.name,
        refusalOf(readSaerskrivenYaml, file.text),
      ]),
    ).toEqual(nativeFixtures.map((file) => [file.name, 'accepted']));
  });

  it('keep the size bound ten times above the largest of them', () => {
    const largest = Math.max(...corpusTexts.map((file) => file.text.length));
    expect(readLimits.maxTextBytes).toBeGreaterThan(largest * 10);
  });

  it('are the numbers this release enforces', () => {
    expect(readLimits).toEqual({
      maxTextBytes: 8_388_608,
      maxImportTextUnits: 16_777_216,
      maxNestingDepth: 64,
      maxAliasCount: 50,
      maxAliasExpansion: 100_000,
    });
  });
});

describe('an adversarial fixture', () => {
  it.each(fixtures)(
    'stops the Saerskriven YAML read of $name at the bound it was built for, saying how far it got',
    ({ text, asYaml, observed }) => {
      expect(failureOf(readSaerskrivenYaml, text)).toEqual({
        _tag: 'ExceededReadLimit',
        limit: asYaml,
        bound: readLimits[asYaml],
        observed,
      });
    },
  );

  it('stops the Threat Dragon read, at a bound where it is JSON at all', () => {
    expect(
      fixtures.map((entry) => [
        entry.name,
        refusalOf(readThreatDragon, entry.text),
      ]),
    ).toEqual(fixtures.map((entry) => [entry.name, entry.asJson]));
  });
});

describe('the size bound', () => {
  it('names the size it measured, which for one byte past is that', () => {
    const text = 'a'.repeat(readLimits.maxTextBytes + 1);
    expect(failureOf(readThreatDragon, text)).toEqual({
      _tag: 'ExceededReadLimit',
      limit: 'maxTextBytes',
      bound: readLimits.maxTextBytes,
      observed: readLimits.maxTextBytes + 1,
    });
  });

  it('counts the text in UTF-8 bytes rather than in code units', () => {
    const text = 'é'.repeat(readLimits.maxTextBytes);
    expect(failureOf(readThreatDragon, text)).toEqual({
      _tag: 'ExceededReadLimit',
      limit: 'maxTextBytes',
      bound: readLimits.maxTextBytes,
      observed: readLimits.maxTextBytes * 2,
    });
  });

  it('reports the code units where those alone break it, unmeasured', () => {
    const text = 'é'.repeat(readLimits.maxTextBytes + 1);
    expect(failureOf(readThreatDragon, text)).toEqual({
      _tag: 'ExceededReadLimit',
      limit: 'maxTextBytes',
      bound: readLimits.maxTextBytes,
      observed: readLimits.maxTextBytes + 1,
    });
  });

  it('admits a text of exactly the bound, to fail on its own merits', () => {
    expect(
      refusalOf(readThreatDragon, 'a'.repeat(readLimits.maxTextBytes)),
    ).toBe('MalformedText');
  });

  it('is the one comparison a writer checks its output against', () => {
    expect([
      withinTextBytes(readLimits.maxTextBytes),
      withinTextBytes(readLimits.maxTextBytes + 1),
    ]).toEqual([true, false]);
  });
});

describe('the nesting bound', () => {
  it('admits a value sitting exactly at it', () => {
    expect(
      refusalOf(readThreatDragon, nestedBy(readLimits.maxNestingDepth)),
    ).toBe('InvalidWireDocument');
  });

  it('refuses a value that branches back into itself, in work its width cannot grow', () => {
    const loop: Record<string, unknown> = {};
    loop['l'] = loop;
    loop['r'] = loop;
    expect(
      failureOf(
        (text) => parseWithinLimits(text, () => Either.right(loop)),
        '{}',
      ),
    ).toEqual({
      _tag: 'ExceededReadLimit',
      limit: 'maxNestingDepth',
      bound: readLimits.maxNestingDepth,
      observed: readLimits.maxNestingDepth + 1,
    });
  });

  it('measures a shared subtree from the deepest place it is reached', () => {
    const shallow = `${'['.repeat(40)}${']'.repeat(40)}`;
    const text = [
      `near: &shared ${shallow}`,
      'far:',
      ...Array.from({ length: 30 }, (_, step) => `${' '.repeat(step + 1)}in:`),
      `${' '.repeat(31)}- *shared`,
      '',
    ].join('\n');
    expect(refusalOf(readSaerskrivenYaml, text)).toBe('maxNestingDepth');
  });

  it('refuses a value one step past it, and says how far it got', () => {
    expect(
      failureOf(readThreatDragon, nestedBy(readLimits.maxNestingDepth + 1)),
    ).toEqual({
      _tag: 'ExceededReadLimit',
      limit: 'maxNestingDepth',
      bound: readLimits.maxNestingDepth,
      observed: readLimits.maxNestingDepth + 1,
    });
  });
});

describe('the alias bound', () => {
  it('is this package measuring, where the parser is now handed nothing', () => {
    const text = adversarialText('alias-expansion.yaml');
    expect(refusalOf(readSaerskrivenYaml, text)).toBe('maxAliasCount');
    expect(() => {
      parse(text);
    }).not.toThrow();
  });
});

describe('the alias expansion bound', () => {
  it('is what an alias reaches rather than how many aliases there are', () => {
    expect(refusalOf(readSaerskrivenYaml, sharedFromDepths(1, 40))).toBe(
      'InvalidWireDocument',
    );
  });

  it('leaves an alias with no anchor to the parser', () => {
    expect(refusalOf(readSaerskrivenYaml, 'a: *missing\n')).toBe(
      'MalformedText',
    );
  });
});

describe('a generated fixture', () => {
  it('is the bytes its generator writes, so the file cannot drift', () => {
    expect([sharedFromDepths(3_000, 40), nestedAnchors(25)]).toEqual([
      adversarialText('shared-anchor.yaml'),
      adversarialText('nested-anchors.yaml'),
    ]);
  });
});
