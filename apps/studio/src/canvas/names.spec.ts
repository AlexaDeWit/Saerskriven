import {
  layoutDiagram,
  type CanvasLayout,
  type ThreatBadge,
} from '@saerskriven/canvas';
import {
  canvasModel,
  probeFlow,
  readerElement,
  requestFlow,
  studioElement,
} from './canvas.fixtures.js';
import { accessibleNames } from './names.js';

const layout = layoutDiagram(canvasModel.diagrams[0], canvasModel);

const names = accessibleNames(layout);

const withoutNodes = (from: CanvasLayout): CanvasLayout => ({
  ...from,
  nodes: [],
});

const withBadge = (id: string, badge: ThreatBadge) =>
  accessibleNames({
    ...layout,
    nodes: layout.nodes.map((node) =>
      node.id === id ? { ...node, badge } : node,
    ),
    edges: layout.edges.map((edge) =>
      edge.id === id ? { ...edge, badge } : edge,
    ),
  });

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

  it('says a threat on a counted badge is flagged', () => {
    expect(
      withBadge(readerElement, {
        kind: 'counted',
        count: 1,
        severity: 'medium',
        secondary: 0,
        flagged: true,
      }).get(readerElement),
    ).toBe(
      'Reader, actor, 1 open threat, highest severity medium, a threat flagged',
    );
  });

  it('says a flag-only badge is flagged and counts no open threat', () => {
    const spoken = withBadge(studioElement, { kind: 'flag-only' }).get(
      studioElement,
    );
    expect(spoken).toBe('Studio, process, a threat flagged');
  });

  it('says a flagged flow is flagged', () => {
    expect(withBadge(probeFlow, { kind: 'flag-only' }).get(probeFlow)).toBe(
      'Reads a file, flow, from Studio to a free point, a threat flagged',
    );
  });

  it('names a flow by the elements its ends attach to', () => {
    expect(names.get(requestFlow)).toContain(
      'Opens a model, flow, from Reader to Studio',
    );
  });

  it('says a bidirectional flow runs between its ends rather than from one to the other', () => {
    const bothWays = accessibleNames({
      ...layout,
      edges: layout.edges.map((edge) =>
        edge.id === requestFlow ? { ...edge, bidirectional: true } : edge,
      ),
    });
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
    expect(accessibleNames(withoutNodes(layout)).get(requestFlow)).toContain(
      `from ${readerElement} to ${studioElement}`,
    );
  });

  it('names an unnamed element by its kind, so a flow end still reads', () => {
    const unnamed = {
      ...layout,
      nodes: layout.nodes.map((node) => ({ ...node, name: '' })),
    };
    const spoken = accessibleNames(unnamed);
    expect(spoken.get(studioElement)).toBe('process');
    expect(spoken.get(requestFlow)).toContain('from actor to process');
  });

  it('names every element the layout draws', () => {
    expect(names.size).toBe(layout.nodes.length + layout.edges.length);
  });
});
