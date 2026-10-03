import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@radix-ui/react-icons';
import { useId, type FocusEvent } from 'react';
import { useTranslator } from '../messages/locale.js';
import type { Speaker } from '../messages/said.js';
import { EnumField } from '../ui/enum-field.js';
import { ProseField, TextField, type RefusedDraft } from '../ui/text-field.js';
import {
  recordFieldIn,
  recordHeadline,
  textOf,
  type RecordField,
  type RecordKind,
  type RecordPart,
  type ThreatRecord,
} from './records.js';
import type { RefusedField, RefusedText } from './refusals.js';
import styles from './threat-panel.module.css';

/** A refused draft held for a record group, by the field it was typed in. */
export type HeldText = Pick<RefusedField, 'field' | 'text' | 'status'>;

/**
 * One row of a record group: its record, how the row is drawn, and what its
 * controls report. `foldable` rows draw a toggle in place of the name, and
 * `elsewhere` and `elsewhereCounted` are the open and folded lines saying
 * where else the record is.
 */
export type RecordRowProps<Held extends ThreatRecord> = {
  readonly kind: RecordKind<Held>;
  readonly record: Held;
  readonly name: string;
  readonly position: number;
  readonly draft: boolean;
  readonly foldable: boolean;
  readonly open: boolean;
  readonly added: boolean;
  readonly elsewhere: string | undefined;
  readonly elsewhereCounted: string | undefined;
  readonly held: HeldText | undefined;
  readonly onToggle: () => void;
  readonly onBlur: (event: FocusEvent<HTMLElement>) => void;
  readonly onChange: () => void;
  readonly onCommit: (part: RecordPart) => (text: string) => void;
  readonly onRefused: (
    field: RecordField,
    refusal: RefusedText | undefined,
  ) => void;
  readonly onStatus: (status: Held['status']) => void;
  readonly onRemove: () => void;
};

/**
 * One record. Folded, it is one row: a toggle drawing its title, or the
 * start of its text, then its status, and a second line where it is on
 * other threats. Open, its name row carries the toggle that folds it, the
 * Added mark once a new record is kept, the status and Unlink (Discard
 * while it is not yet kept), and its fields follow without labels of their
 * own. The toggle is named alike in both states, by the record's name and
 * its headline. The row is a group with no name: its toggle, or a new row's
 * fields, already carry the record's name.
 */
export function RecordRow<Held extends ThreatRecord>({
  kind,
  record,
  name,
  position,
  draft,
  foldable,
  open,
  added,
  elsewhere,
  elsewhereCounted,
  held,
  onToggle,
  onBlur,
  onChange,
  onCommit,
  onRefused,
  onStatus,
  onRemove,
}: RecordRowProps<Held>) {
  const sharedId = useId();
  const { t } = useTranslator();
  const heldField = recordFieldIn(held?.field, kind.noun);
  const heldIn = (part: RecordPart): string | undefined =>
    heldField?.recordId === record.id && heldField.part === part
      ? held?.text
      : undefined;
  const partName = (part: RecordPart): string | undefined =>
    kind.parts.length === 1
      ? undefined
      : t(part === 'title' ? 'fields.title' : 'fields.description');
  const fieldProps = (part: RecordPart) => ({
    held: heldIn(part),
    label: (speak: Speaker): string =>
      speak(kind.partField(part), { number: position }),
    shownLabel: '',
    placeholder: partName(part),
    onChange,
    onCommit: onCommit(part),
    onRefused: (refusal: RefusedDraft | undefined) => {
      onRefused(
        { noun: kind.noun, part, recordId: record.id, pending: draft },
        refusal !== undefined && draft
          ? { ...refusal, status: record.status }
          : refusal,
      );
    },
    value: textOf(record, part),
  });
  const line = open ? elsewhere : elsewhereCounted;
  const status = (
    <EnumField
      label={t(kind.statusField, { number: position })}
      labelOf={(option) => t(kind.statusMessage(option))}
      onCommit={onStatus}
      options={kind.statuses}
      shownLabel=""
      value={record.status}
    />
  );
  const remove = (
    <button
      aria-describedby={elsewhere === undefined ? undefined : sharedId}
      aria-label={t(`fields.${draft ? 'discard' : 'unlink'}-${kind.noun}`, {
        number: position,
      })}
      className={styles.unlink}
      data-unlink-record={draft ? undefined : true}
      onClick={onRemove}
      onMouseDown={
        draft
          ? (event) => {
              event.preventDefault();
            }
          : undefined
      }
      type="button"
    >
      {t(draft ? 'panel.discard' : 'panel.unlink')}
    </button>
  );
  const fields = kind.parts.map((part) =>
    part === 'title' ? (
      <TextField key={part} {...fieldProps(part)} />
    ) : (
      <ProseField compact key={part} {...fieldProps(part)} />
    ),
  );

  return (
    <div
      className={styles.record}
      data-record-row={record.id}
      onBlur={draft ? onBlur : undefined}
    >
      <fieldset className={styles.recordFields}>
        <div className={styles.recordHead} data-folded={open ? undefined : ''}>
          {foldable ? (
            <RecordToggle
              describedBy={line === undefined ? undefined : sharedId}
              headline={recordHeadline(record)}
              name={name}
              onToggle={onToggle}
              open={open}
            />
          ) : (
            <span className={styles.recordName}>{name}</span>
          )}
          {added && (
            <span className={styles.added} data-added="">
              <CheckIcon aria-hidden="true" />
              {t(kind.addedMark)}
            </span>
          )}
          <div className={styles.recordState}>
            {status}
            {open && remove}
          </div>
        </div>
        {line !== undefined && (
          <p className={styles.shared} id={sharedId}>
            {line}
          </p>
        )}
        {open && fields}
      </fieldset>
    </div>
  );
}

function RecordToggle({
  name,
  headline,
  open,
  describedBy,
  onToggle,
}: {
  readonly name: string;
  readonly headline: string | undefined;
  readonly open: boolean;
  readonly describedBy: string | undefined;
  readonly onToggle: () => void;
}) {
  const { t } = useTranslator();

  return (
    <button
      aria-describedby={describedBy}
      aria-expanded={open}
      aria-label={
        headline === undefined
          ? name
          : t('fields.record-toggle', { name, headline })
      }
      className={styles.recordToggle}
      data-record-toggle=""
      onClick={onToggle}
      type="button"
    >
      {open ? (
        <ChevronDownIcon aria-hidden="true" />
      ) : (
        <ChevronRightIcon aria-hidden="true" />
      )}
      <span className={open ? styles.recordName : styles.recordLine}>
        {open ? name : (headline ?? name)}
      </span>
    </button>
  );
}
