import { Either } from 'effect';
import type { ReadFailure } from './codec.js';
import { importModel } from './import.js';
import { saerskrivenYamlCodec } from './saerskriven-yaml.js';
import { threatDragonCodec } from './threat-dragon.js';

const issues = 135_000;

const entries = (entry: string, issuesEach: number): string =>
  Array.from({ length: issues / issuesEach }, () => entry).join(',');

const floodedReads: readonly {
  readonly format: string;
  readonly read: (text: string) => Either.Either<unknown, ReadFailure>;
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
    text: `{"summary":{"title":"t"},"detail":{"diagrams":[{"cells":[${entries('1', 1)}]}]}}`,
  },
  {
    format: 'Saerskriven YAML',
    read: (text) => saerskrivenYamlCodec.read(text),
    text: `{"formatVersion":2,"diagrams":[{"elements":[{"kind":"flow","waypoints":[${entries('{}', 2)}]}]}]}`,
  },
];

describe('a wire document with more invalid entries than zod can gather', () => {
  it.each(floodedReads)(
    'refuses a $format read as one root issue',
    ({ read, text }) => {
      const result = read(text);
      expect(Either.isLeft(result) && result.left).toMatchObject({
        _tag: 'InvalidWireDocument',
        issues: [{ path: [] }],
      });
    },
  );
});
