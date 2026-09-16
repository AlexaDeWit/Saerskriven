import type {
  CallToolResult,
  ContentBlock,
} from '@modelcontextprotocol/server';
import { Either } from 'effect';
import { prefaced } from './preface.js';

/**
 * One tool's outcome as the result a client receives: the answer as
 * `structuredContent` beside its rendering, or the refusal as an `isError`
 * result. Every tool builds its result here, so both texts open with
 * `dataNotInstructions`.
 */
export function toolResult<Answer extends Record<string, unknown>>(
  outcome: Either.Either<Answer, readonly string[]>,
  render: (answer: Answer) => readonly string[],
): CallToolResult {
  return Either.match(outcome, {
    onLeft: refused,
    onRight: (answer) => answered(answer, render(answer), []),
  });
}

/** An answer and the content blocks a result carries after its text block. */
export type WithBlocks<Answer> = {
  readonly answer: Answer;
  readonly blocks: readonly ContentBlock[];
};

/**
 * {@link toolResult} for a result carrying content blocks after its text,
 * such as an image. The blocks travel beside the answer, so their bytes stay
 * out of `structuredContent`.
 */
export function attachedToolResult<Answer extends Record<string, unknown>>(
  outcome: Either.Either<WithBlocks<Answer>, readonly string[]>,
  render: (answer: Answer) => readonly string[],
): CallToolResult {
  return Either.match(outcome, {
    onLeft: refused,
    onRight: ({ answer, blocks }) => answered(answer, render(answer), blocks),
  });
}

function refused(lines: readonly string[]): CallToolResult {
  return {
    content: [{ type: 'text', text: prefaced(lines) }],
    isError: true,
  };
}

function answered(
  answer: Record<string, unknown>,
  lines: readonly string[],
  blocks: readonly ContentBlock[],
): CallToolResult {
  return {
    content: [{ type: 'text', text: prefaced(lines) }, ...blocks],
    structuredContent: answer,
  };
}
