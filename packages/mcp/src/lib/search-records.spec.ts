import {
  answerOf,
  crowdedRecords,
  crowdedRecordsTree,
  forgedIdsTree,
  forgedLinesIn,
  recordLinksTree,
  refusalOf,
} from './read-tools.fixtures.js';
import { renderRecordSearch, searchRecords } from './search-records.js';

const workspace = recordLinksTree();

const search = (args: Parameters<typeof searchRecords>[1]) =>
  answerOf(searchRecords(workspace, args));

const idsOf = (args: Parameters<typeof searchRecords>[1]) =>
  search(args).records.map(({ kind, id }) => `${kind} ${id}`);

const forgedIn = (format: 'concise' | 'detailed') =>
  forgedLinesIn(
    renderRecordSearch(
      answerOf(searchRecords(forgedIdsTree(), { response_format: format })),
    ),
  );

const linkedToTheThreat = [
  'mitigation mitigation-tls',
  'assumption assumption-managed-db',
  'assumption assumption-reviewed',
];

const linkedToNothing = [
  'mitigation mitigation-rotate-keys',
  'assumption assumption-staging-wiped',
];

const marked = (format: 'concise' | 'detailed') =>
  search({ response_format: format })
    .records.filter(({ unlinked }) => unlinked)
    .map(({ kind, id }) => `${kind} ${id}`);

describe('what saer_search_records finds', () => {
  it('matches every record, those linked to nothing included, mitigations first', () => {
    expect(idsOf({ response_format: 'concise' })).toEqual([
      'mitigation mitigation-tls',
      'mitigation mitigation-rotate-keys',
      'assumption assumption-managed-db',
      'assumption assumption-reviewed',
      'assumption assumption-hand-written',
      'assumption assumption-staging-wiped',
    ]);
  });

  it('keeps only the kind a call names', () => {
    expect(idsOf({ kind: 'mitigation', response_format: 'concise' })).toEqual([
      'mitigation mitigation-tls',
      'mitigation mitigation-rotate-keys',
    ]);
  });

  it('keeps only the id a call names, and matches nothing for an id no record carries', () => {
    expect(
      idsOf({ id: 'assumption-reviewed', response_format: 'concise' }),
    ).toEqual(['assumption assumption-reviewed']);
    expect(idsOf({ id: 'no-such-record', response_format: 'concise' })).toEqual(
      [],
    );
  });

  it('keeps only the status a call names', () => {
    expect(
      idsOf({ status: 'invalidated', response_format: 'concise' }),
    ).toEqual(['assumption assumption-staging-wiped']);
  });

  it('keeps the records linked to the threat a call names, by id or by number', () => {
    expect(
      idsOf({ threat: 'threat-tamper-order', response_format: 'concise' }),
    ).toEqual(linkedToTheThreat);
    expect(idsOf({ threat: '1', response_format: 'concise' })).toEqual(
      linkedToTheThreat,
    );
  });

  it('refuses a threat the model does not hold', () => {
    expect(
      refusalOf(
        searchRecords(workspace, {
          threat: '9999',
          response_format: 'concise',
        }),
      )[0],
    ).toContain('holds no threat "9999"');
  });

  it('keeps only the records linked to nothing, or only the others', () => {
    expect(idsOf({ unlinked: true, response_format: 'concise' })).toEqual(
      linkedToNothing,
    );
    expect(idsOf({ unlinked: false, response_format: 'concise' })).toEqual([
      ...linkedToTheThreat,
      'assumption assumption-hand-written',
    ]);
  });

  it('marks the records linked to nothing in every row, in both forms', () => {
    expect({
      concise: marked('concise'),
      detailed: marked('detailed'),
    }).toEqual({ concise: linkedToNothing, detailed: linkedToNothing });
  });

  it('looks for its query in the title and the prose of each record', () => {
    expect(idsOf({ query: 'SIGNING', response_format: 'concise' })).toEqual([
      'mitigation mitigation-rotate-keys',
    ]);
    expect(
      idsOf({ query: 'pin the certificate', response_format: 'concise' }),
    ).toEqual(['mitigation mitigation-tls']);
    expect(idsOf({ query: 'by hand', response_format: 'concise' })).toEqual([
      'assumption assumption-hand-written',
    ]);
  });
});

const proseOf = (format: 'concise' | 'detailed') =>
  search({ threat: '1', response_format: format }).records.map(
    ({ kind, prose }) => `${kind} ${prose ?? 'none'}`,
  );

describe('the text of a record search', () => {
  it('names each record, its text, its links, and the records linked to nothing', () => {
    const found = search({ response_format: 'concise' });
    expect(renderRecordSearch(found)).toEqual([
      'file: model.yaml',
      'format: saerskriven-yaml',
      `revision: ${found.revision}`,
      'matches: 6',
      'records:',
      '  mitigation "mitigation-tls" (proposed): TLS on the order flow',
      '    threats: "threat-tamper-order"',
      '  mitigation "mitigation-rotate-keys" (implemented, linked to nothing): Rotate the signing keys',
      '    threats: none',
      '  assumption "assumption-managed-db" (valid): The order database encrypts its disks.',
      '    threats: "threat-tamper-order"',
      '  assumption "assumption-reviewed" (valid, applies to the model): The order database encrypts its disks.',
      '    threats: "threat-tamper-order"',
      '  assumption "assumption-hand-written" (valid, applies to the model): This model is kept true by hand.',
      '    threats: none',
      '  assumption "assumption-staging-wiped" (invalidated, linked to nothing): The staging copy is wiped every night.',
      '    threats: none',
    ]);
  });

  it('adds the prose of each mitigation beneath its labels where detail is asked for', () => {
    const found = search({ response_format: 'detailed' });
    expect(renderRecordSearch(found).slice(3)).toEqual([
      'matches: 6',
      'records:',
      '  mitigation "mitigation-tls" (proposed): TLS on the order flow',
      '    threats: "threat-tamper-order"',
      '      Terminate TLS at the perimeter and pin the certificate.',
      '  mitigation "mitigation-rotate-keys" (implemented, linked to nothing): Rotate the signing keys',
      '    threats: none',
      '  assumption "assumption-managed-db" (valid): The order database encrypts its disks.',
      '    threats: "threat-tamper-order"',
      '  assumption "assumption-reviewed" (valid, applies to the model): The order database encrypts its disks.',
      '    threats: "threat-tamper-order"',
      '  assumption "assumption-hand-written" (valid, applies to the model): This model is kept true by hand.',
      '    threats: none',
      '  assumption "assumption-staging-wiped" (invalidated, linked to nothing): The staging copy is wiped every night.',
      '    threats: none',
    ]);
  });

  it("leaves a mitigation's prose out of a concise row and keeps an assumption's", () => {
    expect({
      concise: proseOf('concise'),
      detailed: proseOf('detailed'),
    }).toEqual({
      concise: [
        'mitigation none',
        'assumption The order database encrypts its disks.',
        'assumption The order database encrypts its disks.',
      ],
      detailed: [
        'mitigation Terminate TLS at the perimeter and pin the certificate.',
        'assumption The order database encrypts its disks.',
        'assumption The order database encrypts its disks.',
      ],
    });
  });

  it('forges no line out of a threat id, a title or prose carrying a line feed, in either form', () => {
    expect({
      concise: forgedIn('concise'),
      detailed: forgedIn('detailed'),
    }).toEqual({ concise: [], detailed: [] });
  });
});

describe('a record listing past its limit', () => {
  const crowded = answerOf(
    searchRecords(crowdedRecordsTree(), { response_format: 'concise' }),
  );

  it('carries the rest of the listing from the offset it names', () => {
    const next = answerOf(
      searchRecords(crowdedRecordsTree(), {
        response_format: 'concise',
        offset: crowded.counts.nextOffset,
      }),
    );
    const numbered = Array.from({ length: crowdedRecords }, (unused, index) =>
      String(index + 1),
    );
    expect([...crowded.records, ...next.records].map(({ id }) => id)).toEqual([
      ...numbered.map((number) => `mitigation-${number}`),
      ...numbered.map((number) => `assumption-${number}`),
    ]);
    expect({
      first: crowded.counts.nextOffset,
      next: next.counts.nextOffset,
    }).toEqual({ first: crowded.records.length, next: undefined });
  });

  it('names the offset of its next page and the arguments that narrow it', () => {
    const steering = renderRecordSearch(crowded).join('\n');
    expect(steering).toContain('`offset` 50 for the next page');
    expect(steering).toContain('Narrow it with `kind`');
  });
});
