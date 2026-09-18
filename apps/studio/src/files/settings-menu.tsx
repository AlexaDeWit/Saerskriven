import type { Translator } from '@saerskriven/i18n';
import {
  followBrowser,
  languageChoices,
  languageNames,
  type LanguageChoice,
} from '../language-preference.js';
import type { StudioMessages } from '../messages/catalogues.js';
import { useLanguage, useTranslator } from '../messages/locale.js';
import { colourModes, type ColourMode } from '../theme-preference.js';
import styles from './menu.module.css';
import { RadioChoices } from './radio-choices.js';
import { Submenu } from './submenu.js';

const titled = (mode: ColourMode): string =>
  mode[0].toUpperCase() + mode.slice(1);

/** The colour mode submenu: System, Light or Dark. */
export function AppearanceMenu({
  mode,
  onChange,
}: {
  readonly mode: ColourMode;
  readonly onChange?: (mode: ColourMode) => void;
}) {
  return (
    <Submenu
      label={`Appearance ${mode}`}
      trigger={
        <>
          <span>Appearance</span>
          <span aria-hidden="true" className={styles.chord}>
            {titled(mode)}
          </span>
        </>
      }
    >
      <RadioChoices
        choices={colourModes.map((choice) => ({
          value: choice,
          label: titled(choice),
        }))}
        label="Appearance"
        onChoose={(chosen) => {
          onChange?.(chosen);
        }}
        value={mode}
      />
    </Submenu>
  );
}

/**
 * The language submenu: the browser's preferences, or one locale named in its
 * own language.
 */
export function LanguageMenu() {
  const translator = useTranslator();
  const [choice, choose] = useLanguage();
  const heading = translator.t('shell.language');

  return (
    <Submenu
      label={`${heading} ${nameOf(choice, translator)}`}
      trigger={
        <>
          <span>{heading}</span>
          <span aria-hidden="true" className={styles.chord}>
            {nameOf(choice, translator)}
          </span>
        </>
      }
    >
      <RadioChoices
        choices={languageChoices.map((value) => ({
          value,
          label: nameOf(value, translator),
        }))}
        label={heading}
        onChoose={choose}
        value={choice}
      />
    </Submenu>
  );
}

function nameOf(
  choice: LanguageChoice,
  translator: Translator<StudioMessages>,
): string {
  return choice === followBrowser
    ? translator.t('shell.follow-browser')
    : languageNames[choice];
}
