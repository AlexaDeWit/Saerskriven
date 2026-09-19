import type { Model } from '@saerskriven/model';
import { diagramId, parsedFixture } from '@saerskriven/model/fixtures';
import { renderRegister, renderSvg, renderTypst } from '@saerskriven/render';
import { PdfFailure } from '@saerskriven/render/pdf';
import { drawingFace, ResvgFailure } from '@saerskriven/render/png';
import { act, renderHook, waitFor } from '@testing-library/react';
import { Either } from 'effect';
import { activeTranslator, chooseLanguage } from '../messages/locale.js';
import { Action } from '../store/actions.js';
import { initialState, FileLifecycle } from '../store/state.js';
import { dispatch, modelStore } from '../store/store.js';
import {
  foreignSource,
  mainDiagram,
  sampleModel,
} from '../store/store.fixtures.js';
import { SaveOutcome } from './bridge.js';
import { useExportCommands, type RenderExports } from './export-commands.js';
import {
  describeExportNotice,
  isRefusal,
  type ExportNotice,
} from './export-notice.js';
import {
  pngSignature,
  specBridge,
  specRenders,
  type SpecBridge,
} from './files.fixtures.js';
import { RenderAssetFailure } from './render-assets.js';

const worded = (notice: ExportNotice | undefined) =>
  notice === undefined
    ? undefined
    : describeExportNotice(activeTranslator().t, notice);

const refused = (notice: ExportNotice | undefined): boolean | undefined =>
  notice === undefined ? undefined : isRefusal(notice);

const session = (bridge: SpecBridge, renders = specRenders()) =>
  renderHook(() => useExportCommands(bridge, renders)).result;

const unavailable = () =>
  Promise.resolve(
    Either.left(RenderAssetFailure.Unavailable({ reason: 'offline' })),
  );

const headlineOf = async (
  run: (commands: ReturnType<typeof useExportCommands>['commands']) => void,
  renders: RenderExports,
  bridge: SpecBridge = specBridge(),
): Promise<string | undefined> => {
  const result = session(bridge, renders);
  act(() => {
    run(result.current.commands);
  });
  await waitFor(() => {
    expect(refused(result.current.notice)).toBe(true);
  });
  return worded(result.current.notice)?.headline;
};

const openedState = (model: Model = sampleModel) => ({
  ...initialState(model),
  file: FileLifecycle.Opened({ name: 'model.json', source: foreignSource }),
});

const flow = (id: string, target: string): Record<string, unknown> => ({
  kind: 'flow',
  id,
  name: id,
  description: '',
  outOfScope: false,
  reasonOutOfScope: '',
  source: { kind: 'attached', element: sampleModel.diagrams[0].elements[0].id },
  target: { kind: 'attached', element: target },
  waypoints: [],
  bidirectional: false,
});

const unplacedModel = parsedFixture({
  ...sampleModel,
  diagrams: [
    {
      ...sampleModel.diagrams[0],
      elements: [
        ...sampleModel.diagrams[0].elements,
        flow('flow-1', sampleModel.diagrams[0].elements[1].id),
        flow('flow-2', 'flow-1'),
      ],
    },
  ],
});

const selectableElement = sampleModel.diagrams[0].elements[0].id;

beforeEach(() => {
  modelStore.setState(openedState(), true);
});

afterEach(() => {
  vi.useRealTimers();
  chooseLanguage('en-CA');
  globalThis.localStorage.clear();
});

describe('the studio exports', () => {
  it('writes every text projection directly from render under the file name', async () => {
    const bridge = specBridge();
    const result = session(bridge);

    act(() => {
      result.current.commands.diagram(mainDiagram);
      result.current.commands.register();
      result.current.commands.typst();
    });

    await waitFor(() => {
      expect(bridge.writes).toHaveLength(3);
    });
    expect(bridge.writes.map((write) => write.name)).toEqual([
      'model.svg',
      'model.md',
      'model.typ',
    ]);
    expect(bridge.writes.map((write) => write.text)).toEqual([
      renderSvg(sampleModel.diagrams[0], sampleModel, 'en-CA').svg,
      renderRegister(sampleModel, 'en-CA'),
      renderTypst(sampleModel, 'en-CA').typst,
    ]);
  });

  it('names an untitled export and its file type in the language active when it runs, and keeps the bytes', async () => {
    modelStore.setState(initialState(sampleModel), true);
    const bridge = specBridge();
    const result = session(bridge);
    chooseLanguage('sv');

    act(() => {
      result.current.commands.register();
    });

    await waitFor(() => {
      expect(bridge.writes).toHaveLength(1);
    });
    const { t } = activeTranslator();
    expect(bridge.writes[0].name).toBe(`${t('defaults.untitled-model')}.md`);
    expect(bridge.offered.at(-1)?.[0]?.description).toBe(
      t('reports.markdown-file'),
    );
    expect(bridge.writes[0].text).toBe(renderRegister(sampleModel, 'en-CA'));
  });

  it('compiles the render projection and writes the PDF as binary content', async () => {
    const bridge = specBridge();
    const bytes = new Uint8Array([37, 80, 68, 70, 45]);
    const compile = vi.fn<RenderExports['compile']>(() =>
      Promise.resolve(Either.right(bytes)),
    );
    const result = session(bridge, specRenders({ compile }));

    act(() => {
      result.current.commands.pdf();
    });

    await waitFor(() => {
      expect(bridge.writes).toHaveLength(1);
    });
    expect(compile).toHaveBeenCalledWith(
      renderTypst(sampleModel, 'en-CA').typst,
      {
        wasm: new Uint8Array(),
        fonts: [],
      },
    );
    expect(bridge.writes[0]).toMatchObject({ name: 'model.pdf', text: '' });
    expect(bridge.writes[0].bytes).toEqual(bytes);
  });

  it('draws the diagram on screen and writes the PNG as binary content', async () => {
    const bridge = specBridge();
    const draw = vi.fn<RenderExports['draw']>(() =>
      Promise.resolve(
        Either.right({
          png: pngSignature,
          width: 2,
          height: 1,
          unplaced: [],
        }),
      ),
    );
    const result = session(bridge, specRenders({ draw }));

    act(() => {
      result.current.commands.png();
    });

    await waitFor(() => {
      expect(bridge.writes).toHaveLength(1);
    });
    expect(draw).toHaveBeenCalledWith(
      sampleModel.diagrams[0],
      sampleModel,
      'en-CA',
      { assets: { wasm: new Uint8Array(), fonts: [] } },
    );
    expect(bridge.writes[0]).toMatchObject({ name: 'model.png', text: '' });
    expect(bridge.writes[0].bytes).toEqual(pngSignature);
  });

  it.each([
    ResvgFailure.Refused({ sentence: 'no long edge' }),
    ResvgFailure.Unusable({ sentence: 'the module reserved none' }),
  ])(
    'reports a rasterizer refusal and writes nothing, $_tag',
    async (failure) => {
      const bridge = specBridge();
      const result = session(
        bridge,
        specRenders({ draw: () => Promise.resolve(Either.left(failure)) }),
      );

      act(() => {
        result.current.commands.png();
      });

      await waitFor(() => {
        expect(refused(result.current.notice)).toBe(true);
      });
      expect(worded(result.current.notice)?.details).toEqual([
        failure.sentence,
      ]);
      expect(bridge.writes).toEqual([]);
    },
  );

  it('reports a build holding no face to letter the drawing in, and writes nothing', async () => {
    const bridge = specBridge();
    const draw = vi.fn<RenderExports['draw']>();
    const result = session(
      bridge,
      specRenders({
        draw,
        pngAssets: () =>
          Promise.resolve(
            Either.left(RenderAssetFailure.FaceMissing({ face: drawingFace })),
          ),
      }),
    );

    act(() => {
      result.current.commands.png();
    });

    await waitFor(() => {
      expect(refused(result.current.notice)).toBe(true);
    });
    expect(worded(result.current.notice)?.details.join(' ')).toContain(
      drawingFace,
    );
    expect(draw).not.toHaveBeenCalled();
    expect(bridge.writes).toEqual([]);
  });

  it('draws no PNG from a model holding no diagram', async () => {
    modelStore.setState(openedState({ ...sampleModel, diagrams: [] }), true);
    const bridge = specBridge();
    const draw = vi.fn<RenderExports['draw']>();
    const result = session(bridge, specRenders({ draw }));

    act(() => {
      result.current.commands.png();
    });

    await waitFor(() => {
      expect(draw).not.toHaveBeenCalled();
    });
    expect(bridge.writes).toEqual([]);
  });

  it.each(['png', 'diagram'] as const)(
    'reports the endpoints the %s export left out of the drawing, and still writes it',
    async (command) => {
      modelStore.setState(openedState(unplacedModel), true);
      const bridge = specBridge();
      const result = session(bridge);

      act(() => {
        if (command === 'png') {
          result.current.commands.png();
        } else {
          result.current.commands.diagram(mainDiagram);
        }
      });

      await waitFor(() => {
        expect(result.current.notice).toBeDefined();
      });
      expect(bridge.writes).toHaveLength(1);
      expect(refused(result.current.notice)).toBe(false);
      const details = worded(result.current.notice)?.details ?? [];
      expect(details).toHaveLength(1);
      expect(details[0]).toContain('flow-2');
      expect(details[0]).toContain('flow-1');
    },
  );

  it('reports a compiler refusal and writes nothing', async () => {
    const bridge = specBridge();
    const result = session(
      bridge,
      specRenders({
        compile: () =>
          Promise.resolve(
            Either.left(
              PdfFailure.Refused({ sentences: ['unknown function: nope'] }),
            ),
          ),
      }),
    );

    act(() => {
      result.current.commands.pdf();
    });

    await waitFor(() => {
      expect(refused(result.current.notice)).toBe(true);
      expect(worded(result.current.notice)?.details).toEqual([
        'unknown function: nope',
      ]);
    });
    expect(bridge.writes).toEqual([]);
  });

  it('reports unavailable assets before it asks the compiler', async () => {
    const bridge = specBridge();
    const compile = vi.fn<RenderExports['compile']>();
    const result = session(
      bridge,
      specRenders({
        compile,
        pdfAssets: () =>
          Promise.resolve(
            Either.left(RenderAssetFailure.Unavailable({ reason: 'offline' })),
          ),
      }),
    );

    act(() => {
      result.current.commands.pdf();
    });

    await waitFor(() => {
      expect(refused(result.current.notice)).toBe(true);
      expect(worded(result.current.notice)?.details).toEqual(['offline']);
    });
    expect(compile).not.toHaveBeenCalled();
    expect(bridge.writes).toEqual([]);
  });

  it('reports an absent PDF document and writes nothing', async () => {
    const bridge = specBridge();
    const result = session(
      bridge,
      specRenders({
        compile: () => Promise.resolve(Either.left(PdfFailure.NoDocument())),
      }),
    );

    act(() => {
      result.current.commands.pdf();
    });

    await waitFor(() => {
      expect(refused(result.current.notice)).toBe(true);
      expect(worded(result.current.notice)?.details).toEqual([]);
    });
    expect(bridge.writes).toEqual([]);
  });

  it('heads each refusal apart, whatever the details it carries', async () => {
    const headlines = [
      await headlineOf(
        (commands) => {
          commands.pdf();
        },
        specRenders({
          compile: () =>
            Promise.resolve(
              Either.left(PdfFailure.Refused({ sentences: ['offline'] })),
            ),
        }),
      ),
      await headlineOf(
        (commands) => {
          commands.pdf();
        },
        specRenders({
          compile: () => Promise.resolve(Either.left(PdfFailure.NoDocument())),
        }),
      ),
      await headlineOf(
        (commands) => {
          commands.pdf();
        },
        specRenders({ pdfAssets: unavailable }),
      ),
      await headlineOf(
        (commands) => {
          commands.png();
        },
        specRenders({ pngAssets: unavailable }),
      ),
      await headlineOf(
        (commands) => {
          commands.png();
        },
        specRenders({
          draw: () =>
            Promise.resolve(
              Either.left(ResvgFailure.Refused({ sentence: 'offline' })),
            ),
        }),
      ),
      await headlineOf(
        (commands) => {
          commands.register();
        },
        specRenders(),
        specBridge({ save: SaveOutcome.Refused({ reason: 'offline' }) }),
      ),
    ];

    expect(headlines).not.toContain('');
    expect(new Set(headlines).size).toBe(headlines.length);
  });

  it('reports a refused write and lets the report be dismissed', async () => {
    const bridge = specBridge({
      save: SaveOutcome.Refused({ reason: 'NotAllowedError' }),
    });
    const result = session(bridge);

    act(() => {
      result.current.commands.register();
    });

    await waitFor(() => {
      expect(refused(result.current.notice)).toBe(true);
      expect(worded(result.current.notice)?.details).toEqual([
        'NotAllowedError',
      ]);
    });
    act(() => {
      result.current.dismissNotice();
    });
    expect(result.current.notice).toBeUndefined();
  });

  it('puts an informational report away on Dismiss and on the next selection, and at no clock', async () => {
    modelStore.setState(openedState(unplacedModel), true);
    const bridge = specBridge();
    const result = session(bridge);
    const exported = async (): Promise<void> => {
      act(() => {
        result.current.commands.diagram(mainDiagram);
      });
      await waitFor(() => {
        expect(refused(result.current.notice)).toBe(false);
      });
    };

    await exported();
    act(() => {
      result.current.dismissNotice();
    });
    expect(result.current.notice).toBeUndefined();

    await exported();
    vi.useFakeTimers();
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.notice).toBeDefined();

    act(() => {
      dispatch(Action.Select({ elementIds: [selectableElement] }));
    });
    expect(result.current.notice).toBeUndefined();
  });

  it('keeps a refusal through a selection, and clears it on Dismiss', async () => {
    const bridge = specBridge({
      save: SaveOutcome.Refused({ reason: 'NotAllowedError' }),
    });
    const result = session(bridge);

    act(() => {
      result.current.commands.register();
    });
    await waitFor(() => {
      expect(refused(result.current.notice)).toBe(true);
    });

    act(() => {
      dispatch(Action.Select({ elementIds: [selectableElement] }));
    });
    expect(refused(result.current.notice)).toBe(true);

    act(() => {
      result.current.dismissNotice();
    });
    expect(result.current.notice).toBeUndefined();
  });

  it('says nothing when the export picker is cancelled', async () => {
    const bridge = specBridge();
    vi.spyOn(bridge, 'exportFile')
      .mockResolvedValueOnce(SaveOutcome.Refused({ reason: 'NotAllowedError' }))
      .mockResolvedValueOnce(SaveOutcome.Cancelled());
    const result = session(bridge);

    act(() => {
      result.current.commands.register();
    });
    await waitFor(() => {
      expect(result.current.notice).toBeDefined();
    });

    act(() => {
      result.current.commands.register();
    });
    await waitFor(() => {
      expect(result.current.notice).toBeUndefined();
    });
  });

  it('uses the only diagram when the registry supplies no id', async () => {
    const bridge = specBridge();
    const result = session(bridge);

    act(() => {
      result.current.commands.diagram();
    });

    await waitFor(() => {
      expect(bridge.writes[0]?.name).toBe('model.svg');
    });
  });

  it('writes nothing when no diagram or id chooses one', () => {
    modelStore.setState(
      openedState({
        ...sampleModel,
        diagrams: [
          sampleModel.diagrams[0],
          { id: diagramId('other'), title: 'Other', elements: [] },
        ],
      }),
      true,
    );
    const bridge = specBridge();
    const result = session(bridge);

    act(() => {
      result.current.commands.diagram();
      result.current.commands.diagram(diagramId('missing'));
    });

    expect(bridge.writes).toEqual([]);
  });

  it('uses Untitled when the model has no open file', async () => {
    modelStore.setState(initialState(sampleModel), true);
    const bridge = specBridge();
    const result = session(bridge);

    act(() => {
      result.current.commands.register();
    });

    await waitFor(() => {
      expect(bridge.writes[0]?.name).toBe('Untitled.md');
    });
  });
});
