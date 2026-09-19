import type { Model } from '@saerskriven/model';
import { committedText } from '@saerskriven/model/fixtures';
import { otmWireSchema } from '@saerskriven/wire-otm';
import { tmbomWireSchema } from '@saerskriven/wire-tmbom';
import { Either } from 'effect';
import { stringify } from 'yaml';
import { divergenceDetailText } from './divergence-detail.js';
import type { Divergence } from './divergence.js';
import { importModel } from './import.js';
import {
  importCorpus,
  importTexts,
  otmFeatureComplete,
  otmFixture,
  tmbomFeatureComplete,
  tmbomFixture,
  tmbomScopeVariants,
} from './import.fixtures.js';
import { readLimits } from './read-limits.js';
import { saerskrivenYamlCodec } from './saerskriven-yaml.js';
import { unusedConstructs } from './wire-coverage.fixtures.js';

it.each(['otm', 'tmbom'] as const)(
  'imports the upstream %s graph into a native file in JSON or YAML syntax',
  (format) => {
    const imported = Either.getOrThrowWith(
      importModel(importTexts[format]),
      (failure) => new Error(JSON.stringify(failure)),
    );
    const yaml = stringify(JSON.parse(importTexts[format]) as unknown);
    expect(Either.getOrThrow(importModel(yaml))).toEqual(imported);
    expect(imported.format).toBe(format);
    expect(
      imported.model.diagrams[0].elements.filter(
        (element) => element.kind === 'flow',
      ),
    ).toHaveLength(format === 'otm' ? 2 : 9);
    expect(imported.model.threats).toHaveLength(format === 'otm' ? 2 : 27);
    expect(imported.model.mitigations.length).toBeGreaterThan(0);
    expect(imported).not.toHaveProperty('source');
    const written = saerskrivenYamlCodec.write(imported.model);
    expect(written.divergences).toEqual([]);
    expect(
      Either.getOrThrow(saerskrivenYamlCodec.read(written.output)).model,
    ).toEqual(imported.model);
    expect(imported.divergences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: 'unrepresentable' }),
      ]),
    );
  },
);

it('places an OTM component the diagram representation misses on the shared grid', () => {
  const read = Either.getOrThrow(importModel(importTexts.otm));
  const placed = read.model.diagrams[0].elements.find(
    (element) => element.name === 'Class CustomerDatabase',
  );
  expect(placed).toMatchObject({ position: { x: 840, y: 60 } });
  expect(
    read.divergences.filter(
      (entry) =>
        entry.reason === 'overridden' &&
        entry.detail.code === 'otm-geometry-generated' &&
        entry.detail.parameters.id === 'class-customerdatabase',
    ),
  ).toHaveLength(1);
});

it('places TM-BOM nodes on the same grid, offset by their trust-zone band', () => {
  const read = Either.getOrThrow(importModel(importTexts.tmbom));
  const placed = read.model.diagrams[0].elements.find((element) =>
    element.name.startsWith('Host Filesystem'),
  );
  expect(placed).toMatchObject({ position: { x: 320, y: 920 } });
});

it('keeps differing OTM occurrence states, bidirectional flows, and asset names', () => {
  const document = otmFixture();
  const component = document.components?.find(
    (entry) => (entry.threats?.length ?? 0) > 0,
  );
  const occurrence = component?.threats?.[0];
  expect(occurrence).toBeDefined();
  if (occurrence === undefined) return;
  occurrence.state = 'mitigated';
  const oneWay = document.dataflows?.[0];
  expect(oneWay).toBeDefined();
  if (oneWay === undefined) return;
  delete oneWay.bidirectional;
  const read = Either.getOrThrow(importModel(JSON.stringify(document)));
  expect(read.model.threats.map((threat) => threat.status)).toEqual([
    'mitigated',
    'open',
  ]);
  expect(read.model.threats.map((threat) => threat.elements.length)).toEqual([
    1, 1,
  ]);
  expect(
    read.model.mitigations.slice(0, 2).map((mitigation) => mitigation.status),
  ).toEqual(['implemented', 'proposed']);
  expect(
    read.model.diagrams[0].elements
      .filter((element) => element.kind === 'flow')
      .some((flow) => flow.description.includes('Credit')),
  ).toBe(true);
  expect(
    read.model.diagrams[0].elements.flatMap((element) =>
      element.kind === 'flow' ? [element.bidirectional] : [],
    ),
  ).toEqual([false, true]);
  expect(
    read.divergences.filter((entry) => entry.reason === 'split'),
  ).toHaveLength(2);
});

it('reports undeclared fields and does not turn OTM numeric impact into a severity score', () => {
  const document = otmFixture();
  const read = Either.getOrThrow(
    importModel(
      JSON.stringify({ ...document, futureField: 'retained nowhere' }),
    ),
  );
  expect(
    read.model.threats.every((threat) => threat.severity === 'undecided'),
  ).toBe(true);
  expect(read.divergences).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        reason: 'undeclared',
        detail: { code: 'key-undeclared', parameters: { path: 'futureField' } },
      }),
    ]),
  );
  expect(
    read.divergences.some(
      (entry) =>
        entry.detail.code === 'field-not-retained' &&
        entry.detail.parameters.path.includes('risk'),
    ),
  ).toBe(true);
});

it('validates the different TM-BOM 1.0.2 requirements', () => {
  const document = tmbomFixture();
  const newer = {
    ...document,
    $schema:
      'https://github.com/OWASP/www-project-threat-model-library/blob/v1.0.2/threat-model.schema.json',
    actors: document.actors.map((actor) => ({
      ...actor,
      trust_zone: document.trust_zones[0].symbolic_name,
    })),
    data_stores: document.data_stores.map((store) => ({
      ...store,
      trust_zone: document.trust_zones[0].symbolic_name,
    })),
    risks: [],
  };
  expect(Either.isRight(importModel(JSON.stringify(newer)))).toBe(true);
  expect(
    Either.isLeft(
      importModel(
        JSON.stringify({
          ...newer,
          actors: newer.actors.map(({ trust_zone: _zone, ...actor }) => actor),
        }),
      ),
    ),
  ).toBe(true);
});

it.each(['duplicate', 'dangling'] as const)(
  'refuses %s OTM graph references',
  (kind) => {
    const document = otmFixture();
    if (kind === 'duplicate') document.components?.push(document.components[0]);
    else if (document.dataflows?.[0] !== undefined)
      document.dataflows[0].source = 'absent';
    expect(importModel(JSON.stringify(document))).toMatchObject({
      _tag: 'Left',
      left: { _tag: 'InvalidWireDocument' },
    });
  },
);

it('refuses unknown TM-BOM endpoint types and dangling threat targets', () => {
  const document = tmbomFixture();
  document.data_flows[0].source.type = 'unsupported';
  expect(importModel(JSON.stringify(document))).toMatchObject({
    _tag: 'Left',
    left: { _tag: 'InvalidWireDocument' },
  });
  const dangling = tmbomFixture();
  if (dangling.threats?.[0] !== undefined)
    dangling.threats[0].components_affected = ['absent'];
  expect(Either.isLeft(importModel(JSON.stringify(dangling)))).toBe(true);
});

it.each(['0.3.0', '1.0.0'])(
  'refuses unadopted OTM version %s',
  (otmVersion) => {
    expect(
      Either.isLeft(
        importModel(JSON.stringify({ ...otmFixture(), otmVersion })),
      ),
    ).toBe(true);
  },
);

it('enforces the existing size, depth, and alias limits on imports', () => {
  for (const text of [
    ' '.repeat(readLimits.maxTextBytes + 1),
    '['.repeat(100) + '0' + ']'.repeat(100),
    'a: &a [*a]',
  ]) {
    expect(importModel(text)).toMatchObject({
      _tag: 'Left',
      left: { _tag: 'ExceededReadLimit' },
    });
  }
  expect(importModel('otmVersion: [')).toMatchObject({
    _tag: 'Left',
    left: { _tag: 'MalformedText' },
  });
});

it('rejects the upstream Vault example with dangling trust-zone references', () => {
  const text = committedText('tmbom/vault-invalid-zones.json');
  const result = importModel(text);
  expect(result).toMatchObject({
    _tag: 'Left',
    left: { _tag: 'InvalidWireDocument' },
  });
  const messages = Either.match(result, {
    onLeft: (failure) =>
      failure._tag === 'InvalidWireDocument'
        ? failure.issues.map((issue) => issue.message)
        : [],
    onRight: () => [],
  });
  expect(messages).toContain('Unknown trust zone "public-internet"');
});

it('identifies an unsupported import before reporting schema fields', () => {
  expect(importModel('An unrelated document')).toMatchObject({
    _tag: 'Left',
    left: {
      _tag: 'InvalidWireDocument',
      issues: [{ code: 'invalid_format', path: [] }],
    },
  });
});

it.each(['assets', 'threats', 'mitigations'] as const)(
  'bounds OTM %s reference expansion before producing a native model',
  (kind) => {
    const document = otmFixture();
    const repeated = 'x'.repeat(65_536);
    const component = document.components?.[0];
    const asset = document.assets?.[0];
    const threat = document.threats?.[0];
    const mitigation = document.mitigations?.[0];
    if (
      component === undefined ||
      asset === undefined ||
      threat === undefined ||
      mitigation === undefined
    )
      throw new Error('The upstream fixture lacks its referenced records');
    if (kind === 'assets') {
      asset.name = repeated;
      component.assets = {
        processed: Array.from({ length: 512 }, () => asset.id),
      };
    } else {
      if (kind === 'threats') threat.name = repeated;
      else mitigation.name = repeated;
      component.threats = Array.from({ length: 512 }, () => ({
        threat: threat.id,
        state: 'exposed',
        mitigations: [{ mitigation: mitigation.id, state: 'required' }],
      }));
    }
    const text = JSON.stringify(document);
    expect(text.length).toBeLessThan(readLimits.maxTextBytes);
    expect(importModel(text)).toMatchObject({
      _tag: 'Left',
      left: { _tag: 'ExceededReadLimit', limit: 'maxImportTextUnits' },
    });
  },
);

it('bounds TM-BOM data-placement expansion before joining store descriptions', () => {
  const document = tmbomFixture();
  document.data_sets = [
    {
      symbolic_name: 'repeated-data',
      title: 'x'.repeat(65_536),
      description: 'Data in the store',
      data_sensitivity: ['cred'],
      placements: Array.from({ length: 512 }, () => ({
        data_store: document.data_stores[0].symbolic_name,
      })),
    },
  ];
  const text = JSON.stringify(document);
  expect(text.length).toBeLessThan(readLimits.maxTextBytes);
  expect(importModel(text)).toMatchObject({
    _tag: 'Left',
    left: { _tag: 'ExceededReadLimit', limit: 'maxImportTextUnits' },
  });
});

it('budgets generated OTM identifiers before escaping and repeating them', () => {
  const document = otmFixture();
  const component = document.components?.[0];
  if (component === undefined)
    throw new Error('The upstream fixture lacks a component');
  const old = component.id;
  component.id = 'x'.repeat(1_048_576);
  for (const flow of document.dataflows ?? []) {
    if (flow.source === old) flow.source = component.id;
    if (flow.destination === old) flow.destination = component.id;
  }
  const text = JSON.stringify(document);
  expect(text.length).toBeLessThan(readLimits.maxTextBytes);
  expect(importModel(text)).toMatchObject({
    _tag: 'Left',
    left: { _tag: 'ExceededReadLimit', limit: 'maxImportTextUnits' },
  });
});

it('budgets repeated diagnostic paths from aliased assumptions', () => {
  const document = tmbomFixture();
  const assumption = {
    description: 'A premise',
    validity: 'confirmed' as const,
    ['x'.repeat(262_144)]: true,
  };
  document.assumptions = Array.from({ length: 40 }, () => assumption);
  const text = stringify(document);
  expect(text.length).toBeLessThan(readLimits.maxTextBytes);
  expect(importModel(text)).toMatchObject({
    _tag: 'Left',
    left: { _tag: 'ExceededReadLimit', limit: 'maxImportTextUnits' },
  });
});

it('bounds repeated assumption text from YAML aliases', () => {
  const document = tmbomFixture();
  const assumption = {
    description: 'x'.repeat(1_048_576),
    validity: 'unconfirmed' as const,
  };
  document.assumptions = Array.from({ length: 40 }, () => assumption);
  const text = stringify(document);
  expect(text.length).toBeLessThan(readLimits.maxTextBytes);
  expect(importModel(text)).toMatchObject({
    _tag: 'Left',
    left: { _tag: 'ExceededReadLimit', limit: 'maxImportTextUnits' },
  });
});

it('bounds aliased descriptions on distinct unattached OTM mitigations', () => {
  const description = 'x'.repeat(1_048_576);
  const aliased = `otmVersion: 0.2.0\nproject: {id: p, name: Project}\nmitigations:\n- id: first\n  name: Mitigation\n  riskReduction: 0\n  description: &description ${description}\n${Array.from({ length: 39 }, (_, index) => `- id: m${String(index)}\n  name: Mitigation\n  riskReduction: 0\n  description: *description\n`).join('')}`;
  expect(aliased.length).toBeLessThan(readLimits.maxTextBytes);
  expect(importModel(aliased)).toMatchObject({
    _tag: 'Left',
    left: { _tag: 'ExceededReadLimit', limit: 'maxImportTextUnits' },
  });
});

it('generates distinct canvas-compatible identifiers for punctuation and Unicode', () => {
  const document = otmFixture();
  document.components = ['a-b', 'a_2d_b', 'a"b', '雪'].map((id) => ({
    id,
    name: id,
    type: 'component',
    parent: { trustZone: 'zone' },
  }));
  document.dataflows = [];
  document.threats = [];
  document.mitigations = [];
  const read = Either.getOrThrow(importModel(JSON.stringify(document)));
  const ids = read.model.diagrams[0].elements.map((element) => element.id);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids.every((id) => /^[A-Za-z0-9_-]+$/u.test(id))).toBe(true);
});

it.each([
  ['accepted', 'accepted-risk'],
  ['transferred', 'transferred'],
  ['avoided', 'avoided'],
  ['eliminated', 'eliminated'],
  ['not-applicable', 'not-applicable'],
  ['vendor-pending', 'open'],
] as const)(
  'imports OTM treatment %s as %s and keeps the source label',
  (state, expected) => {
    const document = otmFixture();
    const occurrence = document.components?.flatMap(
      (component) => component.threats ?? [],
    )[0];
    if (occurrence === undefined)
      throw new Error('The fixture lacks a threat occurrence');
    occurrence.state = state;
    const read = Either.getOrThrow(importModel(JSON.stringify(document)));
    expect(read.model.threats[0].status).toBe(expected);
    expect(read.model.threats[0].description).toContain(state);
  },
);

it.each([
  ['implemented', 'implemented'],
  ['verified', 'verified'],
  ['vendor-pending', 'proposed'],
] as const)('imports OTM mitigation state %s as %s', (state, expected) => {
  const document = otmFixture();
  const occurrence = document.components?.flatMap(
    (component) => component.threats ?? [],
  )[0];
  const mitigation = occurrence?.mitigations?.[0];
  if (mitigation == null)
    throw new Error('The fixture lacks a mitigation occurrence');
  mitigation.state = state;
  const read = Either.getOrThrow(importModel(JSON.stringify(document)));
  expect(read.model.mitigations[0].status).toBe(expected);
  expect(read.model.mitigations[0].prose).toContain(state);
});

it.each(['asset', 'threat', 'mitigation'] as const)(
  'refuses an OTM occurrence referencing an absent %s',
  (kind) => {
    const document = otmFixture();
    const component = document.components?.find(
      (entry) => (entry.threats?.length ?? 0) > 0,
    );
    const occurrence = component?.threats?.[0];
    if (component === undefined || occurrence === undefined)
      throw new Error('The fixture lacks a threat occurrence');
    if (kind === 'asset') component.assets = { processed: ['absent'] };
    else if (kind === 'threat') occurrence.threat = 'absent';
    else occurrence.mitigations = [{ mitigation: 'absent', state: 'required' }];
    expect(importModel(JSON.stringify(document))).toMatchObject({
      _tag: 'Left',
      left: { _tag: 'InvalidWireDocument' },
    });
  },
);

it('retains OTM threat definitions that have no occurrences', () => {
  const document = otmFixture();
  for (const component of document.components ?? []) component.threats = [];
  for (const flow of document.dataflows ?? []) flow.threats = [];
  const read = Either.getOrThrow(importModel(JSON.stringify(document)));
  expect(read.model.threats).toHaveLength(1);
  expect(read.model.threats[0].elements).toEqual([]);
  expect(read.model.threats[0].status).toBe('open');
});

it('builds no mitigation linked to no threat and no assumption with no reference from any vendored document', () => {
  const readings = importCorpus.map((file) => ({
    name: file.name,
    result: importModel(file.text),
  }));
  expect(
    readings
      .filter(({ result }) => Either.isLeft(result))
      .map(({ name }) => name),
  ).toEqual(['tmbom/vault-invalid-zones.json']);
  const models = readings.flatMap(({ name, result }) =>
    Either.isRight(result) ? [{ name, model: result.right.model }] : [],
  );
  expect(new Set(models.map(({ name }) => name.split('/')[0]))).toEqual(
    new Set(['otm', 'tmbom']),
  );
  expect(
    models.flatMap(({ name, model }) => [
      ...model.mitigations
        .filter((mitigation) => mitigation.threats.length === 0)
        .map((mitigation) => `${name}: mitigation ${mitigation.id}`),
      ...model.assumptions
        .filter(
          (assumption) =>
            assumption.threats.length === 0 && !assumption.appliesToModel,
        )
        .map((assumption) => `${name}: assumption ${assumption.id}`),
    ]),
  ).toEqual([]);
});

const imported = (document: unknown) =>
  Either.getOrThrowWith(
    importModel(JSON.stringify(document)),
    (failure) => new Error(JSON.stringify(failure)),
  );

const namesIn = (model: Model): ReadonlyMap<string, string> =>
  new Map<string, string>([
    ...model.diagrams.flatMap((diagram) =>
      diagram.elements.map((element): [string, string] => [
        element.id,
        element.name,
      ]),
    ),
    ...model.threats.map((threat): [string, string] => [
      threat.id,
      threat.title,
    ]),
  ]);

const registerOf = (model: Model) => {
  const names = namesIn(model);
  const named = (ids: readonly string[]) => ids.map((id) => names.get(id));
  return {
    elements: model.diagrams.flatMap((diagram) =>
      diagram.elements.map((element) => [element.kind, element.name]),
    ),
    threats: model.threats.map((threat) => [
      threat.title,
      threat.status,
      named(threat.elements),
    ]),
    mitigations: model.mitigations.map((mitigation) => [
      mitigation.title,
      mitigation.status,
      named(mitigation.threats),
    ]),
    assumptions: model.assumptions.map((assumption) => [
      assumption.prose,
      assumption.status,
      assumption.appliesToModel,
    ]),
  };
};

const reportsOf = (divergences: readonly Divergence[]) =>
  divergences
    .filter(({ detail }) => detail.code !== 'field-not-retained')
    .map(({ detail }) => divergenceDetailText(detail));

const unretainedFieldsOf = (divergences: readonly Divergence[]) =>
  new Set(
    divergences.flatMap(({ detail }) =>
      detail.code === 'field-not-retained'
        ? [detail.parameters.path.join('.')]
        : [],
    ),
  );

describe('the feature-complete OTM document', () => {
  const read = imported(otmFeatureComplete);

  it('uses every field and variant the wire schema declares', () => {
    expect(unusedConstructs(otmWireSchema, [otmFeatureComplete])).toEqual([]);
  });

  it('lands components as processes, zones as boxes and dataflows as flows', () => {
    expect(registerOf(read.model).elements).toEqual([
      ['process', 'Patient app'],
      ['process', 'Booking service'],
      ['process', 'Appointments'],
      ['trust-boundary', 'Internet'],
      ['trust-boundary', 'Clinic network'],
      ['trust-boundary', 'Service host'],
      ['flow', 'Book appointment'],
      ['flow', 'Store booking'],
    ]);
    expect(
      read.model.diagrams[0].elements.flatMap((element) =>
        element.kind === 'flow' ? [element.bidirectional] : [],
      ),
    ).toEqual([true, false]);
  });

  it('makes one threat of each occurrence, in the status its state maps to', () => {
    expect(registerOf(read.model).threats).toEqual([
      ['Spoofed patient', 'open', ['Patient app']],
      ['Spoofed patient', 'open', ['Patient app']],
      ['Altered fee', 'open', ['Booking service']],
      ['Leaked reason', 'mitigated', ['Booking service']],
      ['Bulk booking', 'accepted-risk', ['Booking service']],
      ['Denied booking', 'accepted-risk', ['Booking service']],
      ['Settings changed by the service', 'transferred', ['Appointments']],
      ['Backup copied off the host', 'avoided', ['Appointments']],
      ['Replayed booking', 'eliminated', ['Book appointment']],
      ['Form read in transit', 'not-applicable', ['Book appointment']],
      ['Model left unreviewed', 'open', []],
    ]);
    expect(read.model.lastIssuedThreatNumber).toBe(11);
  });

  it('makes one mitigation of each reference, implemented or verified only where its state says so', () => {
    expect(registerOf(read.model).mitigations).toEqual([
      ['Sign the booking', 'implemented', ['Altered fee']],
      ['Review the fee', 'verified', ['Altered fee']],
      ['Sign the booking', 'proposed', ['Replayed booking']],
      ['TLS everywhere', 'proposed', ['Form read in transit']],
      ['Review the fee', 'proposed', ['Form read in transit']],
    ]);
    expect(read.model.metadata.description).toBe(
      'Every field an OTM file carries.\n\nMitigation: Rotate keys. No occurrence names this mitigation.',
    );
  });

  it('reports what it narrowed, and names every source field it keeps nowhere', () => {
    expect(reportsOf(read.divergences)).toEqual([
      'Element "appointments" receives generated geometry where the source has none.',
      'OTM component types become process nodes. Their original types remain in the descriptions.',
      'Element "zone-clinic" receives generated geometry where the source has none.',
      'Element "zone-service" receives generated geometry where the source has none.',
      'Referenced asset names become descriptions on flows and components. Shared data identity is not retained.',
      'Threat "threat-spoofing" imports with undecided severity and an unspecified category.',
      'Threat "threat-spoofing" becomes separate records for its occurrences.',
      'Threat status "under-review" imports as open. Supplied status text remains in the description.',
      'Threat "threat-spoofing" imports with undecided severity and an unspecified category.',
      'Threat "threat-tampering" imports with undecided severity and an unspecified category.',
      'Threat "threat-disclosure" imports with undecided severity and an unspecified category.',
      'Threat "threat-denial" imports with undecided severity and an unspecified category.',
      'Threat "threat-repudiation" imports with undecided severity and an unspecified category.',
      'Threat "threat-elevation" imports with undecided severity and an unspecified category.',
      'Threat "threat-backup" imports with undecided severity and an unspecified category.',
      'Threat "threat-replay" imports with undecided severity and an unspecified category.',
      'Mitigation "mitigation-signing" becomes separate records for its occurrences.',
      'Threat "threat-sniffing" imports with undecided severity and an unspecified category.',
      'Mitigation "mitigation-review" becomes separate records for its occurrences.',
      'Mitigation "mitigation-review" has source status "rejected", retained in its description and imported as proposed.',
      'Threat status absent imports as open. Supplied status text remains in the description.',
      'Threat "threat-unattached" imports with undecided severity and an unspecified category.',
      'Mitigation "mitigation-unused" names no threat and becomes a line of the model description.',
    ]);
    expect(unretainedFieldsOf(read.divergences)).toEqual(
      new Set([
        'assets.0.attributes',
        'assets.0.risk',
        'components.0.attributes',
        'components.0.parent',
        'components.0.representations.1.codeSnippet',
        'components.0.representations.1.file',
        'components.0.representations.1.id',
        'components.0.representations.1.line',
        'components.0.representations.1.representation',
        'components.0.tags',
        'components.1.parent',
        'components.1.threats.0.mitigations.3.mitigation',
        'components.1.threats.0.mitigations.3.state',
        'components.2.parent',
        'dataflows.0.attributes',
        'dataflows.0.tags',
        'mitigations.0.attributes',
        'mitigations.0.riskReduction',
        'mitigations.1.riskReduction',
        'mitigations.2.riskReduction',
        'mitigations.3.riskReduction',
        'project.attributes',
        'project.ownerContact',
        'project.tags',
        'representations.0.attributes',
        'representations.0.description',
        'representations.0.size',
        'representations.1.id',
        'representations.1.name',
        'representations.1.repository',
        'representations.1.type',
        'threats.0.attributes',
        'threats.0.categories',
        'threats.0.cwes',
        'threats.0.risk',
        'threats.0.tags',
        'threats.1.risk',
        'threats.2.risk',
        'threats.3.risk',
        'threats.4.risk',
        'threats.5.risk',
        'threats.6.risk',
        'threats.7.risk',
        'threats.8.risk',
        'threats.9.risk',
        'trustZones.0.attributes',
        'trustZones.0.representations.0.attributes',
        'trustZones.0.representations.0.name',
        'trustZones.0.risk',
        'trustZones.0.type',
        'trustZones.1.parent',
        'trustZones.1.risk',
        'trustZones.2.parent',
        'trustZones.2.risk',
      ]),
    );
  });
});

describe('the feature-complete TM-BOM document', () => {
  const read = imported(tmbomFeatureComplete);

  it('uses every field, enum value and variant the wire schema declares, across its scope variants', () => {
    expect(
      unusedConstructs(tmbomWireSchema, [
        tmbomFeatureComplete,
        ...tmbomScopeVariants,
      ]),
    ).toEqual([]);
  });

  it('lands actors, components and stores as nodes in a band for each zone, and data flows as flows', () => {
    expect(registerOf(read.model).elements).toEqual([
      ['trust-boundary', 'Internet'],
      ['actor', 'Patient'],
      ['actor', 'Reminder job'],
      ['actor', 'Receptionist'],
      ['actor', 'Clinic administrator'],
      ['actor', 'On-call engineer'],
      ['actor', 'Payment provider'],
      ['trust-boundary', 'Clinic network'],
      ['process', 'Booking service'],
      ['process', 'Fee calculator'],
      ['store', 'Appointments'],
      ['store', 'Sessions'],
      ['store', 'Forms'],
      ['store', 'Scans'],
      ['store', 'Referrals'],
      ['store', 'Metrics'],
      ['flow', 'Book appointment'],
      ['flow', 'Store booking'],
    ]);
  });

  it('imports threats open and undecided, live controls as mitigations, and every assumption as applying to the model', () => {
    expect(registerOf(read.model)).toMatchObject({
      threats: [
        ['Spoofed patient', 'open', ['Booking service']],
        ['Altered fee', 'open', []],
      ],
      mitigations: [
        ['Control assumed', 'proposed', ['Spoofed patient']],
        ['Control active', 'implemented', ['Spoofed patient']],
        ['Control suggested', 'proposed', ['Altered fee']],
        ['Control under_review', 'proposed', ['Altered fee']],
        ['Control approved', 'proposed', ['Altered fee']],
      ],
      assumptions: [
        ['The phone on file belongs to the patient.', 'unconfirmed', true],
        [
          'The clinic network is not reachable from the internet.',
          'valid',
          true,
        ],
        ['Backups never leave the host.', 'invalidated', true],
      ],
    });
    expect(read.model.metadata.description).toBe(
      'Every field a TM-BOM file carries.\n\nA clinic books appointments online.\n\nMitigation: Control scheduled (proposed, source status scheduled). A control the team marks scheduled.\n\nMitigation: Unwritten control (proposed, source status scheduled).',
    );
  });

  it('reports what it narrowed, and names every source field it keeps nowhere', () => {
    expect(reportsOf(read.divergences)).toEqual([
      'Data set "appointment-records" becomes prose on its stores. Shared data identity is not retained.',
      'The diagram receives generated geometry grouped by source trust zone. Membership becomes visual.',
      'Flow encryption and sensitivity fields remain prose in the flow descriptions.',
      'Control "control-assumed" imports as proposed. Its original status remains in the description.',
      'Control "control-under-review" imports as proposed. Its original status remains in the description.',
      'Control "control-approved" imports as proposed. Its original status remains in the description.',
      'Control "control-scheduled" names no threat and becomes a line of the model description.',
      'Control "control-unwritten" names no threat and becomes a line of the model description.',
      'Threats import as open with undecided severity and an unspecified category. Separate risk assessments are not converted into threat severity.',
    ]);
    expect(unretainedFieldsOf(read.divergences)).toEqual(
      new Set([
        'actors.0.permissions',
        'actors.0.type',
        'actors.1.type',
        'actors.2.type',
        'actors.3.type',
        'actors.4.type',
        'actors.5.type',
        'assumptions.0.topics',
        'components.0.repo_link',
        'components.1.parent_component',
        'controls.0.priority',
        'controls.1.priority',
        'controls.1.trust_boundary',
        'controls.2.priority',
        'controls.3.priority',
        'controls.4.priority',
        'controls.5.priority',
        'controls.6.description',
        'controls.6.priority',
        'controls.6.status',
        'controls.6.symbolic_name',
        'controls.6.threats',
        'controls.6.title',
        'controls.7.description',
        'controls.7.priority',
        'controls.7.status',
        'controls.7.symbolic_name',
        'controls.7.threats',
        'controls.7.title',
        'controls.8.priority',
        'data_sets.0.access_control_methods',
        'data_sets.0.data_sensitivity',
        'data_sets.0.placements.0.encrypted',
        'data_sets.0.record_count',
        'data_stores.0.product',
        'data_stores.0.type',
        'data_stores.0.vendor',
        'data_stores.1.type',
        'data_stores.2.type',
        'data_stores.3.type',
        'data_stores.4.type',
        'data_stores.5.type',
        'diagrams',
        'extensions',
        'frozen',
        'product_release_date',
        'release_docs_link',
        'released_at',
        'repo_link',
        'reviewed_at',
        'risks',
        'scope.business_criticality',
        'scope.data_sensitivity',
        'scope.exposure',
        'scope.tier',
        'threat_personas',
        'threats.0.attack_mechanisms',
        'threats.0.sources',
        'threats.0.threat_persona',
        'threats.0.weaknesses',
        'threats.1.sources',
        'threats.1.threat_persona',
        'trust_boundaries',
        'version',
      ]),
    );
  });

  it('imports the same register under every scope and under the 1.0.1 release', () => {
    for (const variant of tmbomScopeVariants) {
      const { model, divergences } = imported(variant);
      expect(registerOf(model)).toMatchObject({
        threats: registerOf(read.model).threats,
        mitigations: registerOf(read.model).mitigations,
        assumptions: registerOf(read.model).assumptions,
      });
      expect(reportsOf(divergences)).toEqual(reportsOf(read.divergences));
    }
  });
});
