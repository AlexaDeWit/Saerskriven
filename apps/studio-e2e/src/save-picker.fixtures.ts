/** Keys for the save picker stub's recorded calls and writes. */
export const savePicker = {
  asked: 'saerskrivenSavePickerAsked',
  written: 'saerskrivenSavePickerWritten',
  dismissNext: 'saerskrivenSavePickerDismissNext',
} as const;

type SavePickerKeys = typeof savePicker;

type SaveOptions = {
  readonly suggestedName: string;
  readonly types: readonly { readonly description: string }[];
};

/** Supplies a save handle that records writes without opening an operating system dialog. */
export const stubSavePicker = (keys: SavePickerKeys): void => {
  const asked: { name: string; formats: string[] }[] = [];
  const written: string[] = [];
  Object.defineProperty(globalThis, keys.asked, { value: asked });
  Object.defineProperty(globalThis, keys.written, { value: written });
  Object.defineProperty(globalThis, 'showSaveFilePicker', {
    value: (options: SaveOptions) => {
      asked.push({
        name: options.suggestedName,
        formats: options.types.map(({ description }) => description),
      });
      if (Reflect.get(globalThis, keys.dismissNext) === true) {
        Reflect.set(globalThis, keys.dismissNext, false);
        return Promise.reject(new DOMException('Dismissed', 'AbortError'));
      }
      return Promise.resolve({
        name: 'chosen.json',
        createWritable: () =>
          Promise.resolve({
            write: (text: string) => {
              written.push(text);
              return Promise.resolve();
            },
            close: () => Promise.resolve(),
          }),
      });
    },
  });
};
