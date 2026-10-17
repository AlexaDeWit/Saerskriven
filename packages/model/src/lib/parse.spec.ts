import { Either, Option } from 'effect';
import { z } from 'zod';
import { validModel } from '../fixtures.js';
import { drawnElements } from './drawing.js';
import { floodingEntries } from './issue-flood.fixtures.js';
import type { ModelInput } from './model.js';
import {
  issuesOf,
  seededModel,
  seededPlacedModel,
  unnamedWithLoopedFlow,
  validModelFixture,
} from './model.fixtures.js';
import { parseDrawnModel } from './parse-drawn.js';
import { issueFloodCode, type ParseIssueDetail } from './parse-issue.js';
import type { PlacementInput } from './placements.js';
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

type Rejection<Draft> = {
  readonly named: string;
  readonly mutate: (draft: Draft) => void;
  readonly path: readonly (string | number)[];
  readonly detail: ParseIssueDetail;
};

const remoteProcess = {
  kind: 'process',
  id: 'element-remote',
  name: 'Remote',
  description: '',
  outOfScope: false,
  reasonOutOfScope: '',
} as const;

const onSecondDiagram = (
  draft: ModelInput,
  ...placements: readonly PlacementInput[]
) => {
  draft.elements.push(remoteProcess);
  draft.diagrams.push({
    id: 'diagram-second',
    title: 'Second',
    placements: [
      {
        element: 'element-remote',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 60 },
      },
      ...placements,
    ],
  });
};

const twinFlow = {
  kind: 'flow',
  id: 'element-twin',
  name: 'Twin route',
  description: '',
  outOfScope: false,
  reasonOutOfScope: '',
  source: { kind: 'free' },
  target: { kind: 'free' },
  bidirectional: false,
} as const;

const twinProcess = { ...remoteProcess, id: 'element-twin' } as const;

const twinBox: PlacementInput = {
  element: 'element-twin',
  position: { x: 0, y: 0 },
  size: { width: 100, height: 60 },
};

const twinRoute: PlacementInput = {
  element: 'element-twin',
  waypoints: [],
  source: { position: { x: 0, y: 0 } },
  target: { position: { x: 200, y: 0 } },
};

describe('parseModel', () => {
  it('parses the model a drawn read gives it into an equal model', () => {
    expect(Either.getOrNull(parseModel(validModel))).toEqual(validModel);
  });

  it('strips a key no schema declares rather than refusing the model', () => {
    expect(Either.getOrNull(parseModel(plantEverywhere(validModel)))).toEqual(
      validModel,
    );
  });

  it.each<Rejection<ModelInput>>([
    {
      named: 'a duplicate element id',
      mutate: (draft) => {
        draft.elements.push(structuredClone(draft.elements[0]));
      },
      path: ['elements', 6, 'id'],
      detail: {
        code: 'duplicate-element-id',
        parameters: { id: 'element-customer' },
      },
    },
    {
      named: 'a placement of an element the model does not hold',
      mutate: (draft) => {
        draft.diagrams[0].placements.push({
          element: 'element-ghost',
          position: { x: 0, y: 0 },
          size: { width: 100, height: 60 },
        });
      },
      path: ['diagrams', 0, 'placements', 6, 'element'],
      detail: {
        code: 'placement-element-unknown',
        parameters: { id: 'element-ghost' },
      },
    },
    {
      named: 'a second placement of an element on its diagram',
      mutate: (draft) => {
        draft.diagrams[0].placements.push(
          structuredClone(draft.diagrams[0].placements[0]),
        );
      },
      path: ['diagrams', 0, 'placements', 6, 'element'],
      detail: {
        code: 'duplicate-placement',
        parameters: { id: 'element-customer' },
      },
    },
    {
      named: 'a placement of an element on a second diagram',
      mutate: (draft) => {
        onSecondDiagram(
          draft,
          structuredClone(draft.diagrams[0].placements[0]),
        );
      },
      path: ['diagrams', 1, 'placements', 1, 'element'],
      detail: {
        code: 'duplicate-placement',
        parameters: { id: 'element-customer' },
      },
    },
    {
      named: 'an element no diagram places',
      mutate: (draft) => {
        draft.diagrams[0].placements.splice(2, 1);
      },
      path: ['elements', 2],
      detail: { code: 'element-unplaced', parameters: { id: 'element-db' } },
    },
    {
      named: "a placement holding another kind's geometry",
      mutate: (draft) => {
        draft.diagrams[0].placements[0] = {
          element: 'element-customer',
          shape: {
            kind: 'box',
            position: { x: 0, y: 0 },
            size: { width: 100, height: 60 },
          },
        };
      },
      path: ['diagrams', 0, 'placements', 0],
      detail: {
        code: 'placement-geometry-mismatch',
        parameters: { id: 'element-customer' },
      },
    },
    {
      named: 'a free flow end placed with no position',
      mutate: (draft) => {
        draft.diagrams[0].placements[3] = {
          element: 'element-order-flow',
          waypoints: [],
          source: {},
          target: {},
        };
      },
      path: ['diagrams', 0, 'placements', 3],
      detail: {
        code: 'placement-geometry-mismatch',
        parameters: { id: 'element-order-flow' },
      },
    },
    {
      named: 'an attached flow end drawn away from its element, at a position',
      mutate: (draft) => {
        draft.diagrams[0].placements[3] = {
          element: 'element-order-flow',
          waypoints: [],
          source: { position: { x: 0, y: 0 } },
          target: { position: { x: 280, y: 160 } },
        };
      },
      path: ['diagrams', 0, 'placements', 3],
      detail: {
        code: 'placement-geometry-mismatch',
        parameters: { id: 'element-order-flow' },
      },
    },
    {
      named: 'a flow end attached to an element another diagram places',
      mutate: (draft) => {
        onSecondDiagram(draft);
        draft.elements[3] = {
          ...structuredClone(draft.elements[3]),
          kind: 'flow',
          source: { kind: 'attached', element: 'element-remote' },
          target: { kind: 'free' },
          bidirectional: false,
        };
      },
      path: ['elements', 3, 'source', 'element'],
      detail: {
        code: 'flow-endpoint-foreign',
        parameters: { id: 'element-remote' },
      },
    },
    {
      named: 'a boundary listing an element another diagram places',
      mutate: (draft) => {
        onSecondDiagram(draft);
        draft.elements[4] = {
          ...structuredClone(draft.elements[4]),
          kind: 'trust-boundary',
          containedElements: ['element-remote'],
        };
      },
      path: ['elements', 4, 'containedElements', 0],
      detail: {
        code: 'related-element-unknown',
        parameters: { id: 'element-remote' },
      },
    },
  ])('rejects $named, and nothing else', ({ mutate, path, detail }) => {
    expect(issuesOf(seededPlacedModel(mutate))).toEqual([{ path, detail }]);
  });

  it.each<readonly [string, (draft: ModelInput) => void]>([
    [
      'on two diagrams',
      (draft) => {
        draft.diagrams[0].placements.push(twinBox);
        draft.diagrams.push({
          id: 'diagram-second',
          title: 'Second',
          placements: [twinRoute],
        });
      },
    ],
    [
      'on one diagram',
      (draft) => {
        draft.diagrams[0].placements.push(twinBox, twinRoute);
      },
    ],
  ])(
    'pairs each copy of a repeated id with the placement that fits it, %s, and reports the id alone',
    (_named, place) => {
      const result = seededPlacedModel((draft) => {
        draft.elements.push(twinFlow, twinProcess);
        place(draft);
      });
      expect(issuesOf(result)).toEqual([
        {
          path: ['elements', 7, 'id'],
          detail: {
            code: 'duplicate-element-id',
            parameters: { id: 'element-twin' },
          },
        },
      ]);
    },
  );
});

describe('parseDrawnModel', () => {
  it('moves each element to the root and leaves its placement on its diagram, in order', () => {
    const parsed = Either.getOrThrow(parseDrawnModel(validModelFixture));
    expect(drawnElements(parsed, parsed.diagrams[0])).toEqual(
      validModelFixture.diagrams[0].elements,
    );
    expect(parsed.elements.map(({ id }) => id)).toEqual(
      validModelFixture.diagrams[0].elements.map(({ id }) => id),
    );
    expect(parsed.threats).toEqual(validModelFixture.threats);
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

  it('keeps an unnamed element and a flow on one boundary at both ends, which only an edit refuses', () => {
    expect(issuesOf(seededModel(unnamedWithLoopedFlow))).toEqual([]);
  });

  it('strips a key no schema declares rather than refusing the model', () => {
    expect(
      Either.getOrNull(parseDrawnModel(plantEverywhere(validModelFixture))),
    ).toEqual(Either.getOrNull(parseDrawnModel(validModelFixture)));
  });

  it('reports violations as plain tagged data that survives a JSON round trip', () => {
    const failure = Option.getOrUndefined(
      Either.getLeft(
        parseDrawnModel({
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

  it.each<Rejection<typeof validModelFixture>>([
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
      named: 'a duplicate element id within one diagram',
      mutate: (draft) => {
        draft.diagrams[0].elements.push(
          structuredClone(draft.diagrams[0].elements[0]),
        );
      },
      path: ['diagrams', 0, 'elements', 6, 'id'],
      detail: {
        code: 'duplicate-element-id',
        parameters: { id: 'element-customer' },
      },
    },
    {
      named: 'a duplicate element id held by elements of different kinds',
      mutate: (draft) => {
        draft.diagrams.push({
          id: 'diagram-second',
          title: 'Second',
          elements: [
            {
              kind: 'trust-boundary',
              id: 'element-customer',
              name: 'Zone',
              description: '',
              outOfScope: false,
              reasonOutOfScope: '',
              shape: {
                kind: 'box',
                position: { x: 0, y: 0 },
                size: { width: 100, height: 60 },
              },
            },
          ],
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
    {
      named: 'a position past 1,000,000',
      mutate: (draft) => {
        const [actor] = draft.diagrams[0].elements;
        if (actor.kind === 'actor') {
          actor.position.x = 1_000_000.5;
        }
      },
      path: ['diagrams', 0, 'elements', 0, 'position', 'x'],
      detail: {
        code: 'too-big',
        parameters: { bound: 1_000_000, kind: 'number', inclusive: true },
      },
    },
    {
      named: 'a curve point below -1,000,000',
      mutate: (draft) => {
        const curve = draft.diagrams[0].elements[5];
        if (curve.kind === 'trust-boundary' && curve.shape.kind === 'curve') {
          curve.shape.waypoints[1].y = -1_000_001;
        }
      },
      path: ['diagrams', 0, 'elements', 5, 'shape', 'waypoints', 1, 'y'],
      detail: {
        code: 'too-small',
        parameters: { bound: -1_000_000, kind: 'number', inclusive: true },
      },
    },
    {
      named: 'a width under 1',
      mutate: (draft) => {
        const process = draft.diagrams[0].elements[1];
        if (process.kind === 'process') {
          process.size.width = 0.5;
        }
      },
      path: ['diagrams', 0, 'elements', 1, 'size', 'width'],
      detail: {
        code: 'too-small',
        parameters: { bound: 1, kind: 'number', inclusive: true },
      },
    },
    {
      named: 'a height past 1,000,000',
      mutate: (draft) => {
        const box = draft.diagrams[0].elements[4];
        if (box.kind === 'trust-boundary' && box.shape.kind === 'box') {
          box.shape.size.height = 1_000_001;
        }
      },
      path: ['diagrams', 0, 'elements', 4, 'shape', 'size', 'height'],
      detail: {
        code: 'too-big',
        parameters: { bound: 1_000_000, kind: 'number', inclusive: true },
      },
    },
  ])('rejects $named, and nothing else', ({ mutate, path, detail }) => {
    expect(issuesOf(seededModel(mutate))).toEqual([{ path, detail }]);
  });

  it('reports a refused character and a broken model rule from one parse', () => {
    const result = seededModel((draft) => {
      draft.diagrams.push({
        id: 'diagram-second',
        title: 'Second',
        elements: [structuredClone(draft.diagrams[0].elements[0])],
      });
      draft.diagrams[0].elements[0].name = 'Shop\u0007per';
    });
    expect(issuesOf(result)).toEqual([
      {
        path: ['diagrams', 0, 'elements', 0, 'name'],
        detail: { code: 'text-character-refused' },
      },
      {
        path: ['diagrams', 1, 'elements', 0, 'id'],
        detail: {
          code: 'duplicate-element-id',
          parameters: { id: 'element-customer' },
        },
      },
    ]);
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

  it("reads a refusal through the caller's own details", () => {
    const rule = { code: 'caller-rule' } as const;
    const parsed = boundedParse(
      z.string().refine(() => false, { params: rule }),
      'refused',
      z.object({ code: z.literal('caller-rule') }),
    );

    expect(Either.isLeft(parsed) && schemaFailureIssues(parsed.left)).toEqual([
      { path: [], detail: rule },
    ]);
  });

  it('refuses a model with more invalid entries than zod 4.6.2 gathers on V8', () => {
    const flooded = {
      ...validModel,
      threats: [{ elements: floodingEntries(1) }],
    };

    const parsed = parseModel(flooded);

    expect(Either.isLeft(parsed) && parsed.left).toMatchObject({
      _tag: 'InvalidModel',
      issues: [{ path: [], detail: { code: issueFloodCode } }],
    });
  });
});
