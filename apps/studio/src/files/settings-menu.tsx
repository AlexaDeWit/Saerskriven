import {
  followBrowser,
  languageChoices,
  languageNames,
  type LanguageChoice,
} from '../language-preference.js';
import type { StudioTranslator } from '../messages/catalogues.js';
import { colourModeMessages } from '../messages/enum-labels.js';
import { useLanguage, useTranslator } from '../messages/locale.js';
import { colourModes, type ColourMode } from '../theme-preference.js';
import styles from './menu.module.css';
import { RadioChoices } from './radio-choices.js';
import { Submenu } from './submenu.js';

/** The colour mode submenu: System, Light or Dark. */
export function AppearanceMenu({
  mode,
  onChange,
}: {
  readonly mode: ColourMode;
  readonly onChange?: (mode: ColourMode) => void;
}) {
  const { t } = useTranslator();
  const heading = t('menu.appearance');
  const chosen = t(colourModeMessages[mode]);

  return (
    <Submenu
      label={t('menu.appearance-chosen', { mode: chosen })}
      trigger={
        <>
          <span>{heading}</span>
          <span aria-hidden="true" className={styles.chord}>
            {chosen}
          </span>
        </>
      }
    >
      <RadioChoices
        choices={colourModes.map((choice) => ({
          value: choice,
          label: t(colourModeMessages[choice]),
        }))}
        label={heading}
        onChoose={(next) => {
          onChange?.(next);
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
  const chosen = nameOf(choice, translator);

  return (
    <Submenu
      label={translator.t('menu.language-chosen', { language: chosen })}
      trigger={
        <>
          <span>{heading}</span>
          <span aria-hidden="true" className={styles.chord}>
            {chosen}
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

function nameOf(choice: LanguageChoice, translator: StudioTranslator): string {
  return choice === followBrowser
    ? translator.t('shell.follow-browser')
    : languageNames[choice];
}
