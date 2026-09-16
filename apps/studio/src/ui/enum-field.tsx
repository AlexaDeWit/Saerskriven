import { useCallback, useId, useState } from 'react';
import { Select } from 'radix-ui';

import styles from './enum-field.module.css';

/**
 * How an option reads. The accessible name is `label`, a space and `suffix`.
 * The suffix is drawn on a line of its own, so it stays visible when a long
 * label is cut short. `detail` is a line under both that describes the
 * option without naming it.
 */
export type OptionText = {
  readonly label: string;
  readonly suffix?: string;
  readonly detail?: string;
};

/** Narrows a primitive choice to the declared options before committing. */
export function enumCommitter<Value extends string>(
  options: readonly Value[],
  onCommit: (chosen: Value) => void,
): (chosen: string) => void {
  return (chosen) => {
    const named = options.find((option) => option === chosen);
    if (named !== undefined) {
      onCommit(named);
    }
  };
}

function scrollBox(element: Element | null): Element | null {
  const parent = element?.parentElement ?? null;
  return parent === null || getComputedStyle(parent).overflowY !== 'visible'
    ? parent
    : scrollBox(parent);
}

function Listed({
  value,
  text,
  tabStop,
}: {
  readonly value: string;
  readonly text: OptionText;
  readonly tabStop: boolean;
}) {
  const detailId = useId();
  return (
    <Select.Item
      aria-describedby={text.detail === undefined ? undefined : detailId}
      className={styles.item}
      value={value}
      tabIndex={tabStop ? 0 : -1}
    >
      <span className={styles.body}>
        <Select.ItemText>
          <span className={styles.text} data-option-label>
            {text.label}
          </span>
          {text.suffix !== undefined && (
            <>
              {' '}
              <span className={styles.suffix} data-option-suffix>
                {text.suffix}
              </span>
            </>
          )}
        </Select.ItemText>
        {text.detail !== undefined && (
          <span className={styles.detail} data-option-detail id={detailId}>
            {text.detail}
          </span>
        )}
      </span>
      <Select.ItemIndicator className={styles.indicator}>
        ✓
      </Select.ItemIndicator>
    </Select.Item>
  );
}

function grouped<Value extends string>(
  options: readonly Value[],
  groupOf: (option: Value) => string,
): (readonly [string, readonly Value[]])[] {
  const groups = new Map<string, Value[]>();
  for (const option of options) {
    const name = groupOf(option);
    groups.set(name, [...(groups.get(name) ?? []), option]);
  }
  return [...groups];
}

type EnumFieldProps<Value extends string> = {
  readonly label: string;
  readonly shownLabel?: string;
  readonly value: Value | undefined;
  readonly placeholder?: string;
  readonly options: readonly Value[];
  readonly labelOf?: (option: Value) => string | OptionText;
  readonly groupOf?: (option: Value) => string;
  readonly onCommit: (chosen: Value) => void;
};

/**
 * A labelled listbox that commits one choice. `label` is the accessible name,
 * and `shownLabel` replaces the drawn label, an empty one drawing none. With
 * no `value` the trigger shows `placeholder`. The overlay stays in the
 * containing landmark and is placed within the box the field scrolls in.
 */
export function EnumField<Value extends string>({
  label,
  shownLabel,
  value,
  placeholder,
  options,
  groupOf,
  labelOf,
  onCommit,
}: EnumFieldProps<Value>) {
  const triggerId = useId();
  const [boundary, setBoundary] = useState<Element[]>([]);
  const bound = useCallback((trigger: HTMLButtonElement | null) => {
    const box = scrollBox(trigger);
    setBoundary(box === null ? [] : [box]);
  }, []);
  const item = (option: Value) => {
    const text = labelOf?.(option) ?? option;
    return (
      <Listed
        key={option}
        tabStop={option === (value ?? options.at(0))}
        text={typeof text === 'string' ? { label: text } : text}
        value={option}
      />
    );
  };

  return (
    <div className={styles.field}>
      {shownLabel !== '' && (
        <label className={styles.label} htmlFor={triggerId}>
          {shownLabel ?? label}
        </label>
      )}
      <Select.Root
        onValueChange={enumCommitter(options, onCommit)}
        value={value ?? ''}
      >
        <Select.Trigger
          aria-label={shownLabel === undefined ? undefined : label}
          className={styles.trigger}
          id={triggerId}
          ref={bound}
        >
          <Select.Value placeholder={placeholder} />
          <Select.Icon className={styles.icon}>▾</Select.Icon>
        </Select.Trigger>
        <Select.Content
          className={styles.content}
          collisionBoundary={boundary}
          position="popper"
        >
          <Select.Viewport className={styles.viewport}>
            {groupOf === undefined
              ? options.map(item)
              : grouped(options, groupOf).map(([name, members]) => (
                  <Select.Group key={name}>
                    <Select.Label className={styles.group}>{name}</Select.Label>
                    {members.map(item)}
                  </Select.Group>
                ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Root>
    </div>
  );
}
