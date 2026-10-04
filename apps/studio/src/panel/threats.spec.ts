import {
  elementsAcross,
  elementsById,
  reconnectFlow,
  renameElement,
  replaceThreat,
  reverseFlow,
  setFlowDirection,
  type Element,
  type ElementId,
  type Model,
  type Threat,
} from '@saerskriven/model';
import { locales, type Locale } from '@saerskriven/i18n';
import { elementId, elementIn, threatId } from '@saerskriven/model/fixtures';
import { Either } from 'effect';
import {
  canvasModel,
  probeFlow,
  requestFlow,
} from '../canvas/canvas.fixtures.js';
import { Action } from '../store/actions.js';
import { initialState, type State } from '../store/state.js';
import {
  actorElement,
  namedElements,
  namelessElements,
  newProcess,
  processElement,
  sampleElement,
  sampleModel,
  sampleThreat,
  storeElement,
} from '../store/store.fixtures.js';
import { headingKindMessages } from '../messages/enum-labels.js';
import { activeTranslator } from '../messages/locale.js';
import { inLocale } from '../messages/messages.fixtures.js';
import { sentences } from '../messages/said.js';
import {
  attachableElements,
  attachableThreats,
  attachedThreats,
  attachSaid,
  detachSaid,
  elementHeading,
  elementLabel,
  freshThreat,
  nextNumber,
  panelSubject,
  threatAfterDeleting,
  threatAttachments,
  threatCommitter,
} from './threats.js';

const selecting = (selection: State['selection']): State => ({
  ...initialState(sampleModel),
  selection,
});

const mitigated: Model = Either.getOrElse(
  replaceThreat(sampleModel, { ...sampleThreat, status: 'mitigated' }),
  () => sampleModel,
);

const second: Threat = { ...sampleThreat, id: threatId('threat-second') };

const third: Threat = { ...sampleThreat, id: threatId('threat-third') };

const recorder = () => vi.fn<(action: Action) => void>();

describe('panelSubject', () => {
  it('is the element the canvas selected', () => {
    const subject = panelSubject(selecting([actorElement]));
    expect(subject?.kind === 'element' && subject.element.name).toBe('Reader');
  });

  it('is nothing while nothing is selected, which is where no panel is drawn', () => {
    expect(panelSubject(selecting([]))).toBeUndefined();
  });

  it('is nothing where the selection names no element of the model', () => {
    expect(
      panelSubject(selecting([elementId('element-gone')])),
    ).toBeUndefined();
  });

  it('is the model while the model panel shows', () => {
    expect(panelSubject({ ...selecting([]), modelPanel: true })).toEqual({
      kind: 'model',
    });
  });

  it('counts a selection with several elements', () => {
    expect(panelSubject(selecting([actorElement, processElement]))).toEqual({
      kind: 'several',
      count: 2,
    });
  });
});

describe('attachedThreats', () => {
  it('lists the threats naming the selected element', () => {
    expect(attachedThreats(selecting([actorElement]))).toEqual([sampleThreat]);
  });

  it('lists none for an element no threat names', () => {
    expect(attachedThreats(selecting([processElement]))).toEqual([]);
  });

  it('lists none while nothing is selected', () => {
    expect(attachedThreats(selecting([]))).toEqual([]);
  });

  it('lists a threat whatever its status, where the badge counts the open ones', () => {
    const state = { ...initialState(mitigated), selection: [actorElement] };

    expect(attachedThreats(state)).toHaveLength(1);
  });
});

const { t } = activeTranslator();

const french = inLocale('fr-CA');

const sampleElements = elementsById(elementsAcross(sampleModel.diagrams));

const unlabelled = (model: Model, ...flows: readonly ElementId[]): Model =>
  flows.reduce(
    (held, flow) => Either.getOrThrow(renameElement(held, flow, '')),
    model,
  );

const unlabelledCanvas = unlabelled(canvasModel, requestFlow, probeFlow);

const spacedCanvas: Model = {
  ...canvasModel,
  diagrams: canvasModel.diagrams.map((diagram) => ({
    ...diagram,
    elements: diagram.elements.map((element) =>
      element.id === requestFlow ? { ...element, name: ' ' } : element,
    ),
  })),
};

const fromReaderToStudio = (speak: typeof t): string =>
  speak('tools.flow-from-to', { source: 'Reader', target: 'Studio' });

const labelIn = (model: Model, id: ElementId, speak = t): string =>
  elementLabel(
    elementIn(model, id),
    elementsById(elementsAcross(model.diagrams)),
    speak,
  );

describe('elementLabel', () => {
  it('is what the element is called', () => {
    expect(
      elementLabel(newProcess('process-named', 'Studio'), sampleElements, t),
    ).toBe('Studio');
  });

  it('is what kind of element it is where it is called nothing', () => {
    expect(
      elementLabel(newProcess('process-unnamed', ''), sampleElements, t),
    ).toBe('the process');
  });

  it('names a flow left unlabelled from its source to its target', () => {
    expect(labelIn(unlabelledCanvas, requestFlow)).toBe(
      'Flow from Reader to Studio',
    );
  });

  it('names a flow left unlabelled between its ends where it runs both ways', () => {
    const both = Either.getOrThrow(
      setFlowDirection(unlabelledCanvas, requestFlow, true),
    );
    expect(labelIn(both, requestFlow)).toBe('Flow between Reader and Studio');
  });

  it('names an end attached to nothing a free point', () => {
    expect(labelIn(unlabelledCanvas, probeFlow)).toBe(
      'Flow from Studio to a free point',
    );
  });

  it('follows an end to the element it moves to', () => {
    const moved = Either.getOrThrow(
      reconnectFlow(unlabelledCanvas, probeFlow, 'target', actorElement),
    );
    expect(labelIn(moved, probeFlow)).toBe('Flow from Studio to Reader');
  });

  it('words the ends in the language shown', () => {
    expect(labelIn(unlabelledCanvas, requestFlow, french)).toBe(
      french('panel.unlabelled-flow', { ends: fromReaderToStudio(french) }),
    );
  });

  it('names a flow a file holds under white space alone by its ends', () => {
    expect(labelIn(spacedCanvas, requestFlow)).toBe(
      'Flow from Reader to Studio',
    );
  });
});

const namelessOfEveryKind: readonly Element[] = [
  ...canvasModel.diagrams[0].elements,
  sampleElement(storeElement),
]
  .filter(({ kind }) => kind !== 'flow')
  .map((element) => ({ ...element, name: '' }));

const opensWithCapital = (text: string, locale: Locale): boolean =>
  text.charAt(0) !== text.charAt(0).toLocaleLowerCase(locale);

describe('elementHeading', () => {
  it('is what the element is called', () => {
    expect(
      elementHeading(newProcess('process-named', 'Studio'), sampleElements, t),
    ).toBe('Studio');
  });

  it.each(locales)(
    'opens with a capital in %s for an element of each kind called nothing, in the words its label in a sentence has in lower case',
    (locale) => {
      const speak = inLocale(locale);
      const worded = (label: typeof elementLabel): readonly string[] =>
        namelessOfEveryKind.map((element) =>
          label(element, sampleElements, speak),
        );
      const opening = (label: typeof elementLabel): readonly boolean[] =>
        worded(label).map((text) => opensWithCapital(text, locale));
      const lowered = (label: typeof elementLabel): readonly string[] =>
        worded(label).map((text) => text.toLocaleLowerCase(locale));

      expect(new Set(namelessOfEveryKind.map(({ kind }) => kind))).toEqual(
        new Set(Object.keys(headingKindMessages)),
      );
      expect(opening(elementHeading)).not.toContain(false);
      expect(opening(elementLabel)).not.toContain(true);
      expect(lowered(elementHeading)).toEqual(lowered(elementLabel));
    },
  );

  it('heads an element a file holds under white space alone by its kind, as one called nothing', () => {
    expect(
      elementHeading(newProcess('process-spaced', '   '), sampleElements, t),
    ).toBe(t(headingKindMessages.process));
  });

  it('heads a flow left unlabelled by its ends', () => {
    expect(
      elementHeading(
        elementIn(unlabelledCanvas, requestFlow),
        elementsById(elementsAcross(unlabelledCanvas.diagrams)),
        t,
      ),
    ).toBe('Flow from Reader to Studio');
  });
});

describe('the element lists of a threat', () => {
  const [, onFlow] = unlabelledCanvas.threats;

  it('list a flow left unlabelled by its ends, with no id', () => {
    expect(threatAttachments(unlabelledCanvas.diagrams, onFlow, t)).toEqual([
      {
        id: requestFlow,
        label: 'Flow from Reader to Studio',
        detach: 'Detach the flow from Reader to Studio',
      },
    ]);
  });

  it('detach a flow left unlabelled under the message each language words around its ends', () => {
    expect(
      threatAttachments(unlabelledCanvas.diagrams, onFlow, french).map(
        ({ detach }) => detach,
      ),
    ).toEqual([
      french('fields.detach-unlabelled-flow', {
        ends: fromReaderToStudio(french),
      }),
    ]);
  });

  it('detach a flow left unlabelled under its numbered label where only normalization tells it from a name', () => {
    const lookalike = Either.getOrThrow(
      renameElement(unlabelledCanvas, probeFlow, 'Flow from Reader to Studio '),
    );
    expect(
      threatAttachments(
        lookalike.diagrams,
        { ...onFlow, elements: [requestFlow, probeFlow] },
        t,
      ).map(({ detach }) => detach),
    ).toEqual([
      'Detach 1: Flow from Reader to Studio',
      'Detach 2: Flow from Reader to Studio ',
    ]);
  });

  it('detach a named element under its name', () => {
    expect(
      threatAttachments(canvasModel.diagrams, onFlow, t).map(
        ({ detach }) => detach,
      ),
    ).toEqual(['Detach Opens a model']);
  });

  it('offer a flow left unlabelled by its ends', () => {
    expect(
      attachableElements(unlabelledCanvas.diagrams, sampleThreat, t).find(
        ({ id }) => id === probeFlow,
      )?.text,
    ).toEqual({
      label: 'Flow from Studio to a free point',
      detail: 'Main',
    });
  });

  it('tell apart two flows left unlabelled between the same ends by their ids', () => {
    const twin = Either.getOrThrow(
      Either.flatMap(
        reconnectFlow(unlabelledCanvas, probeFlow, 'target', actorElement),
        (moved) => reverseFlow(moved, probeFlow),
      ),
    );
    expect(
      attachableElements(twin.diagrams, sampleThreat, t)
        .filter(({ id }) => id === requestFlow || id === probeFlow)
        .map(({ text }) => text.suffix),
    ).toEqual([`(${requestFlow})`, `(${probeFlow})`]);
    expect(
      threatAttachments(
        twin.diagrams,
        { ...onFlow, elements: [requestFlow, probeFlow] },
        t,
      ).map(({ detach }) => detach),
    ).toEqual([
      `Detach the flow from Reader to Studio (${requestFlow})`,
      `Detach the flow from Reader to Studio (${probeFlow})`,
    ]);
  });
});

describe('attachSaid', () => {
  const { number } = sampleThreat;

  it.each(namelessElements)(
    'words a %s in the message of its kind, which French contracts onto the article',
    (_, on) => {
      expect(attachSaid(sampleThreat, on, sampleElements)(french)).toBe(
        french(`canvas.threat-attached-to-${on.kind}`, { number }),
      );
    },
  );

  it('words a flow left unlabelled in the message of its kind, with its ends', () => {
    const flow = elementIn(unlabelledCanvas, requestFlow);
    const elements = elementsById(elementsAcross(unlabelledCanvas.diagrams));
    expect(attachSaid(sampleThreat, flow, elements)(french)).toBe(
      french('canvas.threat-attached-to-flow', {
        number,
        ends: fromReaderToStudio(french),
      }),
    );
  });

  it('words a flow a file holds under white space alone with its ends', () => {
    const elements = elementsById(elementsAcross(spacedCanvas.diagrams));
    expect(
      attachSaid(
        sampleThreat,
        elementIn(spacedCanvas, requestFlow),
        elements,
      )(t),
    ).toBe(
      t('canvas.threat-attached-to-flow', {
        number,
        ends: fromReaderToStudio(t),
      }),
    );
  });

  it.each(namedElements)(
    'words a %s in the named message of its kind, so no "à" lands before the name',
    (_, on) => {
      expect(attachSaid(sampleThreat, on, sampleElements)(french)).toBe(
        french(`canvas.threat-attached-to-${on.kind}-named`, {
          number,
          name: on.name,
        }),
      );
    },
  );
});

describe('detachSaid', () => {
  const reader = sampleElement(actorElement);
  const onTwo: Threat = {
    ...sampleThreat,
    elements: [actorElement, processElement],
  };
  const { number } = onTwo;

  it('reports the removal where the threat went with its last element', () => {
    expect(
      detachSaid(sampleThreat, reader, undefined, sampleElements)?.(t),
    ).toContain(String(sampleThreat.number));
  });

  it.each(namelessElements)(
    'words a %s in the message of its kind where the threat stays on its others, which French contracts onto the article',
    (_, detached) => {
      const kept: Threat = { ...onTwo, elements: [actorElement] };

      expect(detachSaid(onTwo, detached, kept, sampleElements)?.(french)).toBe(
        sentences(
          french(`canvas.threat-detached-from-${detached.kind}`, { number }),
          french('canvas.threat-stays-on-elements'),
        ),
      );
    },
  );

  it('words a flow left unlabelled in the message of its kind, with its ends, where the threat stays on its others', () => {
    const [, onFlow] = unlabelledCanvas.threats;
    const onFlowAndReader = {
      ...onFlow,
      elements: [requestFlow, actorElement],
    };
    const kept = { ...onFlow, elements: [actorElement] };
    const elements = elementsById(elementsAcross(unlabelledCanvas.diagrams));
    expect(
      detachSaid(
        onFlowAndReader,
        elementIn(unlabelledCanvas, requestFlow),
        kept,
        elements,
      )?.(french),
    ).toBe(
      sentences(
        french('canvas.threat-detached-from-flow', {
          number: onFlow.number,
          ends: fromReaderToStudio(french),
        }),
        french('canvas.threat-stays-on-elements'),
      ),
    );
  });

  it.each(namedElements)(
    'words a %s in the named message of its kind where the threat stays on its others, so no "de" lands before the name',
    (_, detached) => {
      const kept: Threat = { ...onTwo, elements: [actorElement] };

      expect(detachSaid(onTwo, detached, kept, sampleElements)?.(french)).toBe(
        sentences(
          french(`canvas.threat-detached-from-${detached.kind}-named`, {
            number,
            name: detached.name,
          }),
          french('canvas.threat-stays-on-elements'),
        ),
      );
    },
  );

  it('says the threat still applies to the whole model where the detach leaves it on no element, and that it stays on its others where it leaves it on one', () => {
    const modelWide: Threat = { ...sampleThreat, appliesToModel: true };
    const detached = t('canvas.threat-detached-from-actor-named', {
      number: sampleThreat.number,
      name: reader.name,
    });

    expect(
      detachSaid(
        modelWide,
        reader,
        { ...modelWide, elements: [] },
        sampleElements,
      )?.(t),
    ).toBe(sentences(detached, t('canvas.threat-stays-on-model')));
    expect(
      detachSaid(
        { ...modelWide, elements: [actorElement, processElement] },
        reader,
        { ...modelWide, elements: [processElement] },
        sampleElements,
      )?.(t),
    ).toBe(sentences(detached, t('canvas.threat-stays-on-elements')));
  });

  it('says nothing where the detach was refused and the threat still names the element', () => {
    expect(detachSaid(onTwo, reader, onTwo, sampleElements)).toBeUndefined();
  });

  it('says nothing where the model no longer holds the element the row named', () => {
    expect(detachSaid(onTwo, undefined, onTwo, sampleElements)).toBeUndefined();
  });
});

describe('nextNumber', () => {
  it('is the number the model issues next', () => {
    expect(nextNumber(initialState(sampleModel))).toBe(2);
  });
});

describe('freshThreat', () => {
  it('opens attached to the element, unassessed and undispositioned', () => {
    const threat = freshThreat(7, actorElement, t);

    expect(threat.number).toBe(7);
    expect(threat.elements).toEqual([actorElement]);
    expect(threat.severity).toBe('undecided');
    expect(threat.status).toBe('open');
  });

  it('opens applying to the model, on no element, where the add names none', () => {
    expect(freshThreat(7, undefined, t)).toMatchObject({
      elements: [],
      appliesToModel: true,
    });
    expect(freshThreat(7, actorElement, t).appliesToModel).toBe(false);
  });

  it('takes an id of its own on every add', () => {
    expect(freshThreat(7, actorElement, t).id).not.toBe(
      freshThreat(8, actorElement, t).id,
    );
  });
});

const detailOf = (threat: Threat): string | undefined =>
  attachableThreats([threat], processElement, activeTranslator())[0]?.text
    .detail;

describe('attachableThreats', () => {
  it('says that an offered threat applies to the model, and that one with no reference hangs off nothing', () => {
    const modelWide = detailOf({
      ...sampleThreat,
      elements: [],
      appliesToModel: true,
    });

    expect(modelWide).toContain(t('panel.detail-applies-to-model'));
    expect(modelWide).not.toContain(t('panel.detail-no-elements'));
    expect(detailOf({ ...sampleThreat, elements: [] })).toContain(
      t('panel.detail-no-elements'),
    );
    expect(detailOf(sampleThreat)).not.toContain(
      t('panel.detail-applies-to-model'),
    );
  });

  it.each([
    ['no title', ''],
    ['a title of only spaces', '   '],
  ])('offers a threat with %s under its id alone', (_, title) => {
    const [{ text }] = attachableThreats(
      [{ ...sampleThreat, title }],
      processElement,
      activeTranslator(),
    );

    expect(text).toMatchObject({
      label: '',
      suffix: `(${sampleThreat.id})`,
    });
  });
});

describe('threatAfterDeleting', () => {
  it('is the threat that takes the deleted one place in the list', () => {
    expect(threatAfterDeleting([sampleThreat, second, third], second.id)).toBe(
      third.id,
    );
  });

  it('is the threat before it where the deleted one was last', () => {
    expect(threatAfterDeleting([sampleThreat, second], second.id)).toBe(
      sampleThreat.id,
    );
  });

  it('is nothing where the deleted threat was the only one', () => {
    expect(
      threatAfterDeleting([sampleThreat], sampleThreat.id),
    ).toBeUndefined();
  });

  it('is nothing for a threat the list never held', () => {
    expect(threatAfterDeleting([sampleThreat], second.id)).toBeUndefined();
  });
});

describe('threatCommitter', () => {
  it('dispatches nothing while the panel is on no threat', () => {
    const send = recorder();

    threatCommitter(send, undefined)({ severity: 'high' });

    expect(send).toHaveBeenCalledTimes(0);
  });

  it('dispatches nothing for a patch that leaves every field as it was', () => {
    const send = recorder();

    threatCommitter(send, sampleThreat)({ severity: sampleThreat.severity });

    expect(send).toHaveBeenCalledTimes(0);
  });

  it('dispatches one replacement carrying the patch and nothing else', () => {
    const send = recorder();

    threatCommitter(send, sampleThreat)({ severity: 'critical' });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      Action.ReplaceThreat({
        threat: { ...sampleThreat, severity: 'critical' },
      }),
    );
  });
});
