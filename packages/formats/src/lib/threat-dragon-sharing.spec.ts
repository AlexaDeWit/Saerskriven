import {
  addDiagram,
  placeElement,
  threatIdSchema,
  type Model,
} from '@saerskriven/model';
import {
  diagramId,
  elementId,
  placementIn,
  sharedModel,
} from '@saerskriven/model/fixtures';
import type { ThreatDragonCell } from '@saerskriven/wire-threat-dragon';
import { Ajv } from 'ajv';
import { Result } from 'effect';
import { threatDragonJsonSchema } from './corpus.fixtures.js';
import { cellsOf, threatsOf } from './threat-dragon-document.js';
import {
  featureCompleteText,
  threatDragonReading,
} from './threat-dragon.fixtures.js';
import { threatDragonCodec } from './threat-dragon.js';

const written = (model: Model) => threatDragonCodec.write(model);

const cellsOn = (output: string, index: number): readonly ThreatDragonCell[] =>
  cellsOf(threatDragonReading(output).source.detail.diagrams[index]);

const cellNamed = (cells: readonly ThreatDragonCell[], id: string) =>
  cells.find((cell) => cell.id === id);

describe('writing an element placed on several diagrams to Threat Dragon', () => {
  const { output, divergences } = written(sharedModel);

  it('writes a file Threat Dragon validates as one of its own', () => {
    const validate = new Ajv({ allowUnionTypes: true }).compile(
      threatDragonJsonSchema,
    );
    expect(validate(JSON.parse(output) as unknown)).toBe(true);
  });

  it('writes a cell on each diagram, the first under the element id and the others under one derived from it', () => {
    expect(cellNamed(cellsOn(output, 0), 'payments-api')).toBeDefined();
    expect(cellNamed(cellsOn(output, 1), 'payments-api')).toBeUndefined();
    expect(
      cellNamed(cellsOn(output, 1), 'payments-api-payments'),
    ).toBeDefined();
    expect(written(sharedModel).output).toBe(output);
  });

  it("carries the element's name and threats on every cell", () => {
    for (const [index, id] of [
      [0, 'payments-api'],
      [1, 'payments-api-payments'],
    ] as const) {
      const cell = cellNamed(cellsOn(output, index), id);
      expect(cell?.data).toMatchObject({ name: 'Payments API' });
      expect(
        cell === undefined ? [] : threatsOf(cell).map(({ id: held }) => held),
      ).toEqual(['threat-card-data']);
    }
  });

  it('fastens a flow on a later diagram to the cells of that diagram', () => {
    const score = cellNamed(cellsOn(output, 1), 'score');
    expect(score).toMatchObject({
      target: { cell: 'payments-api-payments' },
    });
  });

  it('reports the split once per element, naming the diagrams', () => {
    expect(
      divergences.filter(
        ({ detail }) => detail.code === 'element-split-across-diagrams',
      ),
    ).toEqual(
      ['payments-api', 'charge', 'payments-zone', 'legend'].map((id) => ({
        subject: { kind: 'element', id },
        detail: {
          code: 'element-split-across-diagrams',
          parameters: { diagrams: ['High level', 'Payments'] },
        },
        reason: 'split',
      })),
    );
  });

  it('writes an end drawn away as a free end, and reports it', () => {
    const charge = cellNamed(cellsOn(output, 0), 'charge');
    expect(charge).toMatchObject({ target: { x: 680, y: 210 } });
    expect(divergences).toContainEqual({
      subject: { kind: 'element', id: 'charge' },
      detail: {
        code: 'flow-end-drawn-away-freed',
        parameters: { element: 'card-vault', diagram: 'High level' },
      },
      reason: 'unrepresentable',
    });
  });

  it('reports each end it frees once per diagram, naming the diagram', () => {
    const audit = diagramId('audit');
    const audited = Result.getOrThrow(
      Result.flatMap(
        addDiagram(sharedModel, { id: audit, title: 'Audit' }),
        (model) =>
          placeElement(model, audit, {
            element: elementId('charge'),
            waypoints: [],
            source: { position: { x: 0, y: 0 } },
            target: { position: { x: 200, y: 0 } },
          }),
      ),
    );
    expect(
      written(audited).divergences.flatMap(({ detail }) =>
        detail.code === 'flow-end-drawn-away-freed' ? [detail.parameters] : [],
      ),
    ).toEqual([
      { element: 'card-vault', diagram: 'High level' },
      { element: 'payments-api', diagram: 'Audit' },
      { element: 'card-vault', diagram: 'Audit' },
    ]);
  });

  it('lists in a boundary only the cells of its own diagram, reporting the rest once per diagram, naming it', () => {
    expect(cellNamed(cellsOn(output, 0), 'payments-zone')?.data).toMatchObject({
      containedElements: ['payments-api'],
      crossingFlows: ['card-details'],
    });
    expect(
      divergences.filter(
        ({ detail }) => detail.code === 'relationships-off-diagram-dropped',
      ),
    ).toEqual(
      ['High level', 'Payments'].map((diagram) => ({
        subject: { kind: 'element', id: 'payments-zone' },
        detail: {
          code: 'relationships-off-diagram-dropped',
          parameters: { count: 1, diagram },
        },
        reason: 'unrepresentable',
      })),
    );
  });

  it('reads back as one element per cell, the threats on each', () => {
    const read = threatDragonCodec.read(output);
    const model = Result.isSuccess(read) ? read.success.model : undefined;
    expect(model?.elements.map(({ id }) => id)).toEqual(
      expect.arrayContaining(['payments-api', 'payments-api-payments']),
    );
    expect(
      model?.threats.find(({ id }) => id === 'threat-card-data')?.elements,
    ).toEqual(['payments-api', 'payments-api-payments']);
  });

  it('keeps the id on the diagram whose cell of it the document written over holds', () => {
    const read = threatDragonReading(featureCompleteText);
    const [booking] = read.model.diagrams;
    const clerk = placementIn(read.model, 'actor-clerk');
    const placed = Result.getOrThrow(
      placeElement(read.model, booking.id, clerk),
    );
    const merged = threatDragonCodec.write(placed, read.source);
    expect(cellNamed(cellsOn(merged.output, 1), 'actor-clerk')).toBeDefined();
    expect(
      cellNamed(cellsOn(merged.output, 0), `actor-clerk-${booking.id}`),
    ).toBeDefined();
    expect(
      merged.divergences.filter(
        ({ detail }) => detail.code === 'cell-discarded',
      ),
    ).toEqual([]);
  });

  it('derives an id no record of the model holds', () => {
    const taken = threatIdSchema.parse('payments-api-payments');
    const crowded: Model = {
      ...sharedModel,
      threats: sharedModel.threats.map((threat, index) =>
        index === 1 ? { ...threat, id: taken } : threat,
      ),
    };
    expect(
      cellNamed(cellsOn(written(crowded).output, 1), 'payments-api-payments-2'),
    ).toBeDefined();
  });
});
