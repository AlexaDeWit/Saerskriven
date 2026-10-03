import { assumptionId } from '@saerskriven/model/fixtures';
import type { ElementId, Threat, ThreatFlag } from '@saerskriven/model';
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
import { activeTranslator } from '../messages/locale.js';
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

describe('ThreatSummary', () => {
  beforeEach(() => {
    modelStore.setState(initialState(recordedModel), true);
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
