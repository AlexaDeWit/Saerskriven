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

/**
 * How long the issue flood suite is given, past the root `vitest.shared.mts`
 * sets. The OTM, TM-BOM and Saerskriven YAML reads parse the 135,000-entry
 * flood as YAML before zod sees it, which costs more than zod's own pass,
 * and the model-level read runs the wire and model schemas over it besides.
 * Two contended CI runs (#595) put the OTM read at 10.0 and 10.3 s, TM-BOM
 * at 5.7 and 6.9 s, and the model-level read at 6.7 and 5.4 s.
 */
export const floodTimeout = 30_000;
