import { firstRefusedCharacter, isEmptyName } from '@saerskriven/model';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react';

import { growUnlessResized, sizesFieldsToContent } from './grow-to-content.js';
import styles from './text-field.module.css';

type Draft = { readonly shown: string; readonly text: string };

/** State and validation shared by the studio's controlled text editors. */
export function useTextDraft(
  label: string,
  value: string,
  held: string | undefined,
  onCommit: (text: string) => void,
  onRefused: (refused: RefusedDraft | undefined) => void,
  refuse: (
    label: string,
    text: string,
  ) => TextRefusal | undefined = refusedText,
): {
  readonly text: string;
  readonly refusal: TextRefusal | undefined;
  readonly change: (text: string) => void;
  readonly commit: () => boolean;
} {
  const [draft, setDraft] = useState<Draft>({
    shown: value,
    text: held ?? value,
  });
  const [refusal, setRefusal] = useState<TextRefusal | undefined>(() =>
    held === undefined ? undefined : refuse(label, held),
  );
  const reported = useRef<TextRefusal | undefined>(undefined);

  if (draft.shown !== value) {
    setDraft({ shown: value, text: value });
    setRefusal(undefined);
  }

  useEffect(() => {
    if (reported.current !== refusal) {
      reported.current = refusal;
      onRefused(
        refusal === undefined
          ? undefined
          : { said: refusal.said, text: draft.text },
      );
    }
  }, [draft.text, refusal, onRefused]);

  return {
    text: draft.text,
    refusal,
    change: (text) => {
      setDraft({ shown: value, text });
    },
    commit: () => {
      const refused = refuse(label, draft.text);
      setRefusal(refused);
      if (refused === undefined) {
        onCommit(draft.text);
        return true;
      }
      return false;
    },
  };
}

/** Inline and announced forms of a validation refusal. */
export type TextRefusal = {
  readonly shown: string;
  readonly said: string;
};

/** The refused text and its announcement, retained when the editor unmounts. */
export type RefusedDraft = {
  readonly said: string;
  readonly text: string;
};

/** Identifies the first character the model refuses. */
export function refusedText(
  label: string,
  text: string,
): TextRefusal | undefined {
  const at = firstRefusedCharacter(text);
  if (at === undefined) {
    return undefined;
  }
  const before = Array.from(text.slice(0, at)).length;
  const shown = `Character ${String(before + 1)} is one the model does not accept.`;
  return { shown, said: `${label} was not saved. ${shown}` };
}

const emptyRefusal = 'A name cannot be empty.';

/** Refuses an empty name ahead of the characters {@link refusedText} refuses. */
export function refusedName(
  label: string,
  text: string,
): TextRefusal | undefined {
  return isEmptyName(text)
    ? { shown: emptyRefusal, said: `${label} was not saved. ${emptyRefusal}` }
    : refusedText(label, text);
}

type TextFieldProps = {
  readonly label: string;
  readonly shownLabel?: string;
  readonly value: string;
  readonly held?: string;
  readonly onChange?: () => void;
  readonly onCommit: (text: string) => void;
  readonly onRefused: (refused: RefusedDraft | undefined) => void;
  readonly ref?: Ref<HTMLInputElement>;
};

function Labelled({
  label,
  shownLabel,
  fieldId,
  refusalId,
  refusal,
  children,
}: {
  readonly label: string;
  readonly shownLabel: string | undefined;
  readonly fieldId: string;
  readonly refusalId: string;
  readonly refusal: TextRefusal | undefined;
  readonly children: ReactNode;
}) {
  return (
    <div className={styles.field}>
      {shownLabel !== '' && (
        <label className={styles.label} htmlFor={fieldId}>
          {shownLabel ?? label}
        </label>
      )}
      {children}
      {refusal !== undefined && (
        <p className={styles.refusal} id={refusalId}>
          {refusal.shown}
        </p>
      )}
    </div>
  );
}

function controlProps(
  label: string,
  shownLabel: string | undefined,
  fieldId: string,
  refusalId: string,
  refusal: TextRefusal | undefined,
) {
  return {
    'aria-describedby': refusal === undefined ? undefined : refusalId,
    'aria-invalid': refusal !== undefined,
    'aria-label': shownLabel === undefined ? undefined : label,
    id: fieldId,
  };
}

/**
 * Commits a single line on blur or Enter, as one undo step. `label` is the
 * accessible name and names the field in a refusal, and `shownLabel` replaces
 * the drawn label, an empty one drawing none. `held` opens the field on a
 * refused draft instead of `value`.
 */
export function TextField({
  label,
  shownLabel,
  value,
  held,
  onChange,
  onCommit,
  onRefused,
  ref,
}: TextFieldProps) {
  const fieldId = useId();
  const refusalId = useId();
  const { text, refusal, change, commit } = useTextDraft(
    label,
    value,
    held,
    onCommit,
    onRefused,
  );

  return (
    <Labelled
      fieldId={fieldId}
      label={label}
      refusal={refusal}
      refusalId={refusalId}
      shownLabel={shownLabel}
    >
      <input
        {...controlProps(label, shownLabel, fieldId, refusalId, refusal)}
        className={styles.input}
        onBlur={commit}
        onChange={(event) => {
          onChange?.();
          change(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
        }}
        ref={ref}
        type="text"
        value={text}
      />
    </Labelled>
  );
}

type ProseFieldProps = Omit<TextFieldProps, 'ref'> & {
  readonly compact?: boolean;
};

/**
 * Edits Markdown source and commits on blur, taking {@link TextField}'s
 * labels. The textarea starts at eight lines, or two when `compact`, grows
 * with its content to a bound and scrolls past it.
 */
export function ProseField({
  label,
  shownLabel,
  value,
  held,
  compact = false,
  onChange,
  onCommit,
  onRefused,
}: ProseFieldProps) {
  const fieldId = useId();
  const refusalId = useId();
  const field = useRef<HTMLTextAreaElement>(null);
  const written = useRef<string | undefined>(undefined);
  const { text, refusal, change, commit } = useTextDraft(
    label,
    value,
    held,
    onCommit,
    onRefused,
  );

  useLayoutEffect(() => {
    if (!sizesFieldsToContent()) {
      written.current = growUnlessResized(field.current, written.current);
    }
  });

  return (
    <Labelled
      fieldId={fieldId}
      label={label}
      refusal={refusal}
      refusalId={refusalId}
      shownLabel={shownLabel}
    >
      <textarea
        {...controlProps(label, shownLabel, fieldId, refusalId, refusal)}
        className={compact ? `${styles.prose} ${styles.compact}` : styles.prose}
        onBlur={commit}
        onChange={(event) => {
          onChange?.();
          change(event.target.value);
        }}
        ref={field}
        rows={compact ? 2 : 8}
        value={text}
      />
    </Labelled>
  );
}
