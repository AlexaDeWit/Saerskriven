import type { ModelInput } from '@saerskriven/model';
import { repositoryRoot, testDataPath } from '@saerskriven/model/fixtures';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * `test-data/saerskriven/feature-complete.yaml`, a version 2 file written by
 * hand to use every construct the wire schema declares, in the writer's
 * canonical form: each element kind with every security fact it can state,
 * both endpoint kinds and a side of each name, both boundary shapes, a threat
 * in every status, severity and category, a mitigation in every status, and
 * an assumption in every status, one of them applying to the model.
 */
export const featureCompletePath: string = testDataPath(
  'saerskriven/feature-complete.yaml',
);

/** The committed bytes at {@link featureCompletePath}. */
export const featureCompleteYaml: string = readFileSync(
  featureCompletePath,
  'utf8',
);

/**
 * A cut-down of a model in the document shape v0.2.1 wrote, committed as data
 * and never regenerated, so a file from before a flow's `bidirectional` and an
 * attached endpoint's `side` still has a reader to answer to.
 */
export const frozenV021Path: string = testDataPath('saerskriven/v0.2.1.yaml');

const pilot = 'f1646094-9885-422a-b7e7-7888c72905ef';

/**
 * The model {@link frozenV021Path} describes, written out by hand: every flow
 * one-way and every attached end unpinned, since the file states neither, no
 * security fact, and one mitigation record for each non-empty mitigation
 * text in threat number order, `implemented` under a mitigated threat and
 * `proposed` under any other.
 */
export const frozenV021Model: ModelInput = {
  metadata: {
    title: '',
    owner: 'Alexandra de Wit',
    description: '',
    contributors: ['Alexandra de Wit'],
  },
  diagrams: [
    {
      id: '0',
      title: 'High Level',
      elements: [
        {
          kind: 'trust-boundary',
          id: '0ec10e5e-0000-4000-8000-000000000002',
          name: 'Public internet (untrusted)',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          shape: {
            kind: 'box',
            position: { x: -90, y: 640 },
            size: { width: 240, height: 200 },
          },
        },
        {
          kind: 'actor',
          id: '0ec10e5e-0000-4000-8000-000000000012',
          name: 'AWS IMDS + STS',
          description:
            'Instance-metadata and token endpoint. It sources the container-role credentials the worker exchanges for a CodeArtifact write token.',
          outOfScope: false,
          reasonOutOfScope: '',
          position: { x: 635, y: 740 },
          size: { width: 190, height: 90 },
        },
        {
          kind: 'flow',
          id: 'c928bb63-2ec8-44ff-b34b-39d4afb19dc6',
          name: 'mint token (container role)',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          source: {
            kind: 'attached',
            element: '0ec10e5e-0000-4000-8000-000000000012',
          },
          target: { kind: 'attached', element: pilot },
          waypoints: [],
          bidirectional: false,
        },
        {
          kind: 'flow',
          id: '4e565871-45cc-4987-abba-24859ee2cf60',
          name: 'OSV Dataset for Supported Registries',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          source: { kind: 'free', position: { x: 1480, y: 860 } },
          target: { kind: 'attached', element: pilot },
          waypoints: [],
          bidirectional: false,
        },
        {
          kind: 'flow',
          id: 'ec4bbc95-8582-4e22-ab64-3c87cff87239',
          name: 'Push osv.db (SQLite)',
          description: 'Pilot pushes the optimised osv.db to S3.',
          outOfScope: false,
          reasonOutOfScope: '',
          source: { kind: 'attached', element: pilot },
          target: {
            kind: 'attached',
            element: 'c8455307-cef2-4843-a821-ff90db9643d2',
          },
          waypoints: [],
          bidirectional: false,
        },
        {
          kind: 'process',
          id: pilot,
          name: 'Pilot\n(Ingestion Pipeline)',
          description:
            "Pilot is an unopinionated data ingestion pipeline. It fetches vulnerability data and delivers an optimised osv.db to S3. The proxy therefore never queries osv.dev on the critical path and never meets its rate limits. Pilot makes no security or blocking decision. The proxy's rules engine is the sole opinionated enforcement point. Only the rules engine evaluates that data, for example to block on CVE severity or an EPSS score, or to fast-lane a remediation package.",
          outOfScope: false,
          reasonOutOfScope: '',
          position: { x: 920, y: 915 },
          size: { width: 130, height: 130 },
        },
        {
          kind: 'store',
          id: 'c8455307-cef2-4843-a821-ff90db9643d2',
          name: 'S3 (OSV Datasets)',
          description:
            'Pre-compiled SQLite data files for querying against live CVEs.',
          outOfScope: false,
          reasonOutOfScope: '',
          position: { x: 920, y: 640 },
          size: { width: 180, height: 130 },
        },
      ],
    },
  ],
  threats: [
    {
      id: 'b1a6332d-8def-4df9-922e-53718c920155',
      number: 17,
      title: 'Pilot container-role privilege escalation',
      category: { methodology: 'STRIDE', category: 'elevation-of-privilege' },
      severity: 'high',
      status: 'mitigated',
      description:
        'An attacker who compromises Pilot could use its standing container credentials.',
      elements: [pilot],
    },
    {
      id: '4b73d786-865e-43fc-b1bd-0e0bc75cae03',
      number: 27,
      title: 'Poisoned OSV payload exploits parser',
      category: { methodology: 'STRIDE', category: 'denial-of-service' },
      severity: 'medium',
      status: 'mitigated',
      description:
        'A maliciously crafted or unexpectedly massive OSV payload from upstream could cause Pilot to exhaust memory or crash during JSON parsing.',
      elements: [pilot],
    },
    {
      id: 'c87367bd-fc3f-4792-94b6-8db459011823',
      number: 101,
      title: 'Oracle Blackout / Supply Chain DoS via OSV.dev compromise',
      category: { methodology: 'STRIDE', category: 'spoofing' },
      severity: 'high',
      status: 'accepted-risk',
      description:
        'An attacker who gains control of osv.dev can push malicious vulnerability records. Those records trigger false positives, or fast-lane a malicious remediation package. The attack is strongest when the attacker also publishes a malicious package.',
      elements: [pilot],
    },
  ],
  lastIssuedThreatNumber: 102,
  mitigations: [
    {
      id: 'b1a6332d-8def-4df9-922e-53718c920155-mitigation',
      title: '',
      prose:
        'Least-privilege IAM limits the role to s3:PutObject on the one bucket prefix. Pilot runs in its own container, separate from the proxy.',
      status: 'implemented',
      threats: ['b1a6332d-8def-4df9-922e-53718c920155'],
    },
    {
      id: '4b73d786-865e-43fc-b1bd-0e0bc75cae03-mitigation',
      title: '',
      prose:
        'Pilot runs apart from the proxy. If Pilot runs out of memory or fails, it only delays updates. The proxy keeps serving traffic from the last-known-good osv.db snapshot.',
      status: 'implemented',
      threats: ['4b73d786-865e-43fc-b1bd-0e0bc75cae03'],
    },
    {
      id: 'c87367bd-fc3f-4792-94b6-8db459011823-mitigation',
      title: '',
      prose:
        'Risk treatment: accepted by trust assumption. A compromised security oracle is a foundational supply-chain compromise. Pilot relies on OSV as a source of vulnerability truth. A hostile oracle defeats the defence outright. Transport, parsing, validation, and last-good-database controls mitigate tampering in transit, malformed payloads, and update outages. They cannot make a hostile source of truth trustworthy.',
      status: 'proposed',
      threats: ['c87367bd-fc3f-4792-94b6-8db459011823'],
    },
  ],
  assumptions: [],
};

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
 * Every Saerskriven YAML file this repository commits in the writer's
 * canonical form: what a read of the committed bytes writes back is those
 * bytes again. The suites that gate a native file read this list rather than
 * a path, so a third file joins all of them by being added here. The frozen
 * fixtures at {@link frozenV021Path} and {@link frozenV030Path} are not among
 * them, because a write of their models is a later shape.
 *
 * `modelJsonPath` is where a file's internal model is written out for
 * `packages/render` and `packages/canvas`, which gate on a model and cannot
 * import a codec.
 */
export const nativeFixtures: readonly NativeFixture[] = [
  {
    name: 'feature-complete file',
    path: featureCompletePath,
    text: featureCompleteYaml,
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
