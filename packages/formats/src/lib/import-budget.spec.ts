import type { Model } from '@saerskriven/model';
import { Either } from 'effect';
import { importedFrom, importedId } from './import-budget.js';
import { otmFeatureComplete, tmbomFeatureComplete } from './import.fixtures.js';
import { importModel } from './import.js';

const importedOf = (document: object) =>
  Either.getOrThrow(importModel(JSON.stringify(document)));

const importedModel = (document: object): Model => importedOf(document).model;

const otm = importedModel(otmFeatureComplete);

const tmbom = importedModel(tmbomFeatureComplete);

const madeFrom = (
  ids: readonly string[],
  kind: Parameters<typeof importedFrom>[1],
  source: string,
): number => ids.filter((id) => importedFrom(id, kind, source)).length;

describe('importedId', () => {
  it('escapes every part so `-` only separates the kind, the count and the parts', () => {
    expect(importedId('otm-threat', ['a-b', 'c.d'])).toBe(
      'otm-threat-2-a_2d_b-c_2e_d',
    );
  });
});

describe('importedFrom', () => {
  it('finds one OTM threat for each occurrence of the definition it was made from', () => {
    const ids = otm.threats.map(({ id }) => id);

    expect(madeFrom(ids, 'otm-threat', 'threat-spoofing')).toBe(2);
    expect(madeFrom(ids, 'otm-threat', 'threat-unattached')).toBe(1);
    expect(
      (otmFeatureComplete.threats ?? []).reduce(
        (total, { id }) => total + madeFrom(ids, 'otm-threat', id),
        0,
      ),
    ).toBe(ids.length);
  });

  it('finds every OTM mitigation by the definition it was made from', () => {
    const ids = otm.mitigations.map(({ id }) => id);

    expect(madeFrom(ids, 'otm-mitigation', 'mitigation-signing')).toBe(2);
    expect(
      (otmFeatureComplete.mitigations ?? []).reduce(
        (total, { id }) => total + madeFrom(ids, 'otm-mitigation', id),
        0,
      ),
    ).toBe(ids.length);
  });

  it('finds the mitigation a TM-BOM control became by its symbolic name', () => {
    const ids = tmbom.mitigations.map(({ id }) => id);

    expect(madeFrom(ids, 'tmbom-control', 'control-under-review')).toBe(1);
    expect(madeFrom(ids, 'tmbom-control', 'control-under')).toBe(0);
  });

  it('finds the threats an unmapped OTM status was read for by the source id the divergence carries', () => {
    const ids = otm.threats.map(({ id }) => id);
    const sources = importedOf(otmFeatureComplete).divergences.flatMap(
      ({ detail }) =>
        detail.code === 'otm-threat-status-unmapped' &&
        detail.parameters.status !== undefined
          ? [detail.parameters.id ?? '']
          : [],
    );

    expect(sources).toEqual(['threat-spoofing']);
    expect(madeFrom(ids, 'otm-threat', 'threat-spoofing')).toBe(2);
  });

  it('tells the kinds apart', () => {
    expect(
      otm.threats.some(({ id }) =>
        importedFrom(id, 'otm-mitigation', 'threat-spoofing'),
      ),
    ).toBe(false);
  });
});
