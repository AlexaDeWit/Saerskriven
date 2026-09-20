import { Either, Option } from 'effect';
import { issuesOf, seededModel, validModelFixture } from './model.fixtures.js';
import { issueFloodCode, type ParseIssueDetail } from './parse-issue.js';
import { boundedParse, parseModel, schemaFailureIssues } from './parse.js';

const plantEverywhere = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(plantEverywhere)
    : value !== null && typeof value === 'object'
      ? {
          ...Object.fromEntries(
            Object.entries(value).map(([key, entry]) => [
              key,
              plantEverywhere(entry),
            ]),
          ),
          undeclared: 'dropped',
        }
      : value;

type Rejection = {
  readonly named: string;
  readonly mutate: (draft: typeof validModelFixture) => void;
  readonly path: readonly (string | number)[];
  readonly detail: ParseIssueDetail;
};

describe('parseModel', () => {
  it('parses the committed valid fixture', () => {
    expect(Either.getOrNull(parseModel(validModelFixture))).toEqual(
      validModelFixture,
    );
  });

  it('keeps a mitigation and an assumption linked to no threat', () => {
    const unlinked = Either.getOrNull(
      seededModel((draft) => {
        draft.mitigations = draft.mitigations?.map((mitigation) => ({
          ...mitigation,
          threats: [],
        }));
        draft.assumptions = draft.assumptions?.map((assumption) => ({
          ...assumption,
          threats: [],
        }));
      }),
    );
    expect(
      unlinked?.mitigations.map(({ id, threats }) => [id, threats]),
    ).toEqual([['mitigation-tls', []]]);
    expect(
      unlinked?.assumptions.map(({ id, threats }) => [id, threats]),
    ).toEqual([['assumption-managed-db', []]]);
  });

  it('strips a key no schema declares rather than refusing the model', () => {
    expect(
      Either.getOrNull(parseModel(plantEverywhere(validModelFixture))),
    ).toEqual(validModelFixture);
  });

  it('reports violations as plain tagged data that survives a JSON round trip', () => {
    const failure = Option.getOrUndefined(
      Either.getLeft(
        parseModel({
          ...validModelFixture,
          metadata: 'Saerskriven',
        }),
      ),
    );
    expect(failure?._tag).toBe('InvalidModel');
    expect(failure?.issues).toContainEqual({
      path: ['metadata'],
      detail: {
        code: 'type-mismatch',
        parameters: { expected: 'object', received: 'string' },
      },
    });
    expect(JSON.parse(JSON.stringify(failure))).toEqual({
      _tag: 'InvalidModel',
      issues: failure?.issues,
    });
  });

  it.each<Rejection>([
    {
      named: 'a duplicate element id across diagrams',
      mutate: (draft) => {
        draft.diagrams.push({
          id: 'diagram-second',
          title: 'Second',
          elements: [structuredClone(draft.diagrams[0].elements[0])],
        });
      },
      path: ['diagrams', 1, 'elements', 0, 'id'],
      detail: {
        code: 'duplicate-element-id',
        parameters: { id: 'element-customer' },
      },
    },
    {
      named: 'a duplicate diagram id',
      mutate: (draft) => {
        draft.diagrams.push({
          id: 'diagram-main',
          title: 'Copy',
          elements: [],
        });
      },
      path: ['diagrams', 1, 'id'],
      detail: {
        code: 'duplicate-diagram-id',
        parameters: { id: 'diagram-main' },
      },
    },
    {
      named: 'a duplicate threat number',
      mutate: (draft) => {
        draft.threats.push({
          ...structuredClone(draft.threats[0]),
          id: 'threat-second',
        });
      },
      path: ['threats', 1, 'number'],
      detail: { code: 'duplicate-threat-number', parameters: { number: 1 } },
    },
    {
      named: 'a threat number above the last issued',
      mutate: (draft) => {
        draft.lastIssuedThreatNumber = 0;
      },
      path: ['lastIssuedThreatNumber'],
      detail: {
        code: 'threat-number-above-issued',
        parameters: { number: 1, issued: 0 },
      },
    },
    {
      named: 'a duplicate threat id',
      mutate: (draft) => {
        draft.threats.push({ ...structuredClone(draft.threats[0]), number: 2 });
        draft.lastIssuedThreatNumber = 2;
      },
      path: ['threats', 1, 'id'],
      detail: {
        code: 'duplicate-threat-id',
        parameters: { id: 'threat-tamper-order' },
      },
    },
    {
      named: 'a duplicate mitigation id',
      mutate: (draft) => {
        draft.mitigations.push(structuredClone(draft.mitigations[0]));
      },
      path: ['mitigations', 1, 'id'],
      detail: {
        code: 'duplicate-mitigation-id',
        parameters: { id: 'mitigation-tls' },
      },
    },
    {
      named: 'a duplicate assumption id',
      mutate: (draft) => {
        draft.assumptions.push(structuredClone(draft.assumptions[0]));
      },
      path: ['assumptions', 1, 'id'],
      detail: {
        code: 'duplicate-assumption-id',
        parameters: { id: 'assumption-managed-db' },
      },
    },
    {
      named: 'a flow anchored outside its own diagram',
      mutate: (draft) => {
        draft.diagrams.push({
          id: 'diagram-second',
          title: 'Second',
          elements: [
            {
              ...structuredClone(draft.diagrams[0].elements[1]),
              id: 'element-remote',
            },
          ],
        });
        for (const element of draft.diagrams[0].elements) {
          if (element.kind === 'flow') {
            element.source = { kind: 'attached', element: 'element-remote' };
          }
        }
      },
      path: ['diagrams', 0, 'elements', 3, 'source', 'element'],
      detail: {
        code: 'flow-endpoint-foreign',
        parameters: { id: 'element-remote' },
      },
    },
    {
      named: 'a flow anchored to itself',
      mutate: (draft) => {
        for (const element of draft.diagrams[0].elements) {
          if (element.kind === 'flow') {
            element.target = { kind: 'attached', element: element.id };
          }
        }
      },
      path: ['diagrams', 0, 'elements', 3, 'target', 'element'],
      detail: {
        code: 'flow-endpoint-self',
        parameters: { id: 'element-order-flow' },
      },
    },
    {
      named: 'a threat attachment naming an unknown element',
      mutate: (draft) => {
        draft.threats[0].elements.push('element-ghost');
      },
      path: ['threats', 0, 'elements', 2],
      detail: {
        code: 'unknown-element-reference',
        parameters: { id: 'element-ghost' },
      },
    },
    {
      named: 'a mitigation naming an unknown threat',
      mutate: (draft) => {
        draft.mitigations[0].threats.push('threat-ghost');
      },
      path: ['mitigations', 0, 'threats', 1],
      detail: {
        code: 'unknown-threat-reference',
        parameters: { id: 'threat-ghost' },
      },
    },
    {
      named: 'an assumption naming an unknown threat',
      mutate: (draft) => {
        draft.assumptions[0].threats.push('threat-ghost');
      },
      path: ['assumptions', 0, 'threats', 1],
      detail: {
        code: 'unknown-threat-reference',
        parameters: { id: 'threat-ghost' },
      },
    },
  ])('rejects $named', ({ mutate, path, detail }) => {
    expect(issuesOf(seededModel(mutate))).toContainEqual({ path, detail });
  });

  it('surfaces multiple violations in one parse', () => {
    const result = seededModel((draft) => {
      draft.diagrams.push({ id: 'diagram-main', title: 'Copy', elements: [] });
      draft.threats[0].elements.push('element-ghost');
    });
    expect(issuesOf(result)).toHaveLength(2);
  });
});

const throwing = (error: Error) => ({
  safeParse: (): never => {
    throw error;
  },
});

describe('boundedParse', () => {
  it.each([
    ['RangeError', new RangeError('overflow'), issueFloodCode],
    ['TypeError', new TypeError('schema defect'), 'schema-threw'],
  ])(
    'turns a parse that throws %s into one root issue',
    (_name, error, code) => {
      const parsed = boundedParse(throwing(error), {});

      expect(
        Either.isLeft(parsed) && schemaFailureIssues(parsed.left),
      ).toMatchObject([{ path: [], detail: { code } }]);
    },
  );

  it('refuses a model with more invalid entries than zod 4.6.2 gathers on V8', () => {
    const flooded = {
      ...validModelFixture,
      threats: [{ elements: Array.from({ length: 135_000 }, () => 1) }],
    };

    const parsed = parseModel(flooded);

    expect(Either.isLeft(parsed) && parsed.left).toMatchObject({
      _tag: 'InvalidModel',
      issues: [{ path: [], detail: { code: issueFloodCode } }],
    });
  });
});
