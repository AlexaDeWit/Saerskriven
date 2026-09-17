import { saerskrivenYamlWireSchema } from '@saerskriven/wire-saerskriven-yaml';
import { Either } from 'effect';
import { parse } from 'yaml';
import { readFailureIssues } from './codec.fixtures.js';
import { writeSaerskrivenYaml } from './saerskriven-yaml-write.js';
import {
  readSaerskrivenYaml,
  readSaerskrivenYamlDocument,
} from './saerskriven-yaml-read.js';
import { minimalYamlV1, oneThreatYamlV1 } from './saerskriven-yaml.fixtures.js';

const oneFlowDocument = oneThreatYamlV1.replace(
  'threats:',
  [
    '      - kind: store',
    '        id: element-2',
    '        name: Ledger',
    '        description: ""',
    '        outOfScope: false',
    '        reasonOutOfScope: ""',
    '        position:',
    '          x: 200',
    '          y: 0',
    '        size:',
    '          width: 10',
    '          height: 10',
    '      - kind: flow',
    '        id: element-3',
    '        name: Posts',
    '        description: ""',
    '        outOfScope: false',
    '        reasonOutOfScope: ""',
    '        source:',
    '          kind: attached',
    '          element: element-1',
    '        target:',
    '          kind: attached',
    '          element: element-2',
    '        waypoints: []',
    'threats:',
  ].join('\n'),
);

const withPinnedBidirectionalFlow = oneFlowDocument
  .replace(
    '          element: element-2',
    '          element: element-2\n          side: bottom',
  )
  .replace(
    '        waypoints: []',
    '        waypoints: []\n        bidirectional: true',
  );

const elementLinkedAssumption = (elements: readonly string[]) =>
  oneFlowDocument.replace(
    'assumptions: []',
    [
      'assumptions:',
      '  - id: assumption-1',
      '    prose: The ledger is append only.',
      '    status: valid',
      `    elements: [${elements.join(', ')}]`,
      '    threats:',
      '      - threat-1',
    ].join('\n'),
  );

const threatlessAssumption = elementLinkedAssumption([]).replace(
  '    threats:\n      - threat-1',
  '    threats: []',
);

const threatlessAssumptionInVersion2 = threatlessAssumption
  .replace('formatVersion: 1', 'formatVersion: 2')
  .replace('    mitigation: ""\n', '')
  .replace('    elements: []\n    threats: []', '    threats: []');

const withMitigationText = (status: string) =>
  oneThreatYamlV1
    .replace('    status: open', `    status: ${status}`)
    .replace('    mitigation: ""', '    mitigation: Sign every request.');

const withMitigationRecord = (id: string) =>
  withMitigationText('open').replace(
    'mitigations: []',
    [
      'mitigations:',
      `  - id: ${id}`,
      '    title: Mutual TLS',
      '    prose: ""',
      '    status: verified',
      '    threats:',
      '      - threat-1',
    ].join('\n'),
  );

const withExtras = `${oneThreatYamlV1.replace(
  '    number: 1',
  '    number: 1\n    likelihood: high',
)}notes: kept nowhere\n`;

function readingOf(text: string) {
  const result = readSaerskrivenYaml(text);
  return Either.isRight(result) ? result.right : undefined;
}

function failureOf(text: string) {
  const result = readSaerskrivenYaml(text);
  return Either.isLeft(result) ? result.left : undefined;
}

function modelOfDocumentIn(text: string) {
  const read = readSaerskrivenYaml(text);
  return Either.isLeft(read)
    ? undefined
    : Either.getOrUndefined(readSaerskrivenYamlDocument(read.right.source));
}

function issuePathsOf(text: string) {
  const failure = failureOf(text);
  return failure === undefined
    ? []
    : readFailureIssues(failure).map((issue) => issue.path);
}

describe('a Saerskriven YAML read', () => {
  it('refuses a file with no formatVersion at that path', () => {
    const without = minimalYamlV1.replace('formatVersion: 1\n', '');
    expect(failureOf(without)?._tag).toBe('InvalidWireDocument');
    expect(issuePathsOf(without)).toEqual([['formatVersion']]);
  });

  it('refuses a file stamped with a release it does not know at that path', () => {
    const later = minimalYamlV1.replace('formatVersion: 1', 'formatVersion: 3');
    expect(failureOf(later)?._tag).toBe('InvalidWireDocument');
    expect(issuePathsOf(later)).toEqual([['formatVersion']]);
  });

  it('refuses a version 2 file broken below formatVersion with a path into it', () => {
    expect(issuePathsOf(threatlessAssumptionInVersion2)).toEqual([
      ['assumptions', 0, 'appliesToModel'],
    ]);
  });

  it('refuses text that is not YAML without throwing out of the read', () => {
    expect(failureOf('formatVersion: [1')?._tag).toBe('MalformedText');
  });

  it('refuses a document that is not a mapping', () => {
    expect(failureOf('a plain scalar')?._tag).toBe('InvalidWireDocument');
  });

  it('refuses an alias that closes a cycle rather than following it', () => {
    expect(
      failureOf(
        ['formatVersion: 1', 'metadata: &loop', '  title: *loop', ''].join(
          '\n',
        ),
      )?._tag,
    ).toBe('ExceededReadLimit');
  });

  it('refuses a document the model refuses, with a path into the model', () => {
    const dangling = oneThreatYamlV1.replace(
      '      - element-1',
      '      - element-9',
    );
    expect(failureOf(dangling)?._tag).toBe('InvalidModel');
    expect(issuePathsOf(dangling)).toEqual([['threats', 0, 'elements', 0]]);
  });

  it('refuses a title carrying a character the model refuses, pathed into the model', () => {
    const overridden = minimalYamlV1.replace(
      '  title: Minimal',
      '  title: "Minimal\u202E"',
    );
    expect(failureOf(overridden)?._tag).toBe('InvalidModel');
    expect(issuePathsOf(overridden)).toEqual([['metadata', 'title']]);
  });

  it('reads a valid file with nothing to report', () => {
    expect(readingOf(minimalYamlV1)?.divergences).toEqual([]);
  });

  it('reads a flow written before it had a direction or a pinned side, and one that has both', () => {
    const flowOf = (text: string) =>
      readingOf(text)?.model.diagrams[0]?.elements.find(
        (element) => element.kind === 'flow',
      );
    expect(readingOf(oneFlowDocument)?.divergences).toEqual([]);
    expect(flowOf(oneFlowDocument)).toMatchObject({
      target: { kind: 'attached', element: 'element-2' },
      bidirectional: false,
    });
    expect(flowOf(withPinnedBidirectionalFlow)).toMatchObject({
      target: { kind: 'attached', element: 'element-2', side: 'bottom' },
      bidirectional: true,
    });
  });
});

describe('a version 1 assumption that links elements', () => {
  it('reads with its threat links and without its element links', () => {
    expect(
      readingOf(elementLinkedAssumption(['element-1', 'element-2']))?.model
        .assumptions,
    ).toEqual([
      {
        id: 'assumption-1',
        prose: 'The ledger is append only.',
        status: 'valid',
        threats: ['threat-1'],
        appliesToModel: false,
      },
    ]);
  });

  it('is reported once as narrowed, naming the assumption', () => {
    expect(
      readingOf(elementLinkedAssumption(['element-1', 'element-2']))
        ?.divergences,
    ).toEqual([
      expect.objectContaining({
        subject: { kind: 'assumption', id: 'assumption-1' },
        reason: 'narrowed',
      }),
    ]);
  });

  it('hands back a version 2 source document, which holds no element links', () => {
    const source = readingOf(
      elementLinkedAssumption(['element-1', 'element-2']),
    )?.source;
    expect(source?.formatVersion).toBe(2);
    expect(source?.assumptions).toEqual([
      {
        id: 'assumption-1',
        prose: 'The ledger is append only.',
        status: 'valid',
        threats: ['threat-1'],
        appliesToModel: false,
      },
    ]);
  });

  it('reports nothing when its element list is empty', () => {
    expect(readingOf(elementLinkedAssumption([]))?.divergences).toEqual([]);
  });
});

describe('a version 1 assumption that links no threat', () => {
  it('reads as an assumption that applies to the model, reporting nothing', () => {
    const reading = readingOf(threatlessAssumption);
    expect(reading?.model.assumptions).toEqual([
      expect.objectContaining({ threats: [], appliesToModel: true }),
    ]);
    expect(reading?.divergences).toEqual([]);
  });
});

describe('a version 1 threat that carries mitigation text', () => {
  it.each([
    ['mitigated', 'implemented'],
    ['open', 'proposed'],
    ['accepted-risk', 'proposed'],
  ])(
    'reads on a %s threat as one %s record linked to it, holding the text, reporting nothing',
    (threatStatus, recordStatus) => {
      const reading = readingOf(withMitigationText(threatStatus));
      expect(reading?.model.mitigations).toEqual([
        {
          id: 'threat-1-mitigation',
          title: '',
          prose: 'Sign every request.',
          status: recordStatus,
          threats: ['threat-1'],
        },
      ]);
      expect(reading?.divergences).toEqual([]);
    },
  );

  it('reads as no record when the text is empty', () => {
    expect(readingOf(oneThreatYamlV1)?.model.mitigations).toEqual([]);
  });

  it('keeps a record the file holds under the id the text would take, beside a distinct one', () => {
    expect(
      readingOf(withMitigationRecord('threat-1-mitigation'))?.model.mitigations,
    ).toEqual([
      expect.objectContaining({
        id: 'threat-1-mitigation',
        title: 'Mutual TLS',
        status: 'verified',
      }),
      expect.objectContaining({
        id: 'threat-1-mitigation-2',
        prose: 'Sign every request.',
        status: 'proposed',
      }),
    ]);
  });

  it('hands back a source document holding the record and no text', () => {
    const source = readingOf(withMitigationText('mitigated'))?.source;
    expect(
      source?.threats.map((threat) => Object.hasOwn(threat, 'mitigation')),
    ).toEqual([false]);
    expect(source?.mitigations.map(({ id }) => id)).toEqual([
      'threat-1-mitigation',
    ]);
  });

  it('writes back onto its source reporting nothing, and reads back as the same model', () => {
    const reading = readingOf(withMitigationText('mitigated'));
    const written =
      reading && writeSaerskrivenYaml(reading.model, reading.source);
    expect(written?.divergences).toEqual([]);
    const again = written && readingOf(written.output);
    expect(again?.model).toEqual(reading?.model);
    expect(again?.divergences).toEqual([]);
  });
});

describe('a Saerskriven YAML document mapped without its text', () => {
  it.each([
    {
      named: 'an assumption that links elements, dropping the links',
      text: elementLinkedAssumption(['element-1', 'element-2']),
      readAs: elementLinkedAssumption([]),
    },
    {
      named: 'a threat whose text meets a record holding its id',
      text: withMitigationRecord('threat-1-mitigation'),
      readAs: withMitigationRecord('threat-1-mitigation'),
    },
  ])(
    'maps $named from its version 1 wire document alone to the model its text reads as',
    ({ text, readAs }) => {
      expect(
        Either.getOrUndefined(
          readSaerskrivenYamlDocument(
            saerskrivenYamlWireSchema.parse(parse(text)),
          ),
        ),
      ).toEqual(readingOf(readAs)?.model);
    },
  );

  it.each([
    { named: 'a version 1 flow', text: oneFlowDocument },
    {
      named: 'an assumption that links no threat',
      text: threatlessAssumption,
    },
  ])(
    'maps $named from the version 2 source a read hands back to the model its text reads as',
    ({ text }) => {
      expect(modelOfDocumentIn(text)).toEqual(readingOf(text)?.model);
    },
  );

  it('defaults a key the document was written before the format declared', () => {
    expect(
      modelOfDocumentIn(oneFlowDocument)?.diagrams[0]?.elements.find(
        (element) => element.kind === 'flow',
      ),
    ).toMatchObject({ bidirectional: false });
  });
});

describe('a key the wire schema does not declare', () => {
  it('is dropped from the model rather than refusing the file', () => {
    expect(readingOf(withExtras)?.model).toEqual(
      readingOf(oneThreatYamlV1)?.model,
    );
  });

  it('is reported as undeclared, naming its path in the file', () => {
    expect(readingOf(withExtras)?.divergences).toEqual([
      {
        subject: { kind: 'model' },
        detail: 'the key threats.0.likelihood',
        reason: 'undeclared',
      },
      {
        subject: { kind: 'model' },
        detail: 'the key notes',
        reason: 'undeclared',
      },
    ]);
  });
});
