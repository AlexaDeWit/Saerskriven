import type {
  CanvasEdge,
  CanvasLayout,
  CanvasNode,
  CanvasNodeKind,
  ThreatBadge,
} from '@saerskriven/canvas';
import {
  threatFlags,
  threatFlagSchema,
  type ElementId,
  type Model,
  type ThreatFlag,
} from '@saerskriven/model';
import { flagLabel } from '@saerskriven/render';

const kindWords = {
  actor: 'actor',
  process: 'process',
  store: 'store',
  text: 'text',
  'boundary-box': 'trust boundary',
  'boundary-curve': 'trust boundary',
} as const satisfies Record<CanvasNodeKind, string>;

const freeEndWords = 'a free point';

/**
 * What every element the layout drew is called to assistive technology,
 * keyed by the id React Flow knows it by. The glyphs are hidden from a
 * screen reader, so a name here is the only account of the element it has:
 * what the element is called, what kind it is, what its badge says, and
 * which flags `model` raises on the threats naming it. The badge draws one
 * mark for either flag, so the name is where the two are told apart. A flow
 * also names the elements its ends attach to, from one to the other or
 * between the two where it runs both ways.
 */
export function accessibleNames(
  layout: CanvasLayout,
  model: Model,
): ReadonlyMap<string, string> {
  const nodes = new Map(layout.nodes.map((node) => [node.id, node]));
  const flags = flagsByElement(model);
  const flagWords = (element: ElementId): string[] =>
    (flags.get(element) ?? []).map(flagLabel);
  return new Map<string, string>([
    ...layout.nodes.map(
      (node) => [node.id, nodeName(node, flagWords(node.id))] as const,
    ),
    ...layout.edges.map(
      (edge) => [edge.id, edgeName(edge, nodes, flagWords(edge.id))] as const,
    ),
  ]);
}

/**
 * What one drawn element is called where a control has to name it in a
 * sentence: its own name, or what kind of thing it is while it has none. It
 * is the phrase the rename field is labelled with, so a screen reader hears
 * which element the field renames rather than that a field is open.
 */
export function nodeLabel(node: CanvasNode): string {
  return node.name === '' ? `the ${kindWords[node.kind]}` : node.name;
}

/** What one drawn flow is called, on the same terms as {@link nodeLabel}. */
export function edgeLabel(edge: CanvasEdge): string {
  return edge.name === '' ? 'the flow' : edge.name;
}

function nodeName(node: CanvasNode, flags: readonly string[]): string {
  return spoken([
    node.name,
    kindWords[node.kind],
    ...badgeWords(node.badge),
    ...flags,
  ]);
}

function edgeName(
  edge: CanvasEdge,
  nodes: ReadonlyMap<ElementId, CanvasNode>,
  flags: readonly string[],
): string {
  const source = endName(edge.sourceElement, nodes);
  const target = endName(edge.targetElement, nodes);
  return spoken([
    edge.name,
    'flow',
    edge.bidirectional
      ? `between ${source} and ${target}`
      : `from ${source} to ${target}`,
    ...badgeWords(edge.badge),
    ...flags,
  ]);
}

function endName(
  element: ElementId | undefined,
  nodes: ReadonlyMap<ElementId, CanvasNode>,
): string {
  if (element === undefined) {
    return freeEndWords;
  }
  const node = nodes.get(element);
  if (node === undefined) {
    return element;
  }
  return node.name === '' ? kindWords[node.kind] : node.name;
}

function badgeWords(badge: ThreatBadge | undefined): string[] {
  if (badge === undefined || badge.kind === 'flag-only') {
    return [];
  }
  return [
    badge.count === 1 ? '1 open threat' : `${badge.count} open threats`,
    badge.severity === 'undecided'
      ? 'severity not assessed'
      : `highest severity ${badge.severity}`,
  ];
}

function flagsByElement(model: Model): Map<ElementId, ThreatFlag[]> {
  const raised = new Map<ElementId, Set<ThreatFlag>>();
  for (const threat of model.threats) {
    const flags = threatFlags(model, threat);
    for (const element of flags.length === 0 ? [] : threat.elements) {
      raised.set(element, new Set([...(raised.get(element) ?? []), ...flags]));
    }
  }
  return new Map(
    [...raised].map(([element, flags]) => [
      element,
      threatFlagSchema.options.filter((flag) => flags.has(flag)),
    ]),
  );
}

function spoken(parts: readonly string[]): string {
  return parts.filter((part) => part !== '').join(', ');
}
