import {
  hasDiverged,
  readAnyFormat,
  readLimits,
  writeThrough,
  type Divergence,
  type FormatName,
} from '@saerskriven/formats';
import { Either } from 'effect';
import type { Action } from '../store/actions.js';
import { isDirty } from '../store/selectors.js';
import {
  FileLifecycle,
  initialState,
  placeholderModel,
} from '../store/state.js';
import { dispatch, modelStore } from '../store/store.js';
import {
  settled,
  specBridge,
  type SpecBridge,
  vendoredFile,
} from './files.fixtures.js';
import { formatOf, openedBy, saveTarget, savedBy } from './session.js';

type Gated = {
  readonly path: string;
  readonly format: FormatName;
};

const gated: readonly Gated[] = [
  { path: 'threat-dragon/feature-complete.json', format: 'threat-dragon' },
  { path: 'saerskriven/feature-complete.yaml', format: 'saerskriven-yaml' },
];

const untitledFile = 'threat-model';

const asDocument = (format: FormatName, text: string): unknown =>
  format === 'threat-dragon' ? JSON.parse(text) : text;

const applied = (action: Action | undefined): void => {
  if (action === undefined) {
    throw new Error('The file path produced no action to dispatch.');
  }
  dispatch(action);
};

const opened = async (bridge: SpecBridge): Promise<void> => {
  applied(
    openedBy(await settled(bridge.open(readLimits.maxTextBytes)), untitledFile),
  );
};

const saved = async (bridge: SpecBridge): Promise<readonly Divergence[]> => {
  const state = modelStore.getState();
  const target = saveTarget(state.file, formatOf(state.file), untitledFile);
  const written = writeThrough(state.present, target.source);
  applied(
    savedBy(
      await settled(bridge.save(target.name, written.output)),
      target.source,
    ),
  );
  return written.divergences;
};

describe.each(gated)('$path', ({ path, format }) => {
  beforeEach(() => {
    modelStore.setState(initialState(placeholderModel), true);
  });

  it('opens as the format its content declares', async () => {
    await opened(specBridge({ offers: vendoredFile(path) }));

    const state = modelStore.getState();
    expect(state.lastFailure).toBeUndefined();
    expect(FileLifecycle.$is('Opened')(state.file)).toBe(true);
    expect(formatOf(state.file)).toBe(format);
    expect(state.present.diagrams.length > 0).toBe(true);
    expect(isDirty(state)).toBe(false);
  });

  it('saves back with no edit, losing nothing and reporting nothing', async () => {
    const bridge = specBridge({ offers: vendoredFile(path) });
    await opened(bridge);
    const before = modelStore.getState().present;

    const divergences = await saved(bridge);

    expect(hasDiverged(divergences)).toBe(false);
    expect(isDirty(modelStore.getState())).toBe(false);
    expect(bridge.writes).toHaveLength(1);

    const reread = readAnyFormat(bridge.writes[0].text);
    expect(Either.isRight(reread)).toBe(true);
    expect(Either.getOrThrow(reread).model).toStrictEqual(before);
  });

  it('writes back everything the file said, the parts the model has no home for included', async () => {
    const bridge = specBridge({ offers: vendoredFile(path) });
    await opened(bridge);

    await saved(bridge);

    expect(asDocument(format, bridge.writes[0].text)).toStrictEqual(
      asDocument(format, await vendoredFile(path).text()),
    );
  });
});
