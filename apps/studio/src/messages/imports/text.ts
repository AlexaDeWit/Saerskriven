import type { ImportIssueDetail, SourceReferent } from '@saerskriven/formats';
import type { Speaker } from '../said.js';

/** What one import issue code says, with the data the import passed through. */
export function importIssueDetail(
  t: Speaker,
  detail: ImportIssueDetail,
): string {
  switch (detail.code) {
    case 'import-format-unnamed':
      return t('imports.import-format-unnamed', detail.parameters);
    case 'otm-parent-not-single':
      return t('imports.otm-parent-not-single');
    case 'duplicate-identifier':
      return t('imports.duplicate-identifier', detail.parameters);
    case 'unknown-source-reference':
      return t(sourceIds[detail.parameters.kind], {
        id: detail.parameters.id,
      });
    default:
      return undescribed(detail);
  }
}

const sourceIds = {
  component: 'imports.source-component-unknown',
  asset: 'imports.source-asset-unknown',
  threat: 'imports.source-threat-unknown',
  mitigation: 'imports.source-mitigation-unknown',
  'trust-zone': 'imports.source-trust-zone-unknown',
  endpoint: 'imports.source-endpoint-unknown',
  'data-store': 'imports.source-data-store-unknown',
} as const satisfies Record<SourceReferent, string>;

function undescribed(_detail: never): string {
  return '';
}
