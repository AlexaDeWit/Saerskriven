import type { Locale } from '@saerskriven/i18n';
import {
  elementsAcross,
  inNumberOrder,
  recordsLinkedTo,
  threatFlags,
  type Assumption,
  type Element,
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
  Paragraph,
  Parents,
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

const headingDepths = [1, 2, 3, 4, 5, 6] as const;

const lineBreaks = /\s*[\r\n]+\s*/gu;

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
  readonly elements: ReadonlyMap<string, Element>;
  readonly depth: Heading['depth'];
};

/**
 * The register as an mdast tree, the one definition both register writers
 * serialize: the title, an overview table of every threat, a section of the
 * assumptions that apply to the model where there are any, then one section
 * per threat in number order.
 *
 * Each threat heading follows an empty anchor named `threat-<number>`, which
 * the overview number links to, so a title edit keeps the target. GitHub's
 * Markdown API prefixes the anchor's name with `user-content-` and leaves the
 * link as written, and neither reaches the Typst output. A section
 * lists the threat's fields and flags, its prose, then its mitigations and
 * assumptions in model order, each led by its status. A record linked to
 * several threats appears under each, and a record linked to none appears
 * nowhere unless it is an assumption that applies to the model.
 *
 * Prose is parsed as Markdown and spliced in as nodes, its headings demoted
 * below the section's and its raw HTML kept as written. Prose nested past
 * {@link deepestProse}, counting a record's two enclosing levels, is one
 * paragraph of the author's text. Line breaks in a heading collapse to
 * spaces. Headings, field names, enum labels and the lines standing for
 * absent content are `locale`'s, and every enum has a label in each locale.
 * An absent value reads as `none` or `none-recorded` in the register
 * catalogue, and a model with no threats says so in place of the overview
 * table.
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
    elements: elementsById(model),
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

function headingText(value: string): string {
  return value.replace(lineBreaks, ' ').trim();
}

function elementsById(model: Model): Map<string, Element> {
  return new Map(
    elementsAcross(model.diagrams).map((element) => [element.id, element]),
  );
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
        heading(
          context.depth,
          context.messages.t('register.model-assumptions'),
        ),
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
      t('register.mitigations'),
      recordList(
        recordsLinkedTo(context.model.mitigations, threat.id).map(
          (mitigation) => mitigationItem(mitigation, context),
        ),
        context,
      ),
    ),
    ...labelled(
      t('register.assumptions'),
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
  const content = { nodes: value };
  return {
    type: 'paragraph',
    children: messages
      .parts('register.field', { label: name, value: content })
      .flatMap((part): PhrasingContent[] => {
        if (part === name) {
          return [name];
        }
        if (part === content) {
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
  return threat.elements.length === 0
    ? context.messages.t('register.none')
    : threat.elements.map((id) => elementName(id, context.elements)).join(', ');
}

function elementName(
  id: string,
  elements: ReadonlyMap<string, Element>,
): string {
  const element = elements.get(id);
  return element === undefined || element.name.length === 0 ? id : element.name;
}

function heading(depth: Heading['depth'], value: string): Heading {
  return { type: 'heading', depth, children: [text(value)] };
}

function paragraph(value: string): Paragraph {
  return { type: 'paragraph', children: [text(value)] };
}

function text(value: string): Text {
  return { type: 'text', value };
}

function boundedDepth(depth: number): Heading['depth'] {
  return headingDepths[Math.min(6, Math.max(1, depth)) - 1];
}

function badgeText(badge: RegisterBadge, { terms }: Wording): Text {
  return {
    type: 'text',
    value: badgeLabel(badge, terms),
    data: { registerBadge: badge },
  };
}
