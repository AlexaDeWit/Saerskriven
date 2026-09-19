import type { TmbomDocument } from '@saerskriven/wire-tmbom';
import { Either } from 'effect';
import { importModel } from './import.js';
import { importTexts, tmbomFixture } from './import.fixtures.js';
import { saerskrivenYamlCodec } from './saerskriven-yaml.js';

const imported = (document: TmbomDocument) =>
  Either.getOrThrow(importModel(JSON.stringify(document)));

const paragraphs = (description: string) => description.split('\n\n');

const control = (
  document: TmbomDocument,
  changes: Partial<NonNullable<TmbomDocument['controls']>[number]>,
) => {
  const first = document.controls?.[0];
  if (first === undefined) throw new Error('The fixture lacks a control');
  return { ...first, ...changes };
};

it('imports every assumption of the example as one that applies to the model, and keeps that through a save', () => {
  const source = tmbomFixture().assumptions ?? [];
  const read = Either.getOrThrow(importModel(importTexts.tmbom));
  expect(
    read.model.assumptions.map(({ status, threats, appliesToModel }) => ({
      status,
      threats,
      appliesToModel,
    })),
  ).toEqual(
    ['valid', 'valid', 'unconfirmed', 'valid', 'unconfirmed'].map((status) => ({
      status,
      threats: [],
      appliesToModel: true,
    })),
  );
  for (const { description } of source)
    expect(read.model.metadata.description).not.toContain(description);
  const written = saerskrivenYamlCodec.write(read.model);
  const reread = Either.getOrThrow(saerskrivenYamlCodec.read(written.output));
  expect(
    reread.model.assumptions.every((assumption) => assumption.appliesToModel),
  ).toBe(true);
});

it('maps each assumption validity onto its status and keeps the description as prose', () => {
  const document = tmbomFixture();
  document.assumptions = [
    { description: 'The queue is durable.', validity: 'confirmed' },
    { description: 'Every client authenticates.', validity: 'rejected' },
    {
      description: 'The worker may retry.',
      validity: 'unconfirmed',
      topics: ['retries'],
    },
  ];
  const read = imported(document);
  expect(
    read.model.assumptions.map(
      ({ prose, status, threats, appliesToModel }) => ({
        prose,
        status,
        threats,
        appliesToModel,
      }),
    ),
  ).toEqual([
    {
      prose: 'The queue is durable.',
      status: 'valid',
      threats: [],
      appliesToModel: true,
    },
    {
      prose: 'Every client authenticates.',
      status: 'invalidated',
      threats: [],
      appliesToModel: true,
    },
    {
      prose: 'The worker may retry.',
      status: 'unconfirmed',
      threats: [],
      appliesToModel: true,
    },
  ]);
  expect(
    read.divergences.some(
      (entry) =>
        entry.reason === 'unrepresentable' &&
        entry.detail.code === 'field-not-retained' &&
        entry.detail.parameters.path.includes('topics'),
    ),
  ).toBe(true);
});

it('drops the Trigger line from a threat description when the event is empty, leaving no separator behind', () => {
  const document = tmbomFixture();
  const first = document.threats?.[0];
  if (first === undefined) throw new Error('The fixture lacks a threat');
  document.threats = [
    { ...first, event: '' },
    ...(document.threats?.slice(1) ?? []),
  ];
  const read = imported(document);
  expect(read.model.threats[0].description).toBe(first.description);
});

it('imports active and pending controls naming a threat as linked records, without reviving retired or declined work', () => {
  const document = tmbomFixture();
  document.controls = [
    control(document, {
      symbolic_name: 'active-control',
      title: 'Active work',
      status: 'active',
    }),
    control(document, {
      symbolic_name: 'retired-control',
      title: 'Retired work',
      status: 'retired',
    }),
    control(document, {
      symbolic_name: 'declined-control',
      title: 'Declined work',
      status: 'wont_do',
    }),
    control(document, {
      symbolic_name: 'pending-control',
      title: 'Pending work',
      status: 'under_review',
    }),
  ];
  const read = imported(document);
  expect(
    read.model.mitigations.map((mitigation) => [
      mitigation.title,
      mitigation.status,
      mitigation.threats.length,
    ]),
  ).toEqual([
    ['Active work', 'implemented', 1],
    ['Pending work', 'proposed', 1],
  ]);
  expect(read.model.mitigations[1].prose).toContain('under_review');
  expect(
    ['active-control', 'pending-control'].map(
      (name) =>
        read.divergences.filter(
          (entry) =>
            entry.detail.code === 'tmbom-control-proposed' &&
            entry.detail.parameters.name === name,
        ).length,
    ),
  ).toEqual([0, 1]);
});

it.each([
  ['active', 'implemented'],
  ['under_review', 'proposed'],
] as const)(
  'turns a %s control naming no threat into one %s description line and one report line',
  (status, mapped) => {
    const baseline = tmbomFixture();
    baseline.controls = [];
    const document = tmbomFixture();
    document.controls = [
      control(document, {
        symbolic_name: 'unlinked-control',
        title: 'Unlinked work',
        description: 'Work on no threat.',
        status,
        threats: [],
      }),
    ];
    const read = imported(document);
    const before = paragraphs(imported(baseline).model.metadata.description);
    const after = paragraphs(read.model.metadata.description);
    expect(read.model.mitigations).toEqual([]);
    expect(after).toHaveLength(before.length + 1);
    const line = after.at(-1);
    expect(line).toContain('Unlinked work');
    expect(line).toContain('Work on no threat.');
    expect(line).toContain(mapped);
    expect(
      read.divergences.filter(
        (entry) =>
          entry.detail.code === 'tmbom-control-unlinked' &&
          entry.detail.parameters.name === 'unlinked-control',
      ),
    ).toHaveLength(1);
  },
);

it('ends an unlinked control line with an empty description after its status, with no trailing separator', () => {
  const baseline = tmbomFixture();
  baseline.controls = [];
  const document = tmbomFixture();
  document.controls = [
    control(document, {
      symbolic_name: 'unlinked-control',
      title: 'Unlinked work',
      description: '',
      status: 'active',
      threats: [],
    }),
  ];
  const read = imported(document);
  const before = paragraphs(imported(baseline).model.metadata.description);
  const after = paragraphs(read.model.metadata.description);
  expect(after).toHaveLength(before.length + 1);
  expect(after.at(-1)).toBe(
    'Mitigation: Unlinked work (implemented, source status active).',
  );
});

it('opens an unlinked control line with the bare word Mitigation when the title is empty, with no colon beside it', () => {
  const baseline = tmbomFixture();
  baseline.controls = [];
  const document = tmbomFixture();
  document.controls = [
    control(document, {
      symbolic_name: 'unlinked-control',
      title: '',
      description: 'Work on no threat.',
      status: 'active',
      threats: [],
    }),
  ];
  const read = imported(document);
  const before = paragraphs(imported(baseline).model.metadata.description);
  const after = paragraphs(read.model.metadata.description);
  expect(after).toHaveLength(before.length + 1);
  expect(after.at(-1)).toBe(
    'Mitigation (implemented, source status active). Work on no threat.',
  );
});

it.each(['retired', 'wont_do'] as const)(
  'reports a %s control naming no threat as an omission and writes no description line',
  (status) => {
    const baseline = tmbomFixture();
    baseline.controls = [];
    const document = tmbomFixture();
    document.controls = [
      control(document, {
        symbolic_name: 'unlinked-control',
        title: 'Unlinked work',
        status,
        threats: [],
      }),
    ];
    const read = imported(document);
    expect(read.model.mitigations).toEqual([]);
    expect(read.model.metadata.description).toBe(
      imported(baseline).model.metadata.description,
    );
    expect(
      read.divergences.some(
        (entry) =>
          entry.reason === 'unrepresentable' &&
          entry.detail.code === 'field-not-retained' &&
          entry.detail.parameters.path[0] === 'controls' &&
          entry.detail.parameters.path[1] === '0',
      ),
    ).toBe(true);
  },
);
