import type { CanvasNode } from '@saerskriven/canvas';
import type { ElementId, Model, Point, ThreatStatus } from '@saerskriven/model';
import {
  assumptionId,
  elementId,
  parsedFixture,
} from '@saerskriven/model/fixtures';
import { initialState } from '../store/state.js';
import {
  actorElement,
  mainDiagram,
  processElement,
  sampleThreat,
} from '../store/store.fixtures.js';
import { modelStore } from '../store/store.js';
import { resetAnnouncements } from './announcements.js';
import { resetConnecting } from './connecting.js';
import { currentLayout } from './layout.js';
import { resetTools } from './tools.js';

/** The flow from the store fixture's actor to its process, which two threats name. */
export const requestFlow = elementId('flow-request');

/** The flow whose target belongs to no element. */
export const probeFlow = elementId('flow-probe');

/** The trust boundary drawn around the two, which no flow ends on. */
export const boundaryElement = elementId('boundary-perimeter');

/** The note beside them, which no flow ends on either. */
export const noteElement = elementId('text-note');

const document = {
  metadata: {
    title: 'Canvas fixture',
    owner: 'Saerskriven',
    description: '',
    contributors: [],
  },
  diagrams: [
    {
      id: mainDiagram,
      title: 'Main',
      elements: [
        {
          kind: 'trust-boundary',
          id: boundaryElement,
          name: 'Perimeter',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          shape: {
            kind: 'box',
            position: { x: -20, y: -20 },
            size: { width: 460, height: 100 },
          },
        },
        {
          kind: 'actor',
          id: actorElement,
          name: 'Reader',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          position: { x: 0, y: 0 },
          size: { width: 120, height: 60 },
        },
        {
          kind: 'process',
          id: processElement,
          name: 'Studio',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          position: { x: 300, y: 0 },
          size: { width: 120, height: 60 },
        },
        {
          kind: 'text',
          id: noteElement,
          name: 'Note',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          text: 'The studio opens on this model.',
          position: { x: 0, y: 200 },
          size: { width: 200, height: 40 },
        },
        {
          kind: 'flow',
          id: requestFlow,
          name: 'Opens a model',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          source: { kind: 'attached', element: actorElement },
          target: { kind: 'attached', element: processElement },
          waypoints: [],
          bidirectional: false,
        },
        {
          kind: 'flow',
          id: probeFlow,
          name: 'Reads a file',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          source: { kind: 'attached', element: processElement },
          target: { kind: 'free', position: { x: 500, y: 200 } },
          waypoints: [],
          bidirectional: false,
        },
      ],
    },
  ],
  threats: [
    sampleThreat,
    {
      id: 'threat-path-disclosure',
      number: 2,
      title: 'A model is read from a path the studio should not reach',
      category: { methodology: 'STRIDE', category: 'information-disclosure' },
      severity: 'undecided',
      status: 'open',
      description: '',
      elements: [requestFlow],
    },
    {
      id: 'threat-repudiation',
      number: 3,
      title: 'An edit is attributed to a reader who did not make it',
      category: { methodology: 'STRIDE', category: 'repudiation' },
      severity: 'undecided',
      status: 'open',
      description: '',
      elements: [requestFlow],
    },
  ],
  lastIssuedThreatNumber: 3,
  mitigations: [],
  assumptions: [],
};

/**
 * The model the canvas specs draw: two elements inside a trust boundary, a
 * note, a flow between the two, a flow with a free end, one assessed threat on
 * an element and two undecided threats on a flow.
 */
export const canvasModel: Model = parsedFixture(document);

type ThreatRework = {
  readonly status?: ThreatStatus;
  readonly elements?: readonly string[];
  readonly invalidated?: boolean;
};

/**
 * {@link canvasModel} with threats changed by id: a status, the elements named,
 * and whether an invalidated assumption links the threat.
 */
export const flaggedCanvasModel = (
  byThreat: Readonly<Record<string, ThreatRework>>,
): Model => {
  const threats = canvasModel.threats.map((threat) => {
    const rework = byThreat[threat.id] ?? {};
    return {
      ...threat,
      status: rework.status ?? threat.status,
      elements: rework.elements?.map(elementId) ?? threat.elements,
    };
  });
  return {
    ...canvasModel,
    threats,
    assumptions: threats
      .filter((threat) => byThreat[threat.id]?.invalidated === true)
      .map((threat) => ({
        id: assumptionId(`assumption-${threat.id}`),
        prose: '',
        status: 'invalidated' as const,
        threats: [threat.id],
        appliesToModel: false,
      })),
  };
};

/**
 * Opens {@link canvasModel}, or the model given, with the selection given, and
 * resets the announcements, the tool and the flow chooser a previous spec may
 * have left behind.
 */
export const openCanvas = (
  selection: readonly ElementId[] = [],
  model: Model = canvasModel,
): void => {
  modelStore.setState({ ...initialState(model), selection }, true);
  resetAnnouncements();
  resetTools();
  resetConnecting();
};

/**
 * The node the store's current layout draws for an element, failing the test
 * where the layout draws none.
 */
export const laidOutNode = (id: ElementId): CanvasNode => {
  const node = currentLayout(modelStore.getState()).nodes.find(
    (candidate) => candidate.id === id,
  );
  assert.isDefined(node, `the layout draws ${id}`);
  return node;
};

/**
 * A primary pointer event at a screen point, as a canvas hook reads one. The
 * spec names the targets its hook reads, and another pointer where it needs
 * one.
 */
export const primaryPointer = <
  Targets extends {
    readonly pointerId?: number;
    readonly currentTarget?: EventTarget;
    readonly target?: EventTarget;
  },
>(
  at: Point,
  targets: Targets,
) => ({
  button: 0,
  clientX: at.x,
  clientY: at.y,
  isPrimary: true,
  pointerId: 1,
  preventDefault: vi.fn<() => void>(),
  stopPropagation: vi.fn<() => void>(),
  ...targets,
});
