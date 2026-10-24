import {
  drawnElements,
  moveElement,
  reconnectFlow,
  renameElement,
  resizeElement,
  setFlowDirection,
  setFlowWaypoints,
  type Element,
  type Model,
} from '@saerskriven/model';
import {
  elementId,
  drawnFixture,
  validModelFixture,
  securityModelFixture,
  securityPropertyFixtures as properties,
} from '@saerskriven/model/fixtures';
import { threatDragonWireSchema } from '@saerskriven/wire-threat-dragon';
import { Result } from 'effect';
import { readSaerskrivenYaml } from './saerskriven-yaml-read.js';
import {
  writeSaerskrivenYaml,
  writeSaerskrivenYamlDocument,
} from './saerskriven-yaml-write.js';
import { readThreatDragon } from './threat-dragon-read.js';
import { writeThreatDragon } from './threat-dragon-write.js';
import { allCells, threatsOf } from './threat-dragon-document.js';
import { featureCompleteText } from './threat-dragon.fixtures.js';
import { isRecord } from './records.js';
import { readFailureIssues } from './codec.fixtures.js';
import { version2DocumentOf } from './saerskriven-yaml.fixtures.js';

const secured = drawnFixture(securityModelFixture);

function nativeCycle(model: Model): Model {
  const written = writeSaerskrivenYaml(model);
  expect(written.divergences).toEqual([]);
  const read = Result.getOrThrow(readSaerskrivenYaml(written.output));
  expect(read.divergences).toEqual([]);
  return read.model;
}

const factKeys = [
  'providesAuthentication',
  'handlesCardPayment',
  'handlesGoodsOrServices',
  'isWebApplication',
  'privilegeLevel',
  'isALog',
  'isEncrypted',
  'isSigned',
  'storesCredentials',
  'storesInventory',
  'protocol',
  'isPublicNetwork',
  'trustBoundaryIds',
  'containedElements',
  'crossingFlows',
];

function facts(record: unknown) {
  return isRecord(record)
    ? Object.fromEntries(
        factKeys
          .filter((key) => Object.hasOwn(record, key))
          .map((key) => [key, record[key]]),
      )
    : {};
}

function elementFacts(model: Model) {
  return model.elements.map((element) => ({
    id: element.id,
    ...facts(element),
  }));
}

describe('optional security facts in native YAML', () => {
  it('retains explicit facts on every supported kind, including false, empty text and empty lists', () => {
    const cycle = nativeCycle(secured);
    expect(cycle).toStrictEqual(secured);
    expect(drawnElements(cycle, cycle.diagrams[0]).map(facts)).toEqual(
      properties,
    );
    expect(writeSaerskrivenYamlDocument(cycle).formatVersion).toBe(2);
  });

  it('reads legacy fields as absent and does not turn them into explicit negatives', () => {
    const legacy = drawnFixture(validModelFixture);
    const cycle = nativeCycle(legacy);
    expect(cycle).toStrictEqual(legacy);
    expect(drawnElements(cycle, cycle.diagrams[0]).map(facts)).toEqual(
      properties.map(() => ({})),
    );
  });

  it('preserves an explicitly empty flow protocol and boundary list', () => {
    const input = structuredClone(secured);
    const flow = input.elements.find((element) => element.kind === 'flow');
    expect(flow).toBeDefined();
    if (flow === undefined) return;
    flow.protocol = '';
    flow.trustBoundaryIds = [];
    expect(nativeCycle(input)).toStrictEqual(input);
  });

  it('keeps security facts during unrelated geometry, name and flow edits', () => {
    let edited = Result.getOrThrow(
      renameElement(secured, elementId('element-api'), 'Renamed'),
    );
    edited = Result.getOrThrow(
      moveElement(
        edited,
        secured.diagrams[0].id,
        elementId('element-perimeter'),
        { x: 1000, y: 1000 },
      ),
    );
    edited = Result.getOrThrow(
      resizeElement(edited, secured.diagrams[0].id, elementId('element-db'), {
        width: 200,
        height: 90,
      }),
    );
    edited = Result.getOrThrow(
      setFlowDirection(edited, elementId('element-order-flow'), true),
    );
    edited = Result.getOrThrow(
      setFlowWaypoints(
        edited,
        secured.diagrams[0].id,
        elementId('element-order-flow'),
        [],
      ),
    );
    edited = Result.getOrThrow(
      reconnectFlow(
        edited,
        secured.diagrams[0].id,
        elementId('element-order-flow'),
        'target',
        elementId('element-api'),
      ),
    );
    expect(elementFacts(nativeCycle(edited))).toStrictEqual(
      elementFacts(secured),
    );
  });
});

describe('security facts across Threat Dragon and native YAML', () => {
  it('writes every fact without the original JSON and reads it through native YAML', () => {
    const written = writeThreatDragon(secured);
    const read = Result.getOrThrow(readThreatDragon(written.output));
    expect(elementFacts(nativeCycle(read.model))).toStrictEqual(
      elementFacts(secured),
    );
    const reverse = Result.getOrThrow(
      readThreatDragon(writeThreatDragon(nativeCycle(secured)).output),
    );
    expect(elementFacts(reverse.model)).toStrictEqual(elementFacts(secured));
  });

  it('keeps source styling while writing explicit changes and removals to mapped facts', () => {
    const read = Result.getOrThrow(
      readThreatDragon(writeThreatDragon(secured).output),
    );
    const source = structuredClone(read.source);
    const actor = allCells(source).find((cell) => cell.shape === 'actor');
    expect(actor).toBeDefined();
    if (actor === undefined) return;
    actor.zIndex = 321;
    const node = read.model.elements.find(
      (element) => element.kind === 'actor',
    );
    expect(node).toBeDefined();
    if (node === undefined) return;
    const withActor = (next: Element): Model => ({
      ...read.model,
      elements: read.model.elements.map((element) =>
        element.id === next.id ? next : element,
      ),
    });
    const changed = Result.getOrThrow(
      readThreatDragon(
        writeThreatDragon(
          withActor({ ...node, providesAuthentication: true }),
          source,
        ).output,
      ),
    );
    expect(elementFacts(changed.model)[0]).toEqual({
      id: node.id,
      providesAuthentication: true,
    });
    expect(allCells(changed.source)[0].zIndex).toBe(321);
    const { providesAuthentication: _held, ...unauthenticated } = node;
    const removed = Result.getOrThrow(
      readThreatDragon(
        writeThreatDragon(withActor(unauthenticated), source).output,
      ),
    );
    expect(facts(allCells(removed.source)[0].data)).toEqual({});
    expect(
      facts(drawnElements(removed.model, removed.model.diagrams[0])[0]),
    ).toEqual({});
  });

  it('refuses unrepresentable security text with a model path instead of reporting a lossless read', () => {
    const source = threatDragonWireSchema.parse(
      JSON.parse(writeThreatDragon(secured).output),
    );
    const flow = allCells(source).find((cell) => cell.shape === 'flow');
    expect(flow).toBeDefined();
    if (flow === undefined) return;
    flow.data.protocol = '\u202EHTTPS';
    const read = readThreatDragon(JSON.stringify(source));
    expect(Result.isFailure(read)).toBe(true);
    expect(
      readFailureIssues(Result.getOrThrow(Result.flip(read))),
    ).toContainEqual(
      expect.objectContaining({
        path: ['diagrams', 0, 'elements', 3, 'protocol'],
      }),
    );
  });
});

describe('the feature-complete Threat Dragon file through both codecs', () => {
  it('preserves source facts, declared relationships, threat links, numbers and issuance bookkeeping', () => {
    const before = Result.getOrThrow(readThreatDragon(featureCompleteText));
    const expected = allCells(before.source).map((cell) => ({
      id: cell.id,
      ...facts(cell.data),
    }));
    expect(elementFacts(before.model)).toStrictEqual(expected);
    const after = nativeCycle(before.model);
    expect(elementFacts(after)).toStrictEqual(expected);
    const sourceAttachments = allCells(before.source).flatMap((cell) =>
      threatsOf(cell).map((threat) =>
        JSON.stringify([threat.id, threat.number, cell.id]),
      ),
    );
    const restoredAttachments = after.threats.flatMap((threat) =>
      threat.elements.map((id) =>
        JSON.stringify([threat.id, threat.number, id]),
      ),
    );
    expect(new Set(restoredAttachments)).toEqual(new Set(sourceAttachments));
    expect(after.lastIssuedThreatNumber).toBe(
      Math.max(
        before.source.detail.threatTop ?? 0,
        ...allCells(before.source).flatMap((cell) =>
          threatsOf(cell).map((threat) => threat.number ?? 0),
        ),
      ),
    );
    expect(new Map(after.threats.map((threat) => [threat.id, threat]))).toEqual(
      new Map(before.model.threats.map((threat) => [threat.id, threat])),
    );
    expect(after.lastIssuedThreatNumber).toBe(
      before.model.lastIssuedThreatNumber,
    );
    const written = writeThreatDragon(after);
    const restored = Result.getOrThrow(readThreatDragon(written.output));
    expect(restored.divergences).toEqual(before.divergences);
    expect(elementFacts(restored.model)).toStrictEqual(expected);
    expect(
      new Map(restored.model.threats.map((threat) => [threat.id, threat])),
    ).toEqual(new Map(after.threats.map((threat) => [threat.id, threat])));
    expect(restored.model.lastIssuedThreatNumber).toBe(
      after.lastIssuedThreatNumber,
    );
    expect(restored.source.detail.threatTop).toBe(after.lastIssuedThreatNumber);
    expect(writeThreatDragon(before.model, before.source).divergences).toEqual(
      [],
    );
  });
});

describe('declared relationship validation and edits', () => {
  it('refuses invalid Threat Dragon relationship assertions', () => {
    const original = writeThreatDragon(secured).output;
    const source = threatDragonWireSchema.parse(JSON.parse(original));
    const flow = allCells(source).find((cell) => cell.shape === 'flow');
    expect(flow).toBeDefined();
    if (flow === undefined) return;
    flow.data.trustBoundaryIds = ['missing-boundary'];
    const result = readThreatDragon(JSON.stringify(source));
    expect(
      readFailureIssues(Result.getOrThrow(Result.flip(result))),
    ).toContainEqual(
      expect.objectContaining({
        path: ['diagrams', 0, 'elements', 3, 'trustBoundaryIds', 0],
      }),
    );
  });

  it.each([
    ['trustBoundaryIds', 'element-db'],
    ['trustBoundaryIds', 'missing-boundary'],
    ['crossingFlows', 'element-api'],
    ['containedElements', 'element-perimeter'],
  ])('refuses invalid %s targets with a field path', (field, reference) => {
    const source = version2DocumentOf(secured);
    const index = field === 'trustBoundaryIds' ? 3 : 4;
    Object.assign(source.diagrams[0].elements[index], { [field]: [reference] });
    const result = readSaerskrivenYaml(JSON.stringify(source));
    expect(Result.isFailure(result)).toBe(true);
    expect(
      readFailureIssues(Result.getOrThrow(Result.flip(result))),
    ).toContainEqual(
      expect.objectContaining({
        path: ['diagrams', 0, 'elements', index, field, 0],
      }),
    );
  });

  it('keeps ordered repeated assertions without inventing reciprocal lists', () => {
    const draft = structuredClone(secured);
    const boundary = draft.elements.find(
      (element) => element.kind === 'trust-boundary',
    );
    expect(boundary).toBeDefined();
    if (boundary === undefined) return;
    boundary.crossingFlows = [
      elementId('element-order-flow'),
      elementId('element-order-flow'),
    ];
    const flow = draft.elements.find((element) => element.kind === 'flow');
    expect(flow).toBeDefined();
    if (flow === undefined) return;
    delete flow.trustBoundaryIds;
    expect(nativeCycle(draft)).toStrictEqual(draft);
  });
});
