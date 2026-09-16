import { Either } from 'effect';
import { elementId } from '../fixtures.js';
import {
  addDiagram,
  removeDiagram,
  renameDiagram,
} from './diagram-operations.js';
import { removeElement } from './element-operations.js';
import { OperationFailure } from './operation-failures.js';
import {
  base,
  cache,
  elementIds,
  elementIn,
  errorOf,
  mainDiagram,
  modelOf,
  secondDiagram,
  secondOfElements,
  writeFlow,
  type OperationOutcome,
} from './operations.fixtures.js';
import { parseModel } from './parse.js';

describe('addDiagram', () => {
  it('appends a diagram after the ones the model holds', () => {
    const next = modelOf(
      addDiagram(base, { id: secondDiagram, title: 'Second', elements: [] }),
    );
    expect(next.diagrams.map((diagram) => diagram.id)).toEqual([
      mainDiagram,
      secondDiagram,
    ]);
    expect(next.diagrams[0]).toBe(base.diagrams[0]);
  });

  it('accepts a diagram of elements whose flows stay inside it', () => {
    const next = modelOf(addDiagram(base, secondOfElements));
    expect(next.diagrams[1].elements).toHaveLength(2);
  });

  it('refuses the id of a diagram the model holds', () => {
    expect(
      errorOf(
        addDiagram(base, { id: mainDiagram, title: 'Again', elements: [] }),
      ),
    ).toEqual(OperationFailure.DuplicateDiagramId({ diagramId: mainDiagram }));
  });

  it('refuses an empty title and a refused character in one', () => {
    expect(
      errorOf(
        addDiagram(base, { id: secondDiagram, title: ' ', elements: [] }),
      ),
    ).toEqual(OperationFailure.EmptyTitle({ diagramId: secondDiagram }));
    expect(
      errorOf(
        addDiagram(base, {
          id: secondDiagram,
          title: 'Sec\u00adond',
          elements: [],
        }),
      ),
    ).toEqual(
      OperationFailure.RefusedTitleCharacter({
        diagramId: secondDiagram,
        at: 3,
      }),
    );
  });

  it('refuses an element id the model holds already, or one the diagram repeats', () => {
    expect(
      errorOf(
        addDiagram(base, {
          id: secondDiagram,
          title: 'Second',
          elements: [elementIn(base, 'element-api')],
        }),
      ),
    ).toEqual(
      OperationFailure.DuplicateElementId({
        elementId: elementId('element-api'),
      }),
    );
    expect(
      errorOf(
        addDiagram(base, {
          id: secondDiagram,
          title: 'Second',
          elements: [cache, cache],
        }),
      ),
    ).toEqual(OperationFailure.DuplicateElementId({ elementId: cache.id }));
  });

  it('refuses a flow anchored outside the diagram', () => {
    expect(
      errorOf(
        addDiagram(base, {
          id: secondDiagram,
          title: 'Second',
          elements: [writeFlow],
        }),
      )?._tag,
    ).toBe('InvalidFlowEndpoint');
  });
});

describe('renameDiagram', () => {
  it('retitles the diagram and leaves its elements as they were', () => {
    const next = modelOf(renameDiagram(base, mainDiagram, 'Retitled'));
    expect(next.diagrams[0].title).toBe('Retitled');
    expect(next.diagrams[0].elements).toBe(base.diagrams[0].elements);
  });

  it('refuses an empty title, a whitespace title, and a refused character', () => {
    expect(errorOf(renameDiagram(base, mainDiagram, ''))).toEqual(
      OperationFailure.EmptyTitle({ diagramId: mainDiagram }),
    );
    expect(errorOf(renameDiagram(base, mainDiagram, '  '))).toEqual(
      OperationFailure.EmptyTitle({ diagramId: mainDiagram }),
    );
    expect(errorOf(renameDiagram(base, mainDiagram, 'Ma\u00adin'))).toEqual(
      OperationFailure.RefusedTitleCharacter({ diagramId: mainDiagram, at: 2 }),
    );
  });

  it('fails on an unknown diagram', () => {
    expect(errorOf(renameDiagram(base, secondDiagram, 'Ghost'))).toEqual(
      OperationFailure.UnknownDiagram({ diagramId: secondDiagram }),
    );
  });
});

describe('removeDiagram', () => {
  it('drops a diagram that owns no element', () => {
    const withSecond = modelOf(
      addDiagram(base, { id: secondDiagram, title: 'Second', elements: [] }),
    );
    expect(
      modelOf(removeDiagram(withSecond, secondDiagram)).diagrams.map(
        (diagram) => diagram.id,
      ),
    ).toEqual([mainDiagram]);
  });

  it('refuses a diagram that still owns elements, counting them', () => {
    expect(errorOf(removeDiagram(base, mainDiagram))).toEqual(
      OperationFailure.DiagramNotEmpty({
        diagramId: mainDiagram,
        elements: base.diagrams[0].elements.length,
      }),
    );
  });

  it('fails on an unknown diagram', () => {
    expect(errorOf(removeDiagram(base, secondDiagram))).toEqual(
      OperationFailure.UnknownDiagram({ diagramId: secondDiagram }),
    );
  });

  it('goes through once the caller has emptied it with removeElement', () => {
    const emptied = elementIds(base).reduce(
      (model, id) => modelOf(removeElement(model, elementId(id))),
      base,
    );
    const next = modelOf(removeDiagram(emptied, mainDiagram));
    expect(next.diagrams).toEqual([]);
    expect(next.threats.map((threat) => threat.elements)).toEqual([[]]);
    expect(next.assumptions).toEqual(base.assumptions);
    expect(Either.isRight(parseModel(next))).toBe(true);
  });
});

describe('operation purity', () => {
  it('leaves the input model untouched', () => {
    const pristine = structuredClone(base);
    addDiagram(base, { id: secondDiagram, title: 'Second', elements: [] });
    renameDiagram(base, mainDiagram, 'Retitled');
    removeDiagram(base, mainDiagram);
    expect(base).toEqual(pristine);
  });
});

describe('operation outputs re-parse through parseModel', () => {
  const outputs: [string, OperationOutcome][] = [
    [
      'addDiagram',
      addDiagram(base, { id: secondDiagram, title: 'Second', elements: [] }),
    ],
    ['addDiagram of elements', addDiagram(base, secondOfElements)],
    ['renameDiagram', renameDiagram(base, mainDiagram, 'Retitled')],
    [
      'removeDiagram',
      Either.flatMap(
        addDiagram(base, { id: secondDiagram, title: 'Second', elements: [] }),
        (model) => removeDiagram(model, secondDiagram),
      ),
    ],
  ];

  for (const [operation, result] of outputs) {
    it(`${operation} returns a model parseModel accepts`, () => {
      expect(Either.isRight(parseModel(modelOf(result)))).toBe(true);
    });
  }
});
