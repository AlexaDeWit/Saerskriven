import { useTranslator } from '../messages/locale.js';
import { Message } from '../messages/message.js';
import { useModelStore } from '../store/store.js';
import { DetailLines } from '../ui/detail-lines.js';
import { FailureNotice } from '../ui/failure-notice.js';
import { LiveRegion } from '../ui/live-region.js';
import { describeExportNotice } from './export-notice.js';
import type { FileSession } from './file-commands.js';
import styles from './menu.module.css';
import { reportHeadlines, reportLines } from './session.js';

/**
 * The failure notice, the report of the last file crossing and the export
 * report, which hang under the chrome card. Each is empty until something is
 * refused or costs the model a key, and each is worded on render, so a
 * change of language rewords a standing report.
 */
export function FileReports({ session }: { readonly session: FileSession }) {
  const { t } = useTranslator();
  const failure = useModelStore((state) => state.lastFailure);
  const { dismissExportNotice, dismissReport, exportNotice, report } = session;
  const exported =
    exportNotice === undefined
      ? undefined
      : describeExportNotice(t, exportNotice);

  return (
    <>
      <FailureNotice failure={failure} />
      <LiveRegion
        className={styles.report}
        label={t('reports.region')}
        testId="loss-report"
      >
        {report !== undefined && (
          <>
            <p className={styles.headline}>
              {t(reportHeadlines[report.occasion])}
            </p>
            <DetailLines
              className={styles.lines}
              lines={reportLines(t, report.divergences, report.occasion)}
              summary={
                report.occasion === 'import' ? (
                  <Message
                    id="reports.conversion-details"
                    params={{ count: report.divergences.length }}
                  />
                ) : undefined
              }
            />
            <button
              className={styles.dismiss}
              onClick={dismissReport}
              type="button"
            >
              {t('reports.dismiss-report')}
            </button>
          </>
        )}
        {exported !== undefined && (
          <div data-testid="export-report">
            <p className={styles.headline}>{exported.headline}</p>
            {exported.details.length > 0 && (
              <DetailLines className={styles.lines} lines={exported.details} />
            )}
            <button
              className={styles.dismiss}
              onClick={dismissExportNotice}
              type="button"
            >
              {t('reports.dismiss-export')}
            </button>
          </div>
        )}
      </LiveRegion>
    </>
  );
}
