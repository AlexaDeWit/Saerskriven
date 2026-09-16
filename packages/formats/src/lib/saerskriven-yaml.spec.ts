import {
  inNumberOrder,
  parseModel,
  threatFlags,
  type Flow,
  type FlowEndpoint,
  type Model,
} from '@saerskriven/model';
import {
  committedModel,
  modelInputArbitrary,
  repositoryRoot,
} from '@saerskriven/model/fixtures';
import { saerskrivenYamlWireSchema } from '@saerskriven/wire-saerskriven-yaml';
import { saerskrivenYamlV2WireSchema } from '@saerskriven/wire-saerskriven-yaml-v2';
import { Either } from 'effect';
import * as fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { inferredMitigationStatus } from './mitigation-text.js';
import { saerskrivenYamlCodec } from './saerskriven-yaml.js';
import {
  emittedModels,
  frozenV021Path,
  frozenV030Path,
  goldenText,
  nativeFixtures,
  propertyTimeout,
} from './saerskriven-yaml.fixtures.js';
import { threatStatusesToModel } from './saerskriven-yaml-vocabulary.js';

const ecluseModel = committedModel('ecluse.model.json');

const frozenV021 = readFileSync(frozenV021Path, 'utf8');

const frozenV030 = readFileSync(frozenV030Path, 'utf8');

const description = readFileSync(
  join(repositoryRoot, 'docs/saerskriven-yaml.md'),
  'utf8',
);

const fence = '```yaml\n';

const exampleStart = description.indexOf(fence) + fence.length;

const documentedExample = description.slice(
  exampleStart,
  description.indexOf('```', exampleStart),
);

function withThreatsInNumberOrder(model: Model): Model {
  return { ...model, threats: inNumberOrder(model.threats) };
}

function statusesOf(
  records: readonly {
    readonly id: string;
    readonly status: string;
    readonly threats: readonly string[];
  }[],
) {
  return records.map(({ id, status, threats }) => ({ id, status, threats }));
}

function version1Of(text: string) {
  return saerskrivenYamlWireSchema.parse(parse(text));
}

function textRecordsOf(text: string) {
  return inNumberOrder(version1Of(text).threats)
    .filter(({ mitigation }) => mitigation !== '')
    .map(({ id, status, mitigation }) => ({
      prose: mitigation,
      status: inferredMitigationStatus(threatStatusesToModel[status]),
      threats: [id],
    }));
}

function textRecordsIn(model: Model, text: string) {
  const held = new Set(version1Of(text).mitigations.map(({ id }) => id));
  return model.mitigations
    .filter(({ id }) => !held.has(id))
    .map(({ prose, status, threats }) => ({ prose, status, threats }));
}

function readOrThrow(text: string) {
  return Either.getOrThrow(saerskrivenYamlCodec.read(text));
}

function withoutPinnedSides(model: Model): Model {
  return {
    ...model,
    diagrams: model.diagrams.map((diagram) => ({
      ...diagram,
      elements: diagram.elements.map((element) =>
        element.kind === 'flow'
          ? {
              ...element,
              source: unpinned(element.source),
              target: unpinned(element.target),
            }
          : element,
      ),
    })),
  };
}

function unpinned(endpoint: FlowEndpoint): FlowEndpoint {
  return endpoint.kind === 'attached'
    ? { kind: 'attached', element: endpoint.element }
    : endpoint;
}

function flowsOf(model: Model): readonly Flow[] {
  return model.diagrams.flatMap((diagram) =>
    diagram.elements.flatMap((element) =>
      element.kind === 'flow' ? [element] : [],
    ),
  );
}

describe('the Saerskriven YAML codec', () => {
  it('pairs the read and the write with the schema they share', () => {
    expect(saerskrivenYamlCodec.wire).toBe(saerskrivenYamlV2WireSchema);
  });

  it('reads the committed fixture as the model it was written from', () => {
    const reading = readOrThrow(goldenText);
    expect(reading.model).toEqual(withThreatsInNumberOrder(ecluseModel));
    expect(reading.divergences).toEqual([]);
  });

  it('wrote the example the format description prints, to the byte', () => {
    const reading = readOrThrow(documentedExample);
    expect(reading.divergences).toEqual([]);
    expect(saerskrivenYamlCodec.write(reading.model).output).toBe(
      documentedExample,
    );
  });

  it('hands back the document it read, for a write to merge onto', () => {
    expect(readOrThrow(goldenText).source.formatVersion).toBe(2);
  });
});

describe('a file with an unconfirmed assumption', () => {
  const unconfirmedDocument = [
    'formatVersion: 2',
    'metadata:',
    '  title: Unconfirmed',
    '  owner: ""',
    '  description: ""',
    '  contributors: []',
    'assumptions:',
    '  - id: assumption-1',
    '    prose: The provider signs every webhook.',
    '    status: unconfirmed',
    '    threats:',
    '      - threat-1',
    '    appliesToModel: false',
    'diagrams: []',
    'mitigations: []',
    'threats:',
    '  - id: threat-1',
    '    number: 1',
    '    title: Replayed webhook',
    '    category:',
    '      methodology: STRIDE',
    '      category: spoofing',
    '    severity: high',
    '    status: open',
    '    description: ""',
    '    elements: []',
    'lastIssuedThreatNumber: 1',
    '',
  ].join('\n');

  it('reads to a model holding the status, with nothing diverging', () => {
    const reading = readOrThrow(unconfirmedDocument);
    expect(reading.divergences).toEqual([]);
    expect(reading.model.assumptions.map(({ status }) => status)).toEqual([
      'unconfirmed',
    ]);
  });

  it('writes back as version 2, to the byte', () => {
    expect(
      saerskrivenYamlCodec.write(readOrThrow(unconfirmedDocument).model).output,
    ).toBe(unconfirmedDocument);
  });
});

describe('the document shape v0.2.1 wrote', () => {
  it('reads as the model it describes, with nothing diverging', () => {
    const reading = readOrThrow(frozenV021);
    expect(reading.divergences).toEqual([]);
    const legacy = withoutPinnedSides(withThreatsInNumberOrder(ecluseModel));
    const diagrams = legacy.diagrams.map((diagram) => ({
      ...diagram,
      elements: diagram.elements.map((element) =>
        Object.fromEntries(
          Object.entries(element).filter(
            ([key]) =>
              ![
                'providesAuthentication',
                'handlesCardPayment',
                'handlesGoodsOrServices',
                'isWebApplication',
                'privilegeLevel',
                'isALog',
                'isEncrypted',
                'isSigned',
                'storesCredentials',
                'storesInventory',
                'protocol',
                'isPublicNetwork',
                'trustBoundaryIds',
                'containedElements',
                'crossingFlows',
              ].includes(key),
          ),
        ),
      ),
    }));
    expect(reading.model).toEqual({ ...legacy, diagrams });
  });

  it('holds one record for each non-empty mitigation text, under the one-to-one status rule', () => {
    const records = textRecordsOf(frozenV021);
    expect(records.length).toBeGreaterThan(0);
    expect(textRecordsIn(readOrThrow(frozenV021).model, frozenV021)).toEqual(
      records,
    );
  });

  it('raises no mitigated without implemented work flag on a mitigated threat', () => {
    const { model } = readOrThrow(frozenV021);
    const mitigated = model.threats.filter(
      ({ status }) => status === 'mitigated',
    );
    expect(mitigated.length).toBeGreaterThan(0);
    expect(mitigated.flatMap((threat) => threatFlags(model, threat))).toEqual(
      [],
    );
  });

  it('takes every flow as one-way and every attached end as unpinned', () => {
    const flows = flowsOf(readOrThrow(frozenV021).model);
    expect(flows).toHaveLength(20);
    expect(flows.filter((flow) => flow.bidirectional)).toEqual([]);
    expect(
      flows
        .flatMap((flow) => [flow.source, flow.target])
        .filter(
          (endpoint) =>
            endpoint.kind === 'attached' && endpoint.side !== undefined,
        ),
    ).toEqual([]);
  });
});

describe('the document shape v0.3.0 wrote', () => {
  const reading = readOrThrow(frozenV030);
  const file = version1Of(frozenV030);

  it('holds one record for each non-empty mitigation text beside the records the file holds, under the one-to-one status rule', () => {
    expect(
      statusesOf(reading.model.mitigations.slice(0, file.mitigations.length)),
    ).toEqual(statusesOf(file.mitigations));
    expect(textRecordsIn(reading.model, frozenV030)).toEqual(
      textRecordsOf(frozenV030),
    );
  });

  it('reports the element links it drops, once for each assumption that held any', () => {
    const linked = file.assumptions
      .filter(({ elements }) => elements.length > 0)
      .map(({ id }) => id);
    expect(linked).toEqual(['as-hostile-input', 'as-planned-surfaces']);
    expect(
      reading.divergences.map(({ subject, reason }) => ({ subject, reason })),
    ).toEqual(
      linked.map((id) => ({
        subject: { kind: 'assumption', id },
        reason: 'narrowed',
      })),
    );
  });

  it('applies to the model only the assumption that links no threat, keeping every status', () => {
    expect(
      reading.model.assumptions.map(
        ({ id, status, threats, appliesToModel }) => ({
          id,
          status,
          threats,
          appliesToModel,
        }),
      ),
    ).toEqual([
      {
        id: 'as-hostile-input',
        status: file.assumptions[0].status,
        threats: file.assumptions[0].threats,
        appliesToModel: false,
      },
      {
        id: 'as-planned-surfaces',
        status: file.assumptions[1].status,
        threats: file.assumptions[1].threats,
        appliesToModel: false,
      },
      {
        id: 'as-hand-written',
        status: file.assumptions[2].status,
        threats: [],
        appliesToModel: true,
      },
    ]);
  });

  it('keeps every threat status', () => {
    expect(
      reading.model.threats.map(({ id, status }) => ({ id, status })),
    ).toEqual(file.threats.map(({ id, status }) => ({ id, status })));
  });

  it('writes a file that reads back as the same model, threats in number order, with nothing diverging', () => {
    const written = saerskrivenYamlCodec.write(reading.model, reading.source);
    expect(written.divergences).toEqual([]);
    const again = readOrThrow(written.output);
    expect(again.divergences).toEqual([]);
    expect(again.model).toEqual(withThreatsInNumberOrder(reading.model));
  });
});

describe.each(nativeFixtures)('the committed $name', ({ path, text }) => {
  it('reads with nothing diverging, and writes back the bytes committed', async () => {
    const reading = readOrThrow(text);
    expect(reading.divergences).toEqual([]);
    await expect(
      saerskrivenYamlCodec.write(reading.model).output,
    ).toMatchFileSnapshot(path);
  });
});

describe.each(emittedModels)(
  'the internal model of the $name',
  ({ text, modelJsonPath }) => {
    it('is written out for the render and canvas suites to read', async () => {
      await expect(
        `${JSON.stringify(readOrThrow(text).model, null, 2)}\n`,
      ).toMatchFileSnapshot(modelJsonPath);
    });
  },
);

describe(
  'any model at all',
  () => {
    it('survives a write and a read as itself, threats in number order, with nothing diverging', () => {
      fc.assert(
        fc.property(modelInputArbitrary, (input) => {
          const model = Either.getOrThrow(parseModel(input));
          const written = saerskrivenYamlCodec.write(model);
          expect(written.divergences).toEqual([]);
          const reading = readOrThrow(written.output);
          expect(reading.divergences).toEqual([]);
          expect(reading.model).toEqual(withThreatsInNumberOrder(model));
        }),
      );
    });

    it('writes version 2, with no threat text or assumption element links and a model link on every assumption', () => {
      fc.assert(
        fc.property(modelInputArbitrary, (input) => {
          const output: unknown = parse(
            saerskrivenYamlCodec.write(Either.getOrThrow(parseModel(input)))
              .output,
          );
          const document = saerskrivenYamlV2WireSchema.parse(output);
          expect(document.formatVersion).toBe(2);
          expect(output).toEqual(document);
        }),
      );
    });

    it('writes the same bytes however its records were built', () => {
      fc.assert(
        fc.property(modelInputArbitrary, (input) => {
          const output = saerskrivenYamlCodec.write(
            Either.getOrThrow(parseModel(input)),
          ).output;
          expect(
            saerskrivenYamlCodec.write(readOrThrow(output).model).output,
          ).toBe(output);
        }),
      );
    });
  },
  propertyTimeout,
);
