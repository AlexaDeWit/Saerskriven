import type { Locale } from '@saerskriven/i18n';
import {
  elementsById,
  reversed,
  isEmptyName,
  type Diagram,
  type Element,
  type ElementId,
  type Flow,
  type FlowEndpoint,
} from '@saerskriven/model';
import { exportText, type ExportText } from '../messages/catalogues.js';
import { headingText } from './markdown-nodes.js';
import { mermaidGroups } from './mermaid-groups.js';

/** Structural information the flowchart approximates or omits. */
export type MermaidNotes = {
  readonly boundaries: readonly string[];
  readonly references: readonly string[];
};

type Drawing = {
  readonly messages: ExportText;
  readonly elements: ReadonlyMap<ElementId, Element>;
  readonly identifiers: Map<ElementId, string>;
  readonly references: Map<ElementId, string>;
  readonly lines: string[];
};

type NodeElement = Exclude<Element, { kind: 'flow' | 'trust-boundary' }>;

/** One diagram's Mermaid source and structural notes, without Markdown framing. */
export function mermaidDiagram(
  diagram: Diagram,
  locale: Locale,
): { readonly source: string; readonly notes: MermaidNotes } {
  const drawing: Drawing = {
    messages: exportText(locale),
    elements: elementsById(diagram.elements),
    identifiers: new Map(
      diagram.elements.map((element, index) => [element.id, `n${index}`]),
    ),
    lines: ['flowchart LR'],
    references: new Map(),
  };
  const groups = mermaidGroups(diagram);
  writeNodes(diagram, groups, drawing);
  for (const element of diagram.elements) {
    if (element.kind !== 'flow') continue;
    const source = endpoint(element.source, element, 'source', drawing);
    const target = endpoint(element.target, element, 'target', drawing);
    const arrow = element.bidirectional ? '<-->' : '-->';
    const caption =
      isEmptyName(element.name) && !element.outOfScope
        ? ''
        : `|"${label(element, drawing.messages)}"|`;
    drawing.lines.push(`${source} ${arrow}${caption} ${target}`);
  }
  return {
    source: `${drawing.lines.join('\n')}\n`,
    notes: {
      boundaries: [
        ...new Set(
          diagram.elements
            .filter(
              (element) =>
                element.kind === 'trust-boundary' && !groups.has(element.id),
            )
            .map(name),
        ),
      ],
      references: [...new Set(drawing.references.values())],
    },
  };
}

function writeNodes(
  diagram: Diagram,
  groups: ReadonlyMap<ElementId, readonly ElementId[]>,
  drawing: Drawing,
): void {
  const contained = new Set([...groups.values()].flat());
  const stack: (Element | 'end')[] = reversed(
    diagram.elements.filter((element) => !contained.has(element.id)),
  );
  while (stack.length > 0) {
    const item = stack.pop();
    if (item === undefined) break;
    if (item === 'end') {
      drawing.lines.push('end');
    } else if (item.kind === 'trust-boundary') {
      const members = groups.get(item.id);
      if (members !== undefined) {
        drawing.lines.push(
          `subgraph ${identifier(item.id, drawing)}["${label(item, drawing.messages)}"]`,
        );
        stack.push('end');
        for (const member of reversed(members)) {
          const element = drawing.elements.get(member);
          if (element !== undefined) stack.push(element);
        }
      }
    } else if (item.kind !== 'flow') {
      drawing.lines.push(node(item, drawing));
    }
  }
}

function identifier(id: ElementId, { identifiers }: Drawing): string {
  const held = identifiers.get(id);
  if (held !== undefined) return held;
  const generated = `n${identifiers.size}`;
  identifiers.set(id, generated);
  return generated;
}

function name(element: Element): string {
  return isEmptyName(element.name) ? element.id : headingText(element.name);
}

function escaped(value: string): string {
  return Array.from(headingText(value), (character) =>
    /[\p{L}\p{N} ]/u.test(character)
      ? character
      : `#${character.codePointAt(0)};`,
  ).join('');
}

function label(element: Element, messages: ExportText): string {
  const value =
    element.kind === 'text'
      ? `${name(element)}: ${element.text}`
      : name(element);
  return escaped(
    element.outOfScope
      ? messages.t('register.diagram-out-of-scope', { label: value })
      : value,
  );
}

const shapes = {
  actor: ['[', ']'],
  process: ['((', '))'],
  store: ['[(', ')]'],
  text: ['[', ']'],
} as const;

function node(element: NodeElement, drawing: Drawing): string {
  const id = identifier(element.id, drawing);
  const value = label(element, drawing.messages);
  const prefix =
    element.kind === 'text'
      ? `${escaped(drawing.messages.t('register.diagram-note'))}: `
      : '';
  const [open, close] = shapes[element.kind];
  return `${id}${open}"${prefix}${value}"${close}`;
}

function endpoint(
  end: FlowEndpoint,
  flow: Flow,
  side: 'source' | 'target',
  drawing: Drawing,
): string {
  if (end.kind === 'free') {
    const id = `free_${identifier(flow.id, drawing)}_${side}`;
    drawing.lines.push(
      `${id}["${escaped(drawing.messages.t('register.diagram-free-endpoint'))}"]`,
    );
    return id;
  }
  const element = drawing.elements.get(end.element);
  if (
    element !== undefined &&
    element.kind !== 'flow' &&
    element.kind !== 'trust-boundary'
  )
    return identifier(end.element, drawing);
  const id = `ref_${identifier(end.element, drawing)}`;
  if (!drawing.references.has(end.element)) {
    const value = element === undefined ? end.element : name(element);
    drawing.references.set(end.element, value);
    drawing.lines.push(
      `${id}["${escaped(drawing.messages.t('register.diagram-reference', { label: value }))}"]`,
    );
  }
  return id;
}
