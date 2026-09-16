import type {
  CanvasEdge,
  CanvasLayout,
  CanvasNode,
  CanvasNodeKind,
  ThreatBadge,
} from '@saerskriven/canvas';
import {
  flagsByElement,
  type Element,
  type ElementId,
  type Model,
} from '@saerskriven/model';
import { flagLabel } from '@saerskriven/render';

const kindWords = {
  actor: 'actor',
  process: 'process',
  store: 'store',
  text: 'text',
  flow: 'flow',
  'trust-boundary': 'trust boundary',
} as const satisfies Record<Element['kind'], string>;

const elementKindOf = {
  actor: 'actor',
  process: 'process',
  store: 'store',
  text: 'text',
  'boundary-box': 'trust-boundary',
  'boundary-curve': 'trust-boundary',
} as const satisfies Record<CanvasNodeKind, Element['kind']>;

const freeEndWords = 'a free point';

/**
 * The accessible name of every element the layout drew, keyed by its React
 * Flow id: its name, kind, badge and raised flags, and for a flow the
 * elements its ends attach to. `layout` must be laid out from `model`.
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

/** What an element is called in a sentence: its name, or "the" and its kind while it has none. */
export function kindLabel(name: string, kind: Element['kind']): string {
  return name === '' ? `the ${kindWords[kind]}` : name;
}

/** {@link kindLabel} for one drawn element. */
export function nodeLabel(node: CanvasNode): string {
  return kindLabel(node.name, elementKindOf[node.kind]);
}

/** {@link kindLabel} for one drawn flow. */
export function edgeLabel(edge: CanvasEdge): string {
  return kindLabel(edge.name, 'flow');
}

function nodeName(node: CanvasNode, flags: readonly string[]): string {
  return spoken([
    node.name,
    kindWords[elementKindOf[node.kind]],
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
  return node.name === '' ? kindWords[elementKindOf[node.kind]] : node.name;
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

function spoken(parts: readonly string[]): string {
  return parts.filter((part) => part !== '').join(', ');
}
