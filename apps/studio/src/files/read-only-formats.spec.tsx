import { saerskrivenYamlCodec } from '@saerskriven/formats';
import { act, renderHook, waitFor } from '@testing-library/react';
import { Either } from 'effect';
import { isDirty } from '../store/selectors.js';
import { initialState } from '../store/state.js';
import { modelStore } from '../store/store.js';
import { sampleModel } from '../store/store.fixtures.js';
import { browserFileBridge } from './browser-bridge.js';
import { useFileSession } from './file-commands.js';
import {
  chosenFile,
  deferred,
  handleFor,
  openPicker,
  recordDownloads,
  sampleNativeText,
  specBridge,
  vendoredFile,
} from './files.fixtures.js';
import type { FileContent } from './bridge.js';

beforeEach(() => {
  browserFileBridge.release();
  modelStore.setState(initialState(sampleModel), true);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('opens an OTM file through the fallback picker as a new model, and Save writes YAML under its stem', async () => {
  const bridge = specBridge({ picker: false });
  const { result } = renderHook(() => useFileSession(bridge));
  const input = document.createElement('input');
  const click = vi.spyOn(input, 'click');
  act(() => {
    result.current.attachPicker(input);
    result.current.commands.open();
  });
  await waitFor(() => {
    expect(click).toHaveBeenCalledOnce();
  });
  await act(() => result.current.receive(vendoredFile('otm/example.json')));
  expect(isDirty(modelStore.getState())).toBe(true);
  expect(modelStore.getState().file).toMatchObject({
    name: 'example.yaml',
    source: { format: 'saerskriven-yaml', document: undefined },
  });
  expect(result.current.report?.readOnly).toBe('otm');
  act(() => {
    result.current.commands.save();
  });
  await waitFor(() => {
    expect(bridge.writes).toHaveLength(1);
  });
  expect(bridge.writes[0].name).toBe('example.yaml');
  expect(Either.isRight(saerskrivenYamlCodec.read(bridge.writes[0].text))).toBe(
    true,
  );
  expect(isDirty(modelStore.getState())).toBe(false);
});

it('opens a TM-BOM file through the picker without keeping it, and Save asks where with YAML first', async () => {
  const bridge = specBridge({ offers: vendoredFile('tmbom/example.json') });
  const { result } = renderHook(() => useFileSession(bridge));
  act(() => {
    result.current.commands.open();
  });
  await waitFor(() => {
    expect(result.current.report?.readOnly).toBe('tmbom');
  });
  expect(bridge.writesBack()).toBe(false);
  act(() => {
    result.current.commands.save();
  });
  await waitFor(() => {
    expect(bridge.writes).toHaveLength(1);
  });
  expect(bridge.writes[0]).toMatchObject({
    name: 'example.yaml',
    elsewhere: true,
  });
  expect(bridge.offered[0][0].description).toBe('Saerskriven YAML');
});

it('never writes the OTM file it opened, nor the file open before it', async () => {
  const original: FileContent[] = [];
  const source: FileContent[] = [];
  vi.stubGlobal(
    'showOpenFilePicker',
    openPicker()
      .mockResolvedValueOnce([
        handleFor('original.yaml', sampleNativeText, original),
      ])
      .mockResolvedValueOnce([
        handleFor(
          'source.otm',
          await vendoredFile('otm/example.json').text(),
          source,
        ),
      ]),
  );
  const { result } = renderHook(() => useFileSession(browserFileBridge));
  act(() => {
    result.current.commands.open();
  });
  await waitFor(() => {
    expect(modelStore.getState().file).toMatchObject({ name: 'original.yaml' });
  });
  act(() => {
    result.current.commands.open();
  });
  await waitFor(() => {
    expect(modelStore.getState().file).toMatchObject({ name: 'source.yaml' });
  });
  const downloads = recordDownloads();
  act(() => {
    result.current.commands.save();
  });
  await waitFor(() => {
    expect(downloads).toEqual(['source.yaml']);
  });
  expect(original).toEqual([]);
  expect(source).toEqual([]);
});

it('ignores a late OTM read when a newer open already owns the session', async () => {
  const pending = deferred<string>();
  const bridge = specBridge({
    offers: chosenFile('slow.otm', '', () => pending.promise),
  });
  const { result } = renderHook(() => useFileSession(bridge));
  act(() => {
    result.current.commands.open();
  });
  await act(() =>
    result.current.receive(chosenFile('new.yaml', sampleNativeText)),
  );
  await act(async () => {
    pending.resolve(await vendoredFile('otm/example.json').text());
  });
  expect(modelStore.getState().file).toMatchObject({ name: 'new.yaml' });
  expect(result.current.report).toBeUndefined();
});
