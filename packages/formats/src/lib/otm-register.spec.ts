import { Either } from 'effect';
import { importModel } from './import.js';
import { otmFixture } from './import.fixtures.js';

it('turns a mitigation definition no occurrence names into one description line and one report line', () => {
  const baseline = otmFixture();
  baseline.mitigations = baseline.mitigations?.slice(0, 1);
  const document = otmFixture();
  document.mitigations = [
    ...(baseline.mitigations ?? []),
    {
      id: 'unattached-mitigation',
      name: 'Unattached work',
      description: 'Work no occurrence names.',
      riskReduction: 0,
    },
  ];
  const before = Either.getOrThrow(importModel(JSON.stringify(baseline)));
  const read = Either.getOrThrow(importModel(JSON.stringify(document)));
  expect(read.model.mitigations).toEqual(before.model.mitigations);
  const paragraphs = read.model.metadata.description.split('\n\n');
  expect(paragraphs).toHaveLength(
    before.model.metadata.description.split('\n\n').length + 1,
  );
  expect(paragraphs.at(-1)).toContain('Unattached work');
  expect(paragraphs.at(-1)).toContain('Work no occurrence names.');
  expect(
    read.divergences.filter(
      (entry) =>
        entry.detail.code === 'otm-mitigation-unlinked' &&
        entry.detail.parameters.id === 'unattached-mitigation',
    ),
  ).toHaveLength(1);
});

it.each([
  ['no', undefined],
  ['an empty', ''],
] as const)(
  'writes only the name of an unattached mitigation definition with %s description',
  (_, description) => {
    const document = otmFixture();
    document.mitigations = [
      ...(document.mitigations?.slice(0, 1) ?? []),
      {
        id: 'unattached-mitigation',
        name: 'Unattached work',
        riskReduction: 0,
        ...(description === undefined ? {} : { description }),
      },
    ];
    const read = Either.getOrThrow(importModel(JSON.stringify(document)));
    expect(
      read.model.mitigations.some(({ title }) => title === 'Unattached work'),
    ).toBe(false);
    const line = read.model.metadata.description.split('\n\n').at(-1);
    expect(line?.endsWith('Unattached work')).toBe(true);
    expect(
      read.divergences.filter(
        (entry) =>
          entry.detail.code === 'otm-mitigation-unlinked' &&
          entry.detail.parameters.id === 'unattached-mitigation',
      ),
    ).toHaveLength(1);
  },
);

it('reports a mitigation reference with no mitigation only by the fields that hold a value', () => {
  const document = otmFixture();
  document.components?.[1].threats?.[0].mitigations?.push(
    { mitigation: null, state: null },
    { mitigation: null, state: 'implemented' },
  );
  const before = Either.getOrThrow(importModel(JSON.stringify(otmFixture())));
  const read = Either.getOrThrow(importModel(JSON.stringify(document)));
  expect(read.model.mitigations).toEqual(before.model.mitigations);
  expect(read.divergences).toHaveLength(before.divergences.length + 1);
  expect(read.divergences).toEqual(
    expect.arrayContaining([
      ...before.divergences,
      {
        subject: { kind: 'model' },
        detail: {
          code: 'field-not-retained',
          parameters: {
            path: [
              'components',
              '1',
              'threats',
              '0',
              'mitigations',
              '2',
              'state',
            ],
          },
        },
        reason: 'unrepresentable',
      },
    ]),
  );
});
