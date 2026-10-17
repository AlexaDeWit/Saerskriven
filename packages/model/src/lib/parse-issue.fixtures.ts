import type { ParseIssueDetail } from './parse-issue.js';

/**
 * One sample detail per parse issue code, for a spec that checks a describer
 * words every code. `parse-issue.spec.ts` pins that it stays complete.
 */
export const parseIssueSamples: readonly ParseIssueDetail[] = [
  {
    code: 'type-mismatch',
    parameters: { expected: 'string', received: 'number' },
  },
  { code: 'value-unexpected', parameters: { values: ['"actor"', '"flow"'] } },
  { code: 'option-unmatched' },
  {
    code: 'too-small',
    parameters: { bound: 1, kind: 'string', inclusive: true },
  },
  {
    code: 'too-big',
    parameters: { bound: 9, kind: 'number', inclusive: true },
  },
  { code: 'format-mismatch', parameters: { format: 'url' } },
  { code: 'value-refused', parameters: { kind: 'unrecognized-keys' } },
  { code: 'text-character-refused' },
  { code: 'element-kind-changed' },
  { code: 'operation-unknown' },
  { code: 'duplicate-element-id', parameters: { id: 'element-twice' } },
  { code: 'duplicate-diagram-id', parameters: { id: 'diagram-twice' } },
  {
    code: 'placement-element-unknown',
    parameters: { id: 'element-unheld' },
  },
  { code: 'duplicate-placement', parameters: { id: 'element-placed-twice' } },
  {
    code: 'placement-geometry-mismatch',
    parameters: { id: 'element-misdrawn' },
  },
  { code: 'element-unplaced', parameters: { id: 'element-undrawn' } },
  { code: 'duplicate-threat-id', parameters: { id: 'threat-twice' } },
  { code: 'duplicate-mitigation-id', parameters: { id: 'mitigation-twice' } },
  { code: 'duplicate-assumption-id', parameters: { id: 'assumption-twice' } },
  { code: 'duplicate-threat-number', parameters: { number: 11 } },
  {
    code: 'threat-number-above-issued',
    parameters: { number: 12, issued: 13 },
  },
  { code: 'flow-endpoint-self', parameters: { id: 'element-self-flow' } },
  { code: 'flow-endpoint-foreign', parameters: { id: 'element-elsewhere' } },
  { code: 'flow-end-position-held', parameters: { id: 'element-placed' } },
  { code: 'unknown-element-reference', parameters: { id: 'element-ghost' } },
  { code: 'unknown-threat-reference', parameters: { id: 'threat-ghost' } },
  { code: 'related-element-unknown', parameters: { id: 'element-unrelated' } },
  { code: 'related-boundary-unknown', parameters: { id: 'element-unbounded' } },
  { code: 'related-flow-unknown', parameters: { id: 'element-unflowed' } },
  { code: 'related-off-diagram', parameters: { id: 'element-elsewhere' } },
  { code: 'issue-flood' },
  { code: 'schema-threw', parameters: { reason: 'TypeError: defect' } },
];
