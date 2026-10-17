import { reversed, type Element, type Model } from '@saerskriven/model';
import {
  elementId,
  placedOnto,
  placementIn,
} from '@saerskriven/model/fixtures';
import {
  movesToSaerskrivenYamlVersion3,
  writtenSaerskrivenYamlVersion,
} from './saerskriven-yaml-version.js';
import {
  featureCompleteYaml,
  readOrThrow,
  withFlowDrawnAway,
} from './saerskriven-yaml.fixtures.js';

const featureComplete = readOrThrow(featureCompleteYaml).model;

const shared = placedOnto(
  featureComplete,
  [placementIn(featureComplete, 'actor-patient')],
  1,
);

const drawnAway = withFlowDrawnAway(featureComplete);

const pinnedAway: Model = {
  ...featureComplete,
  diagrams: featureComplete.diagrams.map((diagram) => ({
    ...diagram,
    placements: diagram.placements.map((placement) =>
      placement.element === 'flow-request' && 'waypoints' in placement
        ? { ...placement, source: { position: { x: 0, y: 0 } } }
        : placement,
    ),
  })),
};

function related(change: (element: Element) => Element): Model {
  return { ...featureComplete, elements: featureComplete.elements.map(change) };
}

describe('the version a Saerskriven YAML save writes', () => {
  it('is 2 for a model whose every element is on one diagram, whatever order the root holds them in', () => {
    expect(writtenSaerskrivenYamlVersion(featureComplete)).toBe(2);
    expect(
      writtenSaerskrivenYamlVersion({
        ...featureComplete,
        elements: reversed(featureComplete.elements),
      }),
    ).toBe(2);
  });

  it('is 3 for an element on two diagrams', () => {
    expect(writtenSaerskrivenYamlVersion(shared)).toBe(3);
  });

  it('is 3 for a flow end drawn away from its element', () => {
    expect(writtenSaerskrivenYamlVersion(drawnAway)).toBe(3);
  });

  it('is 3 for an attached end whose placement holds a position on the diagram its element is on, which a version 2 element cannot state', () => {
    expect(writtenSaerskrivenYamlVersion(pinnedAway)).toBe(3);
  });

  it.each([
    {
      list: 'containedElements',
      model: related((element) =>
        element.id === 'zone-clinic' && element.kind === 'trust-boundary'
          ? {
              ...element,
              containedElements: [elementId('process-records')],
            }
          : element,
      ),
    },
    {
      list: 'crossingFlows',
      model: related((element) =>
        element.id === 'boundary-records' && element.kind === 'trust-boundary'
          ? { ...element, crossingFlows: [elementId('flow-request')] }
          : element,
      ),
    },
    {
      list: 'trustBoundaryIds',
      model: related((element) =>
        element.id === 'flow-request' && element.kind === 'flow'
          ? { ...element, trustBoundaryIds: [elementId('boundary-records')] }
          : element,
      ),
    },
  ])('is 3 for a $list naming an element of another diagram', ({ model }) => {
    expect(writtenSaerskrivenYamlVersion(model)).toBe(3);
  });
});

describe('a move from version 2 to version 3', () => {
  it.each([
    {
      edit: 'shares an element',
      before: featureComplete,
      after: shared,
      moves: true,
    },
    {
      edit: 'unshares one',
      before: shared,
      after: featureComplete,
      moves: false,
    },
    {
      edit: 'keeps version 2',
      before: featureComplete,
      after: featureComplete,
      moves: false,
    },
    { edit: 'keeps version 3', before: shared, after: drawnAway, moves: false },
  ])('is made by an edit that $edit: $moves', ({ before, after, moves }) => {
    expect(movesToSaerskrivenYamlVersion3(before, after)).toBe(moves);
  });
});
