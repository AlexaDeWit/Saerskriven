import { diagramIdSchema, inNumberOrder, type Model } from '@saerskriven/model';
import type { ThreatDragonDocument } from '@saerskriven/wire-threat-dragon';
import { Ajv } from 'ajv';
import { Either } from 'effect';
import type { Divergence } from './divergence.js';
import { indexById } from './threat-dragon-document.js';
import { readThreatDragon } from './threat-dragon-read.js';
import { writeThreatDragon } from './threat-dragon-write.js';
import {
  allThreats,
  corpusTexts,
  featureCompleteText,
  threatDragonJsonSchema,
} from './threat-dragon.fixtures.js';

const writtenVersion = '2.6.2';

const validate = new Ajv({ allowUnionTypes: true }).compile(
  threatDragonJsonSchema,
);

const readings = corpusTexts.map((file) => ({
  name: file.name,
  result: readThreatDragon(file.text),
}));

const refused = readings.filter((reading) => Either.isLeft(reading.result));

const diverged = readings.flatMap((reading) =>
  Either.isRight(reading.result)
    ? reading.result.right.divergences.map(
        (divergence) =>
          `${reading.name}: ${divergence.detail} (${divergence.reason})`,
      )
    : [],
);

const roundTrip = (file: { name: string; text: string }) => {
  const read = Either.getOrThrowWith(
    readThreatDragon(file.text),
    () => new Error(`The corpus file ${file.name} no longer reads.`),
  );
  const written = writeThreatDragon(read.model, read.source);
  const reread = readThreatDragon(written.output);
  return {
    name: file.name,
    source: read.source,
    model: read.model,
    written,
    before: JSON.parse(file.text) as unknown,
    after: JSON.parse(written.output) as unknown,
    document: Either.getOrThrowWith(
      reread,
      () => new Error(`The write of ${file.name} no longer reads back.`),
    ).source,
    reread,
  };
};

const featureCompleteName = 'threat-dragon/feature-complete.json';

const roundTrips = [
  ...corpusTexts,
  { name: featureCompleteName, text: featureCompleteText },
].map(roundTrip);

const textsOf = (document: ThreatDragonDocument) =>
  allThreats(document).map((threat) => threat.mitigation);

const firstTexts = (document: ThreatDragonDocument, model: Model) => {
  const held = indexById(allThreats(document));
  return inNumberOrder(model.threats).flatMap(({ id }) => {
    const text = held.get(id)?.mitigation ?? '';
    return text === '' ? [] : [{ threats: [id], prose: text }];
  });
};

const scalarsOf = (
  value: unknown,
  path: string,
  into: Map<string, unknown>,
): ReadonlyMap<string, unknown> => {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scalarsOf(entry, `${path}.${index}`, into));
  } else if (typeof value === 'object' && value !== null) {
    for (const [key, held] of Object.entries(value)) {
      scalarsOf(held, path === '' ? key : `${path}.${key}`, into);
    }
  } else {
    into.set(path, value);
  }
  return into;
};

const moved = (before: unknown, after: unknown): ReadonlySet<string> => {
  const written = scalarsOf(after, '', new Map());
  return new Set(
    [...scalarsOf(before, '', new Map())]
      .filter(([path, value]) => written.get(path) !== value)
      .map(([path]) => path),
  );
};

const released = (
  from: string,
  subject: Divergence['subject'],
): Divergence => ({
  subject,
  detail: `the release "${from}" the source was written by, for the ${writtenVersion} this codec writes`,
  reason: 'overridden',
});

const stamps = (
  source: ThreatDragonDocument,
  after: ThreatDragonDocument,
): readonly { path: string; divergence: Divergence }[] => [
  ...(source.version === writtenVersion
    ? []
    : [
        {
          path: 'version',
          divergence: released(source.version, { kind: 'model' }),
        },
      ]),
  ...(allThreats(source).some((threat) => threat.number === undefined)
    ? [
        {
          path: 'detail.threatTop',
          divergence: {
            subject: { kind: 'model' as const },
            detail: `the threat high-water mark ${source.detail.threatTop}, raised to ${after.detail.threatTop} to cover a number this write issued`,
            reason: 'overridden' as const,
          },
        },
      ]
    : []),
  ...source.detail.diagrams.flatMap((diagram, index) =>
    diagram.version === undefined || diagram.version === writtenVersion
      ? []
      : [
          {
            path: `detail.diagrams.${index}.version`,
            divergence: released(diagram.version, {
              kind: 'diagram' as const,
              id: diagramIdSchema.parse(String(diagram.id)),
            }),
          },
        ],
  ),
];

const stampedPaths = (
  source: ThreatDragonDocument,
  after: ThreatDragonDocument,
): ReadonlySet<string> =>
  new Set(stamps(source, after).map((held) => held.path));

describe('every Threat Dragon file the repository vendors', () => {
  it('is the corpus the codec claims to read', () => {
    expect(corpusTexts).toHaveLength(12);
  });

  it('reads, so the codec refuses none of the format its author ships', () => {
    expect(refused.map((reading) => reading.name)).toEqual([]);
  });

  it('reads whole: no key undeclared, no value held less exactly', () => {
    expect(diverged).toEqual([]);
  });
});

describe('writing every vendored file back onto its own document', () => {
  it.each(roundTrips)(
    'moves no scalar of $name but the stamp this codec writes',
    ({ source, document, before, after }) => {
      expect(moved(before, after)).toEqual(stampedPaths(source, document));
    },
  );

  it.each(roundTrips)(
    'names every scalar it moved in $name, and claims nothing besides',
    ({ source, document, written }) => {
      expect(written.divergences).toEqual(
        stamps(source, document).map((held) => held.divergence),
      );
    },
  );

  it.each(roundTrips)(
    'reads $name back as the model it was written from',
    ({ model, reread }) => {
      expect(Either.isRight(reread) && reread.right.model).toEqual(model);
    },
  );

  it.each(roundTrips)(
    'leaves $name a file Threat Dragon still validates as its own',
    ({ after }) => {
      expect({ valid: validate(after), errors: validate.errors }).toEqual({
        valid: true,
        errors: null,
      });
    },
  );
});

describe('the feature-complete file, stamped with the release this codec writes', () => {
  it('comes back with every scalar it went in with, and no stamp moved', () => {
    const trip = roundTrips.find(({ name }) => name === featureCompleteName);
    expect(trip).toBeDefined();
    if (trip === undefined) return;
    expect(moved(trip.before, trip.after)).toEqual(new Set());
    expect(stamps(trip.source, trip.document)).toEqual([]);
  });
});

describe('the mitigation text of every vendored file and the feature-complete file', () => {
  it.each(roundTrips)(
    'reads each text of $name as one record of its threat alone, in threat number order',
    ({ source, model }) => {
      expect(
        model.mitigations.map(({ threats, prose }) => ({ threats, prose })),
      ).toEqual(firstTexts(source, model));
    },
  );

  it('reads the 56 records the texts of those files make', () => {
    expect(
      roundTrips.reduce(
        (total, { model }) => total + model.mitigations.length,
        0,
      ),
    ).toBe(56);
  });

  it.each(roundTrips)(
    'writes every text of $name back to the byte',
    ({ source, document }) => {
      expect(textsOf(document)).toEqual(textsOf(source));
    },
  );

  it.each(roundTrips)(
    'reports nothing of a mitigation written back onto $name',
    ({ written }) => {
      expect(
        written.divergences.filter(
          ({ subject, reason }) =>
            subject.kind === 'mitigation' ||
            (subject.kind === 'threat' && reason === 'narrowed'),
        ),
      ).toEqual([]);
    },
  );
});
