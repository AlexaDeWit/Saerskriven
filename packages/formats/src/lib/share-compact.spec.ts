import { Either } from 'effect';
import { committedText } from '@saerskriven/model/fixtures';
import { readCompactDocument } from './share-compact-read.js';
import { writeCompactDocument } from './share-compact-write.js';
import { nativeFixtures, readOrThrow } from './saerskriven-yaml.fixtures.js';
import { corpusTexts } from './corpus.fixtures.js';
import { threatDragonReading } from './threat-dragon.fixtures.js';
import { writeSaerskrivenYamlDocument } from './saerskriven-yaml-write.js';
import { compactLayouts, compactRoot } from './share-compact-layout.js';
import { compactRowLimit } from './share-compact-common.js';

const fixtures = [
  ...nativeFixtures.map(({ name, text }) => ({
    name,
    model: readOrThrow(text).model,
  })),
  ...corpusTexts.map(({ name, text }) => ({
    name,
    model: threatDragonReading(text).model,
  })),
];

const minimal = '[[],[["Minimal"],null,null,null,null,0]]';

describe('experimental compact wire layout', () => {
  it.each(fixtures)('preserves every native field in $name', ({ model }) => {
    const document = writeSaerskrivenYamlDocument(model);
    const compact = Either.getOrThrow(writeCompactDocument(document));
    const decoded = Either.getOrThrow(readCompactDocument(compact));
    expect(decoded).toEqual(JSON.parse(JSON.stringify(document)));
  });

  it('keeps the committed field order, enum indexes, optional wrappers, and exact IDs', () => {
    const golden = committedText(
      'share-links/v2-feature-complete.compact.txt',
    ).trimEnd();
    const document = writeSaerskrivenYamlDocument(
      readOrThrow(committedText('saerskriven/feature-complete.yaml')).model,
    );
    expect(Either.getOrThrow(writeCompactDocument(document))).toBe(golden);
    expect(Either.getOrThrow(readCompactDocument(golden))).toEqual(
      JSON.parse(JSON.stringify(document)),
    );
  });

  it('reads a hand-written document without relying on the writer', () => {
    expect(Either.getOrThrow(readCompactDocument(minimal))).toEqual({
      formatVersion: 2,
      metadata: {
        title: 'Minimal',
        owner: '',
        description: '',
        contributors: [],
      },
      assumptions: [],
      diagrams: [],
      mitigations: [],
      threats: [],
      lastIssuedThreatNumber: 0,
    });
  });

  it('never follows an input-selected recursive layout', () => {
    expect(compactRoot).toBe(compactLayouts.length - 1);
    compactLayouts.forEach((layout, index) => {
      const references =
        layout.kind === 'object'
          ? layout.fields.map((field) => field.layout)
          : layout.kind === 'array'
            ? [layout.element]
            : layout.kind === 'optional'
              ? [layout.value]
              : layout.kind === 'variant'
                ? layout.options
                : [];
      references.forEach((reference) => {
        expect(reference).toBeLessThan(index);
      });
    });
  });

  it('preserves fractional coordinates and negative zero', () => {
    const document = writeSaerskrivenYamlDocument(
      readOrThrow(committedText('saerskriven/feature-complete.yaml')).model,
    );
    for (const diagram of document.diagrams) {
      for (const element of diagram.elements) {
        if ('position' in element) {
          element.position.x = -0;
          element.position.y = 0.12345678901234568;
        }
      }
    }
    const decoded = Either.getOrThrow(
      readCompactDocument(Either.getOrThrow(writeCompactDocument(document))),
    );
    expect(decoded).toEqual(document);
    expect(
      decoded.diagrams
        .flatMap((diagram) => diagram.elements)
        .some(
          (element) =>
            'position' in element && Object.is(element.position.x, -0),
        ),
    ).toBe(true);
  });

  it.each([
    '[[],[[0],null,null,null,null,0]]',
    '[["duplicate","duplicate"],[["Minimal"],null,null,null,null,0]]',
    '[[],[["Minimal"],null,null,null,null,0,1]]',
    '[[],[["Minimal"],null,[1,[]],null,null,0]]',
    '[[],[["Minimal"],null,[1,[0]],null,null,0]]',
    '[[],[["Minimal"],null,null,null,null,null]]',
    '[[],[["Minimal"],null,null,null,null,"0"]]',
  ])('refuses a malformed compact document: %s', (text) => {
    expect(Either.isLeft(readCompactDocument(text))).toBe(true);
  });

  it('bounds column expansion before allocating the declared rows', () => {
    const text = JSON.stringify([
      [],
      [['Minimal'], null, [compactRowLimit + 1], null, null, 0],
    ]);
    expect(Either.isLeft(readCompactDocument(text))).toBe(true);
  });

  it('charges every expanded ID reference against the shared text budget', () => {
    const ids = ['x'.repeat(1024 * 1024)];
    const references = Array.from({ length: 100 }, () => 0);
    const diagrams = [
      100,
      references,
      references,
      Array.from({ length: 100 }, () => null),
    ];
    const result = readCompactDocument(
      JSON.stringify([ids, [['Minimal'], null, diagrams, null, null, 0]]),
    );
    expect(Either.isLeft(result) && result.left._tag).toBe('ExceededReadLimit');
  });

  it('applies the shared JSON nesting bound before inspecting the envelope', () => {
    const result = readCompactDocument('['.repeat(100) + '0' + ']'.repeat(100));
    expect(Either.isLeft(result) && result.left._tag).toBe('ExceededReadLimit');
  });
});
