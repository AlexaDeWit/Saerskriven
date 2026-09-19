import type {
  CanvasEdge,
  CanvasLayout,
  CanvasNode,
  CanvasNodeKind,
  ResizeLabels,
  ThreatBadge,
} from '@saerskriven/canvas';
import {
  flagsByElement,
  type Element,
  type ElementId,
  type Model,
} from '@saerskriven/model';
import type { StudioTranslator } from '../messages/catalogues.js';
import {
  articleKindMessages,
  flagMessages,
  kindMessages,
  severityMessages,
} from '../messages/enum-labels.js';

const elementKindOf = {
  actor: 'actor',
  process: 'process',
  store: 'store',
  text: 'text',
  'boundary-box': 'trust-boundary',
  'boundary-curve': 'trust-boundary',
} as const satisfies Record<CanvasNodeKind, Element['kind']>;

/**
 * The accessible name of every element the layout drew, keyed by its React
 * Flow id: its name, kind, badge and raised flags, and for a flow the
 * elements its ends attach to. `layout` must be laid out from `model`.
 */
export function accessibleNames(
  layout: CanvasLayout,
  model: Model,
  t: StudioTranslator['t'],
): ReadonlyMap<string, string> {
  const nodes = new Map(layout.nodes.map((node) => [node.id, node]));
  const flags = flagsByElement(model);
  const flagWords = (element: ElementId): string[] =>
    (flags.get(element) ?? []).map((flag) => t(flagMessages[flag]));
  return new Map<string, string>([
    ...layout.nodes.map(
      (node) => [node.id, nodeName(node, flagWords(node.id), t)] as const,
    ),
    ...layout.edges.map(
      (edge) =>
        [edge.id, edgeName(edge, nodes, flagWords(edge.id), t)] as const,
    ),
  ]);
}

/** What an element is called in a sentence: its name, or its kind while it has none. */
export function kindLabel(
  name: string,
  kind: Element['kind'],
  t: StudioTranslator['t'],
): string {
  return name === '' ? t(articleKindMessages[kind]) : name;
}

/** {@link kindLabel} for one drawn element. */
export function nodeLabel(node: CanvasNode, t: StudioTranslator['t']): string {
  return kindLabel(node.name, elementKindOf[node.kind], t);
}

/** The accessible name of each of a drawn element's resize controls. */
export function resizeLabels(
  node: CanvasNode,
  t: StudioTranslator['t'],
): ResizeLabels {
  const element = nodeLabel(node, t);
  return {
    top: t('canvas.resize-top', { element }),
    right: t('canvas.resize-right', { element }),
    bottom: t('canvas.resize-bottom', { element }),
    left: t('canvas.resize-left', { element }),
    'top-left': t('canvas.resize-top-left', { element }),
    'top-right': t('canvas.resize-top-right', { element }),
    'bottom-right': t('canvas.resize-bottom-right', { element }),
    'bottom-left': t('canvas.resize-bottom-left', { element }),
  };
}

/** {@link kindLabel} for one drawn flow. */
export function edgeLabel(edge: CanvasEdge, t: StudioTranslator['t']): string {
  return kindLabel(edge.name, 'flow', t);
}

function nodeName(
  node: CanvasNode,
  flags: readonly string[],
  t: StudioTranslator['t'],
): string {
  return spoken([
    node.name,
    t(kindMessages[elementKindOf[node.kind]]),
    ...badgeWords(node.badge, t),
    ...flags,
  ]);
}

function edgeName(
  edge: CanvasEdge,
  nodes: ReadonlyMap<ElementId, CanvasNode>,
  flags: readonly string[],
  t: StudioTranslator['t'],
): string {
  const source = endName(edge.sourceElement, nodes, t);
  const target = endName(edge.targetElement, nodes, t);
  return spoken([
    edge.name,
    t(kindMessages.flow),
    t(edge.bidirectional ? 'tools.flow-between' : 'tools.flow-from-to', {
      source,
      target,
    }),
    ...badgeWords(edge.badge, t),
    ...flags,
  ]);
}

function endName(
  element: ElementId | undefined,
  nodes: ReadonlyMap<ElementId, CanvasNode>,
  t: StudioTranslator['t'],
): string {
  if (element === undefined) {
    return t('tools.free-point');
  }
  const node = nodes.get(element);
  if (node === undefined) {
    return element;
  }
  return node.name === ''
    ? t(kindMessages[elementKindOf[node.kind]])
    : node.name;
}

function badgeWords(
  badge: ThreatBadge | undefined,
  t: StudioTranslator['t'],
): string[] {
  if (badge === undefined || badge.kind === 'flag-only') {
    return [];
  }
  return [
    t('tools.open-threats', { count: badge.count }),
    badge.severity === 'undecided'
      ? t('tools.severity-not-assessed')
      : t('tools.highest-severity', {
          severity: t(severityMessages[badge.severity]),
        }),
  ];
}

function spoken(parts: readonly string[]): string {
  return parts.filter((part) => part !== '').join(', ');
}
