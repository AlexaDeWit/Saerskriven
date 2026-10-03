import { Fragment } from 'react';
import { formatNames } from '../format-names.js';
import { useTranslator } from '../messages/locale.js';
import { useModelStore } from '../store/store.js';
import { DetailLines } from '../ui/detail-lines.js';
import { FailureNotice } from '../ui/failure-notice.js';
import { LiveRegion } from '../ui/live-region.js';
import { describeExportNotice } from './export-notice.js';
import type { FileSession } from './file-commands.js';
import styles from './menu.module.css';
import { reportSections } from './session.js';
import { describeShareNotice } from './share-notice.js';

/**
 * The failure notice, the report of the last file crossing, the export report
 * and the share report, which hang under the chrome card. Each is empty until
 * something is refused, costs the model a key, opens as a new model, or is
 * shared, and each is worded on render, so a change of language rewords a
 * standing report. The crossing report draws one heading for each part of it
 * that has a line. A report that replaces another is drawn as new nodes above
 * the same Dismiss button, so the live region says its notice and headings
 * although the last report had the same ones, and focus on the button holds.
 */
export function FileReports({ session }: { readonly session: FileSession }) {
  const { t } = useTranslator();
  const failure = useModelStore((state) => state.lastFailure);
  const {
    dismissExportNotice,
    dismissReport,
    dismissShareNotice,
    exportNotice,
    report,
    reportSequence,
    shareNotice,
  } = session;
  const exported =
    exportNotice === undefined
      ? undefined
      : describeExportNotice(t, exportNotice);
  const shared =
    shareNotice === undefined ? undefined : describeShareNotice(t, shareNotice);

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
            <Fragment key={reportSequence}>
              {report.readOnlyFormat !== undefined && (
                <p className={styles.notice}>
                  {t('reports.opened-read-only', {
                    format: formatNames[report.readOnlyFormat],
                  })}
                </p>
              )}
              {reportSections(t, report).map(({ heading, lines }) => (
                <Fragment key={heading}>
                  <p className={styles.headline}>{t(heading)}</p>
                  <DetailLines className={styles.lines} lines={lines} />
                </Fragment>
              ))}
            </Fragment>
            <Dismiss
              label={t('reports.dismiss-report')}
              onClick={dismissReport}
            />
          </>
        )}
        {exported !== undefined && (
          <div data-testid="export-report">
            <p className={styles.headline}>{exported.headline}</p>
            {exported.details.length > 0 && (
              <DetailLines className={styles.lines} lines={exported.details} />
            )}
            <Dismiss
              label={t('reports.dismiss-export')}
              onClick={dismissExportNotice}
            />
          </div>
        )}
        {shared !== undefined && (
          <div data-testid="share-report">
            <p className={styles.headline}>{shared.headline}</p>
            <DetailLines className={styles.lines} lines={shared.details} />
            <Dismiss
              label={t('reports.dismiss-share')}
              onClick={dismissShareNotice}
            />
          </div>
        )}
      </LiveRegion>
    </>
  );
}

function Dismiss({
  label,
  onClick,
}: {
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <button className={styles.dismiss} onClick={onClick} type="button">
      {label}
    </button>
  );
}
