import {
  assumptionIdSchema,
  diagramIdSchema,
  elementIdSchema,
  mitigationIdSchema,
  threatIdSchema,
} from '@saerskriven/model';
import { z } from 'zod';
import {
  divergenceDetailSchema,
  divergenceDetailText,
} from './divergence-detail.js';

const modelSubjectSchema = z.object({ kind: z.literal('model') });

const diagramSubjectSchema = z.object({
  kind: z.literal('diagram'),
  id: diagramIdSchema,
});

const elementSubjectSchema = z.object({
  kind: z.literal('element'),
  id: elementIdSchema,
});

const threatSubjectSchema = z.object({
  kind: z.literal('threat'),
  id: threatIdSchema,
});

const mitigationSubjectSchema = z.object({
  kind: z.literal('mitigation'),
  id: mitigationIdSchema,
});

const assumptionSubjectSchema = z.object({
  kind: z.literal('assumption'),
  id: assumptionIdSchema,
});

const divergenceSubjectSchema = z.discriminatedUnion('kind', [
  modelSubjectSchema,
  diagramSubjectSchema,
  elementSubjectSchema,
  threatSubjectSchema,
  mitigationSubjectSchema,
  assumptionSubjectSchema,
]);

const divergenceReasonSchema = z.enum([
  'unrepresentable',
  'undeclared',
  'narrowed',
  'split',
  'overridden',
  'discarded-by-edit',
]);

/**
 * The entity a divergence is about: the model as a whole, or one record by
 * id, including a record an edit removed from the source document.
 */
export type DivergenceSubject = z.infer<typeof divergenceSubjectSchema>;

/**
 * Why a file does not correspond to the model, or to its source.
 * `unrepresentable`: the format cannot express what the model holds.
 * `undeclared`: the wire schema does not declare a key, so the read dropped
 * it. `narrowed`: a value reached the file or the model holding less.
 * `split`: one record became several. `overridden`: the codec wrote over a
 * source value it will not repeat, such as a release stamp.
 * `discarded-by-edit`: an edit removed what the source document held. A read
 * reports only `undeclared` and `narrowed`.
 */
export type DivergenceReason = z.infer<typeof divergenceReasonSchema>;

/**
 * One divergence. `detail` is a code and its parameters rather than a
 * sentence, so a reader phrases it in its own language, and this package
 * needs none.
 */
export const divergenceSchema = z.object({
  subject: divergenceSubjectSchema,
  detail: divergenceDetailSchema,
  reason: divergenceReasonSchema,
});

/**
 * One place a file and the model do not correspond exactly, or a written
 * file and the source it was merged onto, in the order the codec recorded it.
 */
export type Divergence = z.infer<typeof divergenceSchema>;

/** Whether anything diverged. */
export function hasDiverged(divergences: readonly Divergence[]): boolean {
  return divergences.length > 0;
}

/**
 * The divergences as English lines for a person, one per entry, or a line
 * saying there are none. This is the CLI's and the MCP server's output, so
 * the wording is an interface. Each detail is worded by
 * {@link divergenceDetailText} and escaped as {@link escapedForTerminal}
 * escapes, and an id as {@link quotedForTerminal} quotes. What that leaves in
 * an id is the format characters the model accepts, which
 * [`SCHEMA.md`](../../../model/SCHEMA.md) lists, some of them invisible.
 */
export function renderDivergences(divergences: readonly Divergence[]): string {
  return hasDiverged(divergences)
    ? divergences.map(renderDivergence).join('\n')
    : 'No divergence recorded.';
}

/**
 * A text with every `Cc` control character written as `\uXXXX` and every
 * backslash doubled, so an escape a file carries cannot move a terminal's
 * cursor. The whole category is covered, C1 included, rather than the subset
 * `JSON.stringify` escapes. Bidirectional and zero-width formatting is left
 * alone.
 */
export function escapedForTerminal(text: string): string {
  return text.replace(escapableText, escapeCharacter);
}

/**
 * A foreign text in double quotes, escaped as {@link escapedForTerminal}
 * escapes and with each quote escaped too, so it cannot close its own
 * quoting.
 */
export function quotedForTerminal(text: string): string {
  return `"${text.replace(escapableQuoted, escapeCharacter)}"`;
}

/**
 * `text` with every run of whitespace, a line feed included, collapsed to
 * one space, so a title reads on the one line of a listing it is given.
 */
export function collapsedWhitespace(text: string): string {
  return text.replace(/\s+/gu, ' ');
}

const reasonPhrases: Record<DivergenceReason, string> = {
  unrepresentable: 'no place in the format',
  undeclared: 'not declared by the wire schema',
  narrowed: 'reduced to fit the format',
  split: 'split by the format',
  overridden: 'not repeated by the codec',
  'discarded-by-edit': 'removed by an edit',
};

const escapableText = /\\|\p{Cc}/gu;

const escapableQuoted = /["\\]|\p{Cc}/gu;

function renderDivergence(divergence: Divergence): string {
  return `${renderSubject(divergence.subject)}: ${escapedForTerminal(
    divergenceDetailText(divergence.detail),
  )} (${reasonPhrases[divergence.reason]})`;
}

function renderSubject(subject: DivergenceSubject): string {
  return subject.kind === 'model'
    ? 'model'
    : `${subject.kind} ${quotedForTerminal(subject.id)}`;
}

function escapeCharacter(character: string): string {
  return character === '\\' || character === '"'
    ? `\\${character}`
    : `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`;
}
