import { elementId, validModel } from '../fixtures.js';
import {
  diagramsOf,
  drawnElement,
  drawnElementOn,
  drawnElements,
  elementOf,
  placementOf,
  placementOn,
} from './drawing.js';
import { validModelFixture } from './model.fixtures.js';

const [diagram] = validModel.diagrams;

describe('drawnElements', () => {
  it('joins each placement to its element, in the order the diagram draws them', () => {
    expect(drawnElements(validModel, diagram)).toEqual(
      validModelFixture.diagrams[0].elements,
    );
  });

  it('draws an unchanged element and placement as the same object, and a changed one anew', () => {
    const [first] = drawnElements(validModel, diagram);
    expect(drawnElements(validModel, diagram)[0]).toBe(first);
    const renamed = {
      ...validModel,
      elements: validModel.elements.map((element, index) =>
        index === 0 ? { ...element, name: 'Buyer' } : element,
      ),
    };
    expect(drawnElements(renamed, diagram)[0]).toMatchObject({ name: 'Buyer' });
  });

  it('splits back into the element and the placement it was joined from', () => {
    for (const drawn of drawnElements(validModel, diagram)) {
      expect(validModel.elements).toContainEqual(elementOf(drawn));
      expect(diagram.placements).toContainEqual(placementOf(drawn));
    }
  });
});

describe('drawnElement', () => {
  const [actor, api, , flow] = validModel.elements;
  const [actorPlacement, , , flowPlacement] = diagram.placements;

  it('draws nothing from a placement holding geometry of another kind', () => {
    expect(drawnElement(actor, flowPlacement)).toBeUndefined();
  });

  it('draws nothing where a flow end is placed unlike the element holds it', () => {
    expect(
      drawnElement(flow, {
        ...flowPlacement,
        source: { position: { x: 0, y: 0 } },
      }),
    ).toBeUndefined();
  });

  it('draws an element with the accent its placement takes', () => {
    expect(
      drawnElement(api, { ...actorPlacement, accent: 'l2' }),
    ).toMatchObject({ id: 'element-api', accent: 'l2' });
  });
});

describe('placementOn and diagramsOf', () => {
  it("find an element's placement and the diagrams placing it", () => {
    const api = elementId('element-api');
    expect(placementOn(diagram, api)).toBe(diagram.placements[1]);
    expect(diagramsOf(validModel, api)).toEqual([diagram]);
    expect(drawnElementOn(validModel, diagram, api)).toMatchObject({
      position: { x: 320, y: 120 },
    });
  });

  it('find nothing for an element no diagram places', () => {
    const ghost = elementId('element-ghost');
    expect(placementOn(diagram, ghost)).toBeUndefined();
    expect(diagramsOf(validModel, ghost)).toEqual([]);
    expect(drawnElementOn(validModel, diagram, ghost)).toBeUndefined();
  });
});
