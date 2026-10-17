import { ReadFailure } from './codec.js';
import { DetectionFailure } from './detect.js';
import { escapedForTerminal } from './divergence.js';
import { wireIssueLine, type WireIssue } from './import-issue-detail.js';

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
        LaterFormatVersion: ({ stated, read }) => {
          const { first, last } = versionsReadSpan(read);
          return [
            `The file is Saerskriven YAML version ${String(stated)}, and this release of saer reads versions ${String(first)} to ${String(last)}.`,
            'Upgrade saer to a release that reads it.',
          ];
        },
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

/**
 * The oldest and the newest of the versions a `LaterFormatVersion` says this
 * release reads.
 */
export function versionsReadSpan(read: readonly number[]): {
  readonly first: number;
  readonly last: number;
} {
  return { first: Math.min(...read), last: Math.max(...read) };
}

function issueLines(issues: readonly WireIssue[]): readonly string[] {
  return issues.map((issue) => escapedForTerminal(wireIssueLine(issue)));
}
