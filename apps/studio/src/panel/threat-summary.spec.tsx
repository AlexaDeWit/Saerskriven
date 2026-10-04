import { assumptionId } from '@saerskriven/model/fixtures';
import {
  elementsById,
  type ElementId,
  type Model,
  type Threat,
  type ThreatFlag,
} from '@saerskriven/model';
import { locales } from '@saerskriven/i18n';
import { act, cleanup, render, screen } from '@testing-library/react';
import { Action } from '../store/actions.js';
import { initialState } from '../store/state.js';
import {
  actorElement,
  firstAssumption,
  firstMitigation,
  firstThreat,
  processElement,
  recordedModel,
  secondThreat,
  storeElement,
} from '../store/store.fixtures.js';
import { dispatch, modelStore } from '../store/store.js';
import {
  canvasModel,
  probeFlow,
  requestFlow,
} from '../canvas/canvas.fixtures.js';
import { inLocale } from '../messages/messages.fixtures.js';
import {
  attachableElements,
  elementHeading,
  threatAttachments,
  threatSummaryElements,
} from './threats.js';
import { activeTranslator, chooseLanguage } from '../messages/locale.js';
import { recordedThreat } from './panel.fixtures.js';
import { ThreatSummary } from './threat-summary.js';

const showSummaryOn = (on: ElementId | undefined, threat: Threat): void => {
  render(
    <button type="button">
      <ThreatSummary on={on} threat={threat} />
    </button>,
  );
};

const showSummary = (threat: Threat, on: ElementId = actorElement): void => {
  showSummaryOn(on, threat);
};

const trigger = (): HTMLElement => screen.getByRole('button');

const named = (part: string): HTMLElement | null =>
  screen.queryByRole('button', { name: (name) => name.includes(part) });

const nameOf = (): string => {
  let found = '';
  screen.getByRole('button', {
    name: (name) => {
      found = name;
      return true;
    },
  });
  return found;
};

const elementsLine = (): string | undefined =>
  trigger().querySelector('[data-on-elements]')?.textContent ?? undefined;

const modelLine = (): string | undefined =>
  trigger().querySelector('[data-on-model]')?.textContent ?? undefined;

const raised = (): string[] =>
  [...trigger().querySelectorAll<HTMLElement>('[data-flag]')].map(
    (mark) => mark.dataset['flag'] ?? '',
  );

const markOf = (flag: ThreatFlag): string =>
  trigger().querySelector(`[data-flag="${flag}"]`)?.textContent ?? '';

const run = (action: Action): void => {
  act(() => {
    dispatch(action);
  });
};

const flowModel: Model = {
  ...canvasModel,
  diagrams: canvasModel.diagrams.map((diagram) => ({
    ...diagram,
    elements: [
      ...diagram.elements.filter(({ id }) => id === requestFlow),
      ...diagram.elements.filter(({ id }) => id !== requestFlow),
    ].map((element) =>
      element.id === requestFlow ? { ...element, name: '' } : element,
    ),
  })),
};

const flowNames = {
  'en-CA': {
    on: 'On the flow from Reader to Studio and Studio',
    also: 'Also on the flow from Reader to Studio and Studio',
    label: 'Flow from Reader to Studio',
    detach: 'Detach the flow from Reader to Studio',
  },
  'fr-CA': {
    on: 'Sur le flux depuis Reader vers Studio et Studio',
    also: 'Aussi sur le flux depuis Reader vers Studio et Studio',
    label: 'Flux depuis Reader vers Studio',
    detach: 'Détacher le flux depuis Reader vers Studio',
  },
  sv: {
    on: 'På flödet från Reader till Studio och Studio',
    also: 'Även på flödet från Reader till Studio och Studio',
    label: 'Flöde från Reader till Studio',
    detach: 'Koppla bort flödet från Reader till Studio',
  },
};

describe('ThreatSummary', () => {
  beforeEach(() => {
    modelStore.setState(initialState(recordedModel), true);
  });

  afterEach(() => {
    cleanup();
    chooseLanguage('en-CA');
  });

  it.each(locales)(
    'names an unlabelled flow as a phrase on both panels in %s',
    (locale) => {
      chooseLanguage(locale);
      modelStore.setState(initialState(flowModel), true);
      const threat = {
        ...flowModel.threats[0],
        elements: [requestFlow, processElement],
      };
      showSummaryOn(undefined, threat);
      expect(named(flowNames[locale].on)).not.toBeNull();
      cleanup();

      showSummary({ ...threat, elements: [...threat.elements, actorElement] });
      expect(named(flowNames[locale].also)).not.toBeNull();

      const t = inLocale(locale);
      const attachments = threatAttachments(flowModel.diagrams, threat, t);
      expect(attachments[0]).toMatchObject({
        label: flowNames[locale].label,
        detach: flowNames[locale].detach,
      });
      expect(
        attachableElements(
          flowModel.diagrams,
          { ...threat, elements: [] },
          t,
        )[0].text.label,
      ).toBe(attachments[0].label);
      const diagram = flowModel.diagrams[0];
      expect(
        elementHeading(diagram.elements[0], elementsById(diagram.elements), t),
      ).toBe(attachments[0].label);
    },
  );

  it.each(locales)(
    'keeps named elements and unnamed actors unchanged in %s',
    (locale) => {
      chooseLanguage(locale);
      const model = {
        ...flowModel,
        diagrams: flowModel.diagrams.map((diagram) => ({
          ...diagram,
          elements: diagram.elements.map((element) =>
            element.id === actorElement ? { ...element, name: '' } : element,
          ),
        })),
      };
      modelStore.setState(initialState(model), true);
      const threat = {
        ...model.threats[0],
        elements: [actorElement, processElement, probeFlow],
      };
      showSummaryOn(undefined, threat);
      const names = threatAttachments(
        model.diagrams,
        threat,
        inLocale(locale),
      ).map(({ label }) => label);
      expect(names).toContain('Studio');
      expect(names).toContain('Reads a file');
      expect(names.some((label) => label.includes(`(${actorElement})`))).toBe(
        true,
      );
      expect(
        named(inLocale(locale)('panel.on-elements', { list: names })),
      ).not.toBeNull();
    },
  );

  it.each(locales)(
    'distinguishes two unlabelled flows between the same ends in %s',
    (locale) => {
      chooseLanguage(locale);
      const source = flowModel.diagrams[0].elements.find(
        ({ id }) => id === requestFlow,
      );
      const twin = {
        ...flowModel,
        diagrams: flowModel.diagrams.map((diagram) => ({
          ...diagram,
          elements: diagram.elements.map((element) =>
            element.id === probeFlow && source?.kind === 'flow'
              ? { ...source, id: probeFlow }
              : element,
          ),
        })),
      };
      modelStore.setState(initialState(twin), true);
      showSummaryOn(undefined, {
        ...twin.threats[0],
        elements: [requestFlow, probeFlow],
      });
      expect(named(`(${requestFlow})`)).not.toBeNull();
      expect(named(`(${probeFlow})`)).not.toBeNull();
    },
  );

  it('distinguishes a flow phrase from a named element with the same normalized text', () => {
    const phrase = 'the flow from Reader to Studio';
    const model = {
      ...flowModel,
      diagrams: flowModel.diagrams.map((diagram) => ({
        ...diagram,
        elements: diagram.elements.map((element) =>
          element.id === probeFlow
            ? { ...element, name: `${phrase} ` }
            : element,
        ),
      })),
    };
    modelStore.setState(initialState(model), true);
    const threat = { ...model.threats[0], elements: [requestFlow, probeFlow] };
    showSummaryOn(undefined, threat);
    const labels = threatSummaryElements(
      model.diagrams,
      threat,
      activeTranslator().t,
    ).map(({ label }) => label);
    expect(new Set(labels.map((label) => label.trim())).size).toBe(2);
    expect(named(`1: ${phrase}`)).not.toBeNull();
    expect(named(`2: ${phrase}`)).not.toBeNull();
  });

  it('names its number, title, severity, status and category in that order, and no record counts', () => {
    showSummary(recordedThreat(firstThreat));

    const name = nameOf();
    const parts = [
      '1',
      'A reader edits a model they may only read',
      'Medium',
      'Open',
      'Tampering',
    ].map((part) => name.indexOf(part));
    expect(parts.every((at) => at >= 0)).toBe(true);
    expect(
      parts.every((at, index) => index === 0 || at > parts[index - 1]),
    ).toBe(true);
    expect(name).not.toContain('Mitigations');
    expect(name).not.toContain('Assumptions');
  });

  it('names the other elements the threat is on, and only when there are any', () => {
    showSummary(recordedThreat(firstThreat));
    expect(elementsLine()).toBeUndefined();
    cleanup();

    showSummary({
      ...recordedThreat(firstThreat),
      elements: [actorElement, storeElement, processElement],
    });

    expect(elementsLine()).toContain('Studio');
    expect(elementsLine()).toContain('Models');
    expect(elementsLine()).not.toContain('Reader');
    expect(named('Models')).not.toBeNull();
  });

  it('names every element the threat is on where no element shows it, and says so where it is on none', () => {
    const { t } = activeTranslator();
    showSummaryOn(undefined, {
      ...recordedThreat(firstThreat),
      elements: [actorElement, processElement],
    });

    expect(elementsLine()).toBe(
      t('panel.on-elements', { list: ['Reader', 'Studio'] }),
    );
    cleanup();

    showSummaryOn(undefined, { ...recordedThreat(firstThreat), elements: [] });

    expect(elementsLine()).toBe(t('panel.on-no-element'));
    expect(named(t('panel.on-no-element'))).not.toBeNull();
    expect(modelLine()).toBeUndefined();
  });

  it('says a threat applies to the whole model in place of saying it is on no element, and ahead of the elements it is on', () => {
    const { t } = activeTranslator();
    const modelWide = { ...recordedThreat(firstThreat), appliesToModel: true };
    showSummaryOn(undefined, { ...modelWide, elements: [] });

    expect(named('Applies to the whole model')).not.toBeNull();
    expect(elementsLine()).toBeUndefined();
    cleanup();

    showSummaryOn(undefined, {
      ...modelWide,
      elements: [actorElement, processElement],
    });

    expect(elementsLine()).toBe(
      t('panel.on-elements', { list: ['Reader', 'Studio'] }),
    );
    expect(nameOf().indexOf(modelLine() ?? 'none')).toBeLessThan(
      nameOf().indexOf(elementsLine() ?? 'none'),
    );
    expect(nameOf()).toContain(modelLine());
  });

  it('says a threat on an element also applies to the whole model, with the other elements it is on', () => {
    const modelWide = { ...recordedThreat(firstThreat), appliesToModel: true };
    showSummary(modelWide);

    expect(named('Applies to the whole model')).not.toBeNull();
    expect(elementsLine()).toBeUndefined();
    cleanup();

    showSummary({ ...modelWide, elements: [actorElement, storeElement] });

    expect(modelLine()).toBeDefined();
    expect(elementsLine()).toContain('Models');
  });

  it('marks an assumption that applies to the model only on the threats it links', () => {
    showSummary(recordedThreat(secondThreat), processElement);
    run(
      Action.AddAssumption({
        assumption: {
          id: assumptionId('assumption-hand-written'),
          prose: 'The model is written by hand.',
          status: 'invalidated',
          threats: [],
          appliesToModel: true,
        },
      }),
    );

    expect(raised()).toEqual([]);

    run(
      Action.LinkAssumption({
        assumptionId: assumptionId('assumption-hand-written'),
        threatId: secondThreat,
      }),
    );

    expect(raised()).toEqual(['rests-on-invalidated-assumption']);
  });

  it('marks a mitigated threat with no implemented work until its mitigation is implemented', () => {
    showSummary(recordedThreat(firstThreat, 'mitigated'));

    expect(raised()).toEqual(['mitigated-without-implemented-work']);
    expect(named(markOf('mitigated-without-implemented-work'))).not.toBeNull();

    run(
      Action.SetMitigationStatus({
        mitigationId: firstMitigation,
        status: 'implemented',
      }),
    );

    expect(raised()).toEqual([]);
  });

  it('marks a threat resting on an invalidated assumption, and no other assumption status', () => {
    showSummary(recordedThreat(firstThreat));

    for (const status of ['unconfirmed', 'valid'] as const) {
      run(
        Action.SetAssumptionStatus({ assumptionId: firstAssumption, status }),
      );
      expect(raised()).toEqual([]);
    }

    run(
      Action.SetAssumptionStatus({
        assumptionId: firstAssumption,
        status: 'invalidated',
      }),
    );

    expect(raised()).toEqual(['rests-on-invalidated-assumption']);
    expect(named(markOf('rests-on-invalidated-assumption'))).not.toBeNull();
  });

  it('gives each flag a glyph of its own beside its label', () => {
    showSummary(recordedThreat(firstThreat, 'mitigated'));
    run(
      Action.SetAssumptionStatus({
        assumptionId: firstAssumption,
        status: 'invalidated',
      }),
    );

    const glyphs = [
      ...trigger().querySelectorAll('[data-flag] svg[aria-hidden] path'),
    ].map((path) => path.getAttribute('d'));

    expect(glyphs).toHaveLength(2);
    expect(new Set(glyphs).size).toBe(2);
    expect(markOf('mitigated-without-implemented-work')).not.toBe(
      markOf('rests-on-invalidated-assumption'),
    );
  });
});
