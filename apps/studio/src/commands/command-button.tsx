import { Tooltip } from 'radix-ui';
import { useId, type MouseEventHandler, type ReactNode } from 'react';
import { VisuallyHidden } from '../ui/visually-hidden.js';
import { useCommandSurface } from './binding.js';
import {
  commandById,
  runCommand,
  type Command,
  type CommandId,
} from './registry.js';
import { hostPlatform, shortcutText, type ShortcutText } from './shortcuts.js';
import styles from './command-button.module.css';

const tooltipDelay = 200;

const tooltipOffset = 6;

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
  const { entry, chord, keyShortcuts, press } = usePressed(command);

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
        {children ?? entry.label}
      </button>
      <VisuallyHidden id={description}>Shortcut: {chord}</VisuallyHidden>
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
  const { entry, chord, keyShortcuts, press } = usePressed(command);

  return (
    <Tooltip.Provider delayDuration={tooltipDelay} disableHoverableContent>
      <Tooltip.Root>
        <Tooltip.Trigger
          {...(description === undefined
            ? {}
            : { 'aria-describedby': descriptionId })}
          aria-keyshortcuts={keyShortcuts}
          aria-label={entry.label}
          aria-pressed={pressed}
          className={className}
          disabled={disabled}
          onClick={press}
          onDoubleClick={onDoubleClick}
          type="button"
        >
          {children}
        </Tooltip.Trigger>
        <Tooltip.Content
          className={styles.tooltip}
          side={side}
          sideOffset={tooltipOffset}
        >
          {entry.label} <span className={styles.chord}>{chord}</span>
        </Tooltip.Content>
        {description !== undefined && (
          <VisuallyHidden id={descriptionId}>
            {description} Shortcut: {chord}
          </VisuallyHidden>
        )}
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

type Pressed = ShortcutText & {
  readonly entry: Command;
  readonly press: () => void;
};

function usePressed(command: CommandId): Pressed {
  const surface = useCommandSurface();
  const entry = commandById(command);

  return {
    ...shortcutText(entry.shortcuts, hostPlatform),
    entry,
    press: () => {
      runCommand(entry, surface);
    },
  };
}
