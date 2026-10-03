import type {
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
import { useLanguage } from '../messages/locale.js';
import type { Said } from '../messages/said.js';

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
  return name === '' ? t(articleKindMessages[kind]) : name;
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
    name === ''
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
  return spoken([
    edge.name,
    t(kindMessages.flow),
    endsText(
      endName(edge.sourceElement, nodes, t),
      endName(edge.targetElement, nodes, t),
      edge.bidirectional,
      t,
    ),
    ...badgeWords(edge.badge, t),
    ...flags,
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
  nodes: ReadonlyMap<ElementId, CanvasNode>,
  t: StudioTranslator['t'],
): string {
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
  return name === '' ? t(kindMessages[kind]) : name;
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
