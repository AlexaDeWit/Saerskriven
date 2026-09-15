import type {
  BoundaryShape,
  Element,
  Model,
  Point,
  Size,
} from '@saerskriven/model';
import {
  saerskrivenYamlV2WireSchema,
  type SaerskrivenYamlV2Document,
} from '@saerskriven/wire-saerskriven-yaml-v2';
import { parsedFixture, validModelFixture } from '@saerskriven/model/fixtures';
import { Either } from 'effect';
import { parse } from 'yaml';
import { readSaerskrivenYaml } from './saerskriven-yaml-read.js';
import { ecluseModel, goldenPath } from './saerskriven-yaml.fixtures.js';
import {
  writeSaerskrivenYaml,
  writeSaerskrivenYamlDocument,
} from './saerskriven-yaml-write.js';
import { isRecord } from './records.js';

const parseDocument: (text: string) => unknown = parse;

const written = writeSaerskrivenYaml(ecluseModel);

function backwardsPoint(point: Point): Point {
  return { y: point.y, x: point.x };
}

function backwardsSize(size: Size): Size {
  return { height: size.height, width: size.width };
}

function backwardsShape(shape: BoundaryShape): BoundaryShape {
  return shape.kind === 'box'
    ? {
        size: backwardsSize(shape.size),
        position: backwardsPoint(shape.position),
        kind: 'box',
      }
    : { waypoints: shape.waypoints.map(backwardsPoint), kind: 'curve' };
}

function backwardsElement(element: Element): Element {
  if (element.kind === 'flow') {
    return { ...element, waypoints: element.waypoints.map(backwardsPoint) };
  }
  if (element.kind === 'trust-boundary') {
    return { ...element, shape: backwardsShape(element.shape) };
  }
  return {
    ...element,
    position: backwardsPoint(element.position),
    size: backwardsSize(element.size),
  };
}

const backwardsEcluse: Model = {
  assumptions: ecluseModel.assumptions,
  mitigations: ecluseModel.mitigations,
  lastIssuedThreatNumber: ecluseModel.lastIssuedThreatNumber,
  threats: ecluseModel.threats.map((threat) => ({
    elements: threat.elements,
    description: threat.description,
    status: threat.status,
    severity: threat.severity,
    category: threat.category,
    title: threat.title,
    number: threat.number,
    id: threat.id,
  })),
  diagrams: ecluseModel.diagrams.map((diagram) => ({
    ...diagram,
    elements: diagram.elements.map(backwardsElement),
  })),
  metadata: ecluseModel.metadata,
};

const otherDocument: SaerskrivenYamlV2Document = {
  formatVersion: 2,
  metadata: {
    title: 'Another file entirely',
    owner: '',
    description: '',
    contributors: [],
  },
  diagrams: [],
  threats: [],
  lastIssuedThreatNumber: 0,
  mitigations: [],
  assumptions: [],
};

function isList(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function listOf(value: unknown): readonly unknown[] {
  return isList(value) ? value : [];
}

function at(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

function keysOf(value: unknown): readonly string[] {
  return isRecord(value) ? Object.keys(value) : [];
}

describe('the Écluse model as a Saerskriven YAML file', () => {
  it('matches the golden fixture committed under test-data', async () => {
    await expect(written.output).toMatchFileSnapshot(goldenPath);
  });

  it('reports no divergence', () => {
    expect(written.divergences).toEqual([]);
  });

  it('writes the root keys in the order the wire schema declares them', () => {
    expect(keysOf(parseDocument(written.output))).toEqual(
      Object.keys(saerskrivenYamlV2WireSchema.shape),
    );
  });

  it('leads every element with the kind that tells its variant apart', () => {
    const elements = listOf(
      at(parseDocument(written.output), 'diagrams'),
    ).flatMap((diagram) => listOf(at(diagram, 'elements')));
    expect(elements.length).toBeGreaterThan(0);
    expect(elements.map((element) => keysOf(element)[0])).toEqual(
      elements.map(() => 'kind'),
    );
  });

  it('states the direction on every flow and the side on every pinned end', () => {
    const lines = written.output.split('\n');
    expect(
      lines.filter((line) => line === '        bidirectional: false'),
    ).toHaveLength(20);
    expect(lines.filter((line) => line.startsWith('          side: '))).toEqual(
      [
        '          side: right',
        '          side: left',
        '          side: right',
        '          side: top',
        '          side: bottom',
        '          side: left',
        '          side: right',
      ],
    );
  });

  it('writes threats in number order, whatever order the model holds', () => {
    const numbers = ecluseModel.threats.map((threat) => threat.number);
    numbers.sort((left, right) => left - right);
    expect(ecluseModel.threats.map((threat) => threat.number)).not.toEqual(
      numbers,
    );
    expect(
      listOf(at(parseDocument(written.output), 'threats')).map((threat) =>
        at(threat, 'number'),
      ),
    ).toEqual(numbers);
  });
});

describe('a Saerskriven YAML write', () => {
  it('writes the same bytes whatever order the model was built in', () => {
    expect(writeSaerskrivenYaml(backwardsEcluse).output).toBe(written.output);
  });

  it('cannot be changed by the source document the contract offers', () => {
    expect(writeSaerskrivenYaml(ecluseModel, otherDocument).output).toBe(
      written.output,
    );
  });
});

describe('a Saerskriven YAML write of assumptions', () => {
  const output = writeSaerskrivenYaml(parsedFixture(validModelFixture)).output;

  it('states a model link and no element list on every assumption', () => {
    const assumptions = listOf(at(parseDocument(output), 'assumptions'));
    expect(assumptions.length).toBeGreaterThan(0);
    expect(assumptions.map(keysOf)).toEqual(
      assumptions.map(() => [
        'id',
        'prose',
        'status',
        'threats',
        'appliesToModel',
      ]),
    );
  });

  it('parses under the version 2 wire schema', () => {
    expect(
      saerskrivenYamlV2WireSchema.safeParse(parseDocument(output)).success,
    ).toBe(true);
  });
});

describe('a Saerskriven YAML write of mitigations', () => {
  it('states no mitigation text on any threat and holds the records', () => {
    const threats = listOf(at(parseDocument(written.output), 'threats'));
    const document = saerskrivenYamlV2WireSchema.parse(
      parseDocument(written.output),
    );
    expect(ecluseModel.mitigations.length).toBeGreaterThan(0);
    expect(
      threats.filter((threat) => keysOf(threat).includes('mitigation')),
    ).toEqual([]);
    expect(document.mitigations.map(({ id }) => id)).toEqual(
      ecluseModel.mitigations.map(({ id }) => id),
    );
  });
});

describe('a Saerskriven YAML write of a long link list', () => {
  const threatIds = ecluseModel.threats.map(({ id }) => id);
  const [first, ...rest] = ecluseModel.mitigations;
  const lines = writeSaerskrivenYaml(
    parsedFixture({
      ...ecluseModel,
      mitigations: [{ ...first, threats: threatIds }, ...rest],
    }),
  ).output.split('\n');

  it('writes each linked id on a line of its own rather than one flow sequence', () => {
    expect(threatIds.length).toBeGreaterThan(5);
    expect(lines.filter((line) => /^\s*threats: \[.+\]$/u.test(line))).toEqual(
      [],
    );
    expect(
      lines.some((_, start) =>
        threatIds.every((id, offset) =>
          lines[start + offset]?.endsWith(`- ${id}`),
        ),
      ),
    ).toBe(true);
  });
});

describe('a Saerskriven YAML write of one list held by several elements', () => {
  const [diagram, ...otherDiagrams] = ecluseModel.diagrams;
  const boundary = diagram.elements.find(
    ({ kind }) => kind === 'trust-boundary',
  );
  const crossed = boundary === undefined ? [] : [boundary.id];
  const shared: Model = {
    ...ecluseModel,
    diagrams: [
      {
        ...diagram,
        elements: diagram.elements.map((element) =>
          element.kind === 'flow'
            ? { ...element, trustBoundaryIds: crossed }
            : element,
        ),
      },
      ...otherDiagrams,
    ],
  };

  it('writes the list out in full each time, with no anchor or alias', () => {
    const output = writeSaerskrivenYaml(shared).output;
    expect(crossed).toHaveLength(1);
    expect(output.split('\n').filter((line) => /[&*]a\d/u.test(line))).toEqual(
      [],
    );
    expect(Either.isRight(readSaerskrivenYaml(output))).toBe(true);
  });
});

describe('a Saerskriven YAML write of an assumption that applies to the model', () => {
  const [assumption] = validModelFixture.assumptions;
  const model = (threats: readonly string[]) =>
    parsedFixture({
      ...validModelFixture,
      assumptions: [
        { ...assumption, threats: [...threats], appliesToModel: true },
      ],
    });

  it.each([
    ['with its threat links', assumption.threats],
    ['with no threat link', []],
  ])('reports nothing and reads back with its model link, %s', (_, threats) => {
    const result = writeSaerskrivenYaml(model(threats));
    expect(result.divergences).toEqual([]);
    expect(
      Either.getOrThrow(readSaerskrivenYaml(result.output)).model.assumptions,
    ).toEqual(model(threats).assumptions);
  });
});

describe('a Saerskriven YAML document written without its text', () => {
  it('holds what the written file holds', () => {
    expect(writeSaerskrivenYamlDocument(ecluseModel)).toEqual(
      parseDocument(written.output),
    );
  });

  it('states the direction on every flow, so a read of it defaults nothing', () => {
    const flows = writeSaerskrivenYamlDocument(ecluseModel).diagrams.flatMap(
      (diagram) =>
        diagram.elements.filter((element) => element.kind === 'flow'),
    );
    expect(flows.length).toBeGreaterThan(0);
    expect(
      flows.filter((flow) => flow.bidirectional === undefined),
    ).toHaveLength(0);
  });
});
