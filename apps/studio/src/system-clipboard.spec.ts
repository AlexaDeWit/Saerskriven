import { Either } from 'effect';
import { recordingClipboard } from './canvas/canvas.fixtures.js';
import { deferred } from './files/files.fixtures.js';
import { writeClipboard } from './system-clipboard.js';

const itemClipboard = () => {
  const items: ClipboardItem[] = [];
  const write = vi.fn<(written: ClipboardItem[]) => Promise<void>>(
    async (written) => {
      items.push(...written);
      await Promise.all(written.map((item) => item.getType('text/plain')));
    },
  );
  vi.stubGlobal(
    'ClipboardItem',
    class {
      readonly types = ['text/plain'];
      constructor(
        private readonly data: Record<string, Promise<Blob | string>>,
      ) {}
      getType(type: string): Promise<Blob | string> {
        return this.data[type] ?? Promise.reject(new Error(type));
      }
    },
  );
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { write },
  });
  return {
    write,
    text: async (): Promise<string> => {
      const blob = await items[0]?.getType('text/plain');
      return blob instanceof Blob ? blob.text() : String(blob);
    },
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the system clipboard', () => {
  it('writes a text it holds now', async () => {
    const clipboard = recordingClipboard();

    expect(await writeClipboard('model')).toEqual(Either.right(undefined));
    expect(clipboard.text()).toBe('model');
  });

  it('asks for the write before a promised text is ready, where the browser holds a ClipboardItem', async () => {
    const clipboard = itemClipboard();
    const link = deferred<string | undefined>();

    const written = writeClipboard(link.promise);

    expect(clipboard.write).toHaveBeenCalledTimes(1);
    link.resolve('https://saerskriven.com/#share=1.G2QA');
    expect(await written).toEqual(Either.right(undefined));
    expect(await clipboard.text()).toBe(
      'https://saerskriven.com/#share=1.G2QA',
    );
  });

  it('writes a promised text once it is ready, where the browser holds no ClipboardItem', async () => {
    const clipboard = recordingClipboard();

    expect(await writeClipboard(Promise.resolve('link'))).toEqual(
      Either.right(undefined),
    );
    expect(clipboard.text()).toBe('link');
  });

  it('writes nothing where the promised text never came', async () => {
    const clipboard = recordingClipboard();

    await writeClipboard(Promise.resolve(undefined));

    expect(clipboard.writeText).not.toHaveBeenCalled();
    expect(clipboard.text()).toBe('existing clipboard');
  });

  it('answers the text the browser refused the write with', async () => {
    const clipboard = recordingClipboard();
    clipboard.writeText.mockRejectedValueOnce(
      new Error('Clipboard write was blocked due to lack of user activation.'),
    );

    expect(await writeClipboard('model')).toEqual(
      Either.left(
        'Clipboard write was blocked due to lack of user activation.',
      ),
    );
  });
});
