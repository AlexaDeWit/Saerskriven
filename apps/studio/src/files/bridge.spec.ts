import { OpenOutcome, fileOwnership, readWithin } from './bridge.js';
import { chosenFile, unreadableFile } from './files.fixtures.js';

describe('fileOwnership', () => {
  it.each([true, false])(
    'ignores stale settlement with retain=%s',
    (retain) => {
      const ownership = fileOwnership<string>();
      const older = ownership.begin();
      const newer = ownership.begin();
      const accepted = newer('read', 'replacement.yaml');
      expect(ownership.current()).toBeUndefined();
      expect(accepted.settle(true)).toBe(true);
      expect(older('read', 'original.yaml').settle(retain)).toBe(false);
      expect(accepted.settle(false)).toBe(false);
      expect(ownership.current()).toBe('replacement.yaml');
    },
  );

  it('invalidates a pending result when the file closes', () => {
    const ownership = fileOwnership<string>();
    const pending = ownership.begin();
    ownership.release();
    expect(pending('read', 'original.yaml').settle(true)).toBe(false);
    expect(ownership.current()).toBeUndefined();
  });
});

describe('readWithin', () => {
  it('hands over the text of a file inside the bound', async () => {
    const outcome = await readWithin(chosenFile('model.yaml', 'a: 1'), 1024);

    expect(outcome).toEqual(
      OpenOutcome.Chosen({ name: 'model.yaml', text: 'a: 1' }),
    );
  });

  it('refuses a file past the bound without reading any of it', async () => {
    const file = unreadableFile('gone.json', 1025);

    const outcome = await readWithin(file, 1024);

    expect(outcome).toEqual(
      OpenOutcome.TooLarge({ name: 'gone.json', bound: 1024, observed: 1025 }),
    );
  });

  it('measures the bound in bytes rather than in characters', async () => {
    const outcome = await readWithin(chosenFile('accents.yaml', 'ééé'), 5);

    expect(outcome._tag).toBe('TooLarge');
  });

  it('reports a file that would not read rather than throwing', async () => {
    const outcome = await readWithin(unreadableFile('gone.json', 4), 1024);

    expect(outcome).toEqual(
      OpenOutcome.Unreadable({ reason: 'The file was moved.' }),
    );
  });
});
