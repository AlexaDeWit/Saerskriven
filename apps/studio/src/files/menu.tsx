import { focusSelectionControl } from '../canvas/selection-control.js';
import { useSnap } from '../canvas/snap.js';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { DropdownMenu } from 'radix-ui';
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { commandById, type CommandId } from '../commands/registry.js';
import { useTranslator } from '../messages/locale.js';
import {
  canRedo,
  canUndo,
  holdsUnsavedWork,
  isDirty,
  needsCloseGuard,
  renameable,
} from '../store/selectors.js';
import { nameOf } from '../store/state.js';
import { useModelStore } from '../store/store.js';
import { useCloseFocus } from '../ui/close-focus.js';
import type { ColourMode } from '../theme-preference.js';
import { DiagramSwitcher } from './diagram-switcher.js';
import {
  MenuCommand,
  MenuItem,
  panelPlacement,
  RegisteredMenuCommand,
} from './menu-items.js';
import type { FileSession } from './file-commands.js';
import cursor from '../ui/cursor-row.module.css';
import styles from './menu.module.css';
import { AppearanceMenu, LanguageMenu } from './settings-menu.js';
import { Submenu, SubmenuEdge } from './submenu.js';
import { formatFiles, formatOf, formatsFrom } from './session.js';

type UnsavedChangesCommandProps = {
  readonly asking: boolean;
  readonly asksFirst: boolean;
  readonly cancel: () => void;
  readonly command: CommandId;
  readonly proceed: () => void;
  readonly question: DiscardQuestion;
  readonly questionRef?: RefObject<HTMLDivElement | null>;
};

type DiscardQuestion =
  | 'menu.discard-and-open'
  | 'menu.discard-and-open-link'
  | 'menu.discard-and-new';

function UnsavedChangesCommand({
  asking,
  asksFirst,
  cancel,
  command,
  proceed,
  question,
  questionRef,
}: UnsavedChangesCommandProps) {
  const { t } = useTranslator();

  return (
    <>
      <RegisteredMenuCommand
        asking={
          asking
            ? { question: t(question), answer: proceed, itemRef: questionRef }
            : undefined
        }
        entry={commandById(command)}
        keepOpen={asksFirst && !asking}
      />
      {asking && <MenuItem onChoose={cancel}>{t('menu.cancel')}</MenuItem>}
    </>
  );
}

function ProjectLink({
  href,
  children,
}: {
  readonly href: string;
  readonly children: ReactNode;
}) {
  return (
    <DropdownMenu.Item asChild className={`${styles.item} ${cursor.row}`}>
      <a href={href} rel="noopener noreferrer" target="_blank">
        <span>{children}</span>
        <ExternalLinkIcon aria-hidden="true" className={styles.externalLink} />
      </a>
    </DropdownMenu.Item>
  );
}

/** The session the items run their commands through. */
export type StudioMenuProps = {
  readonly session: FileSession;
  readonly colourMode?: ColourMode;
  readonly onColourModeChange?: (mode: ColourMode) => void;
  readonly triggerRef?: RefObject<HTMLButtonElement | null>;
};

/** The non-modal file, edit and project menu, as row one of the chrome card. */
export function StudioMenu({
  session,
  colourMode,
  onColourModeChange,
  triggerRef,
}: StudioMenuProps) {
  const dirty = useModelStore(isDirty);
  const unsaved = useModelStore(holdsUnsavedWork);
  const guarded = useModelStore(needsCloseGuard);
  const [open, setOpen] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  const { t } = useTranslator();

  useCloseGuard(guarded);
  useAsking(session.opening, unsaved, setOpen, session.cancelOpen);
  useAsking(session.linking, unsaved, setOpen, session.cancelLink);
  const askingLink = session.linking && unsaved;
  useAsking(session.closing, unsaved, setOpen, session.cancelClose);
  useChoosing(session.choosing, setOpen);

  const {
    attachPicker,
    cancelOpen,
    cancelChoice,
    cancelClose,
    cancelLink,
    receive,
  } = session;

  return (
    <div className={styles.bar} ref={bar}>
      <DropdownMenu.Root
        modal={false}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            cancelOpen();
            cancelLink();
            cancelClose();
            cancelChoice();
          }
        }}
        open={open}
      >
        <DropdownMenu.Trigger
          aria-label={t(dirty ? 'menu.menu-unsaved' : 'menu.menu')}
          className={styles.burger}
          ref={triggerRef}
        >
          <span aria-hidden="true">☰</span>
          {dirty && <span aria-hidden="true" className={styles.dot} />}
        </DropdownMenu.Trigger>
        <SubmenuEdge value={bar}>
          <MenuPanel
            askingLink={askingLink}
            colourMode={colourMode ?? 'system'}
            dirty={dirty}
            onColourModeChange={onColourModeChange}
            session={session}
            unsaved={unsaved}
          />
        </SubmenuEdge>
      </DropdownMenu.Root>
      <DiagramSwitcher />
      <input
        className={styles.input}
        data-testid="file-input"
        onChange={(event) => {
          const chosen = event.target.files?.[0];
          event.target.value = '';
          void receive(chosen);
        }}
        ref={attachPicker}
        type="file"
      />
    </div>
  );
}

type MenuPanelProps = {
  readonly askingLink: boolean;
  readonly colourMode: ColourMode;
  readonly dirty: boolean;
  readonly onColourModeChange?: (mode: ColourMode) => void;
  readonly session: FileSession;
  readonly unsaved: boolean;
};

function MenuPanel({
  askingLink,
  colourMode,
  dirty,
  onColourModeChange,
  session,
  unsaved,
}: MenuPanelProps) {
  const closeFocus = useCloseFocus(focusSelectionControl);
  const { t } = useTranslator();

  return (
    <DropdownMenu.Content
      tabIndex={0}
      {...closeFocus}
      {...panelPlacement}
      className={styles.panel}
    >
      <FileMenu askingLink={askingLink} session={session} unsaved={unsaved} />
      <DropdownMenu.Separator className={styles.rule} />
      <AppearanceMenu mode={colourMode} onChange={onColourModeChange} />
      <LanguageMenu />
      <DropdownMenu.Separator className={styles.rule} />
      <EditMenu />
      <DropdownMenu.Separator className={styles.rule} />
      <ViewMenu />
      <DropdownMenu.Separator className={styles.rule} />
      <DropdownMenu.Group>
        <DropdownMenu.Label className={styles.heading}>
          {t('menu.project')}
        </DropdownMenu.Label>
        <ProjectLink href="https://github.com/AlexaDeWit/Saerskriven">
          {t('menu.view-source')}
        </ProjectLink>
      </DropdownMenu.Group>
      <DropdownMenu.Separator className={styles.rule} />
      <DropdownMenu.Group>
        <DropdownMenu.Label className={styles.heading}>
          {t('commands.group-help')}
        </DropdownMenu.Label>
        <MenuCommand command="shortcut-reference" />
      </DropdownMenu.Group>
      <DropdownMenu.Separator className={styles.rule} />
      <FileState dirty={dirty} />
    </DropdownMenu.Content>
  );
}

function FileState({ dirty }: { readonly dirty: boolean }) {
  const file = useModelStore((state) => state.file);
  const { t } = useTranslator();
  const named = {
    name: nameOf(file, t('defaults.untitled-model')),
    format: formatFiles[formatOf(file)].label,
  };

  return (
    <DropdownMenu.Group className={styles.about}>
      <p className={styles.state} data-testid="file-state">
        {t(dirty ? 'menu.file-state-dirty' : 'menu.file-state-clean', named)}
      </p>
    </DropdownMenu.Group>
  );
}

function FileMenu({
  askingLink,
  session,
  unsaved,
}: {
  readonly askingLink: boolean;
  readonly session: FileSession;
  readonly unsaved: boolean;
}) {
  const file = useModelStore((state) => state.file);
  const linkQuestion = useRef<HTMLDivElement>(null);
  const {
    asksFormat,
    cancelOpen,
    cancelClose,
    cancelLink,
    chooseFormat,
    choosing,
    closing,
    commands,
    confirmOpen,
    confirmClose,
    confirmLink,
    opening,
  } = session;
  const { t } = useTranslator();
  const format = formatOf(file);
  const askingOpen = opening && unsaved;
  const askingClose = closing && unsaved;

  useEffect(() => {
    if (askingLink) {
      linkQuestion.current?.focus();
    }
  }, [askingLink]);

  return (
    <DropdownMenu.Group>
      <DropdownMenu.Label className={styles.heading}>
        {t('commands.group-file')}
      </DropdownMenu.Label>
      <UnsavedChangesCommand
        asking={askingOpen}
        asksFirst={unsaved}
        cancel={cancelOpen}
        command="open"
        proceed={confirmOpen}
        question="menu.discard-and-open"
      />
      <MenuCommand command="save" />
      <RegisteredMenuCommand
        asking={
          choosing
            ? {
                question: t('menu.save-as-format', {
                  format: formatFiles[format].label,
                }),
                answer: () => {
                  chooseFormat(format);
                },
              }
            : undefined
        }
        entry={commandById('save-as')}
        keepOpen={asksFormat && !choosing}
        onChoose={() => {
          commands.saveAs();
        }}
      />
      {choosing &&
        formatsFrom(format)
          .slice(1)
          .map((option) => (
            <MenuItem
              key={option}
              onChoose={() => {
                chooseFormat(option);
              }}
            >
              {t('menu.save-as-format', {
                format: formatFiles[option].label,
              })}
            </MenuItem>
          ))}
      <ExportMenu />
      <UnsavedChangesCommand
        asking={askingLink}
        asksFirst={false}
        cancel={cancelLink}
        command="share"
        proceed={confirmLink}
        question="menu.discard-and-open-link"
        questionRef={linkQuestion}
      />
      <UnsavedChangesCommand
        asking={askingClose}
        asksFirst={unsaved}
        cancel={cancelClose}
        command="close-file"
        proceed={confirmClose}
        question="menu.discard-and-new"
      />
    </DropdownMenu.Group>
  );
}

function EditMenu() {
  const { t } = useTranslator();
  const undoable = useModelStore(canUndo);
  const redoable = useModelStore(canRedo);
  const nothing = useModelStore((state) => state.selection.length === 0);
  const renamable = useModelStore(renameable);

  return (
    <DropdownMenu.Group>
      <DropdownMenu.Label className={styles.heading}>
        {t('commands.group-edit')}
      </DropdownMenu.Label>
      <MenuCommand command="undo" disabled={!undoable} />
      <MenuCommand command="redo" disabled={!redoable} />
      <Submenu trigger={t('menu.arrange')}>
        {(
          [
            'align-left',
            'align-centre',
            'align-right',
            'align-top',
            'align-middle',
            'align-bottom',
            'distribute-horizontal',
            'distribute-vertical',
          ] as const
        ).map((command) => (
          <MenuCommand command={command} disabled={nothing} key={command} />
        ))}
      </Submenu>
      <MenuCommand command="rename" disabled={!renamable} />
      <MenuCommand command="model-panel" />
    </DropdownMenu.Group>
  );
}

function ViewMenu() {
  const { t } = useTranslator();
  const snapping = useSnap();
  const nothing = useModelStore((state) => state.selection.length === 0);

  return (
    <DropdownMenu.Group>
      <DropdownMenu.Label className={styles.heading}>
        {t('commands.group-view')}
      </DropdownMenu.Label>
      <MenuCommand command="threat-register" />
      <MenuCommand command="fit-selection" disabled={nothing} />
      <MenuCommand command="snap-to-grid">
        {t(snapping ? 'menu.snap-on' : 'menu.snap-off')}
      </MenuCommand>
    </DropdownMenu.Group>
  );
}

function ExportMenu() {
  const { t } = useTranslator();
  const nothing = useModelStore((state) => state.present.diagrams.length === 0);

  return (
    <Submenu trigger={<span>{t('menu.export')}</span>}>
      <MenuCommand command="export-diagram" disabled={nothing} />
      <MenuCommand command="export-png" disabled={nothing} />
      <MenuCommand command="export-register" />
      <MenuCommand command="export-typst" />
      <MenuCommand command="export-pdf" />
    </Submenu>
  );
}

function useAsking(
  asking: boolean,
  unsaved: boolean,
  show: (open: boolean) => void,
  cancel: () => void,
): void {
  useEffect(() => {
    if (!asking) {
      return;
    }
    if (unsaved) {
      show(true);
      return;
    }
    cancel();
  }, [asking, cancel, show, unsaved]);
}

function useChoosing(choosing: boolean, show: (open: boolean) => void): void {
  useEffect(() => {
    if (choosing) {
      show(true);
    }
  }, [choosing, show]);
}

function useCloseGuard(guarded: boolean): void {
  useEffect(() => {
    if (!guarded) {
      return undefined;
    }
    const guard = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
    };
    globalThis.addEventListener('beforeunload', guard);
    return () => {
      globalThis.removeEventListener('beforeunload', guard);
    };
  }, [guarded]);
}
