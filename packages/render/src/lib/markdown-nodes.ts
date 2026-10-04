import type { Heading, Paragraph, Text } from 'mdast';

const headingDepths = [1, 2, 3, 4, 5, 6] as const;

/** A heading depth constrained to Markdown's six levels. */
export function boundedDepth(depth: number): Heading['depth'] {
  return headingDepths[Math.min(6, Math.max(1, depth)) - 1];
}

/** Author text on one heading line. */
export function headingText(value: string): string {
  return value.replace(/\s*[\r\n]+\s*/gu, ' ').trim();
}

/** A plain Markdown heading. */
export function heading(depth: Heading['depth'], value: string): Heading {
  return { type: 'heading', depth, children: [text(value)] };
}

/** A plain Markdown paragraph. */
export function paragraph(value: string): Paragraph {
  return { type: 'paragraph', children: [text(value)] };
}

/** Text for the Markdown serializer to escape. */
export function text(value: string): Text {
  return { type: 'text', value };
}
