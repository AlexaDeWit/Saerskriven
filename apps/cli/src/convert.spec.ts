import {
  readAnyFormat,
  saerskrivenYamlCodec,
  type DetectedRead,
} from '@saerskriven/formats';
import { unclaimedYaml } from '@saerskriven/mcp/fixtures';
import { repositoryRoot, testDataPath } from '@saerskriven/model/fixtures';
import { Either } from 'effect';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  brokenDocumentYaml,
  fixtureFile,
  scratchDirectory,
} from './cli.fixtures.js';
import { convert, type ConvertOptions } from './convert.js';

const directory = scratchDirectory('convert');

const toYaml: ConvertOptions = { to: 'saerskriven-yaml', out: '-' };

const toThreatDragon: ConvertOptions = { to: 'threat-dragon', out: '-' };

const repositoryModel = join(
  repositoryRoot,
  'threat-modelling/saerskriven.yaml',
);

const frozenVersion1 = testDataPath('saerskriven/saerskriven-v0.3.0.yaml');

const readBack = (text: string | Uint8Array): DetectedRead =>
  Either.getOrThrow(readAnyFormat(String(text)));

const version2Of = (path: string): string =>
  saerskrivenYamlCodec.write(readBack(readFileSync(path, 'utf8')).model).output;

describe('convert', () => {
  it('writes this repository threat model back byte for byte', () => {
    expect(convert(repositoryModel, toYaml)).toEqual({
      code: 0,
      out: readFileSync(repositoryModel, 'utf8'),
      err: '',
    });
  });

  it('writes a version 1 file as the version 2 writer does, warning of the migration', () => {
    const outcome = convert(frozenVersion1, toYaml);
    expect(outcome).toMatchObject({ code: 0, out: version2Of(frozenVersion1) });
    expect(String(outcome.out).startsWith('formatVersion: 2\n')).toBe(true);
    expect(outcome.err).toContain('warning: ');
  });

  it('rewrites a file in place, leaving no temporary file beside it', () => {
    const path = fixtureFile(
      directory,
      'in-place/model.yaml',
      readFileSync(frozenVersion1, 'utf8'),
    );
    const outcome = convert(path, { to: 'saerskriven-yaml', out: path });
    expect(outcome).toMatchObject({ code: 0, out: '' });
    expect(readFileSync(path, 'utf8')).toEqual(version2Of(frozenVersion1));
    expect(readdirSync(join(directory, 'in-place'))).toEqual(['model.yaml']);
  });

  it('merges an unedited Threat Dragon file onto itself and reports nothing', () => {
    const path = join(directory, 'written.json');
    convert(testDataPath('saerskriven/two-diagrams.yaml'), {
      to: 'threat-dragon',
      out: path,
    });
    const outcome = convert(path, toThreatDragon);
    expect(outcome).toMatchObject({ code: 0, err: '' });
    expect(readBack(outcome.out).model).toEqual(
      readBack(readFileSync(path, 'utf8')).model,
    );
  });

  it('writes a native file as Threat Dragon, reporting what that format cannot hold', () => {
    const path = testDataPath('saerskriven/feature-complete.yaml');
    const outcome = convert(path, toThreatDragon);
    expect(outcome.code).toEqual(0);
    expect(readBack(outcome.out).format).toEqual('threat-dragon');
    expect(outcome.err).toContain('warning: ');
  });

  it('converts an OTM file to a native file, reporting what the import changed', () => {
    const outcome = convert(testDataPath('otm/example.json'), toYaml);
    expect(outcome.code).toEqual(0);
    expect(readBack(outcome.out).format).toEqual('saerskriven-yaml');
    expect(outcome.err).toContain('warning: ');
  });

  it('refuses a TM-BOM file its import refuses, with the import reason', () => {
    const outcome = convert(
      testDataPath('tmbom/vault-invalid-zones.json'),
      toYaml,
    );
    expect(outcome).toMatchObject({ code: 1, out: '' });
    expect(outcome.err).not.toContain('No format claimed');
  });

  it('lists the formats tried where neither a codec nor an import claims the text', () => {
    const outcome = convert(
      fixtureFile(directory, 'unclaimed.yaml', unclaimedYaml),
      toYaml,
    );
    expect(outcome).toMatchObject({ code: 1, out: '' });
    expect(outcome.err).toContain('threat-dragon');
  });

  it('leaves a file it refuses to read untouched', () => {
    const path = fixtureFile(directory, 'broken.yaml', brokenDocumentYaml);
    expect(convert(path, { to: 'saerskriven-yaml', out: path })).toMatchObject({
      code: 1,
      out: '',
    });
    expect(readFileSync(path, 'utf8')).toEqual(brokenDocumentYaml);
  });

  it('refuses a formatVersion no release wrote, as validate does', () => {
    const path = fixtureFile(
      directory,
      'future.yaml',
      readFileSync(
        testDataPath('saerskriven/two-diagrams.yaml'),
        'utf8',
      ).replace('formatVersion: 2', 'formatVersion: 3'),
    );
    expect(convert(path, toYaml)).toMatchObject({ code: 1, out: '' });
  });

  it('refuses a file past a read bound', () => {
    expect(
      convert(testDataPath('adversarial/deep-nesting.json'), toYaml),
    ).toMatchObject({ code: 1, out: '' });
  });

  it('reports a path it cannot write as the invocation being wrong', () => {
    const outcome = convert(testDataPath('saerskriven/two-diagrams.yaml'), {
      to: 'saerskriven-yaml',
      out: join(directory, 'absent', 'model.yaml'),
    });
    expect(outcome).toMatchObject({ code: 2, out: '' });
    expect(outcome.err).toContain('ENOENT');
  });
});
