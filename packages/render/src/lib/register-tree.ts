import type { Locale } from '@saerskriven/i18n';
import {
  elementsAcross,
  elementsById,
  flowEndName,
  flowEnds,
  inNumberOrder,
  isEmptyName,
  recordsLinkedTo,
  threatFlags,
  unlabelledFlow,
  type Assumption,
  type Element,
  type ElementId,
  type Mitigation,
  type Model,
  type Threat,
} from '@saerskriven/model';
import type {
  BlockContent,
  DefinitionContent,
  Heading,
  Html,
  Link,
  List,
  ListItem,
  Nodes,
  Parents,
  Paragraph,
  PhrasingContent,
  Root,
  RootContent,
  Table,
  TableCell,
  TableRow,
  Text,
} from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { exportText, type ExportText } from '../messages/catalogues.js';
import {
  boundedDepth,
  heading,
  headingText,
  paragraph,
  text,
} from './markdown-nodes.js';
import type { RegisterBadge } from './register-badges.js';
import type { RegisterOptions } from './register-options.js';
import {
  badgeLabel,
  categoryLabel,
  renderTerms,
  type RenderTerms,
} from './terms.js';

declare module 'mdast' {
  interface TextData {
    readonly registerBadge?: RegisterBadge;
  }

  interface HtmlData {
    readonly registerTarget?: true;
  }

  interface LinkData {
    readonly registerTarget?: true;
  }
}

/**
 * The deepest nesting of prose both register writers accept, counted from the
 * register's root. Typst refuses seventeen nested blockquotes, which measure
 * 19 here, so the exact bound is 18, and this sits two levels under it so a
 * Typst release that lowers the limit does not refuse prose that rendered
 * before.
 */
export const deepestProse = 16;

const prose = unified().use(remarkParse).use(remarkGfm);

const overviewColumns = [
  'register.number',
  'register.title',
  'register.elements',
  'register.category',
  'register.severity',
  'register.status',
] as const;

const recordNesting = 2;

type FlowContent = BlockContent | DefinitionContent;

const flowTypes = {
  blockquote: true,
  code: true,
  definition: true,
  footnoteDefinition: true,
  heading: true,
  html: true,
  list: true,
  paragraph: true,
  table: true,
  thematicBreak: true,
} satisfies Record<FlowContent['type'], true>;

type Wording = {
  readonly messages: ExportText;
  readonly terms: RenderTerms;
};

type SectionContext = Wording & {
  readonly model: Model;
  readonly elements: ReadonlyMap<ElementId, Element>;
  readonly depth: Heading['depth'];
};

/**
 * The register tree shared by Markdown and Typst. Threat anchors use stable
 * numbers. Records follow their threats, with model assumptions in one section.
 * Author prose keeps Markdown and raw HTML, with headings demoted below their
 * section. Prose beyond `deepestProse` becomes plain text. Locale controls
 * framing and stored-value labels, never author text or anchor identities.
 */
export function registerDocument(
  model: Model,
  locale: Locale,
  options: RegisterOptions = {},
): Root {
  const first = options.headingLevel ?? 1;
  const threats = inNumberOrder(model.threats);
  const context: SectionContext = {
    messages: exportText(locale),
    terms: renderTerms(locale),
    model,
    elements: elementsById(elementsAcross(model.diagrams)),
    depth: boundedDepth(first + (options.title === false ? 0 : 1)),
  };
  return {
    type: 'root',
    children: [
      ...(options.title === false
        ? []
        : [heading(first, registerTitle(model, context))]),
      threats.length === 0
        ? paragraph(context.messages.t('register.no-threats'))
        : overviewTable(threats, context),
      ...modelAssumptionSection(context),
      ...threats.flatMap((threat) => threatSection(threat, context)),
    ],
  };
}

function registerTitle(model: Model, { messages }: Wording): string {
  const title = headingText(model.metadata.title);
  return title.length === 0
    ? messages.t('register.untitled')
    : messages.t('register.titled', { title });
}

function overviewTable(
  threats: readonly Threat[],
  context: SectionContext,
): Table {
  return {
    type: 'table',
    children: [
      tableRow(overviewColumns.map((column) => context.messages.t(column))),
      ...threats.map((threat) =>
        tableRow([
          threatLink(threat.number),
          threat.title,
          elementNames(threat, context),
          categoryLabel(threat.category, context.terms),
          badgeText({ kind: 'severity', value: threat.severity }, context),
          badgeText({ kind: 'status', value: threat.status }, context),
        ]),
      ),
    ],
  };
}

function tableRow(cells: readonly (PhrasingContent | string)[]): TableRow {
  return {
    type: 'tableRow',
    children: cells.map((cell): TableCell => ({
      type: 'tableCell',
      children: [typeof cell === 'string' ? text(cell) : cell],
    })),
  };
}

function modelAssumptionSection(context: SectionContext): RootContent[] {
  const assumptions = context.model.assumptions.filter(
    (assumption) => assumption.appliesToModel,
  );
  return assumptions.length === 0
    ? []
    : [
        heading(context.depth, context.messages.t('terms.model-assumptions')),
        ...recordList(
          assumptions.map((assumption) => assumptionItem(assumption, context)),
          context,
        ),
      ];
}

function threatSection(threat: Threat, context: SectionContext): RootContent[] {
  const { t } = context.messages;
  return [
    threatAnchor(threat.number),
    heading(
      context.depth,
      headingText(
        t('register.threat', {
          number: String(threat.number),
          title: threat.title,
        }),
      ),
    ),
    fieldList(threat, context),
    ...labelled(
      t('register.description'),
      proseContent(threat.description, context),
    ),
    ...labelled(
      t('terms.mitigations'),
      recordList(
        recordsLinkedTo(context.model.mitigations, threat.id).map(
          (mitigation) => mitigationItem(mitigation, context),
        ),
        context,
      ),
    ),
    ...labelled(
      t('terms.assumptions'),
      recordList(
        recordsLinkedTo(context.model.assumptions, threat.id).map(
          (assumption) => assumptionItem(assumption, context),
        ),
        context,
      ),
    ),
  ];
}

function threatAnchor(number: number): Html {
  return {
    type: 'html',
    value: `<a name="${threatTarget(number)}"></a>`,
    data: { registerTarget: true },
  };
}

function threatLink(number: number): Link {
  const target = threatTarget(number);
  return {
    type: 'link',
    url: `#${target}`,
    children: [text(String(number))],
    data: { registerTarget: true },
  };
}

function threatTarget(number: number): string {
  return `threat-${String(number)}`;
}

function fieldList(threat: Threat, context: SectionContext): List {
  const { t } = context.messages;
  const flags = threatFlags(context.model, threat).map((flag) =>
    badgeText({ kind: 'flag', value: flag }, context),
  );
  const fields: readonly (readonly [string, readonly PhrasingContent[]])[] = [
    [t('register.elements'), [text(elementNames(threat, context))]],
    [
      t('register.category'),
      [text(categoryLabel(threat.category, context.terms))],
    ],
    [
      t('register.severity'),
      [badgeText({ kind: 'severity', value: threat.severity }, context)],
    ],
    [
      t('register.status'),
      [badgeText({ kind: 'status', value: threat.status }, context)],
    ],
    [
      t('register.flags'),
      flags.length === 0
        ? [text(t('register.none'))]
        : flags.flatMap((flag, index) =>
            index === 0 ? [flag] : [text(', '), flag],
          ),
    ],
  ];
  return {
    type: 'list',
    ordered: false,
    spread: false,
    children: fields.map(([label, value]) => ({
      type: 'listItem',
      spread: false,
      children: [field(label, value, context)],
    })),
  };
}

function field(
  label: string,
  value: readonly PhrasingContent[],
  { messages }: Wording,
): Paragraph {
  const name: PhrasingContent = { type: 'strong', children: [text(label)] };
  return {
    type: 'paragraph',
    children: messages
      .parts('register.field', { label: name, value })
      .flatMap((part): PhrasingContent[] => {
        if (part === name) {
          return [name];
        }
        if (part === value) {
          return [...value];
        }
        return typeof part === 'string' && part.length > 0 ? [text(part)] : [];
      }),
  };
}

function labelled(label: string, content: RootContent[]): RootContent[] {
  return [
    {
      type: 'paragraph',
      children: [{ type: 'strong', children: [text(label)] }],
    },
    ...content,
  ];
}

function recordList(
  items: readonly ListItem[],
  { messages }: Wording,
): RootContent[] {
  return items.length === 0
    ? [paragraph(messages.t('register.none-recorded'))]
    : [{ type: 'list', ordered: false, spread: true, children: [...items] }];
}

function mitigationItem(
  mitigation: Mitigation,
  context: SectionContext,
): ListItem {
  const title = headingText(mitigation.title);
  return recordItem(
    [
      badgeText({ kind: 'mitigation', value: mitigation.status }, context),
      ...(title.length === 0
        ? []
        : [text(' '), { type: 'strong' as const, children: [text(title)] }]),
    ],
    proseContent(mitigation.prose, context, recordNesting),
  );
}

function assumptionItem(
  assumption: Assumption,
  context: SectionContext,
): ListItem {
  return recordItem(
    [badgeText({ kind: 'assumption', value: assumption.status }, context)],
    proseContent(assumption.prose, context, recordNesting),
  );
}

function recordItem(lead: PhrasingContent[], content: FlowContent[]): ListItem {
  return {
    type: 'listItem',
    spread: true,
    children: [{ type: 'paragraph', children: lead }, ...content],
  };
}

function proseContent(
  written: string,
  context: SectionContext,
  enclosing = 0,
): FlowContent[] {
  const parsed = prose.parse(written);
  if (parsed.children.length === 0) {
    return [paragraph(context.messages.t('register.none-recorded'))];
  }
  const flow = parsed.children.filter(isFlow);
  if (
    flow.length < parsed.children.length ||
    nestingOf(parsed) + enclosing > deepestProse
  ) {
    return [paragraph(written)];
  }
  visit(parsed, 'heading', (node) => {
    node.depth = boundedDepth(context.depth + node.depth);
  });
  return flow;
}

function isFlow(node: RootContent): node is FlowContent {
  return Object.hasOwn(flowTypes, node.type);
}

function nestingOf(tree: Root): number {
  const pending: { readonly node: Nodes; readonly depth: number }[] = [
    { node: tree, depth: 0 },
  ];
  let deepest = 0;
  for (const { node, depth } of pending) {
    deepest = Math.max(deepest, depth);
    if (isParent(node)) {
      for (const child of node.children) {
        pending.push({ node: child, depth: depth + 1 });
      }
    }
  }
  return deepest;
}

function isParent(node: Nodes): node is Parents {
  return Object.hasOwn(node, 'children');
}

function elementNames(threat: Threat, context: SectionContext): string {
  const names = [
    ...(threat.appliesToModel
      ? [context.messages.t('register.whole-model')]
      : []),
    ...threat.elements.map((id) => elementName(id, context)),
  ];
  return names.length === 0
    ? context.messages.t('register.none')
    : names.join(', ');
}

function elementName(
  id: ElementId,
  { elements, messages }: SectionContext,
): string {
  const element = elements.get(id);
  const flow = element === undefined ? undefined : unlabelledFlow(element);
  if (flow !== undefined) {
    const { source, target, bidirectional } = flowEnds(flow, elements);
    const free = messages.t('register.free-point');
    return messages.t(
      bidirectional ? 'register.flow-between' : 'register.flow-from-to',
      { source: flowEndName(source, free), target: flowEndName(target, free) },
    );
  }
  return element === undefined || isEmptyName(element.name) ? id : element.name;
}

function badgeText(badge: RegisterBadge, { terms }: Wording): Text {
  return {
    type: 'text',
    value: badgeLabel(badge, terms),
    data: { registerBadge: badge },
  };
}
