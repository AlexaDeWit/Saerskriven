import { useTranslator } from '../messages/locale.js';
import { useModelStore } from '../store/store.js';
import { DetailLines } from '../ui/detail-lines.js';
import { FailureNotice } from '../ui/failure-notice.js';
import { LiveRegion } from '../ui/live-region.js';
import type { FileSession } from './file-commands.js';
import styles from './menu.module.css';
import { reportHeadlines, reportLines } from './session.js';

/**
 * The failure notice, the report of the last file crossing and the export
 * report, which hang under the chrome card. Each is empty until something is
 * refused or costs the model a key.
 */
export function FileReports({ session }: { readonly session: FileSession }) {
  const { t } = useTranslator();
  const failure = useModelStore((state) => state.lastFailure);
  const { dismissExportNotice, dismissReport, exportNotice, report } = session;

  return (
    <>
      <FailureNotice failure={failure} />
      <LiveRegion
        className={styles.report}
        label="File reports"
        testId="loss-report"
      >
        {report !== undefined && (
          <>
            <p className={styles.headline}>
              {reportHeadlines[report.occasion]}
            </p>
            <DetailLines
              className={styles.lines}
              lines={reportLines(t, report.divergences, report.occasion)}
              summary={
                report.occasion === 'import' ? (
                  <>{report.divergences.length} conversion details</>
                ) : undefined
              }
            />
            <button
              className={styles.dismiss}
              onClick={dismissReport}
              type="button"
            >
              Dismiss report
            </button>
          </>
        )}
        {exportNotice !== undefined && (
          <div data-testid="export-report">
            <p className={styles.headline}>{exportNotice.headline}</p>
            {exportNotice.details.length > 0 && (
              <DetailLines
                className={styles.lines}
                lines={exportNotice.details}
              />
            )}
            <button
              className={styles.dismiss}
              onClick={dismissExportNotice}
              type="button"
            >
              Dismiss export report
            </button>
          </div>
        )}
      </LiveRegion>
    </>
  );
}
