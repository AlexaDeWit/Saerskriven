import { Link2Icon } from '@radix-ui/react-icons';
import { useId, useState } from 'react';
import { EnumField, type OptionText } from '../ui/enum-field.js';
import { VisuallyHidden } from '../ui/visually-hidden.js';
import styles from './threat-panel.module.css';

/** One thing a picker offers: the id it hands back and how the option reads. */
export type Choice<Id extends string> = {
  readonly id: Id;
  readonly text: OptionText;
};

type PickExistingProps<Id extends string> = {
  readonly choices: readonly Choice<Id>[];
  readonly fieldLabel: string;
  readonly actionLabel: string;
  readonly actionText: string;
  readonly reason: string;
  readonly onPick: (id: Id) => void;
};

/**
 * A listbox of what a group can take on, beside the control that takes it on.
 * The control stays on the Tab path while nothing is chosen and is described
 * by `reason` there. The choice is cleared once it is handed back.
 */
export function PickExisting<Id extends string>({
  choices,
  fieldLabel,
  actionLabel,
  actionText,
  reason,
  onPick,
}: PickExistingProps<Id>) {
  const [chosen, setChosen] = useState<Id | undefined>(undefined);
  const offered = choices.find((choice) => choice.id === chosen);
  const reasonId = useId();

  return (
    <div className={styles.existing}>
      <EnumField
        label={fieldLabel}
        labelOf={(id) =>
          choices.find((choice) => choice.id === id)?.text ?? { label: id }
        }
        onCommit={setChosen}
        options={choices.map((choice) => choice.id)}
        placeholder={fieldLabel}
        shownLabel=""
        value={offered?.id}
      />
      <button
        aria-describedby={offered === undefined ? reasonId : undefined}
        aria-disabled={offered === undefined}
        aria-label={actionLabel}
        className={styles.recordAction}
        onClick={() => {
          if (offered !== undefined) {
            onPick(offered.id);
            setChosen(undefined);
          }
        }}
        type="button"
      >
        <Link2Icon aria-hidden="true" />
        {actionText}
      </button>
      {offered === undefined && (
        <VisuallyHidden id={reasonId}>{reason}</VisuallyHidden>
      )}
    </div>
  );
}
