import { assumptionId, mitigationId } from '@saerskriven/model/fixtures';
import type { Threat, ThreatFlag } from '@saerskriven/model';
import { act, render, screen } from '@testing-library/react';
import { Action } from '../store/actions.js';
import { initialState } from '../store/state.js';
import {
  firstAssumption,
  firstMitigation,
  firstThreat,
  recordedModel,
  secondThreat,
} from '../store/store.fixtures.js';
import { dispatch, modelStore } from '../store/store.js';
import { ThreatSummary } from './threat-summary.js';

const threatOf = (id: Threat['id'], status?: Threat['status']): Threat => {
  const threat =
    recordedModel.threats.find((held) => held.id === id) ??
    recordedModel.threats[0];
  return { ...threat, status: status ?? threat.status };
};

const showSummary = (threat: Threat): void => {
  render(
    <button type="button">
      <ThreatSummary threat={threat} />
    </button>,
  );
};

const trigger = (): HTMLElement => screen.getByRole('button');

const named = (part: string): HTMLElement | null =>
  screen.queryByRole('button', { name: (name) => name.includes(part) });

const countOf = (kind: 'mitigations' | 'assumptions'): string =>
  trigger().querySelector(`[data-count="${kind}"]`)?.textContent ?? '';

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

  it('counts the records linked to the threat, and follows a link and an unlink', () => {
    showSummary(threatOf(firstThreat));
    run(
      Action.AddMitigation({
        mitigation: {
          id: mitigationId('mitigation-audit-log'),
          title: 'Audit every write',
          prose: '',
          status: 'proposed',
          threats: [firstThreat],
        },
      }),
    );

    expect(countOf('mitigations')).toContain('2');
    expect(countOf('assumptions')).toContain('1');

    run(
      Action.UnlinkAssumption({
        assumptionId: firstAssumption,
        threatId: firstThreat,
      }),
    );

    expect(countOf('assumptions')).toContain('0');
    expect(named(countOf('mitigations'))).not.toBeNull();
    expect(named(countOf('assumptions'))).not.toBeNull();
  });

  it('counts an assumption that applies to the model only on the threats it links', () => {
    showSummary(threatOf(secondThreat));
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

    expect(countOf('assumptions')).toContain('0');
    expect(raised()).toEqual([]);

    run(
      Action.LinkAssumption({
        assumptionId: assumptionId('assumption-hand-written'),
        threatId: secondThreat,
      }),
    );

    expect(countOf('assumptions')).toContain('1');
    expect(raised()).toEqual(['rests-on-invalidated-assumption']);
  });

  it('marks a mitigated threat with no implemented work until its mitigation is implemented', () => {
    showSummary(threatOf(firstThreat, 'mitigated'));

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
    showSummary(threatOf(firstThreat));

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
    showSummary(threatOf(firstThreat, 'mitigated'));
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
