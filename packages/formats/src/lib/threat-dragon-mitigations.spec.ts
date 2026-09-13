import type { Mitigation, MitigationStatus, Model } from '@saerskriven/model';
import { parsedFixture } from '@saerskriven/model/fixtures';
import type { ThreatDragonDocument } from '@saerskriven/wire-threat-dragon';
import { Either } from 'effect';
import type { Divergence } from './divergence.js';
import { allThreats } from './threat-dragon-document.js';
import { readThreatDragon } from './threat-dragon-read.js';
import { writeThreatDragon } from './threat-dragon-write.js';
import { mitigationTextFixture } from './threat-dragon.fixtures.js';

const read = Either.getOrThrow(
  readThreatDragon(JSON.stringify(mitigationTextFixture)),
);

const record = (
  id: string,
  threats: readonly string[],
  fields: Partial<Pick<Mitigation, 'title' | 'prose' | 'status'>> = {},
) => ({
  id,
  title: '',
  prose: `The text of ${id}.`,
  status: 'proposed' as MitigationStatus,
  threats,
  ...fields,
});

const withRecords = (
  mitigations: readonly ReturnType<typeof record>[],
  prose: Readonly<Record<string, string>> = {},
): Model =>
  parsedFixture({
    ...read.model,
    threats: read.model.threats.map((threat) => ({
      ...threat,
      mitigation: prose[threat.id] ?? '',
    })),
    mitigations,
  });

const writtenOnto = (model: Model) => {
  const written = writeThreatDragon(model, read.source);
  const document: ThreatDragonDocument = Either.getOrThrow(
    readThreatDragon(written.output),
  ).source;
  return {
    divergences: written.divergences,
    texts: Object.fromEntries(
      allThreats(document).map((threat) => [threat.id, threat.mitigation]),
    ),
    keys: allThreats(document).map((threat) => new Set(Object.keys(threat))),
  };
};

const about = (
  divergences: readonly Divergence[],
  reason: Divergence['reason'],
): string[] =>
  divergences
    .filter((divergence) => divergence.reason === reason)
    .map(({ subject }) =>
      subject.kind === 'model' ? 'model' : `${subject.kind} ${subject.id}`,
    );

describe('writing an unedited read back onto its source', () => {
  const written = writtenOnto(read.model);

  it('keeps every text to the byte', () => {
    expect(written.texts).toEqual(
      Object.fromEntries(
        allThreats(mitigationTextFixture).map((threat) => [
          threat.id,
          threat.mitigation,
        ]),
      ),
    );
  });

  it('reports nothing', () => {
    expect(written.divergences).toEqual([]);
  });
});

describe('flattening the records of a threat into its one text', () => {
  it('writes each title on a line above its prose, a blank line between records', () => {
    const written = writtenOnto(
      withRecords([
        record('mitigation-limit', ['threat-open'], {
          title: 'Rate limit',
          prose: 'At the edge.',
        }),
        record('mitigation-alert', ['threat-open'], {
          title: 'Alert',
          prose: 'On a spike.',
        }),
      ]),
    );
    expect(written.texts['threat-open']).toBe(
      'Rate limit\nAt the edge.\n\nAlert\nOn a spike.',
    );
    expect(about(written.divergences, 'narrowed')).toEqual([
      'threat threat-open',
    ]);
  });

  it('writes the prose field first, a blank line before the record', () => {
    const written = writtenOnto(
      withRecords([record('mitigation-limit', ['threat-open'])], {
        'threat-open': 'Held as prose.',
      }),
    );
    expect(written.texts['threat-open']).toBe(
      'Held as prose.\n\nThe text of mitigation-limit.',
    );
    expect(about(written.divergences, 'narrowed')).toEqual([
      'threat threat-open',
    ]);
  });

  it('writes a lone titled record as its title line and prose, and reports the title narrowed', () => {
    const written = writtenOnto(
      withRecords([
        record('mitigation-limit', ['threat-open'], {
          title: 'Rate limit',
          prose: 'At the edge.',
        }),
      ]),
    );
    expect(written.texts['threat-open']).toBe('Rate limit\nAt the edge.');
    expect(about(written.divergences, 'narrowed')).toEqual([
      'threat threat-open',
    ]);
  });

  it('reports a record with no title and no text once for each threat, and nothing else of it', () => {
    const written = writtenOnto(
      withRecords([
        record('mitigation-empty', ['threat-open', 'threat-mitigated'], {
          prose: '',
        }),
      ]),
    );
    expect([
      written.texts['threat-open'],
      written.texts['threat-mitigated'],
    ]).toEqual(['', '']);
    expect(
      written.divergences.map(({ subject, reason }) => ({ subject, reason })),
    ).toEqual([
      {
        subject: { kind: 'mitigation', id: 'mitigation-empty' },
        reason: 'unrepresentable',
      },
      {
        subject: { kind: 'mitigation', id: 'mitigation-empty' },
        reason: 'unrepresentable',
      },
    ]);
  });

  it('writes a record shared by two threats into both, and reports it split', () => {
    const written = writtenOnto(
      withRecords([
        record('mitigation-shared', ['threat-open', 'threat-empty']),
      ]),
    );
    expect([
      written.texts['threat-open'],
      written.texts['threat-empty'],
    ]).toEqual([
      'The text of mitigation-shared.',
      'The text of mitigation-shared.',
    ]);
    expect(about(written.divergences, 'split')).toEqual([
      'mitigation mitigation-shared',
    ]);
  });
});

describe('a mitigation status the text of a threat cannot hold', () => {
  const written = writtenOnto(
    withRecords([
      record('mitigation-verified', ['threat-open', 'threat-mitigated'], {
        status: 'verified',
      }),
      record('mitigation-implemented-open', ['threat-empty'], {
        status: 'implemented',
      }),
      record('mitigation-proposed-mitigated', ['threat-mitigated'], {
        status: 'proposed',
      }),
      record('mitigation-implemented-mitigated', ['threat-mitigated'], {
        status: 'implemented',
      }),
      record('mitigation-proposed-open', ['threat-open'], {
        status: 'proposed',
      }),
    ]),
  );

  it('is reported once for each threat whose read would give another status', () => {
    expect(
      about(written.divergences, 'unrepresentable').reduce<
        Record<string, number>
      >(
        (counts, subject) => ({
          ...counts,
          [subject]: (counts[subject] ?? 0) + 1,
        }),
        {},
      ),
    ).toEqual({
      'mitigation mitigation-verified': 2,
      'mitigation mitigation-implemented-open': 1,
      'mitigation mitigation-proposed-mitigated': 1,
    });
  });

  it('adds no key to a threat the source did not have', () => {
    expect(written.keys).toEqual(
      allThreats(mitigationTextFixture).map(
        (threat) => new Set(Object.keys(threat)),
      ),
    );
  });
});

describe('a mitigation linked to no threat the file holds', () => {
  it('is reported as having no place in the format', () => {
    const model = withRecords([record('mitigation-kept', ['threat-open'])]);
    const unlinked = {
      ...model,
      mitigations: [{ ...model.mitigations[0], threats: [] }],
    };
    expect(about(writtenOnto(unlinked).divergences, 'unrepresentable')).toEqual(
      ['mitigation mitigation-kept'],
    );
  });
});
