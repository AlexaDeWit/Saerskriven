import { useCallback, useId, useState } from 'react';
import { Select } from 'radix-ui';

import styles from './enum-field.module.css';

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

function listed(named: string, label: string, selected: boolean) {
  return (
    <Select.Item
      className={styles.item}
      key={named}
      value={named}
      tabIndex={selected ? 0 : -1}
    >
      <Select.ItemText>
        <span className={styles.text}>{label}</span>
      </Select.ItemText>
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

/** What an {@link EnumField} shows, what it offers, and where an edit goes. */
export type EnumFieldProps<Value extends string> = {
  readonly label: string;
  readonly value: Value;
  readonly options: readonly Value[];
  readonly labelOf?: (option: Value) => string;
  readonly groupOf?: (option: Value) => string;
  readonly onCommit: (chosen: Value) => void;
};

/**
 * A labelled listbox that commits one choice. Its overlay stays in the DOM
 * of the containing landmark, and is placed and sized within the box the
 * field scrolls in, so it opens clear of whatever is drawn over that box.
 */
export function EnumField<Value extends string>({
  label,
  value,
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
  const item = (option: Value) =>
    listed(option, labelOf?.(option) ?? option, option === value);

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={triggerId}>
        {label}
      </label>
      <Select.Root
        onValueChange={enumCommitter(options, onCommit)}
        value={value}
      >
        <Select.Trigger className={styles.trigger} id={triggerId} ref={bound}>
          <Select.Value />
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
