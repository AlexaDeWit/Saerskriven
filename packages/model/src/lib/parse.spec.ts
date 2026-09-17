import { Either, Option } from 'effect';
import { issuesOf, seededModel, validModelFixture } from './fixtures.js';
import { issueLine, parseModel, toParseIssues } from './parse.js';

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
  readonly message: string;
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
    expect(failure?.issues).toContainEqual(
      expect.objectContaining({ code: 'invalid_type', path: ['metadata'] }),
    );
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
      message:
        'Duplicate element id "element-customer": element ids must be unique across the model.',
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
      message:
        'Duplicate diagram id "diagram-main": diagram ids must be unique across the model.',
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
      message:
        'Duplicate threat number 1: threat numbers must be unique across the model.',
    },
    {
      named: 'a threat number above the last issued',
      mutate: (draft) => {
        draft.lastIssuedThreatNumber = 0;
      },
      path: ['lastIssuedThreatNumber'],
      message:
        'Threat number 1 exceeds lastIssuedThreatNumber 0: no threat carries a number above the last issued.',
    },
    {
      named: 'a duplicate threat id',
      mutate: (draft) => {
        draft.threats.push({ ...structuredClone(draft.threats[0]), number: 2 });
        draft.lastIssuedThreatNumber = 2;
      },
      path: ['threats', 1, 'id'],
      message:
        'Duplicate threat id "threat-tamper-order": threat ids must be unique among threats.',
    },
    {
      named: 'a duplicate mitigation id',
      mutate: (draft) => {
        draft.mitigations.push(structuredClone(draft.mitigations[0]));
      },
      path: ['mitigations', 1, 'id'],
      message:
        'Duplicate mitigation id "mitigation-tls": mitigation ids must be unique among mitigations.',
    },
    {
      named: 'a duplicate assumption id',
      mutate: (draft) => {
        draft.assumptions.push(structuredClone(draft.assumptions[0]));
      },
      path: ['assumptions', 1, 'id'],
      message:
        'Duplicate assumption id "assumption-managed-db": assumption ids must be unique among assumptions.',
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
      message:
        'Flow source references element id "element-remote", which is not in the flow\'s own diagram.',
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
      message:
        'Flow target references the flow\'s own id "element-order-flow": a flow cannot anchor to itself.',
    },
    {
      named: 'a threat attachment naming an unknown element',
      mutate: (draft) => {
        draft.threats[0].elements.push('element-ghost');
      },
      path: ['threats', 0, 'elements', 2],
      message: 'Threat elements references unknown element id "element-ghost".',
    },
    {
      named: 'a mitigation naming an unknown threat',
      mutate: (draft) => {
        draft.mitigations[0].threats.push('threat-ghost');
      },
      path: ['mitigations', 0, 'threats', 1],
      message:
        'Mitigation threats references unknown threat id "threat-ghost".',
    },
    {
      named: 'an assumption naming an unknown threat',
      mutate: (draft) => {
        draft.assumptions[0].threats.push('threat-ghost');
      },
      path: ['assumptions', 0, 'threats', 1],
      message:
        'Assumption threats references unknown threat id "threat-ghost".',
    },
  ])('rejects $named', ({ mutate, path, message }) => {
    expect(issuesOf(seededModel(mutate))).toContainEqual(
      expect.objectContaining({ path, message }),
    );
  });

  it('surfaces multiple violations in one parse', () => {
    const result = seededModel((draft) => {
      draft.diagrams.push({ id: 'diagram-main', title: 'Copy', elements: [] });
      draft.threats[0].elements.push('element-ghost');
    });
    expect(issuesOf(result)).toHaveLength(2);
  });
});

describe('toParseIssues', () => {
  it('renders a symbol path segment, which no JSON key spells, as text', () => {
    expect(
      toParseIssues([
        {
          path: ['diagrams', 0, Symbol('kind')],
          message: 'no',
          code: 'custom',
        },
      ]),
    ).toEqual([
      { path: ['diagrams', 0, 'Symbol(kind)'], message: 'no', code: 'custom' },
    ]);
  });
});

describe('issueLine', () => {
  it('prints an issue as its dotted path and message, and an empty path as (root)', () => {
    expect(
      issueLine({ path: ['diagrams', 0, 'id'], message: 'no', code: 'custom' }),
    ).toBe('diagrams.0.id: no');
    expect(issueLine({ path: [], message: 'no', code: 'custom' })).toBe(
      '(root): no',
    );
  });
});
