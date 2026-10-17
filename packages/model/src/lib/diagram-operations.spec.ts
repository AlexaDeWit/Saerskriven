import { Either } from 'effect';
import { elementId, softHyphen, validModel } from '../fixtures.js';
import {
  addDiagram,
  removeDiagram,
  renameDiagram,
} from './diagram-operations.js';
import { removeElement } from './element-operations.js';
import { OperationFailure } from './operation-failures.js';
import {
  elementIds,
  errorOf,
  mainDiagram,
  modelOf,
  operationContract,
  secondDiagram,
} from './operations.fixtures.js';
import { parseModel } from './parse.js';

const second = { id: secondDiagram, title: 'Second' };

describe('addDiagram', () => {
  it('appends an empty diagram after the ones the model holds', () => {
    const next = modelOf(addDiagram(validModel, second));
    expect(next.diagrams.map((diagram) => diagram.id)).toEqual([
      mainDiagram,
      secondDiagram,
    ]);
    expect(next.diagrams[1].placements).toEqual([]);
    expect(next.diagrams[0]).toBe(validModel.diagrams[0]);
    expect(next.elements).toBe(validModel.elements);
  });

  it('refuses the id of a diagram the model holds', () => {
    expect(
      errorOf(addDiagram(validModel, { id: mainDiagram, title: 'Again' })),
    ).toEqual(OperationFailure.DuplicateDiagramId({ diagramId: mainDiagram }));
  });

  it('refuses an empty title and a refused character in one', () => {
    expect(
      errorOf(addDiagram(validModel, { id: secondDiagram, title: ' ' })),
    ).toEqual(OperationFailure.EmptyTitle({ diagramId: secondDiagram }));
    expect(
      errorOf(
        addDiagram(validModel, {
          id: secondDiagram,
          title: `Sec${softHyphen}ond`,
        }),
      ),
    ).toEqual(
      OperationFailure.RefusedTitleCharacter({
        diagramId: secondDiagram,
        at: 3,
      }),
    );
  });
});

describe('renameDiagram', () => {
  it('retitles the diagram and leaves its elements as they were', () => {
    const next = modelOf(renameDiagram(validModel, mainDiagram, 'Retitled'));
    expect(next.diagrams[0].title).toBe('Retitled');
    expect(next.diagrams[0].placements).toBe(validModel.diagrams[0].placements);
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
  it('drops a diagram that places no element', () => {
    const withSecond = modelOf(addDiagram(validModel, second));
    expect(
      modelOf(removeDiagram(withSecond, secondDiagram)).diagrams.map(
        (diagram) => diagram.id,
      ),
    ).toEqual([mainDiagram]);
  });

  it('refuses a diagram that still places elements, counting them', () => {
    expect(errorOf(removeDiagram(validModel, mainDiagram))).toEqual(
      OperationFailure.DiagramNotEmpty({
        diagramId: mainDiagram,
        elements: validModel.diagrams[0].placements.length,
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
    expect(next.elements).toEqual([]);
    expect(next.threats).toEqual([]);
    expect(next.mitigations).toEqual([]);
    expect(next.assumptions).toEqual([]);
    expect(next.lastIssuedThreatNumber).toBe(validModel.lastIssuedThreatNumber);
    expect(Either.isRight(parseModel(next))).toBe(true);
  });
});

describe('diagram operations', () => {
  operationContract({
    addDiagram: {
      input: validModel,
      run: (model) => addDiagram(model, second),
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
      input: modelOf(addDiagram(validModel, second)),
      run: (model) => removeDiagram(model, secondDiagram),
    },
  });
});
