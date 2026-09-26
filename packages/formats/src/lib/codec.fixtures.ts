import { ReadFailure } from './codec.js';
import type { WireIssue } from './import-issue-detail.js';

/** The issues a failure carries, none for a bound or a syntax error. */
export function readFailureIssues(failure: ReadFailure): readonly WireIssue[] {
  return ReadFailure.$match(failure, {
    ExceededReadLimit: () => [],
    MalformedText: () => [],
    InvalidWireDocument: ({ issues }) => issues,
    InvalidModel: ({ issues }) => issues,
  });
}
