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
import {
  commandById,
  diagramExportCommand,
  type CommandId,
} from '../commands/registry.js';
import { useTranslator } from '../messages/locale.js';
import {
  canRedo,
  canUndo,
  isDirty,
  needsCloseGuard,
  renameable,
} from '../store/selectors.js';
import { nameOf } from '../store/state.js';
import { useModelStore } from '../store/store.js';
import { useCloseFocus } from '../ui/close-focus.js';
import type { ColourMode } from '../theme-preference.js';
import { DiagramSwitcher } from './diagram-switcher.js';
import { MenuCommand, MenuItem, RegisteredMenuCommand } from './menu-items.js';
import type { FileSession } from './file-commands.js';
import styles from './menu.module.css';
import { AppearanceMenu, LanguageMenu } from './settings-menu.js';
import { Submenu, SubmenuEdge } from './submenu.js';
import { formatFiles, formatOf, formatsFrom } from './session.js';

type UnsavedChangesCommandProps = {
  readonly asking: boolean;
  readonly cancel: () => void;
  readonly command: CommandId;
  readonly dirty: boolean;
  readonly proceed: () => void;
  readonly question: DiscardQuestion;
};

type DiscardQuestion =
  | 'menu.discard-and-open'
  | 'menu.discard-and-import'
  | 'menu.discard-and-new';

function UnsavedChangesCommand({
  asking,
  cancel,
  command,
  dirty,
  proceed,
  question,
}: UnsavedChangesCommandProps) {
  const { t } = useTranslator();

  return (
    <>
      <RegisteredMenuCommand
        asking={asking ? { question: t(question), answer: proceed } : undefined}
        entry={commandById(command)}
        keepOpen={dirty && !asking}
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
    <DropdownMenu.Item asChild className={styles.item}>
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
  const guarded = useModelStore(needsCloseGuard);
  const [open, setOpen] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  const { t } = useTranslator();

  useCloseGuard(guarded);
  useAsking(session.opening, dirty, setOpen, session.cancelOpen);
  useAsking(session.importing, dirty, setOpen, session.cancelImport);
  useAsking(session.closing, dirty, setOpen, session.cancelClose);
  useChoosing(session.choosing, setOpen);

  const { attachPicker, cancelOpen, cancelChoice, cancelClose, receive } =
    session;

  return (
    <div className={styles.bar} ref={bar}>
      <DropdownMenu.Root
        modal={false}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            cancelOpen();
            session.cancelImport();
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
            colourMode={colourMode ?? 'system'}
            dirty={dirty}
            onColourModeChange={onColourModeChange}
            session={session}
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
  readonly colourMode: ColourMode;
  readonly dirty: boolean;
  readonly onColourModeChange?: (mode: ColourMode) => void;
  readonly session: FileSession;
};

function MenuPanel({
  colourMode,
  dirty,
  onColourModeChange,
  session,
}: MenuPanelProps) {
  const closeFocus = useCloseFocus(focusSelectionControl);
  const { t } = useTranslator();

  return (
    <DropdownMenu.Content
      tabIndex={0}
      {...closeFocus}
      align="start"
      className={styles.panel}
      sideOffset={6}
    >
      <FileMenu dirty={dirty} session={session} />
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
  dirty,
  session,
}: {
  readonly dirty: boolean;
  readonly session: FileSession;
}) {
  const file = useModelStore((state) => state.file);
  const {
    asksFormat,
    cancelOpen,
    cancelClose,
    chooseFormat,
    choosing,
    closing,
    commands,
    confirmOpen,
    confirmClose,
    opening,
  } = session;
  const { t } = useTranslator();
  const format = formatOf(file);
  const askingOpen = opening && dirty;
  const askingClose = closing && dirty;

  return (
    <DropdownMenu.Group>
      <DropdownMenu.Label className={styles.heading}>
        {t('commands.group-file')}
      </DropdownMenu.Label>
      <UnsavedChangesCommand
        asking={askingOpen}
        cancel={cancelOpen}
        command="open"
        dirty={dirty}
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
      <UnsavedChangesCommand
        asking={session.importing && dirty}
        cancel={session.cancelImport}
        command="import"
        dirty={dirty}
        proceed={session.confirmImport}
        question="menu.discard-and-import"
      />
      <ExportMenu />
      <UnsavedChangesCommand
        asking={askingClose}
        cancel={cancelClose}
        command="close-file"
        dirty={dirty}
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
      <MenuCommand command="model-properties" />
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
      <MenuCommand command="fit-selection" disabled={nothing} />
      <MenuCommand command="snap-to-grid">
        {t(snapping ? 'menu.snap-on' : 'menu.snap-off')}
      </MenuCommand>
    </DropdownMenu.Group>
  );
}

function ExportMenu() {
  const { t } = useTranslator();
  const diagrams = useModelStore((state) => state.present.diagrams);
  const several = diagrams.length > 1;

  return (
    <Submenu trigger={<span>{t('menu.export')}</span>}>
      {diagrams.length === 0 && (
        <MenuCommand command="export-diagram" disabled />
      )}
      {diagrams.map((diagram) => (
        <RegisteredMenuCommand
          entry={diagramExportCommand(diagram, several)}
          key={diagram.id}
        />
      ))}
      <MenuCommand command="export-png" disabled={diagrams.length === 0} />
      <MenuCommand command="export-register" />
      <MenuCommand command="export-typst" />
      <MenuCommand command="export-pdf" />
    </Submenu>
  );
}

function useAsking(
  closing: boolean,
  dirty: boolean,
  show: (open: boolean) => void,
  cancel: () => void,
): void {
  useEffect(() => {
    if (!closing) {
      return;
    }
    if (dirty) {
      show(true);
      return;
    }
    cancel();
  }, [cancel, closing, dirty, show]);
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
