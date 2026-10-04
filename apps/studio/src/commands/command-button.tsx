import { useId, type MouseEventHandler, type ReactNode } from 'react';
import { useTranslator } from '../messages/locale.js';
import { ControlTooltip } from '../ui/control-tooltip.js';
import { VisuallyHidden } from '../ui/visually-hidden.js';
import { useCommandSurface } from './binding.js';
import {
  commandById,
  runCommand,
  type Command,
  type CommandId,
} from './registry.js';
import {
  hostPlatform,
  shortcutLabelText,
  shortcutText,
  type ShortcutText,
} from './shortcuts.js';
import styles from './command-button.module.css';

type CommandButtonProps = {
  readonly command: CommandId;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly children?: ReactNode;
};

type IconCommandButtonProps = {
  readonly description?: string;
  readonly command: CommandId;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly pressed?: boolean;
  readonly side?: 'top' | 'bottom';
  readonly onDoubleClick?: MouseEventHandler<HTMLButtonElement>;
  readonly children: ReactNode;
};

/**
 * A control that runs one registered command. Its chord is the `title`
 * tooltip, `aria-keyshortcuts` and the accessible description. `children`
 * replaces the registry's label.
 */
export function CommandButton({
  command,
  className,
  disabled,
  children,
}: CommandButtonProps) {
  const description = useId();
  const { t } = useTranslator();
  const { label, chord, keyShortcuts, press } = usePressed(command);

  return (
    <>
      <button
        aria-describedby={description}
        aria-keyshortcuts={keyShortcuts}
        className={className}
        disabled={disabled}
        onClick={press}
        title={chord}
        type="button"
      >
        {children ?? label}
      </button>
      <VisuallyHidden id={description}>
        {t('commands.button-shortcut', { chord })}
      </VisuallyHidden>
    </>
  );
}

/**
 * An icon control named by the registry's label, with its chord in a Radix
 * tooltip opening on `side`, and `description` read ahead of the chord.
 */
export function IconCommandButton({
  description,
  command,
  className,
  disabled,
  pressed,
  side,
  onDoubleClick,
  children,
}: IconCommandButtonProps) {
  const descriptionId = useId();
  const { t } = useTranslator();
  const { label, chord, keyShortcuts, press } = usePressed(command);

  return (
    <>
      <ControlTooltip
        side={side}
        content={
          <>
            {label} <span className={styles.chord}>{chord}</span>
          </>
        }
      >
        <button
          {...(description === undefined
            ? {}
            : { 'aria-describedby': descriptionId })}
          aria-keyshortcuts={keyShortcuts}
          aria-label={label}
          aria-pressed={pressed}
          className={className}
          disabled={disabled}
          onClick={press}
          onDoubleClick={onDoubleClick}
          type="button"
        >
          {children}
        </button>
      </ControlTooltip>
      {description !== undefined && (
        <VisuallyHidden id={descriptionId}>
          {t('commands.icon-description', { description, chord })}
        </VisuallyHidden>
      )}
    </>
  );
}

type Pressed = ShortcutText & {
  readonly entry: Command;
  readonly label: string;
  readonly press: () => void;
};

function usePressed(command: CommandId): Pressed {
  const surface = useCommandSurface();
  const { t } = useTranslator();
  const entry = commandById(command);

  return {
    ...shortcutText(entry.shortcuts, hostPlatform, t),
    entry,
    label: shortcutLabelText(entry.label, t),
    press: () => {
      runCommand(entry, surface);
    },
  };
}
