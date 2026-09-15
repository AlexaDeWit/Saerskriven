import { layoutDiagram, type CanvasLayout } from '@saerskriven/canvas';
import type { Model } from '@saerskriven/model';
import {
  canvasModel,
  flaggedCanvasModel,
  probeFlow,
  readerElement,
  requestFlow,
  studioElement,
} from './canvas.fixtures.js';
import { accessibleNames } from './names.js';

const layout = layoutDiagram(canvasModel.diagrams[0], canvasModel);

const names = accessibleNames(layout, canvasModel);

const withoutNodes = (from: CanvasLayout): CanvasLayout => ({
  ...from,
  nodes: [],
});

const namedIn = (model: Model, id: string): string | undefined =>
  accessibleNames(layoutDiagram(model.diagrams[0], model), model).get(id);

describe('accessibleNames', () => {
  it('names an element by what it is called and what kind it is', () => {
    expect(names.get(studioElement)).toBe('Studio, process');
  });

  it('says what an element badge shows, which no glyph says to a reader', () => {
    expect(names.get(readerElement)).toBe(
      'Reader, actor, 1 open threat, highest severity medium',
    );
  });

  it('says an undecided badge is unassessed rather than naming a severity', () => {
    expect(names.get(requestFlow)).toContain('severity not assessed');
  });

  it('counts threats in the plural, so a badge of one is not read as many', () => {
    expect(names.get(requestFlow)).toContain('2 open threats');
    expect(names.get(readerElement)).toContain('1 open threat,');
  });

  it('names the flag raised on an open threat after the count it joins', () => {
    const model = flaggedCanvasModel({
      'threat-tampering': { invalidated: true },
    });
    expect(namedIn(model, readerElement)).toBe(
      'Reader, actor, 1 open threat, highest severity medium, Rests on an invalidated assumption',
    );
  });

  it('names each flag once, in flag order, whichever threat raises it', () => {
    const model = flaggedCanvasModel({
      'threat-disclosure': { invalidated: true },
      'threat-repudiation': { status: 'mitigated' },
      'threat-tampering': { elements: [requestFlow], invalidated: true },
    });
    expect(namedIn(model, requestFlow)).toBe(
      'Opens a model, flow, from Reader to Studio, 2 open threats, highest severity medium, Mitigated without implemented work, Rests on an invalidated assumption',
    );
  });

  it('names the flags of a threat in no open status, with no count', () => {
    const model = flaggedCanvasModel({
      'threat-tampering': {
        status: 'mitigated',
        elements: [studioElement, probeFlow],
        invalidated: true,
      },
    });
    expect([namedIn(model, studioElement), namedIn(model, probeFlow)]).toEqual([
      'Studio, process, Mitigated without implemented work, Rests on an invalidated assumption',
      'Reads a file, flow, from Studio to a free point, Mitigated without implemented work, Rests on an invalidated assumption',
    ]);
  });

  it('names a flow by the elements its ends attach to', () => {
    expect(names.get(requestFlow)).toContain(
      'Opens a model, flow, from Reader to Studio',
    );
  });

  it('says a bidirectional flow runs between its ends rather than from one to the other', () => {
    const bothWays = accessibleNames(
      {
        ...layout,
        edges: layout.edges.map((edge) =>
          edge.id === requestFlow ? { ...edge, bidirectional: true } : edge,
        ),
      },
      canvasModel,
    );
    expect(bothWays.get(requestFlow)).toContain(
      'Opens a model, flow, between Reader and Studio',
    );
  });

  it('names an end that belongs to no element as the free point it is', () => {
    expect(names.get(probeFlow)).toBe(
      'Reads a file, flow, from Studio to a free point',
    );
  });

  it('falls back to the id of an end the layout drew no node for', () => {
    expect(
      accessibleNames(withoutNodes(layout), canvasModel).get(requestFlow),
    ).toContain(`from ${readerElement} to ${studioElement}`);
  });

  it('names an unnamed element by its kind, so a flow end still reads', () => {
    const unnamed = {
      ...layout,
      nodes: layout.nodes.map((node) => ({ ...node, name: '' })),
    };
    const spoken = accessibleNames(unnamed, canvasModel);
    expect(spoken.get(studioElement)).toBe('process');
    expect(spoken.get(requestFlow)).toContain('from actor to process');
  });

  it('names every element the layout draws', () => {
    expect(names.size).toBe(layout.nodes.length + layout.edges.length);
  });
});
