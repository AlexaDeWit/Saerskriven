import { flowEndNodeId, layoutDiagram } from '@saerskriven/canvas';
import {
  boundaryElement,
  canvasModel,
  flaggedCanvasModel,
  noteElement,
  probeFlow,
  requestFlow,
} from './canvas.fixtures.js';
import { activeTranslator } from '../messages/locale.js';
import { accessibleNames } from './names.js';
import {
  diagramGraph,
  elementIds,
  nodesById,
  withMeasurements,
  withLiveEdges,
} from './nodes.js';
import { actorElement, processElement } from '../store/store.fixtures.js';

const { t } = activeTranslator();

const layout = layoutDiagram(canvasModel.diagrams[0], canvasModel);

const names = accessibleNames(layout, canvasModel, t);

describe('diagramGraph', () => {
  it('carries an element node per drawn node and an anchor per free end', () => {
    const { nodes } = diagramGraph(layout, canvasModel, [], t);
    expect(nodes).toHaveLength(layout.nodes.length + 1);
    expect(nodes.at(-1)?.id).toBe(flowEndNodeId(probeFlow, 'target'));
  });

  it('names each element node and marks the one the store has selected', () => {
    const { nodes } = diagramGraph(layout, canvasModel, [actorElement], t);
    const reader = nodes.find((node) => node.id === actorElement);
    expect(reader?.selected).toBe(true);
    expect(reader?.zIndex).toBe(1);
    expect(reader?.ariaLabel).toBe(names.get(actorElement));
    expect(nodes.find((node) => node.id === processElement)?.selected).toBe(
      false,
    );
  });

  it('names a node by the flags the model raises on it', () => {
    const flagged = flaggedCanvasModel({
      'threat-tampering': { invalidated: true },
    });
    const { nodes } = diagramGraph(
      layoutDiagram(flagged.diagrams[0], flagged),
      flagged,
      [],
      t,
    );
    expect(nodes.find((node) => node.id === actorElement)?.ariaLabel).toContain(
      'Rests on an invalidated assumption',
    );
  });

  it('keeps a selected boundary below unselected nodes', () => {
    const { nodes } = diagramGraph(layout, canvasModel, [boundaryElement], t);
    expect(nodes.find((node) => node.id === boundaryElement)?.zIndex).toBe(-1);
    expect(nodes.find((node) => node.id === actorElement)?.zIndex).toBe(0);
  });

  it('marks a node a flow can end on connectable, and no other', () => {
    const { nodes } = diagramGraph(layout, canvasModel, [], t);
    const connectable = (id: string): boolean | undefined =>
      nodes.find((node) => node.id === id)?.connectable;

    expect(connectable(actorElement)).toBe(true);
    expect(connectable(processElement)).toBe(true);
    expect(connectable(boundaryElement)).toBe(false);
    expect(connectable(noteElement)).toBe(false);
  });

  it('carries one named edge per flow and marks the selected one', () => {
    const { edges } = diagramGraph(layout, canvasModel, [requestFlow], t);
    expect(edges).toHaveLength(2);
    const request = edges.find((edge) => edge.id === requestFlow);
    expect(request?.selected).toBe(true);
    expect(request?.ariaLabel).toBe(names.get(requestFlow));
  });

  it('marks a selected flow on the flow alone, no node beside it', () => {
    const { nodes } = diagramGraph(layout, canvasModel, [requestFlow], t);
    expect(nodes.some((node) => node.selected)).toBe(false);
  });
});

describe('elementIds', () => {
  it('holds every element the layout drew and no anchor', () => {
    const ids = elementIds(layout);
    expect(ids.get(requestFlow)).toBe(requestFlow);
    expect(ids.get(actorElement)).toBe(actorElement);
    expect(ids.get(flowEndNodeId(probeFlow, 'target'))).toBeUndefined();
  });
});

describe('nodesById', () => {
  it('holds the drawn nodes, so a reported position has a model one to answer', () => {
    expect(nodesById(layout).get(actorElement)?.position).toEqual({
      x: 0,
      y: 0,
    });
    expect(nodesById(layout).get(requestFlow)).toBeUndefined();
  });
});

describe('withMeasurements', () => {
  it('carries the extent React Flow measured onto the nodes the model gives', () => {
    const measured = diagramGraph(layout, canvasModel, [], t).nodes.map(
      (node) => ({
        ...node,
        measured: { width: 120, height: 60 },
      }),
    );

    const carried = withMeasurements(
      diagramGraph(layout, canvasModel, [], t).nodes,
      measured,
    );

    expect(carried[0].measured).toEqual({ width: 120, height: 60 });
  });

  it('leaves a node nothing was measured for as the model gave it', () => {
    const [first] = withMeasurements(
      diagramGraph(layout, canvasModel, [], t).nodes,
      [],
    );
    expect(first.measured).toBeUndefined();
  });
});

describe('withLiveEdges', () => {
  it('reuses settled edges and replaces changed geometry', () => {
    const graph = diagramGraph(layout, canvasModel, [], t);
    const changed = {
      ...layout,
      edges: layout.edges.map((edge, index) =>
        index === 0
          ? { ...edge, source: { x: edge.source.x + 10, y: edge.source.y } }
          : edge,
      ),
    };

    const live = withLiveEdges(graph.edges, changed);

    expect(live[0]).not.toBe(graph.edges[0]);
    expect(live[0].data?.edge).toBe(changed.edges[0]);
    expect(live[1]).toBe(graph.edges[1]);
  });

  it('keeps a selected flow label on its prior candidate', () => {
    const graph = diagramGraph(layout, canvasModel, [requestFlow], t);
    const index = layout.edges.findIndex((edge) => edge.id === requestFlow);
    const settled = layout.edges[index];
    const offset = { x: 10, y: 15 };
    const changedEdge = {
      ...settled,
      source: {
        x: settled.source.x + offset.x,
        y: settled.source.y + offset.y,
      },
      target: {
        x: settled.target.x + offset.x,
        y: settled.target.y + offset.y,
      },
      waypoints: settled.waypoints.map((point) => ({
        x: point.x + offset.x,
        y: point.y + offset.y,
      })),
    };
    const changed = {
      ...layout,
      edges: layout.edges.map((edge, edgeIndex) =>
        edgeIndex === index ? changedEdge : edge,
      ),
    };

    const live = withLiveEdges(graph.edges, changed)[index].data?.edge;

    expect(live?.label.name.at.x).toBeCloseTo(
      settled.label.name.at.x + offset.x,
    );
    expect(live?.label.name.at.y).toBeCloseTo(
      settled.label.name.at.y + offset.y,
    );
  });
});
