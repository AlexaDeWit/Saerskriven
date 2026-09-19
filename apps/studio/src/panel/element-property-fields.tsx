import type { Element, ElementId } from '@saerskriven/model';
import { useRef, useState } from 'react';
import { useTranslator } from '../messages/locale.js';
import type { Said } from '../messages/said.js';
import { EnumField } from '../ui/enum-field.js';
import { TextField, type RefusedDraft } from '../ui/text-field.js';
import { distinctLabels } from './distinct-labels.js';
import styles from './element-properties.module.css';
import { elementLabel } from './threats.js';

const flags = ['not-recorded', 'yes', 'no'] as const;

const recording = ['not-recorded', 'recorded'] as const;

const flagMessages = {
  'not-recorded': 'enums.not-recorded',
  yes: 'enums.yes',
  no: 'enums.no',
  recorded: 'enums.recorded',
} as const;

type Field<Value> = {
  readonly label: string;
  readonly value: Value;
  readonly onCommit: (value: Value) => void;
};

/** A security flag with unknown distinct from an explicit negative. */
export function BooleanProperty({
  label,
  value,
  onCommit,
}: Field<boolean | undefined>) {
  const { t } = useTranslator();

  return (
    <EnumField
      label={label}
      labelOf={(option) => t(flagMessages[option])}
      value={value === undefined ? 'not-recorded' : value ? 'yes' : 'no'}
      options={flags}
      onCommit={(choice) => {
        onCommit(choice === 'not-recorded' ? undefined : choice === 'yes');
      }}
    />
  );
}

/** An optional text fact retains explicit empty text and reports invalid drafts. */
export function TextProperty({
  label,
  value,
  onCommit,
  held,
  onRefused,
}: Omit<Field<string | undefined>, 'label'> & {
  readonly label: Said;
  readonly held?: string;
  readonly onRefused: (draft: RefusedDraft | undefined) => void;
}) {
  const { t } = useTranslator();

  return (
    <div className={styles.group}>
      <EnumField
        label={t('fields.recording-of', { label: label(t) })}
        labelOf={(option) => t(flagMessages[option])}
        value={value === undefined ? 'not-recorded' : 'recorded'}
        options={recording}
        onCommit={(choice) => {
          onRefused(undefined);
          onCommit(choice === 'not-recorded' ? undefined : (value ?? ''));
        }}
      />
      {value !== undefined && (
        <TextField
          label={label}
          value={value}
          held={held}
          onCommit={onCommit}
          onRefused={onRefused}
        />
      )}
    </div>
  );
}

/** Edits ordered relationship assertions using only valid targets, retaining duplicates until explicitly removed. */
export function RelationshipProperty({
  label,
  lowerLabel,
  value,
  choices,
  onCommit,
}: Field<ElementId[] | undefined> & {
  readonly lowerLabel: string;
  readonly choices: readonly Element[];
}) {
  const group = useRef<HTMLFieldSetElement>(null);
  const [chosen, setChosen] = useState<ElementId | undefined>();
  const { t } = useTranslator();
  const options = choices.map((element) => element.id);
  const addition =
    chosen !== undefined && options.includes(chosen) ? chosen : options[0];
  const labelled = distinctLabels(
    choices.map((element) => ({
      id: element.id,
      label: elementLabel(element, t),
      unnamed: element.name === '',
    })),
  );
  const labelOf = (id: ElementId) => labelled.get(id) ?? id;

  return (
    <fieldset className={styles.relationship} ref={group}>
      <legend>{label}</legend>
      <EnumField
        label={t('fields.recording-of', { label })}
        labelOf={(option) => t(flagMessages[option])}
        value={value === undefined ? 'not-recorded' : 'recorded'}
        options={recording}
        onCommit={(choice) => {
          onCommit(choice === 'not-recorded' ? undefined : (value ?? []));
        }}
      />
      {value !== undefined && (
        <>
          {value.length === 0 && (
            <p className={styles.hint}>{t('panel.no-relationships')}</p>
          )}
          {value.map((id, index) => (
            <div className={styles.relationshipRow} key={index}>
              <EnumField
                label={t('fields.relationship-item', {
                  label,
                  number: index + 1,
                })}
                value={id}
                options={options}
                labelOf={labelOf}
                onCommit={(replacement) => {
                  onCommit(
                    value.map((held, at) =>
                      at === index ? replacement : held,
                    ),
                  );
                }}
              />
              <button
                type="button"
                data-remove-relationship
                aria-label={t('fields.remove-relationship', {
                  label: lowerLabel,
                  number: index + 1,
                })}
                onClick={() => {
                  onCommit(value.filter((_, at) => at !== index));
                  requestAnimationFrame(() => {
                    const buttons =
                      group.current?.querySelectorAll<HTMLButtonElement>(
                        '[data-remove-relationship]',
                      );
                    const target =
                      buttons?.[index] ??
                      buttons?.[index - 1] ??
                      group.current?.querySelector<HTMLButtonElement>(
                        '[data-add-relationship]',
                      );
                    target?.focus();
                  });
                }}
              >
                {t('panel.remove')}
              </button>
            </div>
          ))}
          {addition === undefined ? (
            <p className={styles.hint}>{t('panel.no-valid-targets')}</p>
          ) : (
            <div className={styles.relationshipRow}>
              <EnumField
                label={t('fields.add-to-relationship', { label: lowerLabel })}
                value={addition}
                options={options}
                labelOf={labelOf}
                onCommit={setChosen}
              />
              <button
                type="button"
                data-add-relationship
                onClick={() => {
                  onCommit([...value, addition]);
                }}
              >
                {t('panel.add-relationship')}
              </button>
            </div>
          )}
        </>
      )}
    </fieldset>
  );
}
