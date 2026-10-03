import { escapedForTerminal } from '@saerskriven/formats';
import {
  acceptedTextSchema,
  diagramIdSchema,
  elementIdSchema,
  elementKindSchema,
  elementSchema,
  elementsById,
  flowEndName,
  flowEnds,
  unlabelledFlow,
  type Diagram,
  type Element,
  type FlowEndpoint,
  type Point,
  type Size,
} from '@saerskriven/model';
import { z } from 'zod';

const elementContextSchema = z.object({
  diagram: diagramIdSchema,
  threats: z.int().nonnegative(),
  namedFromEnds: acceptedTextSchema
    .optional()
    .describe(
      'For a flow left unlabelled, whose name is empty: the flow named from its ends, such as "Flow from Shopper to Web shop".',
    ),
});

/** A concise identity, scope and threat count for an element. */
export const elementRowSchema = elementContextSchema.extend({
  id: elementIdSchema,
  kind: elementKindSchema,
  name: acceptedTextSchema,
  outOfScope: z.boolean(),
});

const [firstElementSchema, ...otherElementSchemas] = elementSchema.options;

/** Detailed reads carry the complete model variant, including future model fields. */
export const elementDetailSchema = z.discriminatedUnion('kind', [
  firstElementSchema.extend(elementContextSchema.shape),
  ...otherElementSchemas.map((variant) =>
    variant.extend(elementContextSchema.shape),
  ),
]);

/** A full element with its diagram and threat count. */
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

/** One element of a diagram, paired with the diagram that owns it. */
export type ElementOnDiagram = {
  readonly element: Element;
  readonly diagram: Diagram;
};

/** Every element of the given diagrams, each paired with its own diagram. */
export function elementsOnDiagrams(
  diagrams: readonly Diagram[],
): readonly ElementOnDiagram[] {
  return diagrams.flatMap((diagram) =>
    diagram.elements.map((element) => ({ element, diagram })),
  );
}

/** The identifying fields of one element, and its count in `counts`. */
export function elementRow(
  { element, diagram }: ElementOnDiagram,
  counts: ReadonlyMap<string, number>,
): ElementRow {
  return {
    id: element.id,
    diagram: diagram.id,
    kind: element.kind,
    name: element.name,
    outOfScope: element.outOfScope,
    threats: threatsOn(element, counts),
    ...namedFromEnds(element, diagram),
  };
}

/** One element's whole record, geometry included, and its count in `counts`. */
export function elementDetail(
  { element, diagram }: ElementOnDiagram,
  counts: ReadonlyMap<string, number>,
): ElementDetail {
  return {
    ...element,
    diagram: diagram.id,
    threats: threatsOn(element, counts),
    ...namedFromEnds(element, diagram),
  };
}

/** Text results retain explicit false, empty text and empty relationship lists. */
export function renderElement(
  row: ElementDetail | ElementRow,
): readonly string[] {
  return [
    escapedForTerminal(
      `  ${row.id} (${row.kind}, diagram ${row.diagram}, threats ${String(row.threats)}${row.outOfScope ? ', out of scope' : ''}): ${row.namedFromEnds ?? row.name}`,
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
  element: Element,
  diagram: Diagram,
): { readonly namedFromEnds?: string } {
  const flow = unlabelledFlow(element);
  if (flow === undefined) {
    return {};
  }
  const { source, target, bidirectional } = flowEnds(
    flow,
    elementsById(diagram.elements),
  );
  const from = flowEndName(source, 'a free point');
  const to = flowEndName(target, 'a free point');
  return {
    namedFromEnds: bidirectional
      ? `Flow between ${from} and ${to}`
      : `Flow from ${from} to ${to}`,
  };
}

function threatsOn(
  element: Element,
  counts: ReadonlyMap<string, number>,
): number {
  return counts.get(element.id) ?? 0;
}

function renderEndpoint(endpoint: FlowEndpoint): string {
  return endpoint.kind === 'attached'
    ? `element ${endpoint.element}${endpoint.side === undefined ? '' : ` on its ${endpoint.side}`}`
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
