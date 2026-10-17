import type {
  AwayEnd,
  BadgeMarks,
  CanvasEdge,
  CanvasLayout,
  CanvasNode,
  CanvasNodeKind,
  ResizeLabels,
  ThreatBadge,
} from '@saerskriven/canvas';
import {
  flagsByElement,
  isEmptyName,
  type DiagramId,
  type Element,
  type ElementId,
  type FlowEnd,
  type FlowEnds,
  type Model,
} from '@saerskriven/model';
import type { Locale } from '@saerskriven/i18n';
import { renderTerms } from '@saerskriven/render';
import type { StudioTranslator } from '../messages/catalogues.js';
import {
  articleKindMessages,
  flagMessages,
  kindMessages,
  severityMessages,
} from '../messages/enum-labels.js';
import { diagramTitle } from '../messages/diagram-title.js';
import { useLanguage } from '../messages/locale.js';
import type { Said } from '../messages/said.js';
import { otherDiagrams } from './other-diagrams.js';

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
 * elements its ends attach to, an end drawn away from its element named as
 * on another diagram. Laid out from `shownOn`, an element also on other
 * diagrams ends by naming them. `layout` must be laid out from `model`.
 */
export function accessibleNames(
  layout: CanvasLayout,
  model: Model,
  t: StudioTranslator['t'],
  shownOn?: DiagramId,
): ReadonlyMap<string, string> {
  const nodes = new Map(layout.nodes.map((node) => [node.id, node]));
  const flags = flagsByElement(model);
  const trailing = (element: ElementId): string[] => [
    ...(flags.get(element) ?? []).map((flag) => t(flagMessages[flag])),
    ...elsewhereWords(model, element, shownOn, t),
  ];
  return new Map<string, string>([
    ...layout.nodes.map(
      (node) => [node.id, nodeName(node, trailing(node.id), t)] as const,
    ),
    ...layout.edges.map(
      (edge) => [edge.id, edgeName(edge, nodes, trailing(edge.id), t)] as const,
    ),
  ]);
}

/**
 * What an element is called in a sentence: its name, or its kind while it has
 * none. A message that puts "de" or "à" before the element does not take this
 * label: it words each kind itself and takes the name alone, as
 * {@link nameFieldLabel} does.
 */
export function kindLabel(
  name: string,
  kind: Element['kind'],
  t: StudioTranslator['t'],
): string {
  return isEmptyName(name) ? t(articleKindMessages[kind]) : name;
}

/**
 * Where a flow runs, "from A to B", or "between A and B" for a flow running
 * both ways. Each end is called by its element's name, by its kind while it
 * has none, or "a free point".
 */
export function flowEndsText(ends: FlowEnds, t: StudioTranslator['t']): string {
  return endsText(
    modelEndName(ends.source, t),
    modelEndName(ends.target, t),
    ends.bidirectional,
    t,
  );
}

/**
 * The accessible name of an element's name field, worded for its kind, with
 * its name where it has one. A text note has no name field.
 */
export function nameFieldLabel(
  name: string,
  kind: Exclude<Element['kind'], 'text'>,
): Said {
  return (speak) =>
    isEmptyName(name)
      ? speak(`fields.name-of-${kind}`)
      : speak(`fields.name-of-${kind}-named`, { name });
}

/** {@link nameFieldLabel} for one drawn element. */
export function nodeNameFieldLabel(
  node: Exclude<CanvasNode, { readonly kind: 'text' }>,
): Said {
  return nameFieldLabel(node.name, elementKindOf[node.kind]);
}

const marksByLocale: { readonly [L in Locale]: BadgeMarks } = {
  'en-CA': renderTerms('en-CA').marks,
  'fr-CA': renderTerms('fr-CA').marks,
  sv: renderTerms('sv').marks,
};

/**
 * The marks the canvas badges letter: render's marks for the active locale,
 * so the screen matches an export. A change of language re-renders the caller.
 */
export function useBadgeMarks(): BadgeMarks {
  const [locale] = useLanguage();
  return marksByLocale[locale];
}

/** The accessible name of each of a drawn element's resize controls. */
export function resizeLabels(
  node: CanvasNode,
  t: StudioTranslator['t'],
): ResizeLabels {
  const element = kindLabel(node.name, elementKindOf[node.kind], t);
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

function elsewhereWords(
  model: Model,
  element: ElementId,
  shownOn: DiagramId | undefined,
  t: StudioTranslator['t'],
): string[] {
  const elsewhere =
    shownOn === undefined ? [] : otherDiagrams(model, element, shownOn);
  return elsewhere.length === 0
    ? []
    : [
        t('tools.also-on-diagrams', {
          diagrams: elsewhere.map(({ title }) => diagramTitle(title, t)),
        }),
      ];
}

function nodeName(
  node: CanvasNode,
  trailing: readonly string[],
  t: StudioTranslator['t'],
): string {
  return spoken([
    node.name,
    t(kindMessages[elementKindOf[node.kind]]),
    ...badgeWords(node.badge, t),
    ...trailing,
  ]);
}

function edgeName(
  edge: CanvasEdge,
  nodes: ReadonlyMap<ElementId, CanvasNode>,
  trailing: readonly string[],
  t: StudioTranslator['t'],
): string {
  return spoken([
    edge.name,
    t(kindMessages.flow),
    endsText(
      endName(edge.sourceElement, edge.sourceAway, nodes, t),
      endName(edge.targetElement, edge.targetAway, nodes, t),
      edge.bidirectional,
      t,
    ),
    ...badgeWords(edge.badge, t),
    ...trailing,
  ]);
}

function endsText(
  source: string,
  target: string,
  bidirectional: boolean,
  t: StudioTranslator['t'],
): string {
  return t(bidirectional ? 'tools.flow-between' : 'tools.flow-from-to', {
    source,
    target,
  });
}

function endName(
  element: ElementId | undefined,
  away: AwayEnd | undefined,
  nodes: ReadonlyMap<ElementId, CanvasNode>,
  t: StudioTranslator['t'],
): string {
  if (away !== undefined) {
    return t('tools.away-end', { name: away.name });
  }
  if (element === undefined) {
    return t('tools.free-point');
  }
  const node = nodes.get(element);
  return node === undefined
    ? element
    : calledBy(node.name, elementKindOf[node.kind], t);
}

function modelEndName(end: FlowEnd, t: StudioTranslator['t']): string {
  if (end.kind === 'free') {
    return t('tools.free-point');
  }
  if (end.kind === 'missing') {
    return end.element;
  }
  return calledBy(end.element.name, end.element.kind, t);
}

function calledBy(
  name: string,
  kind: Element['kind'],
  t: StudioTranslator['t'],
): string {
  return isEmptyName(name) ? t(kindMessages[kind]) : name;
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
  return parts.filter((part) => !isEmptyName(part)).join(', ');
}
