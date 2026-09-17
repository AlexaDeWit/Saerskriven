import { Either } from 'effect';
import type { ReadFailure } from './codec.js';
import { readFailureIssues } from './codec.fixtures.js';
import { adversarialText, corpusTexts } from './corpus.fixtures.js';
import {
  DetectionFailure,
  formatNameSchema,
  readAnyFormat,
  type DetectedRead,
} from './detect.js';
import {
  featureCompleteYaml,
  minimalYamlV1,
  nativeFixtures,
  oneThreatYamlV1,
} from './saerskriven-yaml.fixtures.js';
import { saerskrivenYamlCodec } from './saerskriven-yaml.js';
import { readSaerskrivenYaml } from './saerskriven-yaml-read.js';
import { readLimits } from './read-limits.js';
import { featureCompleteText } from './threat-dragon.fixtures.js';
import { threatDragonCodec } from './threat-dragon.js';

const branchingCycle = adversarialText('branching-cycle.yaml');

const nativeMinimalVersion2 = minimalYamlV1.replace(
  'formatVersion: 1',
  'formatVersion: 2',
);

const laterFormatVersion = minimalYamlV1.replace(
  'formatVersion: 1',
  'formatVersion: 3',
);

const danglingReference = oneThreatYamlV1.replace(
  '      - element-1',
  '      - element-9',
);

const threatDragonMinimal =
  '{"version":"2.6.2","summary":{"title":"Minimal"},"detail":{"diagrams":[]}}';

const laterMajor = threatDragonMinimal.replace('2.6.2', '3.0.0');

const refusedCell =
  '{"version":"2.6.2","summary":{"title":"Refused"},"detail":{"diagrams":[{"id":0,"title":"Level 0","diagramType":"STRIDE","cells":[{"id":"a","shape":"process","position":{"x":0,"y":0},"size":{"width":10,"height":10},"data":{"type":"tm.Process"}}]}]}}';

const nativeAsJson = JSON.stringify(
  Either.getOrThrow(saerskrivenYamlCodec.read(featureCompleteYaml)).source,
);

const unclaimed: readonly { name: string; text: string }[] = [
  { name: 'prose', text: 'Notes towards a threat model. Nothing formal yet.' },
  { name: 'nothing at all', text: '' },
  { name: 'a JSON object with none of the root keys', text: '{"hello":"you"}' },
  { name: 'a YAML mapping with no formatVersion', text: 'metadata:\n  a: b\n' },
  {
    name: 'another tool stamping a version inside major 2',
    text: '{"version":"2.0","name":"some other tool"}',
  },
  {
    name: 'a version inside major 2 and a summary, but no detail',
    text: '{"version":"2.0","summary":{"title":"Some other tool"}}',
  },
  {
    name: 'a version 2.6.2 document with a detail, but no summary',
    text: '{"version":"2.6.2","detail":{"diagrams":[]}}',
  },
];

const opened = (text: string): DetectedRead =>
  Either.getOrThrow(readAnyFormat(text));

const outcome = (text: string) => Either.merge(readAnyFormat(text));

const refusalOf = (text: string): ReadFailure => {
  const failure = Either.getOrThrow(Either.flip(readAnyFormat(text)));
  if (DetectionFailure.$is('NoFormatClaimed')(failure)) {
    throw new Error(`No format claimed the text: ${failure.tried.join(', ')}`);
  }
  return failure;
};

const issuePaths = (failure: ReadFailure): readonly string[] =>
  readFailureIssues(failure).map((issue) => issue.path.join('.'));

function writtenAsSaerskrivenYaml(answer: DetectedRead): string {
  if (answer.format === 'threat-dragon') {
    return saerskrivenYamlCodec.write(
      answer.model,
      // @ts-expect-error a Threat Dragon document is no Saerskriven YAML document
      answer.source,
    ).output;
  }
  return answer.codec.write(answer.model, answer.source).output;
}

function rewritten(answer: DetectedRead): {
  readonly stamp: string | number;
  readonly output: string;
} {
  if (answer.format === 'threat-dragon') {
    return {
      stamp: answer.source.version,
      output: answer.codec.write(answer.model, answer.source).output,
    };
  }
  return {
    stamp: answer.source.formatVersion,
    output: answer.codec.write(answer.model, answer.source).output,
  };
}

describe('opening a text without being told its format', () => {
  it.each(nativeFixtures)('reads the $name as Saerskriven YAML', ({ text }) => {
    const answer = opened(text);
    expect(answer.format).toBe('saerskriven-yaml');
    expect(answer.codec).toBe(saerskrivenYamlCodec);
  });

  it.each([
    ...corpusTexts,
    { name: 'the feature-complete file', text: featureCompleteText },
  ])('reads $name as Threat Dragon', ({ text }) => {
    const answer = opened(text);
    expect(answer.format).toBe('threat-dragon');
    expect(answer.codec).toBe(threatDragonCodec);
  });

  it('reads a Saerskriven model saved as JSON as Saerskriven YAML', () => {
    expect(opened(nativeAsJson).format).toBe('saerskriven-yaml');
  });

  it('hands back everything the codec that answered produced', () => {
    const answer = opened(featureCompleteYaml);
    expect(answer.model).toEqual(
      Either.getOrThrow(readSaerskrivenYaml(featureCompleteYaml)).model,
    );
    expect(answer.divergences).toEqual([]);
  });
});

describe('a file of one format offered to the other codec', () => {
  it('is not JSON, so the Threat Dragon codec refuses the native file', () => {
    const reading = threatDragonCodec.read(featureCompleteYaml);
    expect(Either.isLeft(reading)).toBe(true);
    expect(Either.merge(reading)).toMatchObject({ _tag: 'MalformedText' });
  });

  it('is JSON all the same, so the Threat Dragon codec refuses it by key', () => {
    const refused = Either.getOrThrow(
      Either.flip(threatDragonCodec.read(nativeAsJson)),
    );
    expect(refused).toMatchObject({ _tag: 'InvalidWireDocument' });
    expect(issuePaths(refused)).toEqual(['version', 'summary', 'detail']);
  });

  it('is YAML, so the Saerskriven codec refuses a Threat Dragon file at its stamp', () => {
    const refused = Either.getOrThrow(
      Either.flip(saerskrivenYamlCodec.read(featureCompleteText)),
    );
    expect(refused).toMatchObject({ _tag: 'InvalidWireDocument' });
    expect(issuePaths(refused)).toContain('formatVersion');
  });
});

describe('a text no codec claims', () => {
  it.each(unclaimed)('names every format tried for $name', ({ text }) => {
    expect(outcome(text)).toEqual(
      DetectionFailure.NoFormatClaimed({
        tried: ['threat-dragon', 'saerskriven-yaml'],
      }),
    );
  });
});

describe('a text past a read limit', () => {
  it('answers with the bound rather than with what detection tried', () => {
    expect(outcome(branchingCycle)).toMatchObject({
      _tag: 'ExceededReadLimit',
      limit: 'maxAliasCount',
    });
  });

  it('stops at the first codec to meet it, offering the text to no other', () => {
    expect(outcome('a'.repeat(readLimits.maxTextBytes + 1))).toMatchObject({
      _tag: 'ExceededReadLimit',
      limit: 'maxTextBytes',
    });
  });
});

describe('a file a codec claimed and then refused', () => {
  it.each([
    {
      name: 'version 1',
      text: danglingReference.replace('    mitigation: ""\n', ''),
      path: 'threats.0.mitigation',
    },
    {
      name: 'version 2',
      text: danglingReference
        .replace('formatVersion: 1', 'formatVersion: 2')
        .replace('    mitigation: ""\n', '')
        .replace('    number: 1', '    number: first'),
      path: 'threats.0.number',
    },
  ])(
    'refuses a Saerskriven $name file broken below formatVersion with a path into the file',
    ({ text, path }) => {
      const failure = refusalOf(text);
      expect(failure).toMatchObject({ _tag: 'InvalidWireDocument' });
      expect(issuePaths(failure)).toContain(path);
    },
  );

  it('reports a dangling reference as the Saerskriven mapping refusing it', () => {
    const failure = refusalOf(danglingReference);
    expect(failure).toMatchObject({ _tag: 'InvalidModel' });
    expect(issuePaths(failure)).toContain('threats.0.elements.0');
  });

  it('reports a cell the wire schema refuses with a path into the file', () => {
    const failure = refusalOf(refusedCell);
    expect(failure).toMatchObject({ _tag: 'InvalidWireDocument' });
    expect(issuePaths(failure)).toContain('detail.diagrams.0.cells.0.id');
  });
});

describe('a file from a release neither codec models', () => {
  it('opens the smallest file of each release they do model', () => {
    expect(opened(threatDragonMinimal).format).toBe('threat-dragon');
    expect(opened(minimalYamlV1).format).toBe('saerskriven-yaml');
    expect(opened(nativeMinimalVersion2).format).toBe('saerskriven-yaml');
  });

  it('claims no Threat Dragon file from a major above 2', () => {
    expect(outcome(laterMajor)).toEqual(
      DetectionFailure.NoFormatClaimed({ tried: formatNameSchema.options }),
    );
  });

  it('claims no Saerskriven file stamped other than 1 or 2', () => {
    expect(outcome(laterFormatVersion)).toEqual(
      DetectionFailure.NoFormatClaimed({ tried: formatNameSchema.options }),
    );
  });
});

describe('the codec the result carries', () => {
  it.each([
    {
      name: 'the Threat Dragon file',
      text: featureCompleteText,
      stamp: '2.6.2',
    },
    { name: 'the native file', text: featureCompleteYaml, stamp: 2 },
  ])('writes $name back as the format that answered', ({ text, stamp }) => {
    const answer = opened(text);
    const written = rewritten(answer);
    expect(written.stamp).toBe(stamp);
    const again = opened(written.output);
    expect(again.format).toBe(answer.format);
    expect(again.model).toEqual(answer.model);
  });

  it('refuses at compile time what nothing refuses at run time', () => {
    expect(
      opened(writtenAsSaerskrivenYaml(opened(featureCompleteText))).format,
    ).toBe('saerskriven-yaml');
  });
});
