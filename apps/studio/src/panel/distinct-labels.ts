import type { OptionText } from '../ui/enum-field.js';

/** One choice a listbox offers: its id, what it is called, and whether that name is a stand-in. */
export type LabelledChoice = {
  readonly id: string;
  readonly label: string;
  readonly unnamed: boolean;
};

/**
 * Option labels a person can tell apart. A stand-in name or a repeated name
 * carries its id as a suffix, and where the whole labels still collide after
 * normalization every one takes a numbered prefix.
 */
export function distinctLabels(
  choices: readonly LabelledChoice[],
): ReadonlyMap<string, OptionText> {
  const counts = new Map<string, number>();
  for (const { label } of choices) {
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const texts = choices.map(({ id, label, unnamed }): OptionText =>
    unnamed || (counts.get(label) ?? 0) > 1
      ? { label, suffix: `(${id})` }
      : { label },
  );
  const distinct =
    new Set(
      texts.map((text) =>
        optionName(text).normalize('NFC').replace(/\s+/gu, ' ').trim(),
      ),
    ).size === choices.length;
  return new Map(
    choices.map(({ id }, index) => [
      id,
      distinct
        ? texts[index]
        : {
            ...texts[index],
            label: `${String(index + 1)}: ${texts[index].label}`,
          },
    ]),
  );
}

/** The accessible name an option drawn from `text` carries. */
export function optionName({ label, suffix }: OptionText): string {
  return suffix === undefined ? label : `${label} ${suffix}`;
}
