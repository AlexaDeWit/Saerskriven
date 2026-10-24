import {
  accentField,
  generateElementId,
  inNumberOrder,
  parseDrawnModel,
  renameElement,
  setAccent,
  reversed,
  type BoundaryShape,
  type Model,
  type PlacedFlowEnd,
  type Placement,
  type Point,
  type Size,
} from '@saerskriven/model';
import { saerskrivenYamlV2WireSchema } from '@saerskriven/wire-saerskriven-yaml-v2';
import {
  saerskrivenYamlV3WireSchema,
  type SaerskrivenYamlV3Document,
} from '@saerskriven/wire-saerskriven-yaml-v3';
import {
  elementId,
  drawnFixture,
  fixtureOf,
  placedOnto,
  placementIn,
  validModel,
  validModelFixture,
} from '@saerskriven/model/fixtures';
import { Result } from 'effect';
import { parse } from 'yaml';
import { readSaerskrivenYaml } from './saerskriven-yaml-read.js';
import { canonicalOrder } from './canonical-order.js';
import {
  featureCompleteYaml,
  withFlowDrawnAway,
} from './saerskriven-yaml.fixtures.js';
import {
  saerskrivenYamlV3Document,
  writeSaerskrivenYaml,
  writeSaerskrivenYamlDocument,
} from './saerskriven-yaml-write.js';
import { isRecord } from './records.js';

const parseDocument: (text: string) => unknown = parse;

const featureComplete = Result.getOrThrow(
  readSaerskrivenYaml(featureCompleteYaml),
).model;

const written = writeSaerskrivenYaml(featureComplete);

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

function backwardsEnd(end: PlacedFlowEnd): PlacedFlowEnd {
  return end.position === undefined
    ? end
    : {
        position: backwardsPoint(end.position),
        ...(end.side === undefined ? {} : { side: end.side }),
      };
}

function backwardsPlacement(placement: Placement): Placement {
  if ('waypoints' in placement) {
    return {
      target: backwardsEnd(placement.target),
      source: backwardsEnd(placement.source),
      waypoints: placement.waypoints.map(backwardsPoint),
      element: placement.element,
      ...accentField(placement),
    };
  }
  if ('shape' in placement) {
    return { ...placement, shape: backwardsShape(placement.shape) };
  }
  return {
    ...placement,
    position: backwardsPoint(placement.position),
    size: backwardsSize(placement.size),
  };
}

const backwardsOf = (model: Model): Model => ({
  assumptions: model.assumptions,
  mitigations: model.mitigations,
  lastIssuedThreatNumber: model.lastIssuedThreatNumber,
  threats: model.threats.map((threat) => ({
    appliesToModel: threat.appliesToModel,
    elements: threat.elements,
    description: threat.description,
    status: threat.status,
    severity: threat.severity,
    category: threat.category,
    title: threat.title,
    number: threat.number,
    id: threat.id,
  })),
  diagrams: model.diagrams.map((diagram) => ({
    ...diagram,
    placements: diagram.placements.map(backwardsPlacement),
  })),
  elements: model.elements,
  metadata: model.metadata,
});

function reversedKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(reversedKeys);
  }
  return isRecord(value)
    ? Object.fromEntries(
        reversed(Object.entries(value)).map(([key, held]) => [
          key,
          reversedKeys(held),
        ]),
      )
    : value;
}

const otherDocument: SaerskrivenYamlV3Document = {
  formatVersion: 3,
  metadata: {
    title: 'Another file entirely',
    owner: '',
    description: '',
    contributors: [],
  },
  diagrams: [],
  elements: [],
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

describe('the feature-complete model as a Saerskriven YAML file', () => {
  it('writes the committed file back to the byte', () => {
    expect(written.output).toBe(featureCompleteYaml);
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
    expect(lines.filter((line) => line.includes('bidirectional: '))).toEqual([
      '        bidirectional: false',
      '        bidirectional: true',
      '        bidirectional: false',
    ]);
    expect(lines.filter((line) => line.startsWith('          side: '))).toEqual(
      [
        '          side: right',
        '          side: left',
        '          side: bottom',
        '          side: top',
      ],
    );
  });

  it('writes threats in number order, whatever order the model holds', () => {
    const numbers = inNumberOrder(featureComplete.threats).map(
      (threat) => threat.number,
    );
    const threatsReversed: Model = {
      ...featureComplete,
      threats: reversed(featureComplete.threats),
    };
    expect(threatsReversed.threats.map((threat) => threat.number)).not.toEqual(
      numbers,
    );
    expect(
      listOf(
        at(
          parseDocument(writeSaerskrivenYaml(threatsReversed).output),
          'threats',
        ),
      ).map((threat) => at(threat, 'number')),
    ).toEqual(numbers);
  });
});

describe('a Saerskriven YAML write of an element on a second diagram', () => {
  const placedAgain = {
    ...placementIn(featureComplete, 'actor-patient'),
    position: { x: 520, y: 120 },
  };
  const shared = placedOnto(featureComplete, [placedAgain], 1);
  const sharedWrite = writeSaerskrivenYaml(shared);
  const document = parseDocument(sharedWrite.output);

  it('writes version 3, each element once at the root and that one placed on both diagrams', () => {
    expect(at(document, 'formatVersion')).toBe(3);
    expect(
      listOf(at(document, 'elements')).map((element) => at(element, 'id')),
    ).toEqual(featureComplete.elements.map(({ id }) => id));
    expect(
      listOf(at(document, 'diagrams')).map(
        (diagram) =>
          listOf(at(diagram, 'placements')).filter(
            (placement) => at(placement, 'element') === 'actor-patient',
          ).length,
      ),
    ).toEqual([1, 1]);
  });

  it('writes the root keys in the order the version 3 schema declares them, and the same bytes each time', () => {
    expect(keysOf(document)).toEqual(
      Object.keys(saerskrivenYamlV3WireSchema.shape),
    );
    expect(writeSaerskrivenYaml(shared).output).toBe(sharedWrite.output);
  });

  it('writes version 2 again, to the byte, once the element is on one diagram again', () => {
    const unshared = {
      ...shared,
      diagrams: shared.diagrams.map((diagram) => ({
        ...diagram,
        placements: diagram.placements.filter(
          (placement) => placement !== placedAgain,
        ),
      })),
    };
    expect(writeSaerskrivenYaml(unshared).output).toBe(written.output);
  });
});

describe('a Saerskriven YAML write of a model only version 3 holds', () => {
  const drawnAway = withFlowDrawnAway(featureComplete);

  it('writes the same bytes whatever order the model was built in', () => {
    expect(writeSaerskrivenYaml(backwardsOf(drawnAway)).output).toBe(
      writeSaerskrivenYaml(drawnAway).output,
    );
  });

  it('orders a document built in reverse key order at every depth as it orders the one the writer builds', () => {
    const document = saerskrivenYamlV3Document(drawnAway);
    expect(
      JSON.stringify(
        canonicalOrder(saerskrivenYamlV3WireSchema, reversedKeys(document)),
      ),
    ).toBe(
      JSON.stringify(canonicalOrder(saerskrivenYamlV3WireSchema, document)),
    );
  });
});

describe('a Saerskriven YAML write', () => {
  it('writes the same bytes whatever order the model was built in', () => {
    expect(writeSaerskrivenYaml(backwardsOf(featureComplete)).output).toBe(
      written.output,
    );
  });

  it('cannot be changed by the source document the contract offers', () => {
    expect(writeSaerskrivenYaml(featureComplete, otherDocument).output).toBe(
      written.output,
    );
  });
});

describe('a Saerskriven YAML write of assumptions', () => {
  const output = writeSaerskrivenYaml(validModel).output;

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
});

describe('a Saerskriven YAML write of mitigations', () => {
  it('states no mitigation text on any threat and holds the records', () => {
    const threats = listOf(at(parseDocument(written.output), 'threats'));
    const document = saerskrivenYamlV2WireSchema.parse(
      parseDocument(written.output),
    );
    expect(featureComplete.mitigations.length).toBeGreaterThan(0);
    expect(
      threats.filter((threat) => keysOf(threat).includes('mitigation')),
    ).toEqual([]);
    expect(document.mitigations.map(({ id }) => id)).toEqual(
      featureComplete.mitigations.map(({ id }) => id),
    );
  });
});

describe('a Saerskriven YAML write of an assumption that applies to the model', () => {
  const [assumption] = validModelFixture.assumptions;
  const model = (threats: readonly string[]) =>
    drawnFixture({
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
      Result.getOrThrow(readSaerskrivenYaml(result.output)).model.assumptions,
    ).toEqual(model(threats).assumptions);
  });
});

describe('a Saerskriven YAML write of accents', () => {
  const api = elementId('element-api');
  const flow = elementId('element-order-flow');
  const plain = writeSaerskrivenYaml(validModel).output;
  const accented = Result.getOrThrow(
    setAccent(validModel, validModel.diagrams[0].id, [api, flow], 's2'),
  );
  const result = writeSaerskrivenYaml(accented);

  it('states the key after the scope fields on each element that holds one, and on no other', () => {
    expect(plain).not.toContain('accent');
    expect(result.divergences).toEqual([]);
    const elements = listOf(
      at(listOf(at(parseDocument(result.output), 'diagrams'))[0], 'elements'),
    );
    expect(
      elements
        .filter((element) => keysOf(element).includes('accent'))
        .map((element) => [at(element, 'id'), at(element, 'accent')]),
    ).toEqual([
      [api, 's2'],
      [flow, 's2'],
    ]);
    expect(
      result.output
        .split('\n')
        .filter((line) => !line.includes('accent: '))
        .join('\n'),
    ).toBe(plain);
    expect(result.output).toContain(
      '        reasonOutOfScope: ""\n        accent: s2\n',
    );
  });

  it("states a note's key after its scope fields, as on any other kind", () => {
    const note = elementId('note-hours');
    const output = writeSaerskrivenYaml(
      Result.getOrThrow(
        setAccent(
          featureComplete,
          featureComplete.diagrams[0].id,
          [note],
          's3',
        ),
      ),
    ).output;
    const notes = listOf(
      at(listOf(at(parseDocument(output), 'diagrams'))[0], 'elements'),
    ).filter((element) => at(element, 'id') === note);
    expect(notes.map((element) => at(element, 'accent'))).toEqual(['s3']);
    expect(output.replace('        accent: s3\n', '')).toBe(written.output);
    expect(output).toContain(
      '        reasonOutOfScope: ""\n        accent: s3\n',
    );
  });

  it('writes a model whose accents were cleared as it wrote the model before any was set', () => {
    const cleared = Result.getOrThrow(
      setAccent(accented, accented.diagrams[0].id, [api, flow], undefined),
    );
    expect(writeSaerskrivenYaml(cleared).output).toBe(plain);
  });

  it('reads back as the model it wrote', () => {
    expect(Result.getOrThrow(readSaerskrivenYaml(result.output)).model).toEqual(
      accented,
    );
  });
});

describe('a Saerskriven YAML write of a flow left unlabelled', () => {
  const unlabelled = Result.getOrThrow(
    renameElement(validModel, elementId('element-order-flow'), ''),
  );
  const result = writeSaerskrivenYaml(unlabelled);

  it('writes an empty name that the v2 wire schema of v0.7.0 reads', () => {
    const document = saerskrivenYamlV2WireSchema.parse(
      parseDocument(result.output),
    );
    expect(
      document.diagrams
        .flatMap((diagram) => diagram.elements)
        .find((element) => element.id === 'element-order-flow')?.name,
    ).toBe('');
  });

  it('reads back unlabelled, reporting nothing', () => {
    expect(result.divergences).toEqual([]);
    expect(Result.getOrThrow(readSaerskrivenYaml(result.output)).model).toEqual(
      unlabelled,
    );
  });
});

describe('a Saerskriven YAML write of a model holding a minted id', () => {
  const minted = generateElementId();
  const model = fixtureOf(
    parseDrawnModel(
      JSON.parse(
        JSON.stringify(validModelFixture).replaceAll(
          'element-order-flow',
          minted,
        ),
      ),
      'diagram',
    ),
  );
  const result = writeSaerskrivenYaml(model);

  it('writes the id as a plain scalar', () => {
    expect(result.output).toContain(`id: ${minted}\n`);
    expect(result.output).not.toMatch(new RegExp(`["']${minted}["']`));
  });

  it('reads the id back', () => {
    expect(Result.getOrThrow(readSaerskrivenYaml(result.output)).model).toEqual(
      model,
    );
  });
});

describe('a Saerskriven YAML document written without its text', () => {
  it('holds what the written file holds', () => {
    expect(writeSaerskrivenYamlDocument(featureComplete)).toEqual(
      parseDocument(written.output),
    );
  });
});
