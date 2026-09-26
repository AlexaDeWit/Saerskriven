import { issueFloodCode } from '@saerskriven/model';
import { saerskrivenYamlV2WireSchema } from '@saerskriven/wire-saerskriven-yaml-v2';
import { Either } from 'effect';
import { parse } from 'yaml';
import { readAnyFormat } from './detect.js';
import { importModel } from './import.js';
import { saerskrivenYamlCodec } from './saerskriven-yaml.js';
import { featureCompleteYaml } from './saerskriven-yaml.fixtures.js';
import { threatDragonCodec } from './threat-dragon.js';

const issues = 135_000;

const entries = (entry: string, issuesEach: number): string =>
  Array.from({ length: issues / issuesEach }, () => entry).join(',');

const threatDragonFlood = `{"summary":{"title":"t"},"detail":{"diagrams":[{"cells":[${entries('1', 1)}]}]}}`;

const saerskrivenYamlFlood = `{"formatVersion":2,"diagrams":[{"elements":[{"kind":"flow","waypoints":[${entries('{}', 2)}]}]}]}`;

const floodedReads: readonly {
  readonly format: string;
  readonly read: (text: string) => Either.Either<unknown, unknown>;
  readonly text: string;
}[] = [
  {
    format: 'OTM',
    read: importModel,
    text: `{"otmVersion":"0.2.0","components":[{"threats":[{"mitigations":[${entries('1', 1)}]}]}]}`,
  },
  {
    format: 'TM-BOM',
    read: importModel,
    text: `{"$schema":"https://github.com/OWASP/www-project-threat-model-library/blob/v1.0.2/threat-model.schema.json","threats":[{"components_affected":[${entries('1', 1)}]}]}`,
  },
  {
    format: 'Threat Dragon',
    read: (text) => threatDragonCodec.read(text),
    text: threatDragonFlood,
  },
  {
    format: 'Saerskriven YAML',
    read: (text) => saerskrivenYamlCodec.read(text),
    text: saerskrivenYamlFlood,
  },
  {
    format: 'detected Threat Dragon',
    read: readAnyFormat,
    text: threatDragonFlood,
  },
  {
    format: 'detected Saerskriven YAML',
    read: readAnyFormat,
    text: saerskrivenYamlFlood,
  },
];

const refusalOf = (
  read: (text: string) => Either.Either<unknown, unknown>,
  text: string,
): unknown => {
  const result = read(text);
  return Either.isLeft(result) && result.left;
};

describe('a document with more invalid entries than zod 4.6.2 gathers on V8', () => {
  it.each(floodedReads)(
    'refuses a $format read as one root wire issue',
    ({ read, text }) => {
      expect(refusalOf(read, text)).toMatchObject({
        _tag: 'InvalidWireDocument',
        issues: [{ path: [], detail: { code: issueFloodCode } }],
      });
    },
  );

  it('refuses a Saerskriven YAML file valid on the wire as one root model issue', () => {
    const wire = saerskrivenYamlV2WireSchema.parse(parse(featureCompleteYaml));
    const text = JSON.stringify({
      ...wire,
      threats: wire.threats.map((threat, index) =>
        index === 0
          ? { ...threat, elements: Array.from({ length: issues }, () => 'a') }
          : threat,
      ),
    });

    expect(
      refusalOf((flooded) => saerskrivenYamlCodec.read(flooded), text),
    ).toMatchObject({
      _tag: 'InvalidModel',
      issues: [{ path: [], detail: { code: issueFloodCode } }],
    });
  });
});
