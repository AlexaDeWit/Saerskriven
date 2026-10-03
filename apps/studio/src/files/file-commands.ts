import {
  readLimits,
  writeThrough,
  type FormatName,
  type WriteResult,
} from '@saerskriven/formats';
import type { Model } from '@saerskriven/model';
import { Either } from 'effect';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FileCommands } from '../commands/surface.js';
import { activeTranslator } from '../messages/locale.js';
import { Action } from '../store/actions.js';
import { isDirty } from '../store/selectors.js';
import type { State } from '../store/state.js';
import { dispatch, modelStore } from '../store/store.js';
import { browserStoreSync, type StoreSync } from '../store/sync.js';
import { browserFileBridge } from './browser-bridge.js';
import {
  browserRenderExports,
  useExportCommands,
  type RenderExports,
} from './export-commands.js';
import type { ExportNotice } from './export-notice.js';
import {
  OpenOutcome,
  SaveOutcome,
  type ChosenFile,
  type FileBridge,
  type FileResult,
} from './bridge.js';
import {
  formatOf,
  formatOfName,
  formatsFrom,
  openReport,
  openedBy,
  saveReport,
  saveTarget,
  saveTypes,
  savedBy,
  type LossReport,
  type SaveTarget,
} from './session.js';

type PlannedSave = {
  readonly model: Model;
  readonly target: SaveTarget;
  readonly written: WriteResult;
};

/** File commands, export commands, notices, and menu questions. */
export type FileSession = {
  readonly commands: FileCommands;
  readonly report: LossReport | undefined;
  readonly opening: boolean;
  readonly closing: boolean;
  readonly choosing: boolean;
  readonly asksFormat: boolean;
  readonly exportNotice: ExportNotice | undefined;
  readonly attachPicker: (input: HTMLInputElement | null) => void;
  readonly dismissReport: () => void;
  readonly dismissExportNotice: () => void;
  readonly receive: (chosen: ChosenFile | undefined) => Promise<void>;
  readonly confirmOpen: () => void;
  readonly cancelOpen: () => void;
  readonly confirmClose: () => void;
  readonly cancelClose: () => void;
  readonly chooseFormat: (format: FormatName) => void;
  readonly cancelChoice: () => void;
};

/**
 * The file session: it settles handle ownership before synchronously
 * dispatching an open or a save, and following another tab's result releases
 * the handle and puts away the report and every question. A Save with no file
 * to write back to runs Save as wherever the platform can ask where.
 */
export function useFileSession(
  bridge: FileBridge = browserFileBridge,
  renders: RenderExports = browserRenderExports,
  sync: Pick<StoreSync, 'watch'> = browserStoreSync,
): FileSession {
  const [report, setReport] = useState<LossReport | undefined>(undefined);
  const [opening, setOpening] = useState(false);
  const [closing, setClosing] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const picker = useRef<HTMLInputElement | null>(null);
  const exporter = useExportCommands(bridge, renders);
  const exportCommands = exporter.commands;

  const attachPicker = useCallback((input: HTMLInputElement | null): void => {
    picker.current = input;
  }, []);

  useEffect(
    () =>
      sync.watch((state) => {
        dispatch(Action.Followed({ state }));
        bridge.release();
        setReport(undefined);
        setOpening(false);
        setClosing(false);
        setChoosing(false);
      }),
    [bridge, sync],
  );

  const closeFile = useCallback((): void => {
    setClosing(false);
    setReport(undefined);
    if (Either.isRight(dispatch(Action.Closed()))) {
      bridge.release();
    }
  }, [bridge]);

  const applyOpen = useCallback((result: FileResult<OpenOutcome>): void => {
    const action = openedBy(result.outcome, untitledFileStem());
    if (action === undefined) {
      result.settle('unchanged');
      return;
    }
    if (!result.settle(Action.$is('Opened')(action))) {
      return;
    }
    dispatch(action);
    if (Action.$is('Opened')(action) || Action.$is('Imported')(action)) {
      setReport(openReport(action));
    }
  }, []);

  const openFile = useCallback(async (): Promise<void> => {
    setOpening(false);
    const result = await bridge.open(readLimits.maxTextBytes);
    if (OpenOutcome.$is('NoPicker')(result.outcome)) {
      if (result.settle('unchanged')) {
        picker.current?.click();
      }
      return;
    }
    applyOpen(result);
  }, [applyOpen, bridge]);

  const land = useCallback(
    (result: FileResult<SaveOutcome>, planned: PlannedSave): void => {
      const action = savedBy(result.outcome, planned.target.source);
      if (action === undefined || !result.settle(true)) {
        return;
      }
      dispatch(action);
      if (SaveOutcome.$is('Written')(result.outcome)) {
        setReport(saveReport(planned.model, planned.written.divergences));
      }
    },
    [],
  );

  const chooseFormat = useCallback(
    (format: FormatName): void => {
      const settle = async (): Promise<void> => {
        setChoosing(false);
        setReport(undefined);
        const planned = planSave(modelStore.getState(), format);
        land(
          await bridge.saveAs(
            planned.target.name,
            saveTypes([format]),
            () => planned.written.output,
          ),
          planned,
        );
      };
      void settle();
    },
    [bridge, land],
  );

  const commands = useMemo<FileCommands>(() => {
    const store = async (): Promise<void> => {
      setReport(undefined);
      const state = modelStore.getState();
      const planned = planSave(state, formatOf(state.file));
      land(
        await bridge.save(planned.target.name, planned.written.output),
        planned,
      );
    };

    const askWhere = async (): Promise<void> => {
      setReport(undefined);
      const state = modelStore.getState();
      const current = formatOf(state.file);
      let planned = planSave(state, current);
      const outcome = await bridge.saveAs(
        planned.target.name,
        saveTypes(formatsFrom(current)),
        (chosen) => {
          const format = formatOfName(chosen) ?? current;
          if (format !== planned.target.source.format) {
            planned = planSave(state, format);
          }
          return planned.written.output;
        },
      );
      land(outcome, planned);
    };

    return {
      open: () => {
        if (isDirty(modelStore.getState())) {
          setOpening(true);
          return;
        }
        void openFile();
      },
      save: () => {
        if (bridge.asksWhere() && !bridge.writesBack()) {
          void askWhere();
          return;
        }
        void store();
      },
      saveAs: () => {
        if (bridge.asksWhere()) {
          void askWhere();
          return;
        }
        setChoosing(true);
      },
      exportDiagram: () => {
        exportCommands.diagram();
      },
      exportRegister: () => {
        exportCommands.register();
      },
      exportTypst: () => {
        exportCommands.typst();
      },
      exportPdf: () => {
        exportCommands.pdf();
      },
      exportPng: () => {
        exportCommands.png();
      },
      close: () => {
        if (isDirty(modelStore.getState())) {
          setClosing(true);
          return;
        }
        closeFile();
      },
    };
  }, [bridge, closeFile, exportCommands, land, openFile]);

  const receive = useCallback(
    async (chosen: ChosenFile | undefined): Promise<void> => {
      if (chosen !== undefined) {
        applyOpen(await bridge.received(chosen, readLimits.maxTextBytes));
      }
    },
    [applyOpen, bridge],
  );

  const dismissReport = useCallback((): void => {
    setReport(undefined);
  }, []);

  const cancelOpen = useCallback((): void => {
    setOpening(false);
  }, []);

  const cancelClose = useCallback((): void => {
    setClosing(false);
  }, []);

  const cancelChoice = useCallback((): void => {
    setChoosing(false);
  }, []);

  return useMemo(
    () => ({
      commands,
      report,
      opening,
      closing,
      choosing,
      asksFormat: !bridge.asksWhere(),
      exportNotice: exporter.notice,
      attachPicker,
      dismissReport,
      dismissExportNotice: exporter.dismissNotice,
      receive,
      confirmOpen: () => {
        void openFile();
      },
      cancelOpen,
      confirmClose: closeFile,
      cancelClose,
      chooseFormat,
      cancelChoice,
    }),
    [
      attachPicker,
      bridge,
      cancelChoice,
      cancelClose,
      cancelOpen,
      chooseFormat,
      choosing,
      closeFile,
      closing,
      commands,
      dismissReport,
      exporter,
      opening,
      openFile,
      receive,
      report,
    ],
  );
}

function untitledFileStem(): string {
  return activeTranslator().t('defaults.untitled-file');
}

function planSave(state: State, format: FormatName): PlannedSave {
  const target = saveTarget(state.file, format, untitledFileStem());
  return {
    model: state.present,
    target,
    written: writeThrough(state.present, target.source),
  };
}
