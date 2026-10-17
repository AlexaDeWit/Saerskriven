import { escapedForTerminal } from '@saerskriven/formats';
import {
  acceptedTextSchema,
  accentField,
  accentSchema,
  diagramIdSchema,
  diagramsOf,
  drawnElementSchema,
  elementIdSchema,
  elementKindSchema,
  elementOf,
  elementsById,
  firstDrawings,
  flowEndName,
  flowEnds,
  unlabelledFlow,
  type Diagram,
  type DiagramId,
  type DrawnElement,
  type DrawnFlowEndpoint,
  type Element,
  type ElementId,
  type Model,
  type Point,
  type Size,
} from '@saerskriven/model';
import { z } from 'zod';

const elementContextSchema = z.object({
  diagram: diagramIdSchema.describe(
    "The diagram the row draws the element from: the first diagram drawing it that the read covers, which is the first of `diagrams`, or of the diagrams a search's `diagram` filter keeps. Its accent, and in a detailed row its geometry, are the ones it has there.",
  ),
  diagrams: z
    .array(diagramIdSchema)
    .min(1)
    .describe('Every diagram the element is on, in diagram order.'),
  threats: z.int().nonnegative(),
  namedFromEnds: acceptedTextSchema
    .optional()
    .describe(
      'For a flow left unlabelled, whose name is empty or white space alone: the flow named from its ends, such as "Flow from Shopper to Web shop".',
    ),
});

/** A concise identity, scope, accent and threat count for an element. */
export const elementRowSchema = elementContextSchema.extend({
  id: elementIdSchema,
  kind: elementKindSchema,
  name: acceptedTextSchema,
  outOfScope: z.boolean(),
  accent: accentSchema
    .optional()
    .describe(
      'The accent key the element is drawn with on `diagram`, where it holds one there.',
    ),
});

const [firstElementSchema, ...otherElementSchemas] = drawnElementSchema.options;

/** Detailed reads carry the complete model variant, including future model fields. */
export const elementDetailSchema = z.discriminatedUnion('kind', [
  firstElementSchema.extend(elementContextSchema.shape),
  ...otherElementSchemas.map((variant) =>
    variant.extend(elementContextSchema.shape),
  ),
]);

/** A full element with its diagrams and threat count. */
export type ElementDetail = z.infer<typeof elementDetailSchema>;

/** The concise fields used by search summaries and coverage reports. */
export type ElementRow = z.infer<typeof elementRowSchema>;

/** Search returns either a complete element or the concise row. */
export const elementResultSchema = z.union([
  elementDetailSchema,
  elementRowSchema,
]);

/** One end of a flow, as an edit names it and a drawing reports it. */
export const flowEndSchema = z.enum(['source', 'target']);

/**
 * One element as a diagram draws it, paired with that diagram, with every
 * diagram of the model it is on, and with every element of the model by id.
 */
export type ElementOnDiagram = {
  readonly element: DrawnElement;
  readonly diagram: Diagram;
  readonly diagrams: readonly DiagramId[];
  readonly elements: ReadonlyMap<ElementId, Element>;
};

/**
 * Every element the given diagrams draw, once each, in diagram order. An
 * element on several of them is paired with the first that draws it.
 */
export function elementsOnDiagrams(
  model: Model,
  searched: readonly Diagram[],
): readonly ElementOnDiagram[] {
  const elements = elementsById(model.elements);
  return firstDrawings(model, searched).map(({ drawn, diagram }) => ({
    element: drawn,
    diagram,
    diagrams: diagramsOf(model, drawn.id).map(({ id }) => id),
    elements,
  }));
}

/** The identifying fields of one element, and its count in `counts`. */
export function elementRow(
  { element, diagram, diagrams, elements }: ElementOnDiagram,
  counts: ReadonlyMap<string, number>,
): ElementRow {
  return {
    id: element.id,
    diagram: diagram.id,
    diagrams: [...diagrams],
    kind: element.kind,
    name: element.name,
    outOfScope: element.outOfScope,
    ...accentField(element),
    threats: threatsOn(element, counts),
    ...namedFromEnds(element, elements),
  };
}

/** One element's whole record, geometry included, and its count in `counts`. */
export function elementDetail(
  { element, diagram, diagrams, elements }: ElementOnDiagram,
  counts: ReadonlyMap<string, number>,
): ElementDetail {
  return {
    ...element,
    diagram: diagram.id,
    diagrams: [...diagrams],
    threats: threatsOn(element, counts),
    ...namedFromEnds(element, elements),
  };
}

/** Text results retain explicit false, empty text and empty relationship lists. */
export function renderElement(
  row: ElementDetail | ElementRow,
): readonly string[] {
  return [
    escapedForTerminal(
      `  ${row.id} (${headingFacts(row).join(', ')}): ${row.namedFromEnds ?? row.name}`,
    ),
    ...('description' in row
      ? detailLines(row).map((line) => `    ${escapedForTerminal(line)}`)
      : []),
  ];
}

const formattedFields = new Set<string>([
  ...elementRowSchema.keyof().options,
  'description',
  'reasonOutOfScope',
  'position',
  'size',
  'source',
  'target',
  'waypoints',
  'shape',
  'text',
]);

function headingFacts(row: ElementDetail | ElementRow): readonly string[] {
  const others = row.diagrams.filter((id) => id !== row.diagram);
  return [
    row.kind,
    `diagram ${row.diagram}`,
    ...(others.length === 0 ? [] : [`also on ${others.join(' and ')}`]),
    `threats ${String(row.threats)}`,
    ...(row.accent === undefined ? [] : [`accent ${row.accent}`]),
    ...(row.outOfScope ? ['out of scope'] : []),
  ];
}

function detailLines(row: ElementDetail): readonly string[] {
  return [
    ...(row.description.length === 0
      ? []
      : [`description: ${row.description}`]),
    ...(row.outOfScope || row.reasonOutOfScope.length > 0
      ? [`reason out of scope: ${row.reasonOutOfScope}`]
      : []),
    ...(row.kind === 'text' && row.text.length > 0
      ? [`text: ${row.text}`]
      : []),
    ...geometryLines(row),
    ...Object.entries(row)
      .filter(
        ([key, value]) => !formattedFields.has(key) && value !== undefined,
      )
      .map(([key, value]) => `${key}: ${JSON.stringify(value)}`),
  ];
}

function geometryLines(row: ElementDetail): readonly string[] {
  if (row.kind === 'flow') {
    return [
      `source: ${renderEndpoint(row.source)}`,
      `target: ${renderEndpoint(row.target)}`,
      ...(row.waypoints.length === 0
        ? []
        : [`waypoints: ${renderPath(row.waypoints)}`]),
    ];
  }
  if (row.kind === 'trust-boundary') {
    return [
      row.shape.kind === 'box'
        ? `shape: box ${renderBox(row.shape.position, row.shape.size)}`
        : `shape: curve through ${renderPath(row.shape.waypoints)}`,
    ];
  }
  return [`box: ${renderBox(row.position, row.size)}`];
}

function namedFromEnds(
  element: DrawnElement,
  elements: ReadonlyMap<ElementId, Element>,
): { readonly namedFromEnds?: string } {
  const flow = unlabelledFlow(element);
  if (flow === undefined) {
    return {};
  }
  const facts = elementOf(flow);
  if (facts.kind !== 'flow') {
    return {};
  }
  const { source, target, bidirectional } = flowEnds(facts, elements);
  const from = flowEndName(source, 'a free point');
  const to = flowEndName(target, 'a free point');
  return {
    namedFromEnds: bidirectional
      ? `Flow between ${from} and ${to}`
      : `Flow from ${from} to ${to}`,
  };
}

function threatsOn(
  element: DrawnElement,
  counts: ReadonlyMap<string, number>,
): number {
  return counts.get(element.id) ?? 0;
}

function renderEndpoint(endpoint: DrawnFlowEndpoint): string {
  if (endpoint.kind === 'attached') {
    return `element ${endpoint.element}${endpoint.side === undefined ? '' : ` on its ${endpoint.side}`}`;
  }
  return endpoint.kind === 'away'
    ? `element ${endpoint.element}, which another diagram draws, drawn at ${renderPoint(endpoint.position)}`
    : `free at ${renderPoint(endpoint.position)}`;
}

function renderBox(position: Point, size: Size): string {
  return `${renderPoint(position)} sized ${String(size.width)} by ${String(size.height)}`;
}

function renderPath(points: readonly Point[]): string {
  return points.map(renderPoint).join(' then ');
}

function renderPoint(point: Point): string {
  return `${String(point.x)},${String(point.y)}`;
}
