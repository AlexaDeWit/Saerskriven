import type { ParseIssue } from '@saerskriven/model';
import { ReadFailure } from './codec.js';

/** The issues a failure carries, none for a bound or a syntax error. */
export function readFailureIssues(failure: ReadFailure): readonly ParseIssue[] {
  return ReadFailure.$match(failure, {
    ExceededReadLimit: () => [],
    MalformedText: () => [],
    InvalidWireDocument: ({ issues }) => issues,
    InvalidModel: ({ issues }) => issues,
  });
}
