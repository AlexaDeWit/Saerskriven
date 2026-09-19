import { DropdownMenu } from 'radix-ui';
import { Fragment, type ReactNode } from 'react';
import { useCommandSurface } from '../commands/binding.js';
import {
  commandById,
  runCommand,
  type Command,
  type CommandId,
} from '../commands/registry.js';
import {
  hostPlatform,
  shortcutLabelText,
  shortcutText,
  type ShortcutText,
} from '../commands/shortcuts.js';
import { useTranslator } from '../messages/locale.js';
import styles from './menu.module.css';

/**
 * Where the burger menu and the diagram switcher open their panels: under the
 * card, kept off each screen edge by the chrome band's own gutter
 * (`--pn-space-3`, at the default font size), which also narrows the width
 * Radix reports as available to the panel.
 */
export const panelPlacement = {
  align: 'start',
  collisionPadding: 12,
  sideOffset: 6,
} as const;

type MenuItemProps = {
  readonly shortcut?: ShortcutText;
  readonly children: ReactNode;
  readonly disabled?: boolean;
  readonly keepOpen?: boolean;
  readonly onChoose: () => void;
};

function Alternatives({ shortcut }: { readonly shortcut: ShortcutText }) {
  const { t } = useTranslator();
  const separator = t('commands.either-chord', { first: '', second: '' });

  return (
    <span aria-hidden="true" className={`${styles.chord} ${styles.chords}`}>
      {shortcut.alternatives.map((chord, index) => (
        <Fragment key={chord}>
          {index > 0 && separator}
          <span className={styles.alternative}>{chord}</span>
        </Fragment>
      ))}
    </span>
  );
}

/**
 * One item of the menu, its chord drawn beside it and declared for assistive
 * technology. A row too narrow for both wraps between the alternative chords,
 * never inside one.
 */
export function MenuItem({
  shortcut,
  children,
  disabled,
  keepOpen,
  onChoose,
}: MenuItemProps) {
  return (
    <DropdownMenu.Item
      aria-keyshortcuts={shortcut?.keyShortcuts}
      className={styles.item}
      disabled={disabled}
      onSelect={(event) => {
        if (keepOpen === true) {
          event.preventDefault();
        }
        onChoose();
      }}
    >
      <span>{children}</span>
      {shortcut !== undefined && <Alternatives shortcut={shortcut} />}
    </DropdownMenu.Item>
  );
}

type MenuCommandProps = {
  readonly command: CommandId;
  readonly children?: ReactNode;
  readonly disabled?: boolean;
};

/** A registered command as a menu item, run through the mounted surface. */
export function MenuCommand({ command, children, disabled }: MenuCommandProps) {
  return (
    <RegisteredMenuCommand disabled={disabled} entry={commandById(command)}>
      {children}
    </RegisteredMenuCommand>
  );
}

type MenuQuestion = {
  readonly question: string;
  readonly answer: () => void;
};

type RegisteredMenuCommandProps = {
  readonly entry: Command;
  readonly children?: ReactNode;
  readonly disabled?: boolean;
  readonly keepOpen?: boolean;
  readonly onChoose?: () => void;
  readonly asking?: MenuQuestion;
};

/**
 * A command bound at render time, such as one export item per diagram.
 * `onChoose` replaces running the command through the surface. While `asking`,
 * the item shows the question without the chord and choosing it answers.
 */
export function RegisteredMenuCommand({
  entry,
  children,
  disabled,
  keepOpen,
  onChoose,
  asking,
}: RegisteredMenuCommandProps) {
  const surface = useCommandSurface();
  const { t } = useTranslator();

  if (asking !== undefined) {
    return (
      <MenuItem
        disabled={disabled}
        keepOpen={keepOpen}
        onChoose={asking.answer}
      >
        {asking.question}
      </MenuItem>
    );
  }
  return (
    <MenuItem
      disabled={disabled}
      keepOpen={keepOpen}
      onChoose={
        onChoose ??
        (() => {
          runCommand(entry, surface);
        })
      }
      shortcut={
        entry.shortcuts.length === 0
          ? undefined
          : shortcutText(entry.shortcuts, hostPlatform, t)
      }
    >
      {children ?? shortcutLabelText(entry.label, t)}
    </MenuItem>
  );
}
