import { Link2Icon, PlusIcon } from '@radix-ui/react-icons';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
} from 'react';
import {
  announce,
  quoted,
  recordQuoteLength,
} from '../canvas/announcements.js';
import { dispatch, modelStore, useModelStore } from '../store/store.js';
import { EnumField, type OptionText } from '../ui/enum-field.js';
import { ProseField, TextField, type RefusedDraft } from '../ui/text-field.js';
import { VisuallyHidden } from '../ui/visually-hidden.js';
import {
  editedRecord,
  inShownOrder,
  isRecordField,
  linkableRecords,
  recordFieldIn,
  recordFieldName,
  recordLabel,
  textOf,
  type RecordField,
  type RecordFieldName,
  type RecordKind,
  type RecordPart,
  type RecordTarget,
  type ThreatRecord,
} from './records.js';
import type { RefusedField, RefusedText } from './refusals.js';
import styles from './threat-panel.module.css';

type HeldText = Pick<RefusedField, 'field' | 'text' | 'status'>;

type RecordGroupProps<Held extends ThreatRecord> = {
  readonly kind: RecordKind<Held>;
  readonly target: RecordTarget<Held>;
  readonly held: HeldText | undefined;
  readonly refusals: ReadonlyMap<string, RefusedText>;
  readonly onChange: () => void;
  readonly onRefused: (
    changes: readonly (readonly [RecordFieldName, RefusedText | undefined])[],
  ) => void;
};

type FocusRequest =
  | { readonly kind: 'text'; readonly recordId: string }
  | { readonly kind: 'add' }
  | {
      readonly kind: 'unlinked';
      readonly index: number;
      readonly body: Element | null | undefined;
      readonly scrolled: number;
    };

const rowSelector = '[data-record-row]';

/**
 * The records of one kind linked to one target, a threat or the model. Add
 * opens an empty row that becomes a record on its first commit and goes when
 * left empty. A row that returns while the group is mounted takes its old
 * slot back.
 */
export function RecordGroup<Held extends ThreatRecord>({
  kind,
  target,
  held,
  refusals,
  onChange,
  onRefused,
}: RecordGroupProps<Held>) {
  const all = useModelStore((state) => kind.held(state.present));
  const threats = useModelStore((state) => state.present.threats);
  const records = all.filter(target.holds);
  const linkable = linkableRecords(all, target, threats);
  const group = useRef<HTMLFieldSetElement>(null);
  const [draft, setDraft] = useState<Held | undefined>(() => {
    const heldField = recordFieldIn(held?.field, kind.noun);
    const restored =
      heldField === undefined ||
      !heldField.pending ||
      all.some(({ id }) => id === heldField.recordId)
        ? undefined
        : kind.restored(heldField.recordId, held?.status);
    return restored === undefined ? undefined : target.attach(restored);
  });
  const focus = useRef<FocusRequest | undefined>(undefined);
  const focusedRow = useRef<string | undefined>(undefined);
  const drafting =
    draft !== undefined && !records.some(({ id }) => id === draft.id);
  const listed = drafting ? [...records, draft] : records;
  const isDraft = (record: Held): boolean => drafting && record.id === draft.id;
  const [order, setOrder] = useState<readonly string[]>(() =>
    listed.map(({ id }) => id),
  );
  const arranged = inShownOrder(listed, order);
  const { rows } = arranged;
  if (arranged.shown !== order) {
    setOrder(arranged.shown);
  }
  const shown = new Set<string>(rows.map(({ id }) => id));
  const stale = [...refusals.keys(), held?.field ?? '']
    .filter((field) => isRecordField(field, kind.noun))
    .find(
      (field) => !shown.has(recordFieldIn(field, kind.noun)?.recordId ?? field),
    );

  useEffect(() => {
    if (stale !== undefined) {
      onRefused([[stale, undefined]]);
    }
  }, [stale, onRefused]);

  useLayoutEffect(() => {
    const request = focus.current;
    if (request?.kind === 'unlinked' && request.body) {
      request.body.scrollTop = request.scrolled;
    }
  });

  useEffect(() => {
    const request = focus.current;
    focus.current = undefined;
    const control =
      request === undefined ? undefined : focusTarget(group.current, request);
    if (request?.kind === 'unlinked') {
      control?.focus({ preventScroll: true });
      control?.scrollIntoView({ block: 'nearest' });
    } else {
      control?.focus();
    }
    const lost = focusedRow.current;
    if (
      lost !== undefined &&
      rowOf(group.current, lost) === undefined &&
      !(group.current?.contains(document.activeElement) ?? false)
    ) {
      focusedRow.current = undefined;
      group.current?.querySelector<HTMLElement>('[data-add-record]')?.focus();
    }
  });

  const commit =
    (record: Held, part: RecordPart) =>
    (text: string): void => {
      const next = editedRecord(kind, record, part, text);
      if (next === undefined) {
        return;
      }
      if (!isDraft(record)) {
        dispatch(kind.replace(next));
        return;
      }
      dispatch(kind.add(next));
      if (
        kind
          .held(modelStore.getState().present)
          .some(({ id }) => id === next.id)
      ) {
        setDraft(undefined);
      }
    };

  const left = (event: FocusEvent<HTMLElement>): void => {
    const row = event.currentTarget;
    if (
      row.contains(event.relatedTarget) ||
      [
        ...row.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
          'input, textarea',
        ),
      ].some(({ value }) => value !== '')
    ) {
      return;
    }
    setDraft(undefined);
  };

  const unlink = (record: Held, index: number): void => {
    const body = group.current?.closest(`.${styles.body}`);
    focus.current = {
      kind: 'unlinked',
      index,
      body,
      scrolled: body?.scrollTop ?? 0,
    };
    dispatch(target.unlink(record));
    const kept = kind
      .held(modelStore.getState().present)
      .some(({ id }) => id === record.id);
    const named = `${kind.noun} ${quoted(recordLabel(record), recordQuoteLength)}`;
    announce(
      kept
        ? `Unlinked ${named}. It stays on its other references.`
        : `Removed ${named}. Nothing else used it. Undo restores it.`,
    );
  };

  const tracked = (event: FocusEvent<HTMLDivElement>): void => {
    if (event.type === 'focus') {
      focusedRow.current =
        document.activeElement?.closest<HTMLElement>(rowSelector)?.dataset[
          'recordRow'
        ];
    } else if (
      event.target.isConnected &&
      !event.currentTarget.contains(event.relatedTarget)
    ) {
      focusedRow.current = undefined;
    }
  };

  return (
    <fieldset className={styles.records} ref={group}>
      <legend>{target.heading}</legend>
      <div className={styles.recordBody} onBlur={tracked} onFocus={tracked}>
        {rows.map((record, index) => (
          <RecordRow
            draft={isDraft(record)}
            held={held}
            key={record.id}
            kind={kind}
            name={`${kind.title} ${String(index + 1)}`}
            onBlur={left}
            onChange={onChange}
            onCommit={(part) => commit(record, part)}
            onRefused={(field, refusal) => {
              onRefused([[recordFieldName(field), refusal]]);
            }}
            onStatus={(status) => {
              if (isDraft(record)) {
                setDraft({ ...record, status });
                onRefused(
                  [...refusals].flatMap(([field, refusal]) =>
                    isRecordField(field, kind.noun) &&
                    recordFieldIn(field, kind.noun)?.recordId === record.id
                      ? [[field, { ...refusal, status }] as const]
                      : [],
                  ),
                );
              } else {
                dispatch(kind.setStatus(record, status));
              }
            }}
            onRemove={() => {
              if (isDraft(record)) {
                focus.current = { kind: 'add' };
                setDraft(undefined);
              } else {
                unlink(record, index);
              }
            }}
            elsewhere={target.elsewhere(record, threats)}
            record={record}
          />
        ))}
        <div className={styles.addLink}>
          <button
            aria-label={`Add ${kind.noun}`}
            className={styles.recordAction}
            data-add-record
            onClick={() => {
              if (drafting) {
                focusTarget(group.current, {
                  kind: 'text',
                  recordId: draft.id,
                })?.focus();
                return;
              }
              const opened = target.attach(kind.fresh());
              focus.current = { kind: 'text', recordId: opened.id };
              setDraft(opened);
            }}
            type="button"
          >
            <PlusIcon aria-hidden="true" />
            Add
          </button>
          {linkable.length > 0 && (
            <LinkExisting
              linkable={linkable}
              noun={kind.noun}
              onLink={(record) => {
                dispatch(target.link(record));
                focus.current = { kind: 'text', recordId: record.id };
              }}
            />
          )}
        </div>
      </div>
    </fieldset>
  );
}

type LinkExistingProps<Held extends ThreatRecord> = {
  readonly noun: string;
  readonly linkable: readonly {
    readonly record: Held;
    readonly text: OptionText;
  }[];
  readonly onLink: (record: Held) => void;
};

function LinkExisting<Held extends ThreatRecord>({
  noun,
  linkable,
  onLink,
}: LinkExistingProps<Held>) {
  const [chosen, setChosen] = useState<string | undefined>(undefined);
  const offered = linkable.find(({ record }) => record.id === chosen);
  const reasonId = useId();
  const texts = new Map<string, OptionText>(
    linkable.map(({ record, text }) => [record.id, text]),
  );

  return (
    <div className={styles.existing}>
      <EnumField
        label={`Existing ${noun}`}
        labelOf={(id) => texts.get(id) ?? id}
        onCommit={setChosen}
        options={linkable.map(({ record }) => record.id)}
        placeholder={`Existing ${noun}`}
        shownLabel=""
        value={offered?.record.id}
      />
      <button
        aria-describedby={offered === undefined ? reasonId : undefined}
        aria-disabled={offered === undefined}
        aria-label={`Link existing ${noun}`}
        className={styles.recordAction}
        onClick={() => {
          if (offered !== undefined) {
            onLink(offered.record);
            setChosen(undefined);
          }
        }}
        type="button"
      >
        <Link2Icon aria-hidden="true" />
        Link
      </button>
      {offered === undefined && (
        <VisuallyHidden id={reasonId}>
          {`Choose an existing ${noun} first.`}
        </VisuallyHidden>
      )}
    </div>
  );
}

type RecordRowProps<Held extends ThreatRecord> = {
  readonly kind: RecordKind<Held>;
  readonly record: Held;
  readonly elsewhere: string | undefined;
  readonly name: string;
  readonly draft: boolean;
  readonly held: HeldText | undefined;
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

function RecordRow<Held extends ThreatRecord>({
  kind,
  record,
  elsewhere,
  name,
  draft,
  held,
  onBlur,
  onChange,
  onCommit,
  onRefused,
  onStatus,
  onRemove,
}: RecordRowProps<Held>) {
  const sharedId = useId();
  const heldField = recordFieldIn(held?.field, kind.noun);
  const heldIn = (part: RecordPart): string | undefined =>
    heldField?.recordId === record.id && heldField.part === part
      ? held?.text
      : undefined;
  const shownLabel = (part: RecordPart): string =>
    kind.parts.length === 1 ? '' : part === 'title' ? 'Title' : 'Description';
  const fieldProps = (part: RecordPart) => ({
    held: heldIn(part),
    label:
      kind.parts.length === 1
        ? name
        : `${name} ${shownLabel(part).toLowerCase()}`,
    shownLabel: shownLabel(part),
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

  return (
    <div
      className={styles.record}
      data-record-row={record.id}
      onBlur={draft ? onBlur : undefined}
    >
      <fieldset className={styles.recordFields}>
        <legend className={styles.recordName}>{name}</legend>
        {kind.parts.map((part) =>
          part === 'title' ? (
            <TextField key={part} {...fieldProps(part)} />
          ) : (
            <ProseField compact key={part} {...fieldProps(part)} />
          ),
        )}
        <div className={styles.recordState}>
          <EnumField
            label={`${name} status`}
            onCommit={onStatus}
            options={kind.statuses}
            shownLabel=""
            value={record.status}
          />
          <button
            aria-describedby={elsewhere === undefined ? undefined : sharedId}
            aria-label={`${draft ? 'Discard' : 'Unlink'} ${name.toLowerCase()}`}
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
            {draft ? 'Discard' : 'Unlink'}
          </button>
        </div>
        {elsewhere !== undefined && (
          <p className={styles.shared} id={sharedId}>
            {elsewhere}
          </p>
        )}
      </fieldset>
    </div>
  );
}

function rowOf(
  group: HTMLFieldSetElement | null,
  recordId: string,
): HTMLElement | undefined {
  return [...(group?.querySelectorAll<HTMLElement>(rowSelector) ?? [])].find(
    (row) => row.dataset['recordRow'] === recordId,
  );
}

function focusTarget(
  group: HTMLFieldSetElement | null,
  focus: FocusRequest,
): HTMLElement | null | undefined {
  if (focus.kind === 'text') {
    return rowOf(group, focus.recordId)?.querySelector<HTMLElement>(
      'input, textarea',
    );
  }
  const add = group?.querySelector<HTMLElement>('[data-add-record]');
  if (focus.kind === 'add') {
    return add;
  }
  const unlinks = group?.querySelectorAll<HTMLElement>('[data-unlink-record]');
  return unlinks?.[focus.index] ?? unlinks?.[focus.index - 1] ?? add;
}
