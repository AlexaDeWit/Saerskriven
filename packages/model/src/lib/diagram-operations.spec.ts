import { Either } from 'effect';
import { elementId, elementIn, softHyphen, validModel } from '../fixtures.js';
import {
  addDiagram,
  removeDiagram,
  renameDiagram,
} from './diagram-operations.js';
import { removeElement } from './element-operations.js';
import { OperationFailure } from './operation-failures.js';
import {
  cache,
  elementIds,
  errorOf,
  mainDiagram,
  modelOf,
  operationContract,
  secondDiagram,
  secondOfElements,
  writeFlow,
} from './operations.fixtures.js';
import { parseModel } from './parse.js';

describe('addDiagram', () => {
  it('appends a diagram after the ones the model holds', () => {
    const next = modelOf(
      addDiagram(validModel, {
        id: secondDiagram,
        title: 'Second',
        elements: [],
      }),
    );
    expect(next.diagrams.map((diagram) => diagram.id)).toEqual([
      mainDiagram,
      secondDiagram,
    ]);
    expect(next.diagrams[0]).toBe(validModel.diagrams[0]);
  });

  it('accepts a diagram of elements whose flows stay inside it', () => {
    const next = modelOf(addDiagram(validModel, secondOfElements));
    expect(next.diagrams[1].elements).toHaveLength(2);
  });

  it('refuses the id of a diagram the model holds', () => {
    expect(
      errorOf(
        addDiagram(validModel, {
          id: mainDiagram,
          title: 'Again',
          elements: [],
        }),
      ),
    ).toEqual(OperationFailure.DuplicateDiagramId({ diagramId: mainDiagram }));
  });

  it('refuses an empty title and a refused character in one', () => {
    expect(
      errorOf(
        addDiagram(validModel, { id: secondDiagram, title: ' ', elements: [] }),
      ),
    ).toEqual(OperationFailure.EmptyTitle({ diagramId: secondDiagram }));
    expect(
      errorOf(
        addDiagram(validModel, {
          id: secondDiagram,
          title: `Sec${softHyphen}ond`,
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
        addDiagram(validModel, {
          id: secondDiagram,
          title: 'Second',
          elements: [elementIn(validModel, 'element-api')],
        }),
      ),
    ).toEqual(
      OperationFailure.DuplicateElementId({
        elementId: elementId('element-api'),
      }),
    );
    expect(
      errorOf(
        addDiagram(validModel, {
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
        addDiagram(validModel, {
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
    const next = modelOf(renameDiagram(validModel, mainDiagram, 'Retitled'));
    expect(next.diagrams[0].title).toBe('Retitled');
    expect(next.diagrams[0].elements).toBe(validModel.diagrams[0].elements);
  });

  it('refuses an empty title, a whitespace title, and a refused character', () => {
    expect(errorOf(renameDiagram(validModel, mainDiagram, ''))).toEqual(
      OperationFailure.EmptyTitle({ diagramId: mainDiagram }),
    );
    expect(errorOf(renameDiagram(validModel, mainDiagram, '  '))).toEqual(
      OperationFailure.EmptyTitle({ diagramId: mainDiagram }),
    );
    expect(
      errorOf(renameDiagram(validModel, mainDiagram, `Ma${softHyphen}in`)),
    ).toEqual(
      OperationFailure.RefusedTitleCharacter({ diagramId: mainDiagram, at: 2 }),
    );
  });

  it('fails on an unknown diagram', () => {
    expect(errorOf(renameDiagram(validModel, secondDiagram, 'Ghost'))).toEqual(
      OperationFailure.UnknownDiagram({ diagramId: secondDiagram }),
    );
  });
});

describe('removeDiagram', () => {
  it('drops a diagram that owns no element', () => {
    const withSecond = modelOf(
      addDiagram(validModel, {
        id: secondDiagram,
        title: 'Second',
        elements: [],
      }),
    );
    expect(
      modelOf(removeDiagram(withSecond, secondDiagram)).diagrams.map(
        (diagram) => diagram.id,
      ),
    ).toEqual([mainDiagram]);
  });

  it('refuses a diagram that still owns elements, counting them', () => {
    expect(errorOf(removeDiagram(validModel, mainDiagram))).toEqual(
      OperationFailure.DiagramNotEmpty({
        diagramId: mainDiagram,
        elements: validModel.diagrams[0].elements.length,
      }),
    );
  });

  it('fails on an unknown diagram', () => {
    expect(errorOf(removeDiagram(validModel, secondDiagram))).toEqual(
      OperationFailure.UnknownDiagram({ diagramId: secondDiagram }),
    );
  });

  it('goes through once the caller has emptied it with removeElement', () => {
    const emptied = elementIds(validModel).reduce(
      (model, id) => modelOf(removeElement(model, elementId(id))),
      validModel,
    );
    const next = modelOf(removeDiagram(emptied, mainDiagram));
    expect(next.diagrams).toEqual([]);
    expect(next.threats.map((threat) => threat.elements)).toEqual([[]]);
    expect(next.assumptions).toEqual(validModel.assumptions);
    expect(Either.isRight(parseModel(next))).toBe(true);
  });
});

describe('diagram operations', () => {
  operationContract({
    addDiagram: {
      input: validModel,
      run: (model) =>
        addDiagram(model, { id: secondDiagram, title: 'Second', elements: [] }),
    },
    'addDiagram of elements': {
      input: validModel,
      run: (model) => addDiagram(model, secondOfElements),
    },
    renameDiagram: {
      input: validModel,
      run: (model) => renameDiagram(model, mainDiagram, 'Retitled'),
    },
    'removeDiagram of the diagram the model holds': {
      input: validModel,
      run: (model) => removeDiagram(model, mainDiagram),
    },
    removeDiagram: {
      input: modelOf(
        addDiagram(validModel, {
          id: secondDiagram,
          title: 'Second',
          elements: [],
        }),
      ),
      run: (model) => removeDiagram(model, secondDiagram),
    },
  });
});
