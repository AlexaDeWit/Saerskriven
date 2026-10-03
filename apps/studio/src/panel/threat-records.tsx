import { PlusIcon } from '@radix-ui/react-icons';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
} from 'react';
import {
  announce,
  excerpt,
  recordQuoteLength,
} from '../canvas/announcements.js';
import { useTranslator } from '../messages/locale.js';
import { dispatch, modelStore, useModelStore } from '../store/store.js';
import { marked, markedWithin } from './marked.js';
import { PickExisting } from './pick-existing.js';
import { RecordRow, type HeldText } from './record-row.js';
import {
  editedRecord,
  isRecordField,
  linkableRecords,
  recordFieldIn,
  recordFieldName,
  recordLabel,
  type RecordFieldName,
  type RecordKind,
  type RecordPart,
  type RecordTarget,
  type ThreatRecord,
} from './records.js';
import type { RefusedText } from './refusals.js';
import { useShownOrder } from './shown-order.js';
import styles from './threat-panel.module.css';

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
  | { readonly kind: 'row'; readonly recordId: string }
  | { readonly kind: 'add' }
  | {
      readonly kind: 'unlinked';
      readonly index: number;
      readonly body: Element | null | undefined;
      readonly scrolled: number;
    };

/**
 * The records of one kind linked to one target, a threat or the model. Add
 * opens an empty row that becomes a record on its first commit and goes when
 * left empty. A row that returns while the group is mounted takes its old
 * slot back. On a threat the heading counts the records, every record starts
 * folded and one opened stays open while the group is mounted, and a new
 * record is marked and announced as added once it is kept. The model's
 * records are cards, open, as they were before threats folded theirs.
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
  const translator = useTranslator();
  const { t } = translator;
  const records = all.filter(target.holds);
  const noun = t(kind.nounMessage);
  const linkable = linkableRecords(kind, all, target, threats, translator);
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
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => {
    const heldField = recordFieldIn(held?.field, kind.noun);
    return new Set(
      heldField === undefined || heldField.pending ? [] : [heldField.recordId],
    );
  });
  const [added, setAdded] = useState<ReadonlySet<string>>(() => new Set());
  const focus = useRef<FocusRequest | undefined>(undefined);
  const focusedRow = useRef<string | undefined>(undefined);
  const drafting =
    draft !== undefined && !records.some(({ id }) => id === draft.id);
  const listed = drafting ? [...records, draft] : records;
  const isDraft = (record: Held): boolean => drafting && record.id === draft.id;
  const rows = useShownOrder(listed);
  const shown = new Set<string>(rows.map(({ id }) => id));
  const refused = new Set(
    [...refusals.keys()].flatMap(
      (field) => recordFieldIn(field, kind.noun)?.recordId ?? [],
    ),
  );
  const isOpen = (record: Held): boolean =>
    !target.inThreat || isDraft(record) || opened.has(record.id);
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
      markedWithin(group.current, 'recordRow', lost) === undefined &&
      !(group.current?.contains(document.activeElement) ?? false)
    ) {
      focusedRow.current = undefined;
      group.current?.querySelector<HTMLElement>('[data-add-record]')?.focus();
    }
  });

  const commit =
    (record: Held, part: RecordPart, position: number) =>
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
        if (target.inThreat) {
          setOpened((current) => withId(current, next.id));
          setAdded((current) => withId(current, next.id));
          const { addedSaid } = kind;
          announce((speak) => speak(addedSaid, { number: position }));
        }
      }
    };

  const toggle = (record: Held): void => {
    if (isOpen(record) && refused.has(record.id)) {
      return;
    }
    setOpened((current) =>
      current.has(record.id)
        ? new Set([...current].filter((id) => id !== record.id))
        : withId(current, record.id),
    );
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
    const label = excerpt(recordLabel(record), recordQuoteLength);
    const { nounMessage } = kind;
    announce((speak) => {
      const named = speak('canvas.record-named', {
        kind: speak(nounMessage),
        label,
      });
      return kept
        ? speak('canvas.record-unlinked', { record: named })
        : speak('canvas.record-removed', { record: named });
    });
  };

  const tracked = (event: FocusEvent<HTMLDivElement>): void => {
    if (event.type === 'focus') {
      focusedRow.current = document.activeElement?.closest<HTMLElement>(
        marked.recordRow,
      )?.dataset['recordRow'];
    } else if (
      event.target.isConnected &&
      !event.currentTarget.contains(event.relatedTarget)
    ) {
      focusedRow.current = undefined;
    }
  };

  return (
    <fieldset className={styles.records} ref={group}>
      <legend>
        {t(target.heading)}
        {target.inThreat && (
          <>
            {' '}
            <span className={styles.count}>{records.length}</span>
          </>
        )}
      </legend>
      <div className={styles.recordBody} onBlur={tracked} onFocus={tracked}>
        {rows.map((record, index) => (
          <RecordRow
            added={added.has(record.id)}
            draft={isDraft(record)}
            elsewhere={target.elsewhere(record, threats, translator)}
            elsewhereCounted={target.elsewhereCounted(
              record,
              threats,
              translator,
            )}
            foldable={target.inThreat && !isDraft(record)}
            held={held}
            key={record.id}
            kind={kind}
            layout={target.inThreat ? 'section' : 'card'}
            name={t('fields.record-name', {
              kind: t(kind.title),
              number: index + 1,
            })}
            open={isOpen(record)}
            position={index + 1}
            onBlur={left}
            onChange={onChange}
            onCommit={(part) => commit(record, part, index + 1)}
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
            onToggle={() => {
              toggle(record);
            }}
            record={record}
          />
        ))}
        <div className={styles.addLink}>
          <button
            aria-label={t('fields.add-record', {
              kind: t(kind.nounMessage),
            })}
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
              const fresh = target.attach(kind.fresh());
              focus.current = { kind: 'text', recordId: fresh.id };
              setDraft(fresh);
            }}
            type="button"
          >
            <PlusIcon aria-hidden="true" />
            {t('panel.add')}
          </button>
          {linkable.length > 0 && (
            <PickExisting
              actionLabel={t('fields.link-existing-record', { kind: noun })}
              actionText={t('panel.link')}
              choices={linkable.map(({ record, text }) => ({
                id: record.id,
                text,
              }))}
              fieldLabel={t('fields.existing-record', { kind: noun })}
              onPick={(id) => {
                const picked = linkable.find(
                  ({ record }) => record.id === id,
                )?.record;
                if (picked === undefined) {
                  return;
                }
                dispatch(target.link(picked));
                focus.current = { kind: 'row', recordId: picked.id };
              }}
              reason={t('fields.choose-existing-first', { kind: noun })}
            />
          )}
        </div>
      </div>
    </fieldset>
  );
}

function focusTarget(
  group: HTMLFieldSetElement | null,
  focus: FocusRequest,
): HTMLElement | null | undefined {
  if (focus.kind === 'text' || focus.kind === 'row') {
    const row = markedWithin(group, 'recordRow', focus.recordId);
    return (
      (focus.kind === 'row'
        ? row?.querySelector<HTMLElement>('[data-record-toggle]')
        : undefined) ?? row?.querySelector<HTMLElement>('input, textarea')
    );
  }
  const add = group?.querySelector<HTMLElement>('[data-add-record]');
  if (focus.kind === 'add') {
    return add;
  }
  const rows = [
    ...(group?.querySelectorAll<HTMLElement>(marked.recordRow) ?? []),
  ];
  const row =
    rows.at(focus.index) ??
    (focus.index > 0 ? rows.at(focus.index - 1) : undefined);
  return (
    row?.querySelector<HTMLElement>('[data-unlink-record]') ??
    row?.querySelector<HTMLElement>('[data-record-toggle]') ??
    add
  );
}

function withId(ids: ReadonlySet<string>, id: string): ReadonlySet<string> {
  return ids.has(id) ? ids : new Set([...ids, id]);
}
