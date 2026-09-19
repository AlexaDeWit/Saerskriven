import { catalogueReport } from '@saerskriven/i18n';
import { exportCatalogues } from './catalogues.js';

const report = catalogueReport(exportCatalogues);

describe('the export catalogues', () => {
  it('hold no brace outside a placeholder', () => {
    expect(report.malformed).toEqual([]);
  });

  it('report the entries fr-CA and sv word as en-CA does', async ({
    annotate,
  }) => {
    await annotate(report.sameAsDefault.join('\n') || 'none', 'same as en-CA');
    expect(report.sameAsDefault.some((line) => line.startsWith('en-CA'))).toBe(
      false,
    );
  });
});
