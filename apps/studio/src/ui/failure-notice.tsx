import {
  DetectionFailure,
  ReadFailure,
  importFormatSchema,
  readLimits,
  type WireIssue,
} from '@saerskriven/formats';
import { ShareLinkFailure } from '@saerskriven/formats/share-link';
import { OperationFailure } from '@saerskriven/model';
import { assetFailureLine } from '../asset-failure.js';
import { formatNames } from '../format-names.js';
import { parseIssueLine } from '../messages/issues/text.js';
import { useTranslator } from '../messages/locale.js';
import { Message } from '../messages/message.js';
import type { Speaker } from '../messages/said.js';
import { Action } from '../store/actions.js';
import { RecoveryProblem } from '../store/recovery-storage.js';
import { LinkFailure, StudioFailure } from '../store/state.js';
import { dispatch } from '../store/store.js';
import { DetailLines, type NoticeText } from './detail-lines.js';
import styles from './failure-notice.module.css';
import { LiveRegion } from './live-region.js';

/**
 * A refusal as a person reads it: a headline in the reader's language, and
 * the lines under it. An id, a file name, a limit's name and a schema path
 * pass through unchanged. Text a browser or a parser raised stays a literal
 * line, since no code says what it means.
 */
export function describeFailure(
  t: Speaker,
  failure: StudioFailure,
): NoticeText {
  return StudioFailure.$match(failure, {
    Operation: ({ failure: refusal }) => ({
      headline: t('notice.operation-refused'),
      details: describeOperation(t, refusal),
    }),
    Read: ({ name, failure: refusal }) => describeRead(t, name, refusal),
    File: ({ reason }) => ({
      headline: t('notice.file-unreachable'),
      details: [reason],
    }),
    Link: ({ failure: refusal }) => ({
      headline: t('notice.link-refused'),
      details: linkFailureLines(t, refusal),
    }),
    StoredRecoveryRejected: ({ problem }) => ({
      headline: t('notice.recovery-rejected'),
      details: [describeRecovery(t, problem)],
    }),
    RecoveryUnavailable: ({ problem }) => ({
      headline: t('notice.recovery-unavailable'),
      details: [describeRecovery(t, problem)],
    }),
  });
}

/**
 * Why a link was not written or opened, as the lines under a notice's
 * headline: the cause named from the failure's tag, then the module's or the
 * browser's own text, or the read's detail lines, where there are any.
 */
export function linkFailureLines(
  t: Speaker,
  failure: LinkFailure,
): readonly string[] {
  return LinkFailure.$match(failure, {
    Codec: ({ failure: refusal }) =>
      ShareLinkFailure.$match(refusal, {
        TooLong: ({ length, limit }) => [
          t('notice.link-too-long', { length, limit }),
        ],
        PastReadBound: ({ size }) => [
          t('notice.link-past-read-bound', {
            size,
            bound: readLimits.maxTextBytes,
          }),
        ],
        NotAShareLink: () => [t('notice.link-not-a-link')],
        UnknownEncoding: ({ prefix }) => [
          t('notice.link-encoding', { prefix }),
        ],
        Malformed: () => [t('notice.link-cut-off')],
        Unusable: ({ sentence }) => [t('notice.link-module'), sentence],
      }),
    Read: ({ failure: refusal }) =>
      ReadFailure.$is('ExceededReadLimit')(refusal)
        ? [t('notice.link-too-large'), t('notice.read-limit-detail', refusal)]
        : [t('notice.link-not-a-model'), ...readDetails(t, refusal)],
    Module: ({ failure: refusal }) => [
      t('notice.link-module'),
      assetFailureLine(t, refusal),
    ],
  });
}

/** What the model refused, as a sentence followed by any parse issue lines. */
export function describeOperation(
  t: Speaker,
  failure: OperationFailure,
): readonly string[] {
  return OperationFailure.$match(failure, {
    InvalidElementProperties: ({ issues }) => [
      t('notice.op-element-properties'),
      ...issueLines(t, issues),
    ],
    InvalidElementRelationship: ({ issues }) => [
      t('notice.op-element-relationships'),
      ...issueLines(t, issues),
    ],
    InvalidFragment: ({ issues }) => [
      t('notice.op-fragment'),
      ...issueLines(t, issues),
    ],
    UnknownDiagram: ({ diagramId }) => [
      t('notice.op-unknown-diagram', { id: diagramId }),
    ],
    DuplicateDiagramId: ({ diagramId }) => [
      t('notice.op-duplicate-diagram', { id: diagramId }),
    ],
    EmptyTitle: ({ diagramId }) => [
      t('notice.op-empty-title', { id: diagramId }),
    ],
    RefusedTitleCharacter: ({ diagramId }) => [
      t('notice.op-title-character', { id: diagramId }),
    ],
    DiagramNotEmpty: ({ diagramId, elements }) => [
      t('notice.op-diagram-not-empty', { id: diagramId, count: elements }),
    ],
    UnknownElement: ({ elementId }) => [
      t('notice.op-unknown-element', { id: elementId }),
    ],
    UnknownThreat: ({ threatId }) => [
      t('notice.op-unknown-threat', { id: threatId }),
    ],
    UnknownMitigation: ({ mitigationId }) => [
      t('notice.op-unknown-mitigation', { id: mitigationId }),
    ],
    UnknownAssumption: ({ assumptionId }) => [
      t('notice.op-unknown-assumption', { id: assumptionId }),
    ],
    DuplicateElementId: ({ elementId }) => [
      t('notice.op-duplicate-element', { id: elementId }),
    ],
    DuplicateThreatId: ({ threatId }) => [
      t('notice.op-duplicate-threat', { id: threatId }),
    ],
    DuplicateMitigationId: ({ mitigationId }) => [
      t('notice.op-duplicate-mitigation', { id: mitigationId }),
    ],
    DuplicateAssumptionId: ({ assumptionId }) => [
      t('notice.op-duplicate-assumption', { id: assumptionId }),
    ],
    RecordWithoutThreat: ({ record }) => [
      t(
        record.kind === 'mitigation'
          ? 'notice.op-mitigation-without-threat'
          : 'notice.op-assumption-without-threat',
        { id: record.id },
      ),
    ],
    AssumptionWithoutReference: ({ assumptionId }) => [
      t('notice.op-assumption-without-reference', { id: assumptionId }),
    ],
    ReusedThreatNumber: ({ number }) => [
      t('notice.op-reused-number', { number }),
    ],
    ChangedThreatNumber: ({ threatId, number }) => [
      t('notice.op-changed-number', { id: threatId, number }),
    ],
    InvalidFlowEndpoint: ({ side, reference }) => [
      t(
        side === 'source'
          ? 'notice.op-source-endpoint'
          : 'notice.op-target-endpoint',
        { id: reference },
      ),
    ],
    NotResizable: ({ elementId }) => [
      t('notice.op-not-resizable', { id: elementId }),
    ],
    NotTextElement: ({ elementId }) => [
      t('notice.op-not-note', { id: elementId }),
    ],
    NotFlowElement: ({ elementId }) => [
      t('notice.op-not-flow', { id: elementId }),
    ],
    NotTrustBoundaryElement: ({ elementId }) => [
      t('notice.op-not-trust-boundary', { id: elementId }),
    ],
    EmptyName: ({ elementId }) => [
      t('notice.op-empty-name', { id: elementId }),
    ],
    RefusedCharacter: ({ elementId }) => [
      t('notice.op-element-character', { id: elementId }),
    ],
    RefusedMetadataCharacter: ({ field }) => [t(metadataCharacter[field])],
    RefusedContributorCharacter: ({ contributor }) => [
      t('notice.op-contributor-character', { entry: contributor + 1 }),
    ],
  });
}

type FailureNoticeProps = {
  readonly failure: StudioFailure | undefined;
};

/** Announces the last failure in a live region until dismissal or resolution. */
export function FailureNotice({ failure }: FailureNoticeProps) {
  const { t } = useTranslator();
  const described =
    failure === undefined ? undefined : describeFailure(t, failure);

  return (
    <LiveRegion
      className={styles.notice}
      label={t('notice.problems')}
      testId="failure-notice"
    >
      {described !== undefined && (
        <>
          <p className={styles.headline}>{described.headline}</p>
          {described.details.length > 0 && (
            <DetailLines
              className={styles.details}
              lines={described.details}
              summary={
                described.details.length > 1 ? (
                  <Message
                    id="notice.refusal-details"
                    params={{ count: described.details.length }}
                  />
                ) : undefined
              }
            />
          )}
          <button
            className={styles.dismiss}
            onClick={() => {
              dispatch(Action.DismissFailure());
            }}
            type="button"
          >
            {t('notice.dismiss')}
          </button>
        </>
      )}
    </LiveRegion>
  );
}

const metadataCharacter = {
  title: 'notice.op-model-title-character',
  owner: 'notice.op-model-owner-character',
  description: 'notice.op-model-description-character',
} as const;

function describeRead(
  t: Speaker,
  name: string,
  failure: ReadFailure | DetectionFailure,
): NoticeText {
  return DetectionFailure.$is('NoFormatClaimed')(failure)
    ? {
        headline: t('notice.no-format-claimed', { name }),
        details: [
          t('notice.formats-tried', {
            formats: [...failure.tried, ...importFormatSchema.options].map(
              (format) => formatNames[format],
            ),
          }),
        ],
      }
    : {
        headline: t(readHeadlines[failure._tag], { name }),
        details: readDetails(t, failure),
      };
}

const readHeadlines = {
  ExceededReadLimit: 'notice.read-limit',
  MalformedText: 'notice.malformed-text',
  InvalidWireDocument: 'notice.invalid-document',
  InvalidModel: 'notice.invalid-model',
} as const satisfies Record<ReadFailure['_tag'], string>;

function readDetails(t: Speaker, failure: ReadFailure): readonly string[] {
  return ReadFailure.$match(failure, {
    ExceededReadLimit: (bound) => [t('notice.read-limit-detail', bound)],
    MalformedText: ({ message }) => [message],
    InvalidWireDocument: ({ issues }) => issueLines(t, issues),
    InvalidModel: ({ issues }) => issueLines(t, issues),
  });
}

function describeRecovery(t: Speaker, problem: RecoveryProblem): string {
  return RecoveryProblem.$match(problem, {
    Thrown: ({ reason }) => reason,
    PastBound: (bound) => t('notice.snapshot-limit-detail', bound),
    Unsupported: () => t('notice.snapshot-unsupported'),
    EarlierRelease: ({ writer }) =>
      writer === undefined
        ? t('notice.snapshot-earlier-release')
        : t('notice.snapshot-release', { release: writer }),
  });
}

function issueLines(
  t: Speaker,
  issues: readonly WireIssue[],
): readonly string[] {
  return issues.map((issue) => parseIssueLine(t, issue));
}
