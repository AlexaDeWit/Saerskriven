import { repositoryRoot, testDataPath } from '@saerskriven/model/fixtures';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The Écluse model as this format writes it, committed so a change to what
 * the format writes arrives as a diff on a file rather than as a test that
 * still passes.
 */
export const goldenPath: string = testDataPath('saerskriven/ecluse.yaml');

/** The committed bytes at {@link goldenPath}. */
export const goldenText: string = readFileSync(goldenPath, 'utf8');

/**
 * The Écluse model in the document shape v0.2.1 wrote, committed as data and
 * never regenerated, so a file from before a flow's `bidirectional` and an
 * attached endpoint's `side` still has a reader to answer to.
 */
export const frozenV021Path: string = testDataPath(
  'saerskriven/ecluse-v0.2.1.yaml',
);

/**
 * Saerskriven's own model in the document shape v0.3.0 wrote, committed as
 * data and never regenerated: version 1 with each threat's mitigation text,
 * assumption element links and an assumption that links no threat, so the v1
 * to v2 migration has a released file to answer to.
 */
export const frozenV030Path: string = testDataPath(
  'saerskriven/saerskriven-v0.3.0.yaml',
);

const saerskrivenModelPath = join(
  repositoryRoot,
  'threat-modelling/saerskriven.yaml',
);

const saerskrivenModelJsonPath = testDataPath('saerskriven.model.json');

/**
 * A Saerskriven YAML file this repository commits, with its committed bytes and,
 * where this suite is the producer of one, the path it writes the file's
 * internal model out to.
 */
export type NativeFixture = {
  readonly name: string;
  readonly path: string;
  readonly text: string;
  readonly modelJsonPath: string | undefined;
};

/** A {@link NativeFixture} whose internal model this suite writes out. */
export type EmittedModel = {
  readonly name: string;
  readonly text: string;
  readonly modelJsonPath: string;
};

/**
 * Every Saerskriven YAML file this repository commits as a fixed point of the
 * codec: what a read of the committed bytes writes back is those bytes
 * again. The suites that gate a native file read this list rather than a
 * path, so a third file joins all of them by being added here. The frozen
 * fixtures at {@link frozenV021Path} and {@link frozenV030Path} are not among
 * them, because a write of their models is a later shape.
 *
 * `modelJsonPath` is where a file's internal model is written out for
 * `packages/render` and `packages/canvas`, which gate on a model and cannot
 * import a codec. Écluse names none, because `packages/model` writes that
 * one from its own transcription of the Threat Dragon file and this suite
 * compares against it rather than producing it. A file this suite is the
 * only reader of names its own.
 */
export const nativeFixtures: readonly NativeFixture[] = [
  {
    name: 'Écluse model',
    path: goldenPath,
    text: goldenText,
    modelJsonPath: undefined,
  },
  {
    name: 'Saerskriven model',
    path: saerskrivenModelPath,
    text: readFileSync(saerskrivenModelPath, 'utf8'),
    modelJsonPath: saerskrivenModelJsonPath,
  },
];

/** The fixtures of {@link nativeFixtures} this suite writes a model out for. */
export const emittedModels: readonly EmittedModel[] = nativeFixtures.flatMap(
  (fixture) =>
    fixture.modelJsonPath === undefined
      ? []
      : [
          {
            name: fixture.name,
            text: fixture.text,
            modelJsonPath: fixture.modelJsonPath,
          },
        ],
);

/**
 * How long a property over `modelInputArbitrary` is given, past the root
 * `vitest.shared.mts` sets. fast-check runs a property a hundred times by
 * default, and each run parses a model, writes it and reads it back, which
 * ten runs of the whole workspace's suites on a contended host measured at
 * 9.5 seconds.
 */
export const propertyTimeout = 30_000;

/**
 * The smallest version 1 document the read accepts: a title and every list
 * empty. A spec derives the variant it needs with a `replace`.
 */
export const minimalYamlV1 = [
  'formatVersion: 1',
  'metadata:',
  '  title: Minimal',
  '  owner: ""',
  '  description: ""',
  '  contributors: []',
  'diagrams: []',
  'threats: []',
  'lastIssuedThreatNumber: 0',
  'mitigations: []',
  'assumptions: []',
  '',
].join('\n');

/**
 * A version 1 document with one process on one diagram and one threat
 * linked to it. A spec derives the variant it needs with a `replace`.
 */
export const oneThreatYamlV1 = [
  'formatVersion: 1',
  'metadata:',
  '  title: One threat',
  '  owner: ""',
  '  description: ""',
  '  contributors: []',
  'diagrams:',
  '  - id: diagram-1',
  '    title: Only',
  '    elements:',
  '      - kind: process',
  '        id: element-1',
  '        name: Gateway',
  '        description: ""',
  '        outOfScope: false',
  '        reasonOutOfScope: ""',
  '        position:',
  '          x: 0',
  '          y: 0',
  '        size:',
  '          width: 10',
  '          height: 10',
  'threats:',
  '  - id: threat-1',
  '    number: 1',
  '    title: Spoofed caller',
  '    category:',
  '      methodology: STRIDE',
  '      category: spoofing',
  '    severity: high',
  '    status: open',
  '    description: ""',
  '    mitigation: ""',
  '    elements:',
  '      - element-1',
  'lastIssuedThreatNumber: 1',
  'mitigations: []',
  'assumptions: []',
  '',
].join('\n');
