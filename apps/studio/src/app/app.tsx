import { ReactFlowProvider } from '@xyflow/react';
import { useMemo, useState } from 'react';
import { DiagramCanvas } from '../canvas/diagram-canvas.js';
import { useViewCommands } from '../canvas/view-commands.js';
import { CommandSurfaceProvider } from '../commands/binding.js';
import type { CommandSurface } from '../commands/surface.js';
import {
  ShortcutReference,
  useShortcutReference,
} from '../commands/shortcut-reference.js';
import { useFileSession } from '../files/file-commands.js';
import { useTranslator } from '../messages/locale.js';
import { useColourMode } from '../theme.js';
import { studioReleaseTag, studioVersion } from '../version.js';
import styles from './app.module.css';
import { StudioChrome } from './chrome.js';

/** The studio shell and the provider that exposes its viewport commands. */
export function App() {
  return (
    <ReactFlowProvider>
      <Studio />
    </ReactFlowProvider>
  );
}

function Studio() {
  const session = useFileSession();
  const paneCoverage = useState(0);
  const view = useViewCommands(paneCoverage[0]);
  const [colourMode, setColourMode] = useColourMode();
  const reference = useShortcutReference();
  const { t } = useTranslator();

  const surface = useMemo<CommandSurface>(
    () => ({
      files: session.commands,
      reference: reference.commands,
      view,
    }),
    [reference.commands, session.commands, view],
  );

  return (
    <CommandSurfaceProvider surface={surface}>
      <div className={styles.shell}>
        <main className={styles.diagram}>
          <h1 className={styles.title}>Saerskriven</h1>
          <div className={styles.stage}>
            <StudioChrome
              colourMode={colourMode}
              onColourModeChange={setColourMode}
              session={session}
              triggerRef={reference.menuTrigger}
            />
            <DiagramCanvas paneCoverage={paneCoverage} />
            <span className={styles.version} data-testid="studio-version">
              {studioReleaseTag === ''
                ? t('shell.development-version', { version: studioVersion })
                : studioVersion}
            </span>
            {reference.open && <ShortcutReference onClose={reference.close} />}
          </div>
        </main>
      </div>
    </CommandSurfaceProvider>
  );
}
