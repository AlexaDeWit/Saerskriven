import type { Model } from '@saerskriven/model';
import { assumptionOf, modelFrom, threatOf } from '@saerskriven/model/fixtures';
import type { ListItem, Root, RootContent } from 'mdast';
import type { RegisterBadge } from './register-badges.js';

/** The text of a run of Markdown nodes, joined with no separator. */
export function textOf(nodes: readonly RootContent[]): string {
  return nodes
    .map((node) =>
      node.type === 'text'
        ? node.value
        : 'children' in node
          ? textOf(node.children)
          : '',
    )
    .join('');
}

function isLabel(node: RootContent | undefined, label: string): boolean {
  return (
    node?.type === 'paragraph' &&
    node.children.length === 1 &&
    node.children[0].type === 'strong' &&
    textOf(node.children[0].children) === label
  );
}

/** The items of the list after a section's bold label, empty where no list follows it. */
export function recordItems(
  section: readonly RootContent[],
  label: string,
): readonly ListItem[] {
  const following =
    section[section.findIndex((node) => isLabel(node, label)) + 1];
  return following?.type === 'list' ? following.children : [];
}

function isThreatAnchor(node: RootContent): boolean {
  const anchor = node.type === 'paragraph' ? node.children[0] : node;
  return anchor?.type === 'html' && anchor.value.startsWith('<a name="threat-');
}

/** The nodes between the overview table and the first threat anchor, which hold the assumptions that apply to the model. */
export function modelSectionIn(tree: Root): RootContent[] {
  const firstThreat = tree.children.findIndex(isThreatAnchor);
  return tree.children.slice(
    2,
    firstThreat === -1 ? tree.children.length : firstThreat,
  );
}

/** The items of the list a section holds under its heading. */
export function sectionItems(
  section: readonly RootContent[],
): readonly ListItem[] {
  return section[1]?.type === 'list' ? section[1].children : [];
}

/** Every badge a run of nodes carries, with the label written for it, in document order. */
export function badgeTextsIn(
  nodes: readonly RootContent[],
): { readonly badge: RegisterBadge; readonly label: string }[] {
  return nodes.flatMap((node) => {
    if (node.type === 'text') {
      const badge = node.data?.registerBadge;
      return badge === undefined ? [] : [{ badge, label: node.value }];
    }
    return 'children' in node ? badgeTextsIn(node.children) : [];
  });
}

/** Every badge a run of nodes carries, in document order. */
export function badgesIn(nodes: readonly RootContent[]): RegisterBadge[] {
  return badgeTextsIn(nodes).map((entry) => entry.badge);
}

/** The nodes of each threat section, from after its anchor up to the next one. */
export function threatSectionsIn(tree: Root): RootContent[][] {
  return tree.children.reduce<RootContent[][]>(
    (sections, node) =>
      isThreatAnchor(node)
        ? [...sections, []]
        : sections.length === 0
          ? sections
          : [
              ...sections.slice(0, -1),
              [...sections[sections.length - 1], node],
            ],
    [],
  );
}

/**
 * Two threats and three assumptions: one invalidated on the model alone, one
 * valid on threat 1 alone, and one unconfirmed on both the model and threat 1.
 */
export const scopedAssumptionsModel: Model = modelFrom({
  threats: [threatOf({ number: 1 }), threatOf({ number: 2 })],
  mitigations: [],
  assumptions: [
    assumptionOf({
      id: 'assumption-a',
      threats: [],
      appliesToModel: true,
      status: 'invalidated',
      prose: 'model only',
    }),
    assumptionOf({
      id: 'assumption-b',
      threats: ['threat-1'],
      status: 'valid',
      prose: 'threat only',
    }),
    assumptionOf({
      id: 'assumption-c',
      threats: ['threat-1'],
      appliesToModel: true,
      prose: 'model and threat',
    }),
  ],
});
