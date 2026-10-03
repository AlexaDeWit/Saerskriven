import { elementsById, type Element, type ElementId } from '@saerskriven/model';
import { useRef, useState } from 'react';
import { useTranslator } from '../messages/locale.js';
import { EnumField } from '../ui/enum-field.js';
import { TextField, type RefusedDraft } from '../ui/text-field.js';
import { distinctLabels } from './distinct-labels.js';
import styles from './element-properties.module.css';
import { labelledElement } from './threats.js';

const flags = ['not-recorded', 'yes', 'no'] as const;

const answers = ['yes', 'no'] as const;

const recording = ['not-recorded', 'recorded'] as const;

type TextFact = 'privilege-level' | 'protocol';

type Relationship =
  | 'crossed-trust-boundaries'
  | 'contained-elements'
  | 'crossing-flows';

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

/** A flag the model always holds, so it offers Yes and No and nothing unknown. */
export function RequiredBooleanProperty({
  label,
  value,
  onCommit,
}: Field<boolean>) {
  const { t } = useTranslator();

  return (
    <EnumField
      label={label}
      labelOf={(option) => t(flagMessages[option])}
      value={value ? 'yes' : 'no'}
      options={answers}
      onCommit={(choice) => {
        onCommit(choice === 'yes');
      }}
    />
  );
}

/** An optional text fact retains explicit empty text and reports invalid drafts. */
export function TextProperty({
  fact,
  value,
  onCommit,
  held,
  onRefused,
}: Omit<Field<string | undefined>, 'label'> & {
  readonly fact: TextFact;
  readonly held?: string;
  readonly onRefused: (draft: RefusedDraft | undefined) => void;
}) {
  const { t } = useTranslator();

  return (
    <div className={styles.group}>
      <EnumField
        label={t(`fields.recording-of-${fact}`)}
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
          label={(speak) => speak(`fields.${fact}`)}
          value={value}
          held={held}
          onCommit={onCommit}
          onRefused={onRefused}
        />
      )}
    </div>
  );
}

/**
 * Edits ordered relationship assertions using only valid targets, retaining
 * duplicates until explicitly removed. `elements` is the diagram's, which name
 * a flow left unlabelled by its ends.
 */
export function RelationshipProperty({
  relationship,
  value,
  choices,
  elements,
  onCommit,
}: Omit<Field<ElementId[] | undefined>, 'label'> & {
  readonly relationship: Relationship;
  readonly choices: readonly Element[];
  readonly elements: readonly Element[];
}) {
  const group = useRef<HTMLFieldSetElement>(null);
  const [chosen, setChosen] = useState<ElementId | undefined>();
  const { t } = useTranslator();
  const options = choices.map((element) => element.id);
  const addition =
    chosen !== undefined && options.includes(chosen) ? chosen : options[0];
  const known = elementsById(elements);
  const labelled = distinctLabels(
    choices.map((element) => labelledElement(element, known, t)),
  );
  const labelOf = (id: ElementId) => labelled.get(id) ?? id;

  return (
    <fieldset className={styles.relationship} ref={group}>
      <legend>{t(`fields.${relationship}`)}</legend>
      <EnumField
        label={t(`fields.recording-of-${relationship}`)}
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
                label={t(`fields.item-of-${relationship}`, {
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
                aria-label={t(`fields.remove-from-${relationship}`, {
                  number: index + 1,
                })}
                onClick={() => {
                  onCommit(value.filter((_, at) => at !== index));
                  requestAnimationFrame(() => {
                    focusAfterRemoval(group.current, index);
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
                label={t(`fields.add-to-${relationship}`)}
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

function focusAfterRemoval(
  group: HTMLFieldSetElement | null,
  index: number,
): void {
  const buttons = group?.querySelectorAll<HTMLButtonElement>(
    '[data-remove-relationship]',
  );
  const target =
    buttons?.[index] ??
    buttons?.[index - 1] ??
    group?.querySelector<HTMLButtonElement>('[data-add-relationship]');
  target?.focus();
}
