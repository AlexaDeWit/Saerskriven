import { isAlias, isCollection, isNode, isPair } from 'yaml';
import type { parseDocument } from 'yaml';

/** A YAML text composed into a document, before any alias in it is resolved. */
export type ComposedDocument = ReturnType<typeof parseDocument>;

/**
 * What resolving a document's aliases will cost, each number counted no
 * further than its ceiling. `expanded` is one for each alias plus the
 * expanded aliases inside its anchor, and a cycle takes the ceiling at once.
 * `reached` is the nodes under each alias's anchor, summed over the aliases,
 * and 0 once `expanded` has passed its ceiling.
 */
export type AliasCost = {
  readonly expanded: number;
  readonly reached: number;
};

/**
 * What a composed document's aliases will cost, taken between composing and
 * resolving it. The `yaml` parser's own alias accounting scans the whole
 * document once per anchor, so anchors nested within anchors pay that scan
 * once per level: fifty aliases arranged that way in a 4 MiB text cost 147
 * seconds inside the parser, and a fifth of a millisecond here. `toJS` is
 * therefore called with `maxAliasCount: -1`, and this measures instead.
 *
 * `expanded` bounds what the parser's option bounds, as a sum where the
 * parser takes a product. It is weighed bottom up in one traversal, which
 * works because a YAML anchor precedes its aliases, and an alias reaching an
 * anchor still being weighed is a cycle. `reached` bounds what a count
 * cannot, since a one-node anchor costs as little to alias as a huge one: the
 * nesting walk expands a node again for each depth an alias reaches it from.
 * The counting after the traversal costs the ceilings rather than the
 * document.
 */
export function aliasCostIn(
  document: ComposedDocument,
  stopAt: AliasCost,
): AliasCost {
  const weighed = weighAliases(document, stopAt.expanded);
  if (weighed.expanded >= stopAt.expanded) {
    return { expanded: stopAt.expanded, reached: 0 };
  }
  return {
    expanded: weighed.expanded,
    reached: nodesReached(weighed, stopAt.reached),
  };
}

type Level = {
  readonly children: readonly unknown[];
  index: number;
};

type Weighing = Level & {
  readonly weighs: unknown;
  total: number;
};

type Weighed = {
  readonly expanded: number;
  readonly boundTo: ReadonlyMap<unknown, unknown>;
  readonly repeats: ReadonlyMap<unknown, number>;
};

function weighAliases(document: ComposedDocument, stopAt: number): Weighed {
  const named = new Map<string, unknown>();
  const boundTo = new Map<unknown, unknown>();
  const repeats = new Map<unknown, number>();
  const weight = new Map<unknown, number>();
  const open = new Set<unknown>();
  const levels: Weighing[] = [
    { children: [document.contents], index: 0, weighs: undefined, total: 0 },
  ];
  let expanded = 0;
  while (levels.length > 0) {
    const level = levels[levels.length - 1];
    if (level.index >= level.children.length) {
      levels.pop();
      if (level.weighs !== undefined) {
        weight.set(level.weighs, level.total);
        open.delete(level.weighs);
      }
      if (levels.length === 0) {
        expanded = level.total;
      } else {
        levels[levels.length - 1].total += level.total;
      }
      continue;
    }
    const node = level.children[level.index];
    level.index += 1;
    if (isPair(node)) {
      levels.push(descend([node.key, node.value], undefined));
      continue;
    }
    if (!isNode(node)) {
      continue;
    }
    if (isAlias(node)) {
      const anchor = named.get(node.source);
      boundTo.set(node, anchor);
      repeats.set(anchor, (repeats.get(anchor) ?? 0) + 1);
      if (open.has(anchor)) {
        return { expanded: stopAt, boundTo, repeats };
      }
      level.total += 1 + (weight.get(anchor) ?? 0);
      if (level.total >= stopAt) {
        return { expanded: stopAt, boundTo, repeats };
      }
      continue;
    }
    if (node.anchor !== undefined) {
      named.set(node.anchor, node);
    }
    if (isCollection(node)) {
      const weighs = node.anchor === undefined ? undefined : node;
      if (weighs !== undefined) {
        open.add(weighs);
      }
      levels.push(descend(node.items, weighs));
    } else if (node.anchor !== undefined) {
      weight.set(node, 0);
    }
  }
  return { expanded, boundTo, repeats };
}

function descend(children: readonly unknown[], weighs: unknown): Weighing {
  return { children, index: 0, weighs, total: 0 };
}

function nodesReached(weighed: Weighed, stopAt: number): number {
  let counted = 0;
  for (const [anchor, times] of weighed.repeats) {
    const room = Math.ceil((stopAt - counted) / times);
    counted += nodesUnder(anchor, weighed.boundTo, room) * times;
    if (counted >= stopAt) {
      return stopAt;
    }
  }
  return counted;
}

function nodesUnder(
  anchor: unknown,
  boundTo: ReadonlyMap<unknown, unknown>,
  stopAt: number,
): number {
  const seen = new Set<unknown>();
  const levels: Level[] = [{ children: [anchor], index: 0 }];
  let counted = 0;
  while (levels.length > 0 && counted < stopAt) {
    const level = levels[levels.length - 1];
    if (level.index >= level.children.length) {
      levels.pop();
      continue;
    }
    const node = level.children[level.index];
    level.index += 1;
    if (isPair(node)) {
      levels.push({ children: [node.key, node.value], index: 0 });
      continue;
    }
    if (!isNode(node) || seen.has(node)) {
      continue;
    }
    seen.add(node);
    counted += 1;
    if (isAlias(node)) {
      levels.push({ children: [boundTo.get(node)], index: 0 });
    } else if (isCollection(node)) {
      levels.push({ children: node.items, index: 0 });
    }
  }
  return counted;
}
