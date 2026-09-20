import { readAnyFormat, readLimits } from '@saerskriven/formats';
import { OperationFailure, type AssumptionStatus } from '@saerskriven/model';
import { assumptionId } from '@saerskriven/model/fixtures';
import { Either } from 'effect';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { unclaimedFile } from '../fixtures.js';
import {
  dragonFile,
  editableTree,
  modelFile,
  renaming,
  staleRevision,
  type EditInput,
} from './edit.fixtures.js';
import { editArgumentsSchema, editModel, renderEdit } from './edit.js';
import { getThreat } from './get-threat.js';
import { describeOperationFailure } from './operation-failure.js';
import { revisionOf } from './revision.js';
import { searchThreats } from './search-threats.js';
import { openWorkspace } from './workspace.js';
import { refusalOf } from './read-tools.fixtures.js';

const addedMitigation = (
  threat: string,
  prose = 'Record every write with the caller.',
): EditInput => ({
  op: 'add_mitigation',
  mitigation: {
    id: 'mitigation-audit-log',
    title: 'Audit log',
    prose,
    status: 'proposed',
    threats: [threat],
  },
});

const dragonThreat = 'threat-tampering';

const attempt = () => {
  const tree = editableTree();
  const workspace = Either.getOrThrow(openWorkspace({ root: tree.root }));
  const bytes = (file: string): Buffer => readFileSync(join(tree.root, file));
  return {
    workspace,
    bytes,
    edit: (file: string, revision: string, edits: readonly EditInput[]) =>
      editModel(
        workspace,
        editArgumentsSchema.parse({ file, revision, edits }),
      ),
  };
};

const revisionIn = (
  attempted: ReturnType<typeof attempt>,
  file: string,
): string => revisionOf(attempted.bytes(file));

describe('what a refused edit leaves on disk', () => {
  it.each<{
    readonly name: string;
    readonly file: string;
    readonly revision: (attempted: ReturnType<typeof attempt>) => string;
    readonly edits: readonly EditInput[];
    readonly phrase: string;
    readonly lines: number;
  }>([
    {
      name: 'the model refuses one edit of the batch',
      file: modelFile,
      revision: (attempted) => revisionIn(attempted, modelFile),
      edits: [renaming, { op: 'remove_element', element: 'element-absent' }],
      phrase: 'index 1',
      lines: 2,
    },
    {
      name: 'the revision no longer matches the file',
      file: modelFile,
      revision: () => staleRevision,
      edits: [renaming],
      phrase: 'changed since the read this call quoted',
      lines: 3,
    },
    {
      name: 'no codec claims the file',
      file: unclaimedFile,
      revision: (attempted) => revisionIn(attempted, unclaimedFile),
      edits: [renaming],
      phrase: 'was not read',
      lines: 2,
    },
    {
      name: 'the edited model would be past the size this server reads',
      file: modelFile,
      revision: (attempted) => revisionIn(attempted, modelFile),
      edits: [
        addedMitigation(
          'threat-tamper-order',
          'x'.repeat(readLimits.maxTextBytes),
        ),
      ],
      phrase: 'past the size this server reads',
      lines: 2,
    },
  ])(
    'writes nothing when $name',
    ({ file, revision, edits, phrase, lines }) => {
      const attempted = attempt();
      const before = attempted.bytes(file);
      const refused = refusalOf(
        attempted.edit(file, revision(attempted), edits),
      );
      expect(attempted.bytes(file)).toEqual(before);
      expect(refused.join('\n')).toContain(phrase);
      expect(refused).toHaveLength(lines);
    },
  );
});

describe('what an applied edit writes', () => {
  it('reports the file, the count and the handle the next write quotes', () => {
    const attempted = attempt();
    const quoted = revisionIn(attempted, modelFile);
    const applied = attempted.edit(modelFile, quoted, [renaming]);
    const written = revisionIn(attempted, modelFile);
    expect(Either.getOrUndefined(applied)).toEqual({
      file: modelFile,
      format: 'saerskriven-yaml',
      revision: written,
      applied: 1,
      culled: [],
      culledThreats: [],
      divergences: [],
    });
    expect(written).not.toEqual(quoted);
  });

  it('reads as the lines a text result carries', () => {
    const attempted = attempt();
    const applied = attempted.edit(
      modelFile,
      revisionIn(attempted, modelFile),
      [renaming],
    );
    expect(
      Either.match(applied, { onLeft: (lines) => lines, onRight: renderEdit }),
    ).toEqual([
      'edits applied: 1',
      'culled:',
      'No record culled.',
      'threats culled:',
      'No threat culled.',
      `file: ${modelFile}`,
      'format: saerskriven-yaml',
      `revision: ${revisionIn(attempted, modelFile)}`,
      'divergences:',
      'No divergence recorded.',
    ]);
  });

  it('keeps a Threat Dragon file in its own format and reports what it cannot hold', () => {
    const attempted = attempt();
    const applied = attempted.edit(
      dragonFile,
      revisionIn(attempted, dragonFile),
      [addedMitigation(dragonThreat)],
    );
    const reread = readAnyFormat(attempted.bytes(dragonFile).toString('utf8'));
    expect(Either.getOrUndefined(applied)?.format).toEqual('threat-dragon');
    expect(
      Either.getOrUndefined(applied)?.divergences.map(
        ({ subject, reason }) => ({ subject, reason }),
      ),
    ).toEqual([
      { subject: { kind: 'threat', id: dragonThreat }, reason: 'narrowed' },
    ]);
    expect(Either.getOrUndefined(reread)?.format).toEqual('threat-dragon');
  });
});

const addedBackups = (
  fields: Partial<{
    threats: string[];
    status: AssumptionStatus;
    appliesToModel: boolean;
  }>,
): EditInput => ({
  op: 'add_assumption',
  assumption: {
    id: 'assumption-backups',
    prose: 'Backups are encrypted with the same key policy.',
    threats: [],
    ...fields,
  },
});

const heldModel = (attempted: ReturnType<typeof attempt>) =>
  Either.getOrUndefined(
    readAnyFormat(attempted.bytes(modelFile).toString('utf8')),
  )?.model;

const backupsIn = (attempted: ReturnType<typeof attempt>) =>
  heldModel(attempted)?.assumptions.find(
    ({ id }) => id === 'assumption-backups',
  );

describe('what add_assumption writes', () => {
  it('refuses an assumption that links no threat and does not apply to the model, and writes nothing', () => {
    const attempted = attempt();
    const before = attempted.bytes(modelFile);
    const refused = attempted.edit(
      modelFile,
      revisionIn(attempted, modelFile),
      [addedBackups({})],
    );
    expect(attempted.bytes(modelFile)).toEqual(before);
    expect(Either.isLeft(refused) ? refused.left[1] : undefined).toEqual(
      describeOperationFailure(
        OperationFailure.AssumptionWithoutReference({
          assumptionId: assumptionId('assumption-backups'),
        }),
      ),
    );
  });

  it('adds an unconfirmed assumption with no model link where neither is given', () => {
    const attempted = attempt();
    const applied = attempted.edit(
      modelFile,
      revisionIn(attempted, modelFile),
      [addedBackups({ threats: ['threat-tamper-order'] })],
    );
    expect(Either.getOrUndefined(applied)?.divergences).toEqual([]);
    expect(backupsIn(attempted)).toMatchObject({
      status: 'unconfirmed',
      appliesToModel: false,
    });
  });

  it('adds the status a call gives', () => {
    const attempted = attempt();
    attempted.edit(modelFile, revisionIn(attempted, modelFile), [
      addedBackups({ threats: ['threat-tamper-order'], status: 'valid' }),
    ]);
    expect(backupsIn(attempted)?.status).toEqual('valid');
  });

  it('adds an assumption that applies to the model and links no threat', () => {
    const attempted = attempt();
    attempted.edit(modelFile, revisionIn(attempted, modelFile), [
      addedBackups({ appliesToModel: true }),
    ]);
    expect(backupsIn(attempted)).toMatchObject({
      threats: [],
      appliesToModel: true,
    });
  });
});

const replay: EditInput = {
  op: 'add_threat',
  threat: {
    id: 'threat-replay',
    title: 'Order replay',
    category: { methodology: 'STRIDE', category: 'repudiation' },
    severity: 'low',
    status: 'open',
    description: '',
    elements: [],
  },
};

describe('a mitigation shared between threats and unlinked from both', () => {
  const attempted = attempt();
  const linked = attempted.edit(modelFile, revisionIn(attempted, modelFile), [
    replay,
    {
      op: 'link_mitigation',
      mitigation: 'mitigation-tls',
      threat: 'threat-replay',
    },
  ]);
  const readOn = (ref: string) =>
    Either.getOrUndefined(
      getThreat(attempted.workspace, { file: modelFile, ref }),
    )?.mitigations.map(({ id }) => id);
  const onEither = [readOn('threat-tamper-order'), readOn('threat-replay')];
  const unlinked = attempted.edit(
    modelFile,
    revisionIn(attempted, modelFile),
    ['threat-tamper-order', 'threat-replay'].map((threat): EditInput => ({
      op: 'unlink_mitigation',
      mitigation: 'mitigation-tls',
      threat,
    })),
  );

  it('is read on either threat once linked to the second', () => {
    expect(Either.isRight(linked)).toBe(true);
    expect(onEither).toEqual([['mitigation-tls'], ['mitigation-tls']]);
  });

  it('leaves the file and is named culled once unlinked from its last threat', () => {
    expect(Either.getOrUndefined(unlinked)?.culled).toEqual([
      { kind: 'mitigation', id: 'mitigation-tls' },
    ]);
    expect(heldModel(attempted)?.mitigations).toEqual([]);
  });
});

describe('an assumption applied to the model and unlinked', () => {
  const attempted = attempt();
  const managedDb = () =>
    heldModel(attempted)?.assumptions.find(
      ({ id }) => id === 'assumption-managed-db',
    );
  const applied = attempted.edit(modelFile, revisionIn(attempted, modelFile), [
    { op: 'link_assumption_to_model', assumption: 'assumption-managed-db' },
    {
      op: 'unlink_assumption',
      assumption: 'assumption-managed-db',
      threat: 'threat-tamper-order',
    },
  ]);
  const kept = managedDb();
  const taken = attempted.edit(modelFile, revisionIn(attempted, modelFile), [
    { op: 'unlink_assumption_from_model', assumption: 'assumption-managed-db' },
  ]);

  it('stays in the file and is named nowhere once its last threat link goes', () => {
    expect(Either.getOrUndefined(applied)?.culled).toEqual([]);
    expect(kept).toMatchObject({ threats: [], appliesToModel: true });
  });

  it('leaves the file and is named culled once its model link goes too', () => {
    expect(Either.getOrUndefined(taken)?.culled).toEqual([
      { kind: 'assumption', id: 'assumption-managed-db' },
    ]);
    expect(managedDb()).toBeUndefined();
  });
});

describe('a link op naming what the model does not hold', () => {
  const refusals: readonly EditInput[] = [
    {
      op: 'link_mitigation',
      mitigation: 'mitigation-absent',
      threat: 'threat-tamper-order',
    },
    {
      op: 'link_assumption',
      assumption: 'assumption-managed-db',
      threat: 'threat-absent',
    },
  ];

  for (const refused of refusals) {
    it(`refuses ${refused.op} and writes nothing`, () => {
      const attempted = attempt();
      const before = attempted.bytes(modelFile);
      const outcome = attempted.edit(
        modelFile,
        revisionIn(attempted, modelFile),
        [renaming, refused],
      );
      expect(Either.isLeft(outcome) ? outcome.left[0] : undefined).toContain(
        'index 1 was refused',
      );
      expect(attempted.bytes(modelFile)).toEqual(before);
    });
  }
});

const flagsOf = (attempted: ReturnType<typeof attempt>) =>
  Either.getOrUndefined(
    searchThreats(attempted.workspace, {
      file: modelFile,
      response_format: 'concise',
    }),
  )?.threats.map(({ id, status, flags }) => ({ id, status, flags }));

describe('what a status edit does to the flags a search reads', () => {
  it('clears the mitigated-without-implemented-work flag once the only mitigation is implemented', () => {
    const attempted = attempt();
    attempted.edit(modelFile, revisionIn(attempted, modelFile), [
      {
        op: 'set_threat_status',
        threat: 'threat-tamper-order',
        status: 'mitigated',
      },
    ]);
    const flagged = flagsOf(attempted);
    attempted.edit(modelFile, revisionIn(attempted, modelFile), [
      {
        op: 'set_mitigation_status',
        mitigation: 'mitigation-tls',
        status: 'implemented',
      },
    ]);
    expect([flagged, flagsOf(attempted)]).toEqual([
      [
        {
          id: 'threat-tamper-order',
          status: 'mitigated',
          flags: ['mitigated-without-implemented-work'],
        },
      ],
      [{ id: 'threat-tamper-order', status: 'mitigated', flags: [] }],
    ]);
  });

  it('raises no flag for an invalidated assumption that applies to the model and links no threat', () => {
    const attempted = attempt();
    const applied = attempted.edit(
      modelFile,
      revisionIn(attempted, modelFile),
      [
        addedBackups({ appliesToModel: true }),
        {
          op: 'set_assumption_status',
          assumption: 'assumption-backups',
          status: 'invalidated',
        },
      ],
    );
    expect(Either.isRight(applied)).toBe(true);
    expect(flagsOf(attempted)).toEqual([
      { id: 'threat-tamper-order', status: 'open', flags: [] },
    ]);
  });
});

describe('the records and threats a batch culls', () => {
  it('names each record a removed threat took with it, in its lines too', () => {
    const attempted = attempt();
    const applied = attempted.edit(
      modelFile,
      revisionIn(attempted, modelFile),
      [{ op: 'remove_threat', threat: 'threat-tamper-order' }],
    );
    expect(Either.getOrUndefined(applied)?.culled).toEqual([
      { kind: 'mitigation', id: 'mitigation-tls' },
      { kind: 'assumption', id: 'assumption-managed-db' },
    ]);
    expect(
      Either.match(applied, { onLeft: (lines) => lines, onRight: renderEdit }),
    ).toEqual(
      expect.arrayContaining([
        'mitigation "mitigation-tls"',
        'assumption "assumption-managed-db"',
      ]),
    );
  });

  it('names a threat a detach left attached to nothing, with what it took', () => {
    const attempted = attempt();
    const applied = attempted.edit(
      modelFile,
      revisionIn(attempted, modelFile),
      ['element-api', 'element-order-flow'].map((element): EditInput => ({
        op: 'detach_threat',
        threat: 'threat-tamper-order',
        element,
      })),
    );
    expect(
      Either.getOrUndefined(applied)?.culledThreats.map(({ id }) => id),
    ).toEqual(['threat-tamper-order']);
    expect(Either.getOrUndefined(applied)?.culled).toEqual([
      { kind: 'mitigation', id: 'mitigation-tls' },
      { kind: 'assumption', id: 'assumption-managed-db' },
    ]);
    expect(heldModel(attempted)?.threats).toEqual([]);
    expect(
      Either.match(applied, { onLeft: (lines) => lines, onRight: renderEdit }),
    ).toEqual(
      expect.arrayContaining([
        'threats culled:',
        'threat 1 ("threat-tamper-order"): Order tampering in transit',
      ]),
    );
  });

  it('names a threat whose last attachment a removed element was', () => {
    const attempted = attempt();
    const applied = attempted.edit(
      modelFile,
      revisionIn(attempted, modelFile),
      ['element-api', 'element-order-flow'].map((element): EditInput => ({
        op: 'remove_element',
        element,
      })),
    );
    expect(
      Either.getOrUndefined(applied)?.culledThreats.map(({ id }) => id),
    ).toEqual(['threat-tamper-order']);
  });

  it('names no threat a remove_threat took, nor one detached from one element of two', () => {
    const attempted = attempt();
    const applied = attempted.edit(
      modelFile,
      revisionIn(attempted, modelFile),
      [
        {
          op: 'detach_threat',
          threat: 'threat-tamper-order',
          element: 'element-api',
        },
        { op: 'remove_threat', threat: 'threat-tamper-order' },
      ],
    );
    expect(Either.getOrUndefined(applied)?.culledThreats).toEqual([]);
  });

  it('names neither an explicitly removed record nor one the batch added and culled', () => {
    const attempted = attempt();
    const applied = attempted.edit(
      modelFile,
      revisionIn(attempted, modelFile),
      [
        { op: 'remove_mitigation', mitigation: 'mitigation-tls' },
        addedMitigation('threat-tamper-order'),
        { op: 'remove_assumption', assumption: 'assumption-managed-db' },
        { op: 'remove_threat', threat: 'threat-tamper-order' },
      ],
    );
    expect(Either.getOrUndefined(applied)?.culled).toEqual([]);
  });
});

const tlsOn = (threat: string): EditInput => ({
  op: 'add_mitigation',
  mitigation: {
    id: 'mitigation-tls',
    title: 'TLS on the order flow',
    prose: 'Terminate TLS at the perimeter and pin the certificate.',
    status: 'proposed',
    threats: [threat],
  },
});

describe('the records a batch culls and adds back', () => {
  const culledBy = (edits: readonly EditInput[]) => {
    const attempted = attempt();
    return Either.getOrUndefined(
      attempted.edit(modelFile, revisionIn(attempted, modelFile), edits),
    )?.culled;
  };

  it('names a record a removed threat culled, though a later edit adds it back', () => {
    expect(
      culledBy([
        replay,
        { op: 'remove_threat', threat: 'threat-tamper-order' },
        tlsOn('threat-replay'),
      ]),
    ).toEqual([
      { kind: 'mitigation', id: 'mitigation-tls' },
      { kind: 'assumption', id: 'assumption-managed-db' },
    ]);
  });

  it('names a record the file held that the batch removed, added back and then culled', () => {
    expect(
      culledBy([
        { op: 'remove_mitigation', mitigation: 'mitigation-tls' },
        tlsOn('threat-tamper-order'),
        { op: 'remove_assumption', assumption: 'assumption-managed-db' },
        { op: 'remove_threat', threat: 'threat-tamper-order' },
      ]),
    ).toEqual([{ kind: 'mitigation', id: 'mitigation-tls' }]);
  });
});

describe('what the flow direction and metadata ops write', () => {
  it('makes a flow bidirectional and keeps the threats attached to it', () => {
    const attempted = attempt();
    attempted.edit(modelFile, revisionIn(attempted, modelFile), [
      {
        op: 'set_flow_direction',
        element: 'element-order-flow',
        bidirectional: true,
      },
    ]);
    const model = Either.getOrUndefined(
      readAnyFormat(attempted.bytes(modelFile).toString('utf8')),
    )?.model;
    expect(
      model?.diagrams[0].elements.find(
        (element) => element.id === 'element-order-flow',
      ),
    ).toMatchObject({ bidirectional: true });
    expect(
      model?.threats.find((threat) => threat.id === 'threat-tamper-order')
        ?.elements,
    ).toContain('element-order-flow');
  });

  const metadata = {
    title: 'Clinic booking, second pass',
    owner: 'Jonas Lindqvist',
    description: 'Reviewed with the platform team.\nSecond line.',
    contributors: ['Alexandra de Wit', 'Jonas Lindqvist', ''],
  };

  for (const file of [modelFile, dragonFile]) {
    it(`carries every metadata field through a ${file} write and back`, () => {
      const attempted = attempt();
      const applied = attempted.edit(file, revisionIn(attempted, file), [
        { op: 'set_model_metadata', ...metadata },
      ]);
      const reread = readAnyFormat(attempted.bytes(file).toString('utf8'));
      expect(Either.getOrUndefined(reread)?.model.metadata).toEqual(metadata);
      expect(
        Either.getOrUndefined(applied)?.divergences.filter(
          (divergence) => divergence.subject.kind === 'model',
        ),
      ).toEqual([]);
    });
  }
});
