import { elementSchema } from '@saerskriven/model';
import { everyGlyphModel } from './canvas.fixtures.js';

const declaredKinds = new Set<string>(
  elementSchema.options.map((option) => option.shape.kind.value),
);

describe('everyGlyphModel', () => {
  it('carries one element of every kind the model declares', () => {
    expect(
      new Set(everyGlyphModel.elements.map((element) => element.kind)),
    ).toEqual(declaredKinds);
  });
});
