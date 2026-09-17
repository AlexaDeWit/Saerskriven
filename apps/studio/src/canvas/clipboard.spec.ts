import { readLimits, saerskrivenYamlCodec } from '@saerskriven/formats';
import { emptyModel } from '@saerskriven/model';
import {
  elementId,
  parsedFixture,
  threatIn,
} from '@saerskriven/model/fixtures';
import { waitFor } from '@testing-library/react';
import { Either } from 'effect';
import { recordingSurface } from '../commands/commands.fixtures.js';
import { commandById, runCommand } from '../commands/registry.js';
import { deferred } from '../files/files.fixtures.js';
import { Action } from '../store/actions.js';
import { FileLifecycle, initialState } from '../store/state.js';
import {
  actorElement,
  firstMitigation,
  firstThreat,
  processElement,
  recordedModel,
  sampleModel,
  sampleThreat,
  secondDiagram,
  storeElement,
  twoDiagramModel,
} from '../store/store.fixtures.js';
import { dispatch, modelStore } from '../store/store.js';
import { currentAnnouncement, resetAnnouncements } from './announcements.js';
import { numbersIn } from '../ui/ui.fixtures.js';
import { canvasModel, openCanvas, requestFlow } from './canvas.fixtures.js';
import { copySelected, duplicateSelected, pasteSelected } from './clipboard.js';

const pastePrefix = vi.hoisted(() => ({
  fixed: undefined as string | undefined,
}));

vi.mock('@saerskriven/model', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@saerskriven/model')>();
  return {
    ...actual,
    generateElementId: () =>
      pastePrefix.fixed === undefined
        ? actual.generateElementId()
        : actual.elementIdSchema.parse(pastePrefix.fixed),
  };
});

const canvasElements = canvasModel.diagrams[0].elements.length;

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

const recordedModelWide = parsedFixture({
  ...recordedModel,
  assumptions: recordedModel.assumptions.map((assumption) => ({
    ...assumption,
    appliesToModel: true,
  })),
});

function announcedCounts(): {
  linked: number | undefined;
  cloned: number | undefined;
} {
  const [linked, cloned] = numbersIn(currentAnnouncement().message).slice(-2);
  return { linked, cloned };
}

async function announcedBy(run: () => Promise<void>): Promise<string> {
  const before = currentAnnouncement().sequence;
  await run();
  const after = currentAnnouncement();
  expect(after.sequence).toBeGreaterThan(before);
  expect(after.message).not.toBe('');
  return after.message;
}

beforeEach(() => {
  openCanvas([actorElement]);
});

describe('copySelected', () => {
  it('keeps the document and clipboard when a cut write fails', async () => {
    const clipboard = recordingClipboard();
    clipboard.writeText.mockRejectedValueOnce(new Error('denied'));
    const before = modelStore.getState();
    const refused = await announcedBy(() => copySelected(true));
    expect(modelStore.getState()).toBe(before);
    expect(clipboard.text()).toBe('existing clipboard');
    expect(await announcedBy(() => copySelected(true))).not.toBe(refused);
  });

  it('reports excluded links in related records and source-only format fields', async () => {
    const clipboard = recordingClipboard();
    const model = parsedFixture({
      ...sampleModel,
      threats: [
        { ...sampleThreat, elements: [actorElement, storeElement] },
        {
          ...sampleThreat,
          id: 'external-threat',
          number: 2,
          elements: [storeElement],
        },
      ],
      lastIssuedThreatNumber: 2,
      mitigations: [
        {
          id: 'shared-mitigation',
          title: 'Protection',
          prose: 'Shared',
          status: 'proposed',
          threats: [firstThreat, 'external-threat'],
        },
      ],
      assumptions: [
        {
          id: 'shared-assumption',
          prose: 'Shared',
          status: 'valid',
          threats: [firstThreat, 'external-threat'],
          appliesToModel: true,
        },
      ],
    });
    modelStore.setState(
      {
        ...initialState(model),
        selection: [actorElement],
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
    expect(copy.threats[0].elements).toEqual([actorElement]);
    expect(copy.mitigations[0].threats).toEqual([firstThreat]);
    expect(copy.assumptions[0].threats).toEqual([firstThreat]);
    const fromThreatDragon = currentAnnouncement().message;
    expect(numbersIn(fromThreatDragon)).toEqual([
      copy.diagrams[0].elements.length,
      copy.threats.length,
      4,
    ]);
    expect(modelStore.getState().present).toBe(model);
    modelStore.setState({ file: FileLifecycle.NoFile() });
    const fromNative = await announcedBy(() => copySelected());
    expect(numbersIn(fromNative)).toEqual(numbersIn(fromThreatDragon));
    expect(fromNative).not.toBe(fromThreatDragon);
  });

  it('does not cut a selection that changes while clipboard writing is pending', async () => {
    const clipboard = recordingClipboard();
    const copied = await announcedBy(() => copySelected());
    const written = deferred<void>();
    clipboard.writeText.mockReturnValueOnce(written.promise);
    const kept = await announcedBy(async () => {
      const pending = copySelected(true);
      dispatch(Action.Select({ elementIds: [processElement] }));
      written.resolve(undefined);
      await pending;
    });
    expect(modelStore.getState().present).toBe(canvasModel);
    expect(kept).not.toBe(copied);
    dispatch(Action.Select({ elementIds: [actorElement] }));
    expect(await announcedBy(() => copySelected(true))).not.toBe(kept);
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
    expect(modelStore.getState().present).toBe(canvasModel);
  });

  it('refuses oversized copies before overwriting the system clipboard', async () => {
    const clipboard = recordingClipboard();
    const model = {
      ...canvasModel,
      metadata: {
        ...canvasModel.metadata,
        description: 'x'.repeat(readLimits.maxTextBytes + 1),
      },
    };
    openCanvas([actorElement], model);
    const refused = await announcedBy(() => copySelected());
    expect(clipboard.writeText).not.toHaveBeenCalled();
    expect(clipboard.text()).toBe('existing clipboard');
    dispatch(Action.Select({ elementIds: [] }));
    expect(await announcedBy(() => copySelected())).not.toBe(refused);
  });
});

describe('pasteSelected', () => {
  it('copies a flow with its endpoints, and pastes with distinct IDs on each press', async () => {
    const clipboard = recordingClipboard();
    dispatch(Action.Select({ elementIds: [requestFlow] }));
    await copySelected();
    expect(
      Either.getOrThrow(saerskrivenYamlCodec.read(clipboard.text())).model
        .diagrams[0].elements,
    ).toHaveLength(3);
    await pasteSelected();
    await pasteSelected();
    const after = modelStore.getState();
    const elements = after.present.diagrams[0].elements;
    expect(elements).toHaveLength(canvasElements + 6);
    expect(new Set(elements.map((element) => element.id)).size).toBe(
      canvasElements + 6,
    );
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

  it('refuses a paste into a document replaced during the clipboard read', async () => {
    const clipboard = recordingClipboard();
    const read = deferred<string>();
    clipboard.readText.mockReturnValueOnce(read.promise);
    const pending = pasteSelected();
    dispatch(
      Action.MoveElement({ elementId: actorElement, offset: { x: 1, y: 0 } }),
    );
    const changed = modelStore.getState().present;
    const text = marker + saerskrivenYamlCodec.write(canvasModel).output;
    const refused = await announcedBy(async () => {
      read.resolve(text);
      await pending;
    });
    expect(modelStore.getState().present).toBe(changed);
    clipboard.readText.mockResolvedValueOnce(text);
    expect(await announcedBy(() => pasteSelected())).not.toBe(refused);
  });

  it.each([
    marker + 'invalid: [',
    marker + saerskrivenYamlCodec.write(emptyModel).output,
  ])(
    'refuses malformed or diagram-free clipboard content: %s',
    async (text) => {
      const clipboard = recordingClipboard();
      clipboard.readText.mockResolvedValueOnce(text);
      const before = modelStore.getState();
      await pasteSelected();
      expect(modelStore.getState()).toBe(before);
      expect(clipboard.writeText).not.toHaveBeenCalled();
    },
  );

  it('pastes a version 1 selection copied before version 2, its mitigation text as a record', async () => {
    const clipboard = recordingClipboard();
    clipboard.readText.mockResolvedValueOnce(version1Selection);
    await pasteSelected();
    const after = modelStore.getState().present;
    expect(after.diagrams[0].elements).toHaveLength(canvasElements + 1);
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
      ...canvasModel,
      mitigations: [
        {
          id: 'threat-copied-mitigation',
          title: '',
          prose: 'Callers sign in.',
          status: 'implemented',
          threats: [firstThreat],
        },
      ],
      assumptions: [
        {
          id: 'assumption-copied',
          prose: 'Callers sign in.',
          status: 'valid',
          threats: [firstThreat],
          appliesToModel: false,
        },
      ],
    });
    openCanvas([actorElement], holding);
    clipboard.readText.mockResolvedValueOnce(version1Selection);
    await pasteSelected();
    const after = modelStore.getState().present;
    const pasted = after.threats.at(-1)?.id;
    expect(after.mitigations).toEqual([
      { ...holding.mitigations[0], threats: [firstThreat, pasted] },
    ]);
    expect(after.assumptions).toEqual([
      {
        ...holding.assumptions[0],
        threats: [firstThreat, pasted],
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
    const unread = await announcedBy(() => pasteSelected());
    modelStore.setState(initialState(emptyModel), true);
    clipboard.readText.mockResolvedValueOnce(
      marker + saerskrivenYamlCodec.write(canvasModel).output,
    );
    const nowhere = await announcedBy(() => pasteSelected());
    expect(modelStore.getState().present).toBe(emptyModel);
    expect(nowhere).not.toBe(unread);
  });

  it('pastes a link to an unchanged record and a clone of an edited one as one undo step', async () => {
    recordingClipboard();
    openCanvas([actorElement], recordedModelWide);
    await copySelected();
    dispatch(
      Action.ReplaceMitigation({
        mitigation: { ...recordedModelWide.mitigations[0], prose: 'Edited.' },
      }),
    );
    const edited = modelStore.getState().present;
    await pasteSelected();
    const after = modelStore.getState().present;
    const pasted = after.threats.at(-1)?.id;
    expect(after.mitigations).toEqual([
      edited.mitigations[0],
      expect.objectContaining({
        title: recordedModelWide.mitigations[0].title,
        prose: recordedModelWide.mitigations[0].prose,
        threats: [pasted],
      }),
    ]);
    expect(after.mitigations[1].id).not.toBe(edited.mitigations[0].id);
    expect(after.assumptions).toEqual([
      { ...edited.assumptions[0], threats: [firstThreat, pasted] },
    ]);
    expect(announcedCounts()).toEqual({ linked: 1, cloned: 1 });
    dispatch(Action.Undo());
    expect(modelStore.getState().present).toBe(edited);
  });

  it('pastes a clone of a record culled after copying', async () => {
    recordingClipboard();
    openCanvas([actorElement], recordedModelWide);
    await copySelected();
    dispatch(
      Action.UnlinkMitigation({
        mitigationId: firstMitigation,
        threatId: firstThreat,
      }),
    );
    expect(modelStore.getState().present.mitigations).toEqual([]);
    await pasteSelected();
    const after = modelStore.getState().present;
    expect(after.mitigations).toEqual([
      expect.objectContaining({
        title: recordedModelWide.mitigations[0].title,
        threats: [after.threats.at(-1)?.id],
      }),
    ]);
    expect(after.mitigations[0].id).not.toBe(firstMitigation);
  });
});

describe('duplicateSelected', () => {
  it('duplicates attached threats under fresh IDs in one undoable edit without touching the clipboard', () => {
    const { writeText } = recordingClipboard();
    duplicateSelected();
    const after = modelStore.getState();
    expect(after.past).toEqual([canvasModel]);
    expect(after.present.diagrams[0].elements).toHaveLength(canvasElements + 1);
    const copy = after.present.diagrams[0].elements.at(-1);
    expect(copy?.id).not.toBe(actorElement);
    expect(after.present.threats.at(-1)?.elements).toEqual([copy?.id]);
    expect(after.present.threats.at(-1)?.id).not.toBe(firstThreat);
    expect(writeText).not.toHaveBeenCalled();
    dispatch(Action.Undo());
    expect(modelStore.getState().present).toBe(canvasModel);
  });

  it('duplicates a threat linked to the records its original links', () => {
    openCanvas([actorElement], recordedModelWide);
    duplicateSelected();
    const after = modelStore.getState().present;
    const duplicate = after.threats.at(-1)?.id;
    expect(after.mitigations).toEqual([
      {
        ...recordedModelWide.mitigations[0],
        threats: [firstThreat, duplicate],
      },
    ]);
    expect(after.assumptions).toEqual([
      {
        ...recordedModelWide.assumptions[0],
        threats: [firstThreat, duplicate],
      },
    ]);
    expect(announcedCounts()).toEqual({ linked: 2, cloned: 0 });
  });
});

describe('the clipboard refusals', () => {
  afterEach(() => {
    pastePrefix.fixed = undefined;
  });

  it('words every copy refusal apart', async () => {
    const clipboard = recordingClipboard();
    const said: string[] = [];
    dispatch(Action.Select({ elementIds: [] }));
    said.push(await announcedBy(() => copySelected()));
    dispatch(Action.Select({ elementIds: [elementId('missing-element')] }));
    said.push(await announcedBy(() => copySelected()));
    openCanvas([actorElement]);
    clipboard.writeText.mockRejectedValueOnce(new Error('denied'));
    said.push(await announcedBy(() => copySelected()));
    openCanvas([actorElement], {
      ...canvasModel,
      metadata: {
        ...canvasModel.metadata,
        description: 'x'.repeat(readLimits.maxTextBytes + 1),
      },
    });
    said.push(await announcedBy(() => copySelected()));

    expect(clipboard.writeText).toHaveBeenCalledTimes(1);
    expect(new Set(said).size).toBe(said.length);
  });

  it('words every paste refusal apart', async () => {
    const clipboard = recordingClipboard();
    const text = marker + saerskrivenYamlCodec.write(canvasModel).output;
    const heldMitigation = {
      id: 'pinned:mitigation-held',
      title: 'Held',
      prose: 'Held by the target.',
      status: 'proposed',
      threats: [firstThreat],
    };
    const colliding =
      marker +
      saerskrivenYamlCodec.write(
        parsedFixture({
          ...canvasModel,
          mitigations: [
            heldMitigation,
            {
              ...heldMitigation,
              id: 'mitigation-held',
              prose: 'Renamed onto the held id.',
            },
          ],
        }),
      ).output;
    const said: string[] = [];
    clipboard.readText.mockRejectedValueOnce(new Error('denied'));
    said.push(await announcedBy(() => pasteSelected()));
    const read = deferred<string>();
    clipboard.readText.mockReturnValueOnce(read.promise);
    said.push(
      await announcedBy(async () => {
        const pending = pasteSelected();
        dispatch(
          Action.MoveElement({
            elementId: actorElement,
            offset: { x: 1, y: 0 },
          }),
        );
        read.resolve(text);
        await pending;
      }),
    );
    clipboard.readText.mockResolvedValueOnce('ordinary text');
    said.push(await announcedBy(() => pasteSelected()));
    clipboard.readText.mockResolvedValueOnce(marker + 'invalid: [');
    said.push(await announcedBy(() => pasteSelected()));
    openCanvas(
      [actorElement],
      parsedFixture({ ...canvasModel, mitigations: [heldMitigation] }),
    );
    pastePrefix.fixed = 'pinned';
    clipboard.readText.mockResolvedValueOnce(colliding);
    said.push(await announcedBy(() => pasteSelected()));
    modelStore.setState(initialState(emptyModel), true);
    clipboard.readText.mockResolvedValueOnce(text);
    said.push(await announcedBy(() => pasteSelected()));

    expect(modelStore.getState().present).toBe(emptyModel);
    expect(new Set(said).size).toBe(said.length);
  });
});

describe('registered reuse commands', () => {
  it('runs the registered reuse commands through clipboard I/O and atomic history', async () => {
    const clipboard = recordingClipboard();
    const { surface } = recordingSurface();
    runCommand(commandById('copy'), surface);
    await waitFor(() => {
      expect(clipboard.writeText).toHaveBeenCalledTimes(1);
    });
    runCommand(commandById('cut'), surface);
    await waitFor(() => {
      expect(modelStore.getState().present.diagrams[0].elements).toHaveLength(
        canvasElements - 1,
      );
    });
    expect(modelStore.getState().past).toEqual([canvasModel]);
    expect(
      threatIn(modelStore.getState().present, firstThreat).elements,
    ).toEqual([]);
    dispatch(Action.Undo());
    runCommand(commandById('paste'), surface);
    await waitFor(() => {
      expect(modelStore.getState().present.diagrams[0].elements).toHaveLength(
        canvasElements + 1,
      );
    });
    runCommand(commandById('duplicate'), surface);
    expect(modelStore.getState().present.diagrams[0].elements).toHaveLength(
      canvasElements + 2,
    );
    expect(modelStore.getState().past).toHaveLength(2);
  });
});
