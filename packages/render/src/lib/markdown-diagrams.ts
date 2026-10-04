import type { Locale } from '@saerskriven/i18n';
import type { Model } from '@saerskriven/model';
import type { Root, RootContent } from 'mdast';
import { exportText } from '../messages/catalogues.js';
import {
  boundedDepth,
  heading,
  headingText,
  paragraph,
} from './markdown-nodes.js';
import { mermaidDiagram } from './mermaid-diagram.js';
import type { RegisterOptions } from './register-options.js';
import { registerDocument } from './register-tree.js';

/** Diagrams followed by the register, with structural notes beside each drawing. */
export function markdownWithDiagrams(
  model: Model,
  locale: Locale,
  options: RegisterOptions,
): Root {
  const existing = registerDocument(model, locale, options);
  if (model.diagrams.length === 0) return existing;
  const messages = exportText(locale);
  const depth = boundedDepth(
    (options.headingLevel ?? 1) + (options.title === false ? 0 : 1),
  );
  const childDepth = boundedDepth(depth + 1);
  const diagrams = model.diagrams.flatMap((diagram): RootContent[] => {
    const title = heading(childDepth, headingText(diagram.title) || diagram.id);
    if (diagram.elements.length === 0)
      return [title, paragraph(messages.t('register.diagram-empty'))];
    const { source, notes } = mermaidDiagram(diagram, locale);
    const content: RootContent[] = [title];
    if (source.trim() !== 'flowchart LR')
      content.push({ type: 'code', lang: 'mermaid', value: source.trimEnd() });
    if (notes.boundaries.length > 0)
      content.push(
        paragraph(
          messages.t('register.diagram-omitted-boundaries', {
            names: notes.boundaries.join(', '),
          }),
        ),
      );
    if (notes.references.length > 0)
      content.push(
        paragraph(
          messages.t('register.diagram-substituted-references', {
            names: notes.references.join(', '),
          }),
        ),
      );
    return content;
  });
  return {
    type: 'root',
    children: [
      ...(options.title === false ? [] : existing.children.slice(0, 1)),
      heading(depth, messages.t('register.diagrams')),
      ...diagrams,
      heading(depth, messages.t('register.untitled')),
      ...registerDocument(model, locale, {
        title: false,
        headingLevel: childDepth,
      }).children,
    ],
  };
}
