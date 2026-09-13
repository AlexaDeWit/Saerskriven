import { waitFor } from '@testing-library/react';
import { readLimits } from '@saerskriven/formats';
import { emptyModel, type Model } from '@saerskriven/model';
import {
  elementId,
  mitigationId,
  parsedFixture,
  threatId,
} from '@saerskriven/model/fixtures';
import { commandById, runCommand } from '../commands/registry.js';
import { recordingSurface } from '../commands/commands.fixtures.js';
import { deferred } from '../files/files.fixtures.js';
import { FileLifecycle } from '../store/state.js';
import { Either } from 'effect';
import { saerskrivenYamlCodec } from '@saerskriven/formats';
import { Action } from '../store/actions.js';
import { initialState, placeholderModel } from '../store/state.js';
import {
  actorElement,
  secondDiagram,
  twoDiagramModel,
} from '../store/store.fixtures.js';
import { dispatch, modelStore } from '../store/store.js';
import { copySelected, duplicateSelected, pasteSelected } from './clipboard.js';
import { currentAnnouncement, resetAnnouncements } from './announcements.js';

const actor = placeholderModel.diagrams[0].elements[0].id;

beforeEach(() => {
  modelStore.setState(
    { ...initialState(placeholderModel), selection: [actor] },
    true,
  );
  resetAnnouncements();
});

it('duplicates attached threats under fresh IDs in one undoable edit without touching the clipboard', () => {
  const { writeText } = recordingClipboard();
  duplicateSelected();
  const after = modelStore.getState();
  expect(after.past).toEqual([placeholderModel]);
  expect(after.present.diagrams[0].elements).toHaveLength(4);
  const copy = after.present.diagrams[0].elements[3];
  expect(copy.id).not.toBe(actor);
  expect(after.present.threats.at(-1)?.elements).toEqual([copy.id]);
  expect(after.present.threats.at(-1)?.id).not.toBe(
    placeholderModel.threats[0].id,
  );
  expect(writeText).not.toHaveBeenCalled();
  dispatch(Action.Undo());
  expect(modelStore.getState().present).toBe(placeholderModel);
});

it('keeps the document and clipboard when a cut write fails', async () => {
  const clipboard = recordingClipboard();
  clipboard.writeText.mockRejectedValueOnce(new Error('denied'));
  const before = modelStore.getState();
  await copySelected(true);
  expect(modelStore.getState()).toBe(before);
  expect(clipboard.text()).toBe('existing clipboard');
  expect(currentAnnouncement().message).toContain('failed');
});

it('copies a flow with its endpoints, and pastes with distinct IDs on each press', async () => {
  const clipboard = recordingClipboard();
  dispatch(
    Action.Select({
      elementIds: [placeholderModel.diagrams[0].elements[2].id],
    }),
  );
  await copySelected();
  expect(
    Either.getOrThrow(saerskrivenYamlCodec.read(clipboard.text())).model
      .diagrams[0].elements,
  ).toHaveLength(3);
  await pasteSelected();
  await pasteSelected();
  const after = modelStore.getState();
  const elements = after.present.diagrams[0].elements;
  expect(elements).toHaveLength(9);
  expect(new Set(elements.map((element) => element.id)).size).toBe(9);
  expect(after.past).toHaveLength(2);
});

it('copies from and pastes into the diagram on screen', async () => {
  recordingClipboard();
  modelStore.setState(
    { ...initialState(twoDiagramModel), selection: [actorElement] },
    true,
  );
  await copySelected();
  dispatch(Action.SelectDiagram({ diagramId: secondDiagram }));
  await pasteSelected();
  const after = modelStore.getState().present;
  expect(after.diagrams[0].elements).toHaveLength(3);
  expect(after.diagrams[1].elements).toHaveLength(2);
  expect(after.diagrams[1].elements.map((element) => element.name)).toContain(
    'Reader',
  );
});

it('refuses unsupported clipboard data without editing or replacing it', async () => {
  const { writeText, readText } = recordingClipboard();
  readText.mockResolvedValueOnce('ordinary text');
  const before = modelStore.getState();
  await pasteSelected();
  expect(modelStore.getState()).toBe(before);
  expect(writeText).not.toHaveBeenCalled();
});

const marker = '# Saerskriven selection v1\n';

function recordingClipboard() {
  let text = 'existing clipboard';
  const api = {
    writeText: vi.fn<(value: string) => Promise<void>>((value) => {
      text = value;
      return Promise.resolve();
    }),
    readText: vi.fn<() => Promise<string>>(() => Promise.resolve(text)),
  };
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: api,
  });
  return { ...api, text: () => text };
}

it('runs the registered reuse commands through clipboard I/O and atomic history', async () => {
  const clipboard = recordingClipboard();
  const { surface } = recordingSurface();
  runCommand(commandById('copy'), surface);
  await waitFor(() => {
    expect(clipboard.writeText).toHaveBeenCalledTimes(1);
  });
  runCommand(commandById('cut'), surface);
  await waitFor(() => {
    expect(modelStore.getState().present.diagrams[0].elements).toHaveLength(2);
  });
  expect(modelStore.getState().past).toEqual([placeholderModel]);
  expect(modelStore.getState().present.threats[0].elements).toEqual([]);
  dispatch(Action.Undo());
  runCommand(commandById('paste'), surface);
  await waitFor(() => {
    expect(modelStore.getState().present.diagrams[0].elements).toHaveLength(4);
  });
  runCommand(commandById('duplicate'), surface);
  expect(modelStore.getState().present.diagrams[0].elements).toHaveLength(5);
  expect(modelStore.getState().past).toHaveLength(2);
});

it('reports excluded links in related records and source-only format fields', async () => {
  const clipboard = recordingClipboard();
  const originalThreat = placeholderModel.threats[0];
  const store = placeholderModel.diagrams[0].elements[1].id;
  const model = parsedFixture({
    ...placeholderModel,
    threats: [
      { ...originalThreat, elements: [actor, store] },
      {
        ...originalThreat,
        id: 'external-threat',
        number: 2,
        elements: [store],
      },
    ],
    lastIssuedThreatNumber: 2,
    mitigations: [
      {
        id: 'shared-mitigation',
        title: 'Protection',
        prose: 'Shared',
        status: 'proposed',
        threats: [originalThreat.id, 'external-threat'],
      },
    ],
    assumptions: [
      {
        id: 'shared-assumption',
        prose: 'Shared',
        status: 'valid',
        threats: [originalThreat.id, 'external-threat'],
        appliesToModel: true,
      },
    ],
  });
  modelStore.setState(
    {
      ...initialState(model),
      selection: [actor],
      file: FileLifecycle.Opened({
        name: 'source.json',
        source: { format: 'threat-dragon', document: undefined },
      }),
    },
    true,
  );
  await copySelected();
  const copy = Either.getOrThrow(
    saerskrivenYamlCodec.read(clipboard.text()),
  ).model;
  expect(copy.threats[0].elements).toEqual([actor]);
  expect(copy.mitigations[0].threats).toEqual([originalThreat.id]);
  expect(copy.assumptions[0].threats).toEqual([originalThreat.id]);
  expect(currentAnnouncement().message).toContain('4 external links excluded');
  expect(currentAnnouncement().message).toContain('Source-format fields');
  expect(modelStore.getState().present).toBe(model);
});

it('does not cut a selection that changes while clipboard writing is pending', async () => {
  const clipboard = recordingClipboard();
  const written = deferred<void>();
  clipboard.writeText.mockReturnValueOnce(written.promise);
  const pending = copySelected(true);
  dispatch(
    Action.Select({
      elementIds: [placeholderModel.diagrams[0].elements[1].id],
    }),
  );
  written.resolve(undefined);
  await pending;
  expect(modelStore.getState().present).toBe(placeholderModel);
  expect(currentAnnouncement().message).toContain('Nothing was cut');
});

it('refuses a paste into a document replaced during the clipboard read', async () => {
  const clipboard = recordingClipboard();
  const read = deferred<string>();
  clipboard.readText.mockReturnValueOnce(read.promise);
  const pending = pasteSelected();
  dispatch(Action.MoveElement({ elementId: actor, offset: { x: 1, y: 0 } }));
  const changed = modelStore.getState().present;
  read.resolve(marker + saerskrivenYamlCodec.write(placeholderModel).output);
  await pending;
  expect(modelStore.getState().present).toBe(changed);
  expect(currentAnnouncement().message).toContain('document changed');
});

it.each([
  marker + 'invalid: [',
  marker + saerskrivenYamlCodec.write(emptyModel).output,
])('refuses malformed or diagram-free clipboard content: %s', async (text) => {
  const clipboard = recordingClipboard();
  clipboard.readText.mockResolvedValueOnce(text);
  const before = modelStore.getState();
  await pasteSelected();
  expect(modelStore.getState()).toBe(before);
  expect(clipboard.writeText).not.toHaveBeenCalled();
});

const version1Selection = `${marker}formatVersion: 1
metadata:
  title: Selection
  owner: ""
  description: ""
  contributors: []
assumptions:
  - id: assumption-copied
    prose: Callers sign in.
    status: valid
    elements: []
    threats:
      - threat-copied
diagrams:
  - id: diagram-copied
    title: Copied
    elements:
      - kind: actor
        id: actor-copied
        name: Caller
        description: ""
        outOfScope: false
        reasonOutOfScope: ""
        position:
          x: 0
          y: 0
        size:
          width: 120
          height: 60
mitigations: []
threats:
  - id: threat-copied
    number: 1
    title: Spoofed caller
    category:
      methodology: STRIDE
      category: spoofing
    severity: high
    status: mitigated
    description: ""
    mitigation: Callers sign in.
    elements:
      - actor-copied
lastIssuedThreatNumber: 1
`;

it('pastes a version 1 selection copied before version 2, its mitigation text as a record', async () => {
  const clipboard = recordingClipboard();
  clipboard.readText.mockResolvedValueOnce(version1Selection);
  await pasteSelected();
  const after = modelStore.getState().present;
  expect(after.diagrams[0].elements).toHaveLength(
    placeholderModel.diagrams[0].elements.length + 1,
  );
  const pasted = after.threats.at(-1);
  expect(after.mitigations.at(-1)).toMatchObject({
    prose: 'Callers sign in.',
    status: 'implemented',
    threats: [pasted?.id],
  });
  expect(after.assumptions.at(-1)).toMatchObject({
    threats: [pasted?.id],
    appliesToModel: false,
  });
});

it('links a version 1 selection to identical records the target holds', async () => {
  const clipboard = recordingClipboard();
  const holding = parsedFixture({
    ...placeholderModel,
    mitigations: [
      {
        id: 'threat-copied-mitigation',
        title: '',
        prose: 'Callers sign in.',
        status: 'implemented',
        threats: [placeholderThreat],
      },
    ],
    assumptions: [
      {
        id: 'assumption-copied',
        prose: 'Callers sign in.',
        status: 'valid',
        threats: [placeholderThreat],
        appliesToModel: false,
      },
    ],
  });
  openModel(holding);
  clipboard.readText.mockResolvedValueOnce(version1Selection);
  await pasteSelected();
  const after = modelStore.getState().present;
  const pasted = after.threats.at(-1)?.id;
  expect(after.mitigations).toEqual([
    { ...holding.mitigations[0], threats: [placeholderThreat, pasted] },
  ]);
  expect(after.assumptions).toEqual([
    {
      ...holding.assumptions[0],
      threats: [placeholderThreat, pasted],
    },
  ]);
  expect(announcedCounts()).toEqual({ linked: 2, cloned: 0 });
});

it('refuses a selection copied before assumptions dropped their element links', async () => {
  const clipboard = recordingClipboard();
  clipboard.readText.mockResolvedValueOnce(marker + 'invalid: [');
  await pasteSelected();
  const invalidSelection = currentAnnouncement().message;
  expect(invalidSelection).not.toBe('');
  resetAnnouncements();
  clipboard.readText.mockResolvedValueOnce(
    version1Selection.replace(
      '    elements: []',
      '    elements:\n      - actor-copied',
    ),
  );
  const before = modelStore.getState();
  await pasteSelected();
  expect(modelStore.getState()).toBe(before);
  expect(currentAnnouncement().message).toBe(invalidSelection);
});

it('reports clipboard read refusal and a missing destination diagram', async () => {
  const clipboard = recordingClipboard();
  clipboard.readText.mockRejectedValueOnce(new Error('denied'));
  await pasteSelected();
  expect(currentAnnouncement().message).toContain('read failed');
  modelStore.setState(initialState(emptyModel), true);
  clipboard.readText.mockResolvedValueOnce(
    marker + saerskrivenYamlCodec.write(placeholderModel).output,
  );
  await pasteSelected();
  expect(modelStore.getState().present).toBe(emptyModel);
  expect(currentAnnouncement().message).toContain('no diagram');
});

it('keeps the clipboard when no selection exists or its IDs no longer resolve', async () => {
  const clipboard = recordingClipboard();
  dispatch(Action.Select({ elementIds: [] }));
  await copySelected();
  duplicateSelected();
  dispatch(Action.Select({ elementIds: [elementId('missing-element')] }));
  await copySelected();
  expect(clipboard.text()).toBe('existing clipboard');
  expect(clipboard.writeText).not.toHaveBeenCalled();
  expect(modelStore.getState().present).toBe(placeholderModel);
});

it('refuses oversized copies before overwriting the system clipboard', async () => {
  const clipboard = recordingClipboard();
  const model = {
    ...placeholderModel,
    metadata: {
      ...placeholderModel.metadata,
      description: 'x'.repeat(readLimits.maxTextBytes + 1),
    },
  };
  modelStore.setState({ ...initialState(model), selection: [actor] }, true);
  await copySelected();
  expect(clipboard.writeText).not.toHaveBeenCalled();
  expect(clipboard.text()).toBe('existing clipboard');
  expect(currentAnnouncement().message).toContain('size limit');
});

const placeholderThreat = placeholderModel.threats[0].id;

const recordedModel = parsedFixture({
  ...placeholderModel,
  mitigations: [
    {
      id: 'mitigation-checked',
      title: 'Check records',
      prose: 'Validate each record.',
      status: 'proposed',
      threats: [placeholderThreat],
    },
  ],
  assumptions: [
    {
      id: 'assumption-trusted',
      prose: 'The actor is trusted.',
      status: 'valid',
      threats: [placeholderThreat],
      appliesToModel: true,
    },
  ],
});

function openModel(model: Model) {
  modelStore.setState({ ...initialState(model), selection: [actor] }, true);
}

function announcedCounts(): { linked: number; cloned: number } {
  const { message } = currentAnnouncement();
  const count = (label: string) =>
    Number(new RegExp(`${label}: (\\d+)`, 'u').exec(message)?.[1]);
  return { linked: count('linked'), cloned: count('cloned') };
}

it('duplicates a threat linked to the records its original links', () => {
  openModel(recordedModel);
  duplicateSelected();
  const after = modelStore.getState().present;
  const duplicate = after.threats.at(-1)?.id;
  expect(after.mitigations).toEqual([
    {
      ...recordedModel.mitigations[0],
      threats: [placeholderThreat, duplicate],
    },
  ]);
  expect(after.assumptions).toEqual([
    {
      ...recordedModel.assumptions[0],
      threats: [placeholderThreat, duplicate],
    },
  ]);
  expect(announcedCounts()).toEqual({ linked: 2, cloned: 0 });
});

it('pastes a link to an unchanged record and a clone of an edited one as one undo step', async () => {
  recordingClipboard();
  openModel(recordedModel);
  await copySelected();
  dispatch(
    Action.ReplaceMitigation({
      mitigation: { ...recordedModel.mitigations[0], prose: 'Edited.' },
    }),
  );
  const edited = modelStore.getState().present;
  await pasteSelected();
  const after = modelStore.getState().present;
  const pasted = after.threats.at(-1)?.id;
  expect(after.mitigations).toEqual([
    edited.mitigations[0],
    expect.objectContaining({
      prose: 'Validate each record.',
      threats: [pasted],
    }),
  ]);
  expect(after.mitigations[1].id).not.toBe(edited.mitigations[0].id);
  expect(after.assumptions).toEqual([
    { ...edited.assumptions[0], threats: [placeholderThreat, pasted] },
  ]);
  expect(announcedCounts()).toEqual({ linked: 1, cloned: 1 });
  dispatch(Action.Undo());
  expect(modelStore.getState().present).toBe(edited);
});

it('pastes a clone of a record culled after copying', async () => {
  recordingClipboard();
  openModel(recordedModel);
  await copySelected();
  dispatch(
    Action.UnlinkMitigation({
      mitigationId: mitigationId('mitigation-checked'),
      threatId: threatId(placeholderThreat),
    }),
  );
  expect(modelStore.getState().present.mitigations).toEqual([]);
  await pasteSelected();
  const after = modelStore.getState().present;
  expect(after.mitigations).toEqual([
    expect.objectContaining({
      prose: 'Validate each record.',
      threats: [after.threats.at(-1)?.id],
    }),
  ]);
  expect(after.mitigations[0].id).not.toBe('mitigation-checked');
});
