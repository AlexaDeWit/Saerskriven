import { issueLine, type ParseIssue } from '@saerskriven/model';
import { ReadFailure } from './codec.js';
import { DetectionFailure } from './detect.js';
import { escapedForTerminal } from './divergence.js';

/**
 * Why a read produced nothing, as lines without terminators, every variant
 * worded. A path and a message come out of a file, so both are escaped as
 * {@link escapedForTerminal} escapes.
 */
export function renderReadFailure(
  failure: ReadFailure | DetectionFailure,
): readonly string[] {
  return DetectionFailure.$is('NoFormatClaimed')(failure)
    ? [
        `No format claimed the file. Saerskriven tried ${failure.tried.join(', ')}.`,
      ]
    : ReadFailure.$match(failure, {
        ExceededReadLimit: ({ limit, bound, observed }) => [
          'The file is past a read bound, so nothing read it.',
          `${limit}: the bound is ${String(bound)}, the file reached ${String(observed)}.`,
        ],
        MalformedText: ({ message }) => [
          'The file is not valid text of the format that claimed it.',
          message,
        ],
        InvalidWireDocument: ({ issues }) => [
          'The file is not a valid document of the format that claimed it:',
          ...issueLines(issues),
        ],
        InvalidModel: ({ issues }) => [
          'The file is a valid document, and the model it maps to is not:',
          ...issueLines(issues),
        ],
      });
}

function issueLines(issues: readonly ParseIssue[]): readonly string[] {
  return issues.map((issue) => escapedForTerminal(issueLine(issue)));
}
