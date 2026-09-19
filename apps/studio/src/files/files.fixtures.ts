import { saerskrivenYamlCodec } from '@saerskriven/formats';
import { committedText, testDataPath } from '@saerskriven/model/fixtures';
import { renderSvg } from '@saerskriven/render';
import { act } from '@testing-library/react';
import { Either } from 'effect';
import { statSync } from 'node:fs';
import { addedProcess, sampleModel } from '../store/store.fixtures.js';
import { dispatch } from '../store/store.js';
import {
  OpenOutcome,
  SaveOutcome,
  fileOwnership,
  readWithin,
  type ChosenFile,
  type FileContent,
  type FileBridge,
  type FileResult,
  type SaveFileType,
} from './bridge.js';
import type { RenderExports } from './export-commands.js';

/**
 * The bytes a PNG file opens with, so a spec can tell one from other content
 * without reading the whole file.
 */
export const pngSignature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

/**
 * Render services that answer without WebAssembly, one field at a time
 * replaceable by the spec that is about that field.
 */
export function specRenders(
  overrides: Partial<RenderExports> = {},
): RenderExports {
  const assets = { wasm: new Uint8Array(), fonts: [] };
  return {
    pdfAssets: () => Promise.resolve(Either.right(assets)),
    compile: () => Promise.resolve(Either.right(new Uint8Array([37, 80]))),
    pngAssets: () => Promise.resolve(Either.right(assets)),
    draw: (diagram, model, locale) =>
      Promise.resolve(
        Either.right({
          png: pngSignature,
          width: 2,
          height: 1,
          unplaced: renderSvg(diagram, model, locale).unplaced,
        }),
      ),
    ...overrides,
  };
}

/**
 * A file a spec hands to a bridge, standing in for a browser `File`. Its size
 * is the text's, and a spec that controls when or how the read settles passes
 * its own `read`.
 */
export function chosenFile(
  name: string,
  text: string,
  read: () => Promise<string> = () => Promise.resolve(text),
): ChosenFile {
  return { name, size: Buffer.byteLength(text, 'utf8'), text: read };
}

/** A file of `size` bytes whose read fails, as one moved after it was chosen. */
export const unreadableFile = (name: string, size: number): ChosenFile => ({
  name,
  size,
  text: () => Promise.reject(new Error('The file was moved.')),
});

/**
 * A Threat Dragon document whose one diagram lacks what the wire schema
 * requires, so the codec claims it and refuses it with a path.
 */
export const brokenThreatDragonText = JSON.stringify({
  version: '2.0',
  summary: { title: 'Broken' },
  detail: { diagrams: [{ id: 0 }] },
});

/** The store's sample model as the native format writes it. */
export const sampleNativeText = saerskrivenYamlCodec.write(sampleModel).output;

/** Adds a process to the open model, one undoable edit that dirties the file. */
export const edit = (): void => {
  act(() => {
    dispatch(addedProcess);
  });
};

/**
 * Stubs the object URL calls and the anchor click a download goes through, and
 * answers with the names downloaded, in order. `vi.unstubAllGlobals` and
 * `vi.restoreAllMocks` undo it.
 */
export function recordDownloads(): readonly string[] {
  const downloads: string[] = [];
  vi.stubGlobal(
    'URL',
    class extends URL {
      static override createObjectURL(): string {
        return 'blob:model';
      }
      static override revokeObjectURL(): void {}
    },
  );
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
    function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    },
  );
  return downloads;
}

/** A stand-in for the browser's open picker, answering with file handles. */
export const openPicker = () =>
  vi.fn<() => Promise<ReturnType<typeof handleFor>[]>>();

/** A browser file handle whose writes and completion a spec controls. */
export const handleFor = (
  name: string,
  text: string,
  written: FileContent[],
  close: () => Promise<void> = () => Promise.resolve(),
) => ({
  name,
  getFile: () => Promise.resolve(chosenFile(name, text)),
  createWritable: () =>
    Promise.resolve({
      write: (chunk: FileContent) => {
        written.push(chunk);
        return Promise.resolve();
      },
      close,
    }),
});

/** A promise whose result a spec supplies after starting concurrent operations. */
export function deferred<Value>() {
  let resolveValue: ((value: Value) => void) | undefined;
  let rejectValue: ((reason: Error) => void) | undefined;
  const promise = new Promise<Value>((resolve, reject) => {
    resolveValue = resolve;
    rejectValue = reject;
  });
  return {
    promise,
    resolve: (value: Value): void => {
      resolveValue?.(value);
    },
    reject: (reason: Error): void => {
      rejectValue?.(reason);
    },
  };
}

/** Settles a bridge outcome without codec validation for platform-level specs. */
export async function settled<Outcome extends OpenOutcome | SaveOutcome>(
  pending: Promise<FileResult<Outcome>>,
): Promise<Outcome> {
  const result = await pending;
  result.settle(
    result.outcome._tag !== 'TooLarge' && result.outcome._tag !== 'Unreadable',
  );
  return result.outcome;
}

/** A committed file under `test-data` with its on-disk byte count. */
export function vendoredFile(path: string): ChosenFile {
  const text = committedText(path);
  return {
    name: path.split('/').at(-1) ?? path,
    size: statSync(testDataPath(path)).size,
    text: () => Promise.resolve(text),
  };
}

type Recorded = {
  readonly name: string;
  readonly text: string;
  readonly bytes?: Uint8Array;
  readonly elsewhere: boolean;
};

type Releases = { count: number };

/** A bridge recording writes, picker offers in order, and releases. */
export type SpecBridge = FileBridge & {
  readonly writes: readonly Recorded[];
  readonly offered: readonly (readonly SaveFileType[])[];
  readonly releases: Releases;
};

type SpecBridgeOptions = {
  readonly offers?: ChosenFile;
  readonly chooses?: string;
  readonly picker?: boolean;
  readonly save?: SaveOutcome;
};

/**
 * A bridge reading through the size bound it is handed and recording the
 * writes. By default an open is cancelled and a save writes the proposed name.
 */
export function specBridge(options: SpecBridgeOptions = {}): SpecBridge {
  const ownership = fileOwnership<never>();
  const writes: Recorded[] = [];
  const offered: (readonly SaveFileType[])[] = [];
  const releases: Releases = { count: 0 };

  const request = async <Outcome>(
    work: () => Promise<Outcome>,
  ): Promise<FileResult<Outcome>> => {
    const complete = ownership.begin();
    return complete(await work(), undefined);
  };

  const opened = (maxBytes: number): Promise<OpenOutcome> => {
    if (options.picker === false) {
      return Promise.resolve(OpenOutcome.NoPicker());
    }
    return options.offers === undefined
      ? Promise.resolve(OpenOutcome.Cancelled())
      : readWithin(options.offers, maxBytes);
  };

  const answer = (
    name: string,
    content: FileContent,
    elsewhere: boolean,
  ): Promise<SaveOutcome> => {
    const outcome = options.save ?? SaveOutcome.Written({ name });
    if (SaveOutcome.$is('Written')(outcome)) {
      writes.push({
        name: outcome.name,
        text: typeof content === 'string' ? content : '',
        bytes: typeof content === 'string' ? undefined : content,
        elsewhere,
      });
    }
    return Promise.resolve(outcome);
  };

  return {
    writes,
    offered,
    releases,
    open: (maxBytes) => request(() => opened(maxBytes)),
    received: (file, maxBytes) => request(() => readWithin(file, maxBytes)),
    save: (name, text) => request(() => answer(name, text, false)),
    saveAs: (name, types, text) =>
      request(() => {
        offered.push(types);
        const chosen =
          options.picker === false ? name : (options.chooses ?? name);
        return answer(chosen, text(chosen), true);
      }),
    exportFile: (name, type, content) => {
      offered.push([type]);
      const chosen =
        options.picker === false ? name : (options.chooses ?? name);
      return answer(chosen, content, true);
    },
    asksWhere: () => options.picker !== false,
    release: () => {
      ownership.release();
      releases.count += 1;
    },
  };
}
