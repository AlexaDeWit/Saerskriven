import { Either } from 'effect';

/**
 * What the process answers with: 0 for the command doing what it was asked,
 * 1 for a file Saerskriven read and refused, and 2 for an invocation it
 * cannot carry out.
 */
export type ExitCode = 0 | 1 | 2;

/**
 * What a command puts on standard output: the text of a document, or its
 * bytes where the document is not text. A PDF is the second, and a stream
 * handed a string would encode it as UTF-8 and corrupt it.
 */
export type CommandOutput = string | Uint8Array;

/**
 * What a command asks the edge to do: the exit code, and what each stream is
 * to carry. Both are written verbatim, so a command writing a document to
 * standard output decides its own trailing newline rather than inheriting
 * one.
 */
export type CommandOutcome = {
  readonly code: ExitCode;
  readonly out: CommandOutput;
  readonly err: string;
};

/** The command did what it was asked, whatever it wrote to either stream. */
export function succeeded(out: CommandOutput, err: string): CommandOutcome {
  return { code: 0, out, err };
}

/** Saerskriven read the file and refused it. */
export function invalidInput(err: string): CommandOutcome {
  return { code: 1, out: '', err };
}

/**
 * The invocation, the environment or a projection failed, not the input
 * file. A projection that fails on a model Saerskriven accepted is 2 rather
 * than 1, since the file was read and was good.
 */
export function usageError(err: string): CommandOutcome {
  return { code: 2, out: '', err };
}

/**
 * Texts as lines, each ending in a newline, so passing none gives an empty
 * text rather than a blank line.
 */
export function lines(...texts: readonly string[]): string {
  return texts.map((text) => `${text}\n`).join('');
}

/**
 * `content` on standard output where `out` is `-`, and otherwise handed to
 * `write` for the path `out` names, whose refusal lines exit 2. `warning`
 * goes to standard error either way.
 */
export function delivered<Content extends CommandOutput>(
  out: string,
  content: Content,
  warning: string,
  write: (
    path: string,
    content: Content,
  ) => Either.Either<unknown, readonly string[]>,
): CommandOutcome {
  return out === '-'
    ? succeeded(content, warning)
    : Either.match(write(out, content), {
        onLeft: (refusal) => usageError(lines(...refusal)),
        onRight: () => succeeded('', warning),
      });
}
