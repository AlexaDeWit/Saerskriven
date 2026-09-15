import type { OptionText } from '../ui/enum-field.js';

/** One choice a listbox offers: its id, what it is called, and whether that name is a stand-in. */
export type LabelledChoice = {
  readonly id: string;
  readonly label: string;
  readonly unnamed: boolean;
};

/**
 * Option labels a person can tell apart, each beside the choice it labels
 * and in the order given. A stand-in name or a repeated name carries its id
 * as a suffix, and where the whole labels still collide after normalization
 * every one takes a numbered prefix.
 */
export function distinctTexts<Choice extends LabelledChoice>(
  choices: readonly Choice[],
): readonly (readonly [Choice, OptionText])[] {
  const repeated = (label: string): boolean =>
    choices.filter((choice) => choice.label === label).length > 1;
  const texts = choices.map(({ id, label, unnamed }): OptionText =>
    unnamed || repeated(label) ? { label, suffix: `(${id})` } : { label },
  );
  const distinct =
    new Set(
      texts.map((text) =>
        optionName(text).normalize('NFC').replace(/\s+/gu, ' ').trim(),
      ),
    ).size === choices.length;
  return choices.map((choice, index) => [
    choice,
    distinct
      ? texts[index]
      : {
          ...texts[index],
          label: `${String(index + 1)}: ${texts[index].label}`,
        },
  ]);
}

/** {@link distinctTexts} by the id of the choice each labels. */
export function distinctLabels(
  choices: readonly LabelledChoice[],
): ReadonlyMap<string, OptionText> {
  return new Map(distinctTexts(choices).map(([{ id }, text]) => [id, text]));
}

/** The accessible name an option drawn from `text` carries. */
export function optionName({ label, suffix }: OptionText): string {
  return suffix === undefined ? label : `${label} ${suffix}`;
}
