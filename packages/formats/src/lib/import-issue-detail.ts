import {
  carrying,
  coded,
  codesOf,
  issueLine,
  parseIssueText,
  type ParseIssue,
  type ParseIssueDetail,
} from '@saerskriven/model';
import { z } from 'zod';

const sourceReferentSchema = z.enum([
  'component',
  'asset',
  'threat',
  'mitigation',
  'trust-zone',
  'endpoint',
  'data-store',
]);

/** What an entry of a source document names when a mapping cannot resolve it. */
export type SourceReferent = z.infer<typeof sourceReferentSchema>;

/**
 * What one issue an import found is about, where no parse issue code of
 * `@saerskriven/model` covers it: a document naming neither import format,
 * with the releases each is read in, an OTM parent that does not name
 * exactly one trust zone or component, an identifier a source list repeats,
 * and a reference a mapping cannot resolve. The OTM wire schema names
 * `otm-parent-not-single` in its refinement's own parameters.
 */
export const importIssueDetailSchema = z.discriminatedUnion('code', [
  carrying('import-format-unnamed', {
    otm: z.array(z.string()),
    tmbom: z.array(z.string()),
  }),
  coded('otm-parent-not-single'),
  carrying('duplicate-identifier', { id: z.string() }),
  carrying('unknown-source-reference', {
    id: z.string(),
    kind: sourceReferentSchema,
  }),
]);

/** One import issue's code and the data that code carries. */
export type ImportIssueDetail = z.infer<typeof importIssueDetailSchema>;

/** Every code an import reports beside the parse issue codes. */
export type ImportIssueCode = ImportIssueDetail['code'];

/** What an issue a read found in a wire document is about. */
export type WireIssueDetail = ParseIssueDetail | ImportIssueDetail;

/** One issue a read found in a wire document, with its path into it. */
export type WireIssue = ParseIssue<WireIssueDetail>;

const importIssueCodes: ReadonlySet<string> = new Set(
  codesOf(importIssueDetailSchema),
);

/** Whether a wire issue's detail is an import code rather than a parse issue code. */
export function isImportIssueDetail(
  detail: WireIssueDetail,
): detail is ImportIssueDetail {
  return importIssueCodes.has(detail.code);
}

/**
 * One wire issue as a line of English, the text `renderReadFailure` reports
 * and the CLI and the MCP server print.
 */
export function wireIssueLine(issue: WireIssue): string {
  return issueLine(issue, (detail) =>
    isImportIssueDetail(detail)
      ? importIssueText(detail)
      : parseIssueText(detail),
  );
}

/**
 * One import detail in English. A reader that phrases a code itself, as the
 * studio does, uses the code and its parameters instead.
 */
export function importIssueText(detail: ImportIssueDetail): string {
  switch (detail.code) {
    case 'import-format-unnamed':
      return `import requires an OTM ${detail.parameters.otm.join(' or ')} version stamp or a TM-BOM ${detail.parameters.tmbom.join(' or ')} schema URI`;
    case 'otm-parent-not-single':
      return 'a parent names exactly one trust zone or component';
    case 'duplicate-identifier':
      return `duplicate identifier "${detail.parameters.id}"`;
    case 'unknown-source-reference':
      return `names unknown ${referentNouns[detail.parameters.kind]} "${detail.parameters.id}"`;
    default:
      return unworded(detail);
  }
}

const referentNouns: Record<SourceReferent, string> = {
  component: 'component',
  asset: 'asset',
  threat: 'threat',
  mitigation: 'mitigation',
  'trust-zone': 'trust zone',
  endpoint: 'endpoint',
  'data-store': 'data store',
};

function unworded(_detail: never): string {
  return '';
}
