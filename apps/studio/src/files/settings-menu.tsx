import { locales } from '@saerskriven/i18n';
import { languageNames } from '../language-preference.js';
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

/** The language submenu: each locale named in its own language. */
export function LanguageMenu() {
  const translator = useTranslator();
  const [locale, choose] = useLanguage();
  const heading = translator.t('shell.language');
  const chosen = languageNames[locale];

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
        choices={locales.map((value) => ({
          value,
          label: languageNames[value],
        }))}
        label={heading}
        onChoose={choose}
        value={locale}
      />
    </Submenu>
  );
}
