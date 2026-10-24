import { parseModel, type Model } from '@saerskriven/model';
import { sharedModel } from '@saerskriven/model/fixtures';
import { Result } from 'effect';
import { saerskrivenYamlCodec } from './saerskriven-yaml.js';
import {
  featureCompleteYaml,
  readOrThrow,
  sharedElementsYaml,
  withFlowDrawnAway,
} from './saerskriven-yaml.fixtures.js';

const written = (model: Model): string =>
  saerskrivenYamlCodec.write(model).output;

describe('a version 3 file holding a shared element', () => {
  it('reads as the model it was written from, reporting nothing', () => {
    const read = readOrThrow(sharedElementsYaml);
    expect(read.model).toEqual(sharedModel);
    expect(read.divergences).toEqual([]);
  });

  it('writes back byte for byte, and two writes are equal', () => {
    const { model } = readOrThrow(sharedElementsYaml);
    expect(written(model)).toBe(sharedElementsYaml);
    expect(written(model)).toBe(written(readOrThrow(written(model)).model));
  });
});

describe('a flow end drawn away from its element', () => {
  const drawnAway = withFlowDrawnAway(readOrThrow(featureCompleteYaml).model);

  it('is a model the parse accepts, which reads back from its write as itself', () => {
    expect(Result.isSuccess(parseModel(drawnAway))).toBe(true);
    const text = written(drawnAway);
    expect(text).toMatch(/^formatVersion: 3$/mu);
    expect(readOrThrow(text).model).toEqual(drawnAway);
    expect(written(readOrThrow(text).model)).toBe(text);
  });
});

describe('a relationship to an element on another diagram', () => {
  it('reads from a version 3 file', () => {
    const { model } = readOrThrow(sharedElementsYaml);
    expect(
      model.elements.find(({ id }) => id === 'payments-zone'),
    ).toMatchObject({ containedElements: ['payments-api', 'card-vault'] });
  });

  it('is refused in a version 2 file, at the path the file holds it', () => {
    const text = featureCompleteYaml.replace(
      /containedElements:\n(\s+)- process-booking/u,
      'containedElements:\n$1- process-records',
    );
    expect(text).not.toBe(featureCompleteYaml);
    const read = saerskrivenYamlCodec.read(text);
    expect(Result.isFailure(read) ? read.failure : undefined).toMatchObject({
      _tag: 'InvalidModel',
      issues: [
        {
          path: ['diagrams', 0, 'elements', 0, 'containedElements', 0],
          detail: {
            code: 'related-off-diagram',
            parameters: { id: 'process-records' },
          },
        },
      ],
    });
  });
});

describe('an accent no release knows on two placements of one element', () => {
  it('is reported once for the element', () => {
    const text = sharedElementsYaml
      .replace('accent: s1', 'accent: q9')
      .replace(
        '      - element: payments-api\n        position:\n          x: 240',
        '      - element: payments-api\n        accent: q9\n        position:\n          x: 240',
      );
    expect(readOrThrow(text).divergences).toEqual([
      {
        subject: { kind: 'element', id: 'payments-api' },
        detail: { code: 'accent-unknown', parameters: { accent: 'q9' } },
        reason: 'narrowed',
      },
    ]);
  });
});
