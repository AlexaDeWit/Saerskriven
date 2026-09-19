import type { DiagramId } from '@saerskriven/model';
import {
  renderRegister,
  renderSvg,
  renderTypst,
  type SvgDocument,
} from '@saerskriven/render';
import {
  compilePdf,
  PdfFailure,
  type PdfAssets,
} from '@saerskriven/render/pdf';
import {
  renderPng,
  ResvgFailure,
  type PngImage,
} from '@saerskriven/render/png';
import type { ResvgAssets } from '@saerskriven/render/resvg';
import { Either } from 'effect';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { activeTranslator } from '../messages/locale.js';
import { activeDiagram } from '../store/selectors.js';
import type { FileLifecycle, State } from '../store/state.js';
import { modelStore, onCanvasOrPanelChange } from '../store/store.js';
import { SaveOutcome, type FileBridge, type SaveFileType } from './bridge.js';
import { browserFileBridge } from './browser-bridge.js';
import { ExportNotice, isRefusal } from './export-notice.js';
import {
  loadPdfAssets,
  loadPngAssets,
  type RenderAssetFailure,
} from './render-assets.js';
import { proposedExportName } from './session.js';

type UnplacedFlow = SvgDocument['unplaced'][number];

type ExportFile = {
  readonly extension: string;
  readonly description:
    | 'reports.svg-file'
    | 'reports.png-file'
    | 'reports.markdown-file'
    | 'reports.typst-file'
    | 'reports.pdf-file';
  readonly accept: SaveFileType['accept'];
};

type Produced = {
  readonly content: Uint8Array;
  readonly unplaced: readonly UnplacedFlow[];
};

const exportFiles = {
  svg: {
    extension: '.svg',
    description: 'reports.svg-file',
    accept: { 'image/svg+xml': ['.svg'] },
  },
  png: {
    extension: '.png',
    description: 'reports.png-file',
    accept: { 'image/png': ['.png'] },
  },
  markdown: {
    extension: '.md',
    description: 'reports.markdown-file',
    accept: { 'text/markdown': ['.md'] },
  },
  typst: {
    extension: '.typ',
    description: 'reports.typst-file',
    accept: { 'text/plain': ['.typ'] },
  },
  pdf: {
    extension: '.pdf',
    description: 'reports.pdf-file',
    accept: { 'application/pdf': ['.pdf'] },
  },
} as const satisfies Record<string, ExportFile>;

type ExportCommands = {
  diagram(diagramId?: DiagramId): void;
  register(): void;
  typst(): void;
  pdf(): void;
  png(): void;
};

/** The asset loaders and projections the PDF and PNG exports run, which a spec replaces. */
export type RenderExports = {
  readonly pdfAssets: () => Promise<
    Either.Either<PdfAssets, RenderAssetFailure>
  >;
  readonly compile: typeof compilePdf;
  readonly pngAssets: () => Promise<
    Either.Either<ResvgAssets, RenderAssetFailure>
  >;
  readonly draw: typeof renderPng;
};

/** The PDF and PNG services used by the browser application. */
export const browserRenderExports: RenderExports = {
  pdfAssets: loadPdfAssets,
  compile: compilePdf,
  pngAssets: loadPngAssets,
  draw: renderPng,
};

/**
 * The export commands and the report their last run produced. A refusal
 * stands until dismissed or replaced, and any other report also goes at the
 * next canvas or panel change.
 */
export function useExportCommands(
  bridge: FileBridge = browserFileBridge,
  renders: RenderExports = browserRenderExports,
): {
  readonly commands: ExportCommands;
  readonly notice: ExportNotice | undefined;
  readonly dismissNotice: () => void;
} {
  const [notice, setNotice] = useState<ExportNotice | undefined>(undefined);

  const place = useCallback(
    async (
      sourceFile: FileLifecycle,
      file: ExportFile,
      content: string | Uint8Array,
      unplaced: readonly UnplacedFlow[] = [],
    ): Promise<void> => {
      const { t } = activeTranslator();
      const outcome = await bridge.exportFile(
        proposedExportName(
          sourceFile,
          file.extension,
          t('defaults.untitled-model'),
        ),
        { description: t(file.description), accept: file.accept },
        content,
      );
      setNotice(noticeFrom(outcome, unplaced));
    },
    [bridge],
  );

  const produce = useCallback(
    (
      file: ExportFile,
      make: (
        state: State,
      ) => Promise<Either.Either<Produced, ExportNotice> | undefined>,
    ): void => {
      const run = async (): Promise<void> => {
        setNotice(undefined);
        const state = modelStore.getState();
        const made = await make(state);
        if (made === undefined) {
          return;
        }
        if (Either.isLeft(made)) {
          setNotice(made.left);
          return;
        }
        await place(state.file, file, made.right.content, made.right.unplaced);
      };
      void run();
    },
    [place],
  );

  const commands = useMemo<ExportCommands>(
    () => ({
      diagram: (diagramId) => {
        const state = modelStore.getState();
        const diagram =
          diagramId === undefined
            ? state.present.diagrams.length === 1
              ? state.present.diagrams[0]
              : undefined
            : state.present.diagrams.find(
                (candidate) => candidate.id === diagramId,
              );
        if (diagram === undefined) {
          return;
        }
        const projection = renderSvg(diagram, state.present, 'en-CA');
        void place(
          state.file,
          exportFiles.svg,
          projection.svg,
          projection.unplaced,
        );
      },
      register: () => {
        const state = modelStore.getState();
        void place(
          state.file,
          exportFiles.markdown,
          renderRegister(state.present, 'en-CA'),
        );
      },
      typst: () => {
        const state = modelStore.getState();
        const projection = renderTypst(state.present, 'en-CA');
        void place(
          state.file,
          exportFiles.typst,
          projection.typst,
          projection.unplaced,
        );
      },
      pdf: () => {
        produce(exportFiles.pdf, (state) => compiled(state, renders));
      },
      png: () => {
        produce(exportFiles.png, (state) => drawn(state, renders));
      },
    }),
    [place, produce, renders],
  );

  const dismissNotice = useCallback((): void => {
    setNotice(undefined);
  }, []);

  useEffect(
    () =>
      onCanvasOrPanelChange(() => {
        setNotice((current) =>
          current !== undefined && isRefusal(current) ? current : undefined,
        );
      }),
    [],
  );

  return useMemo(
    () => ({ commands, notice, dismissNotice }),
    [commands, dismissNotice, notice],
  );
}

async function compiled(
  state: State,
  renders: RenderExports,
): Promise<Either.Either<Produced, ExportNotice>> {
  const projection = renderTypst(state.present, 'en-CA');
  const assets = await renders.pdfAssets();
  if (Either.isLeft(assets)) {
    return Either.left(assetNotice(assets.left, 'compiler'));
  }
  return Either.mapBoth(await renders.compile(projection.typst, assets.right), {
    onLeft: compileNotice,
    onRight: (pdf) => ({
      content: new Uint8Array(pdf),
      unplaced: projection.unplaced,
    }),
  });
}

async function drawn(
  state: State,
  renders: RenderExports,
): Promise<Either.Either<Produced, ExportNotice> | undefined> {
  const diagram = activeDiagram(state);
  if (diagram === undefined) {
    return undefined;
  }
  const assets = await renders.pngAssets();
  if (Either.isLeft(assets)) {
    return Either.left(assetNotice(assets.left, 'rasterizer'));
  }
  return Either.mapBoth(
    await renders.draw(diagram, state.present, 'en-CA', {
      assets: assets.right,
    }),
    {
      onLeft: rasterNotice,
      onRight: (image: PngImage) => ({
        content: image.png,
        unplaced: image.unplaced,
      }),
    },
  );
}

function noticeFrom(
  outcome: SaveOutcome,
  unplaced: readonly UnplacedFlow[],
): ExportNotice | undefined {
  return SaveOutcome.$match(outcome, {
    Written: () =>
      unplaced.length > 0 ? ExportNotice.Unplaced({ unplaced }) : undefined,
    Cancelled: () => undefined,
    Refused: ({ reason }) => ExportNotice.WriteRefused({ reason }),
  });
}

function assetNotice(
  failure: RenderAssetFailure,
  reader: 'compiler' | 'rasterizer',
): ExportNotice {
  return ExportNotice.AssetsUnavailable({ reader, failure });
}

function compileNotice(failure: PdfFailure): ExportNotice {
  return PdfFailure.$match(failure, {
    Refused: ({ sentences }) => ExportNotice.CompileRefused({ sentences }),
    NoDocument: () => ExportNotice.NoPdf(),
  });
}

function rasterNotice(failure: ResvgFailure): ExportNotice {
  return ExportNotice.DrawRefused({
    sentence: ResvgFailure.$match(failure, {
      Refused: ({ sentence }) => sentence,
      Unusable: ({ sentence }) => sentence,
    }),
  });
}
