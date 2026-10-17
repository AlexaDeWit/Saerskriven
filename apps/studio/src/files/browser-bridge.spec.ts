import {
  OpenOutcome,
  SaveOutcome,
  type FileBridge,
  type FileContent,
  type SaveFileType,
} from './bridge.js';
import { browserBridge, pickerIds } from './browser-bridge.js';
import {
  chosenFile,
  deferred,
  dismissal,
  handleFor,
  memoryRecentStore,
  openPicker,
  recordDownloads,
  settled,
} from './files.fixtures.js';

const types: readonly SaveFileType[] = [
  {
    description: 'Saerskriven YAML',
    accept: { 'application/yaml': ['.yaml', '.yml'] },
  },
  {
    description: 'Threat Dragon JSON',
    accept: { 'application/json': ['.json'] },
  },
];

const inTheFormatOf = (name: string): string =>
  name.endsWith('.json') ? '{}' : 'a: 1';

let downloads: readonly string[] = [];

const freshBridge = (): FileBridge => browserBridge(memoryRecentStore());

type Handle = ReturnType<typeof handleFor>;

const names = async (bridge: FileBridge): Promise<readonly string[]> =>
  (await bridge.recentFiles()).map(({ name }) => name);

const declined = (name: string): Handle => ({
  ...handleFor(name, 'a: 1', []),
  requestPermission: () => Promise.resolve<PermissionState>('denied'),
});

const picking = (...handles: readonly Handle[]) => {
  const picker = vi.fn<(options: unknown) => Promise<readonly Handle[]>>();
  for (const handle of handles) {
    picker.mockResolvedValueOnce([handle]);
  }
  vi.stubGlobal('showOpenFilePicker', picker);
  return picker;
};

const interruptions = [
  [
    'an open supersedes it',
    async (bridge: FileBridge): Promise<void> => {
      await settled(bridge.open(1024));
    },
  ],
  [
    'the file is released',
    (bridge: FileBridge): Promise<void> => {
      bridge.release();
      return Promise.resolve();
    },
  ],
] as const;

beforeEach(() => {
  downloads = recordDownloads();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('opening', () => {
  it.each(['open', 'save'] as const)(
    'does not release a newer open when an older %s fails',
    async (older) => {
      const failure = deferred<void>();
      const success = deferred<string>();
      const written: FileContent[] = [];
      const picker = openPicker().mockResolvedValueOnce([
        handleFor('original.yaml', 'a: 1', [], () => failure.promise),
      ]);
      vi.stubGlobal('showOpenFilePicker', picker);
      const bridge = freshBridge();
      await settled(bridge.open(1024));
      if (older === 'open') {
        picker.mockResolvedValueOnce([
          {
            ...handleFor('failed.yaml', '', []),
            getFile: () =>
              Promise.resolve(
                chosenFile('failed.yaml', '', () =>
                  failure.promise.then(() => ''),
                ),
              ),
          },
        ]);
      }
      const failed = (
        older === 'open'
          ? bridge.open(1024)
          : bridge.save('original.yaml', 'b: 2')
      ).then((result) => result.settle(false));
      picker.mockResolvedValueOnce([
        {
          ...handleFor('replacement.yaml', 'a: 1', written),
          getFile: () =>
            Promise.resolve(
              chosenFile('replacement.yaml', 'a: 1', () => success.promise),
            ),
        },
      ]);
      const opened = bridge.open(1024).then((result) => result.settle(true));
      failure.reject(new Error('NotAllowedError'));
      success.resolve('a: 1');
      expect(await Promise.all([failed, opened])).toEqual([false, true]);
      await settled(bridge.save('replacement.yaml', 'b: 2'));
      expect(written).toEqual(['b: 2']);
      expect(downloads).toEqual([]);
    },
  );

  it('asks the caller for its own picker where the browser has none', async () => {
    const bridge = freshBridge();

    expect(await settled(bridge.open(1024))).toEqual(OpenOutcome.NoPicker());
  });

  it('reads the file the picker handed over', async () => {
    vi.stubGlobal('showOpenFilePicker', () =>
      Promise.resolve([handleFor('model.yaml', 'a: 1', [])]),
    );
    const bridge = freshBridge();

    expect(await settled(bridge.open(1024))).toEqual(
      OpenOutcome.Chosen({ name: 'model.yaml', text: 'a: 1' }),
    );
  });

  it('reports what the picker refused with', async () => {
    vi.stubGlobal('showOpenFilePicker', () =>
      Promise.reject(new Error('NotAllowedError')),
    );
    const bridge = freshBridge();

    expect(await settled(bridge.open(1024))).toEqual(
      OpenOutcome.Unreadable({ reason: 'NotAllowedError' }),
    );
  });

  it.each([
    { named: 'was dismissed', picked: () => Promise.reject(dismissal()) },
    { named: 'handed nothing over', picked: () => Promise.resolve([]) },
  ])('says nothing where the picker $named', async ({ picked }) => {
    vi.stubGlobal('showOpenFilePicker', picked);
    const bridge = freshBridge();

    expect(await settled(bridge.open(1024))).toEqual(OpenOutcome.Cancelled());
  });
});

describe('saving', () => {
  it('writes back to the very file that was opened', async () => {
    const written: string[] = [];
    vi.stubGlobal('showOpenFilePicker', () =>
      Promise.resolve([handleFor('model.yaml', 'a: 1', written)]),
    );
    const bridge = freshBridge();
    await settled(bridge.open(1024));

    expect(await settled(bridge.save('proposed.yaml', 'b: 2'))).toEqual(
      SaveOutcome.Written({ name: 'model.yaml' }),
    );
    expect(written).toEqual(['b: 2']);
  });

  it('reports a write the platform refused', async () => {
    vi.stubGlobal('showOpenFilePicker', () =>
      Promise.resolve([
        {
          name: 'model.yaml',
          getFile: () => Promise.resolve(chosenFile('model.yaml', 'a: 1')),
          createWritable: () => Promise.reject(new Error('NotAllowedError')),
        },
      ]),
    );
    const bridge = freshBridge();
    await settled(bridge.open(1024));

    expect(await settled(bridge.save('model.yaml', 'b: 2'))).toEqual(
      SaveOutcome.Refused({ reason: 'NotAllowedError' }),
    );
  });

  it('offers a download where the file the picker named would not read', async () => {
    const written: string[] = [];
    vi.stubGlobal('showOpenFilePicker', () =>
      Promise.resolve([handleFor('huge.json', 'a'.repeat(100), written)]),
    );
    const bridge = freshBridge();

    expect((await settled(bridge.open(10)))._tag).toBe('TooLarge');
    expect(await settled(bridge.save('threat-model.yaml', 'a: 1'))).toEqual(
      SaveOutcome.Written({ name: 'threat-model.yaml' }),
    );
    expect(written).toEqual([]);
    expect(downloads).toEqual(['threat-model.yaml']);
  });

  it('offers a download where no file was opened through a picker', async () => {
    const bridge = freshBridge();

    expect(await settled(bridge.save('threat-model.yaml', 'a: 1'))).toEqual(
      SaveOutcome.Written({ name: 'threat-model.yaml' }),
    );
    expect(downloads).toEqual(['threat-model.yaml']);
  });

  it('writes where a save-as asked, and a later save follows it there', async () => {
    const written: string[] = [];
    vi.stubGlobal('showSaveFilePicker', () =>
      Promise.resolve(handleFor('chosen.yaml', '', written)),
    );
    const bridge = freshBridge();

    expect(
      await settled(bridge.saveAs('proposed.yaml', types, inTheFormatOf)),
    ).toEqual(SaveOutcome.Written({ name: 'chosen.yaml' }));
    await settled(bridge.save('proposed.yaml', 'second'));

    expect(written).toEqual(['a: 1', 'second']);
  });

  it('offers every format, and writes the one the name it came back with is in', async () => {
    const written: string[] = [];
    const asked: unknown[] = [];
    vi.stubGlobal('showSaveFilePicker', (options: unknown) => {
      asked.push(options);
      return Promise.resolve(handleFor('chosen.json', '', written));
    });
    const bridge = freshBridge();

    expect(
      await settled(bridge.saveAs('proposed.yaml', types, inTheFormatOf)),
    ).toEqual(SaveOutcome.Written({ name: 'chosen.json' }));

    expect(asked).toEqual([
      { id: pickerIds.save, suggestedName: 'proposed.yaml', types },
    ]);
    expect(written).toEqual(['{}']);
  });

  it('keeps writing back to the open file when a save-as is refused where it was pointed', async () => {
    const written: string[] = [];
    vi.stubGlobal('showOpenFilePicker', () =>
      Promise.resolve([handleFor('model.json', '{}', written)]),
    );
    vi.stubGlobal('showSaveFilePicker', () =>
      Promise.resolve({
        name: 'elsewhere.json',
        createWritable: () => Promise.reject(new Error('NotAllowedError')),
      }),
    );
    const bridge = freshBridge();
    await settled(bridge.open(1024));

    expect(
      await settled(bridge.saveAs('elsewhere.json', types, inTheFormatOf)),
    ).toEqual(SaveOutcome.Refused({ reason: 'NotAllowedError' }));
    await settled(bridge.save('model.json', 'second'));

    expect(written).toEqual(['second']);
    expect(downloads).toEqual([]);
  });

  it('says nothing where a save-as was dismissed, and keeps writing back to the open file', async () => {
    const written: string[] = [];
    vi.stubGlobal('showOpenFilePicker', () =>
      Promise.resolve([handleFor('model.json', '{}', written)]),
    );
    vi.stubGlobal('showSaveFilePicker', () => Promise.reject(dismissal()));
    const bridge = freshBridge();
    await settled(bridge.open(1024));

    expect(
      await settled(bridge.saveAs('model.yaml', types, inTheFormatOf)),
    ).toEqual(SaveOutcome.Cancelled());
    await settled(bridge.save('model.json', 'second'));

    expect(written).toEqual(['second']);
    expect(downloads).toEqual([]);
  });

  it('says it cannot ask where, and downloads the format it was handed, on a browser with no save picker', async () => {
    const written: string[] = [];
    vi.stubGlobal('showOpenFilePicker', () =>
      Promise.resolve([handleFor('model.json', '{}', written)]),
    );
    const bridge = freshBridge();
    await settled(bridge.open(1024));

    expect(bridge.asksWhere()).toBe(false);
    expect(
      await settled(bridge.saveAs('model.yaml', types, inTheFormatOf)),
    ).toEqual(SaveOutcome.Written({ name: 'model.yaml' }));
    await settled(bridge.save('model.yaml', 'a: 1'));

    expect(written).toEqual([]);
    expect(downloads).toEqual(['model.yaml', 'model.yaml']);
  });

  it('says it writes back only while it holds a file a picker handed over', async () => {
    vi.stubGlobal('showOpenFilePicker', () =>
      Promise.resolve([handleFor('model.yaml', 'a: 1', [])]),
    );
    vi.stubGlobal('showSaveFilePicker', () => Promise.reject(dismissal()));
    const bridge = freshBridge();

    expect(bridge.writesBack()).toBe(false);
    await settled(bridge.open(1024));
    expect(bridge.writesBack()).toBe(true);
    await settled(bridge.saveAs('model.yaml', types, inTheFormatOf));
    expect(bridge.writesBack()).toBe(true);
    bridge.release();
    expect(bridge.writesBack()).toBe(false);
  });

  it('says it can ask where wherever the browser has that picker', () => {
    vi.stubGlobal('showSaveFilePicker', () =>
      Promise.resolve(handleFor('chosen.yaml', '', [])),
    );
    const bridge = freshBridge();

    expect(bridge.asksWhere()).toBe(true);
  });

  it('forgets it too when the caller opened through its own file input', async () => {
    const written: string[] = [];
    vi.stubGlobal('showOpenFilePicker', () =>
      Promise.resolve([handleFor('model.json', '{}', written)]),
    );
    const bridge = freshBridge();
    await settled(bridge.open(1024));

    await settled(bridge.received(chosenFile('other.yaml', 'a: 1'), 1024));
    await settled(bridge.save('other.yaml', 'a: 1'));

    expect(written).toEqual([]);
    expect(downloads).toEqual(['other.yaml']);
  });

  it('forgets it when the file is released, so a later save writes nowhere near it', async () => {
    const written: string[] = [];
    vi.stubGlobal('showOpenFilePicker', () =>
      Promise.resolve([handleFor('model.json', '{}', written)]),
    );
    const bridge = freshBridge();
    await settled(bridge.open(1024));

    bridge.release();
    await settled(bridge.save('threat-model.yaml', 'a: 1'));

    expect(written).toEqual([]);
    expect(downloads).toEqual(['threat-model.yaml']);
  });

  it.each(['picker', 'input'] as const)(
    'downloads after the session releases a refused %s open',
    async (path) => {
      const original: FileContent[] = [];
      const rejected: FileContent[] = [];
      const picker = openPicker()
        .mockResolvedValueOnce([handleFor('model.yaml', 'a: 1', original)])
        .mockResolvedValueOnce([
          handleFor('notes.txt', 'not a model', rejected),
        ]);
      vi.stubGlobal('showOpenFilePicker', picker);
      const bridge = freshBridge();
      await settled(bridge.open(1024));

      const result =
        path === 'picker'
          ? await bridge.open(1024)
          : await bridge.received(chosenFile('notes.txt', 'not a model'), 1024);
      expect(result.outcome._tag).toBe('Chosen');

      expect(result.settle(false)).toBe(true);
      expect(await settled(bridge.save('threat-model.yaml', 'b: 2'))).toEqual(
        SaveOutcome.Written({ name: 'threat-model.yaml' }),
      );
      expect(original).toEqual([]);
      expect(rejected).toEqual([]);
      expect(downloads).toEqual(['threat-model.yaml']);
    },
  );
});

describe('exporting', () => {
  it('writes text through the picker without replacing the open file', async () => {
    const opened: FileContent[] = [];
    const exported: FileContent[] = [];
    vi.stubGlobal('showOpenFilePicker', () =>
      Promise.resolve([handleFor('model.yaml', 'a: 1', opened)]),
    );
    vi.stubGlobal('showSaveFilePicker', () =>
      Promise.resolve(handleFor('model.svg', '', exported)),
    );
    const bridge = freshBridge();
    await settled(bridge.open(1024));

    expect(await bridge.exportFile('model.svg', types[0], '<svg/>')).toEqual(
      SaveOutcome.Written({ name: 'model.svg' }),
    );
    await settled(bridge.save('model.yaml', 'second'));

    expect(exported).toEqual(['<svg/>']);
    expect(opened).toEqual(['second']);
  });

  it('starts the export picker beside the open file, and where the browser chooses without one', async () => {
    const opened = handleFor('model.yaml', 'a: 1', []);
    picking(opened);
    const asked: unknown[] = [];
    vi.stubGlobal('showSaveFilePicker', (options: unknown) => {
      asked.push(options);
      return Promise.resolve(handleFor('model.svg', '', []));
    });
    const bridge = freshBridge();

    await bridge.exportFile('model.svg', types[0], '<svg/>');
    await settled(bridge.open(1024));
    await bridge.exportFile('model.svg', types[0], '<svg/>');

    expect(asked).toEqual([
      { startIn: undefined, suggestedName: 'model.svg', types: [types[0]] },
      { startIn: opened, suggestedName: 'model.svg', types: [types[0]] },
    ]);
  });

  it('downloads binary content under the proposed name without a picker', async () => {
    const bridge = freshBridge();
    const pdf = new Uint8Array([37, 80, 68, 70]);

    expect(await bridge.exportFile('Untitled.pdf', types[0], pdf)).toEqual(
      SaveOutcome.Written({ name: 'Untitled.pdf' }),
    );
    expect(downloads).toEqual(['Untitled.pdf']);
  });

  it('reports a refused export picker and treats its dismissal as no write', async () => {
    vi.stubGlobal('showSaveFilePicker', () =>
      Promise.reject(new Error('NotAllowedError')),
    );
    const bridge = freshBridge();

    expect(await bridge.exportFile('model.svg', types[0], '<svg/>')).toEqual(
      SaveOutcome.Refused({ reason: 'NotAllowedError' }),
    );

    vi.stubGlobal('showSaveFilePicker', () => Promise.reject(dismissal()));

    expect(await bridge.exportFile('model.svg', types[0], '<svg/>')).toEqual(
      SaveOutcome.Cancelled(),
    );
  });
});

describe('the recent list', () => {
  it('lists each file a settlement takes up, most recent first, and the same file once', async () => {
    picking(
      handleFor('first.yaml', 'a: 1', []),
      handleFor('second.yaml', 'a: 1', []),
      handleFor('first.yaml', 'a: 1', []),
    );
    const bridge = freshBridge();

    await settled(bridge.open(1024));
    await settled(bridge.open(1024));
    expect(await names(bridge)).toEqual(['second.yaml', 'first.yaml']);

    await settled(bridge.open(1024));
    expect(await names(bridge)).toEqual(['first.yaml', 'second.yaml']);
  });

  it('lists a file a save-as wrote, and not one whose open settled without it', async () => {
    picking(handleFor('imported.json', '{}', []));
    vi.stubGlobal('showSaveFilePicker', () =>
      Promise.resolve(handleFor('saved.yaml', '', [])),
    );
    const bridge = freshBridge();

    (await bridge.open(1024)).settle(false);
    await settled(bridge.saveAs('proposed.yaml', types, inTheFormatOf));

    expect(await names(bridge)).toEqual(['saved.yaml']);
  });

  it('leaves the list alone when a save writes back to the open file', async () => {
    picking(handleFor('model.yaml', 'a: 1', []));
    const bridge = freshBridge();
    await settled(bridge.open(1024));
    await bridge.clearRecent();

    await settled(bridge.save('model.yaml', 'b: 2'));

    expect(await names(bridge)).toEqual([]);
  });

  it('keeps the ten most recent files', async () => {
    const files = Array.from(
      { length: 11 },
      (_, index) => `model-${String(index)}.yaml`,
    );
    picking(...files.map((name) => handleFor(name, 'a: 1', [])));
    const bridge = freshBridge();

    for (let opened = 0; opened < files.length; opened += 1) {
      await settled(bridge.open(1024));
    }

    expect(await names(bridge)).toEqual(
      Array.from({ length: 10 }, (_, index) => files[files.length - 1 - index]),
    );
  });

  it('keeps both files where two tabs each take one up at once', async () => {
    picking(
      handleFor('first.yaml', 'a: 1', []),
      handleFor('second.yaml', 'a: 1', []),
    );
    const store = memoryRecentStore();
    const tabs = [browserBridge(store), browserBridge(store)];

    await Promise.all(tabs.map((tab) => settled(tab.open(1024))));

    const listed = await names(tabs[0]);
    expect(listed).toHaveLength(2);
    expect(listed).toEqual(
      expect.arrayContaining(['first.yaml', 'second.yaml']),
    );
  });

  it('reopens a listed file once the browser grants the permission Save needs', async () => {
    const requestPermission = vi.fn<() => Promise<PermissionState>>(() =>
      Promise.resolve<PermissionState>('granted'),
    );
    picking({ ...handleFor('model.yaml', 'a: 1', []), requestPermission });
    const bridge = freshBridge();
    await settled(bridge.open(1024));
    const [file] = await bridge.recentFiles();
    bridge.release();

    expect(await settled(bridge.reopen(file, 1024))).toEqual(
      OpenOutcome.Chosen({ name: 'model.yaml', text: 'a: 1' }),
    );
    expect(requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
    expect(bridge.writesBack()).toBe(true);
  });

  it('keeps a file whose permission was declined, and opens nothing', async () => {
    picking(declined('model.yaml'));
    const bridge = freshBridge();
    await settled(bridge.open(1024));
    const [file] = await bridge.recentFiles();

    expect(await settled(bridge.reopen(file, 1024))).toEqual(
      OpenOutcome.Declined(),
    );
    expect(await names(bridge)).toEqual(['model.yaml']);
  });

  it('drops a file that is no longer there, naming it', async () => {
    const handle = handleFor('moved.yaml', 'a: 1', []);
    picking(handle);
    const bridge = freshBridge();
    await settled(bridge.open(1024));
    const [file] = await bridge.recentFiles();
    handle.getFile = () =>
      Promise.reject(new DOMException('Not found.', 'NotFoundError'));

    expect(await settled(bridge.reopen(file, 1024))).toEqual(
      OpenOutcome.Gone({ name: 'moved.yaml' }),
    );
    expect(await names(bridge)).toEqual([]);
  });

  it('starts the next open picker in the folder of a file a reopen did not open, and only the next', async () => {
    const refused = declined('model.yaml');
    const picker = picking(
      refused,
      handleFor('other.yaml', 'a: 1', []),
      handleFor('third.yaml', 'a: 1', []),
    );
    const bridge = freshBridge();
    await settled(bridge.open(1024));
    const [file] = await bridge.recentFiles();

    await settled(bridge.reopen(file, 1024));
    await settled(bridge.open(1024));
    await settled(bridge.open(1024));

    expect(picker.mock.calls.map(([options]) => options)).toEqual([
      { id: pickerIds.open, multiple: false, startIn: undefined },
      { id: pickerIds.open, multiple: false, startIn: refused },
      { id: pickerIds.open, multiple: false, startIn: undefined },
    ]);
  });

  it.each(interruptions)(
    'settles nothing, and leaves the next open picker alone, where %s before a reopen lands',
    async (_, interrupt) => {
      const picker = picking(
        declined('model.yaml'),
        handleFor('other.yaml', 'a: 1', []),
        handleFor('third.yaml', 'a: 1', []),
      );
      const bridge = freshBridge();
      await settled(bridge.open(1024));
      const [file] = await bridge.recentFiles();

      const reopening = bridge.reopen(file, 1024);
      await interrupt(bridge);

      expect((await reopening).settle('unchanged')).toBe(false);
      await settled(bridge.open(1024));
      expect(picker.mock.calls.at(-1)?.[0]).toMatchObject({
        startIn: undefined,
      });
    },
  );

  it('gives the open and the save picker each a folder of its own to remember', () => {
    expect(pickerIds.open).not.toBe(pickerIds.save);
  });

  it('empties the list', async () => {
    picking(handleFor('model.yaml', 'a: 1', []));
    const bridge = freshBridge();
    await settled(bridge.open(1024));

    await bridge.clearRecent();

    expect(await names(bridge)).toEqual([]);
  });

  it('keeps no list where the browser has no open picker', async () => {
    vi.stubGlobal('showSaveFilePicker', () =>
      Promise.resolve(handleFor('saved.yaml', '', [])),
    );
    const bridge = freshBridge();

    await settled(bridge.saveAs('proposed.yaml', types, inTheFormatOf));

    expect(bridge.keepsRecent()).toBe(false);
    expect(await bridge.recentFiles()).toEqual([]);
  });
});
