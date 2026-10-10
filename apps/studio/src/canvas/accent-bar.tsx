import { accentParts, accentSchema, type Accent } from '@saerskriven/model';
import { IconCommandButton } from '../commands/command-button.js';
import { accentCommands } from '../commands/registry.js';
import { useTranslator } from '../messages/locale.js';
import { selectionAccent } from '../store/selectors.js';
import { useModelStore } from '../store/store.js';
import styles from './accent-bar.module.css';

const strengths = [true, false].map((strong) =>
  accentSchema.options.filter(
    (accent) => accentParts[accent].strong === strong,
  ),
);

const glyph = (accent: Accent | undefined) => (
  <svg
    aria-hidden="true"
    className={styles.glyph}
    data-slot={accent === undefined ? undefined : accentParts[accent].slot}
    data-strength={
      accent === undefined
        ? undefined
        : accentParts[accent].strong
          ? 'strong'
          : 'light'
    }
    viewBox="0 0 24 24"
  >
    <rect className={styles.shape} x="3" y="6" width="18" height="12" />
  </svg>
);

/**
 * The accent bar: no accent, the four strong keys and the four light ones,
 * each drawn as an element holding it. A press gives the key to every
 * selected element and flow that takes one. The pressed swatch is the one
 * they all hold, none is pressed where they differ, and the row is disabled
 * while the selection holds nothing that takes an accent.
 */
export function AccentBar() {
  const shown = useModelStore(selectionAccent);
  const { t } = useTranslator();
  const inactive = shown === 'inactive';

  return (
    <section
      aria-label={t('commands.group-accent')}
      className={styles.row}
      data-testid="accent-bar"
    >
      <IconCommandButton
        className={styles.swatch}
        command="accent-none"
        disabled={inactive}
        pressed={shown === 'none'}
        side="bottom"
      >
        {glyph(undefined)}
      </IconCommandButton>
      {strengths.map((accents) => (
        <span className={styles.strength} key={accents.join(' ')}>
          {accents.map((accent) => (
            <IconCommandButton
              className={styles.swatch}
              command={accentCommands[accent]}
              disabled={inactive}
              key={accent}
              pressed={shown === accent}
              side="bottom"
            >
              {glyph(accent)}
            </IconCommandButton>
          ))}
        </span>
      ))}
    </section>
  );
}
