import type { Model } from '@saerskriven/model';
import type { Html, Root } from 'mdast';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import type { RegisterBadge } from './register-badges.js';
import type { MarkdownOptions } from './register-options.js';
import {
  registerClassNames,
  registerStylesheet,
} from './register-stylesheet.js';
import { registerDocument } from './register-tree.js';

/**
 * The register as Markdown. Portable by default. With `styled`, badges become
 * classed HTML spans inside a register `<div>`, preceded by the scoped
 * stylesheet unless `stylesheet` is false.
 */
export function renderRegister(
  model: Model,
  options: MarkdownOptions = {},
): string {
  const tree = registerDocument(model, options);
  return markdown.stringify(
    options.styled === true ? styledTree(tree, options) : tree,
  );
}

const markdown = unified().use(remarkStringify, { bullet: '-' }).use(remarkGfm);

function styledTree(tree: Root, options: MarkdownOptions): Root {
  visit(tree, 'text', (node, index, parent) => {
    const badge = node.data?.registerBadge;
    if (badge === undefined || parent === undefined || index === undefined) {
      return;
    }
    parent.children.splice(index, 1, badgeHtml(node.value, badge));
  });
  tree.children.unshift({
    type: 'html',
    value: `<div class="${registerClassNames.root}">`,
  });
  tree.children.push({ type: 'html', value: '</div>' });
  if (options.stylesheet !== false) {
    tree.children.unshift({
      type: 'html',
      value: `<style>\n${registerStylesheet(options.theme)}</style>`,
    });
  }
  return tree;
}

function badgeHtml(label: string, badge: RegisterBadge): Html {
  return {
    type: 'html',
    value: renderToStaticMarkup(
      createElement(
        'span',
        {
          className: `${registerClassNames.badge} saer-${badge.kind} saer-${badge.kind}-${badge.value}`,
        },
        createElement('span', { className: registerClassNames.label }, label),
      ),
    ),
  };
}
