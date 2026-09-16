import { elementSchema } from '@saerskriven/model';
import { everyGlyphModel } from './canvas.fixtures.js';

const declaredKinds = new Set<string>(
  elementSchema.options.map((option) => option.shape.kind.value),
);

describe('everyGlyphModel', () => {
  it('carries one element of every kind the model declares', () => {
    expect(
      new Set(
        everyGlyphModel.diagrams[0].elements.map((element) => element.kind),
      ),
    ).toEqual(declaredKinds);
  });

  it('read the kinds off the model schema, not off a list kept by hand', () => {
    expect(declaredKinds.size).toBeGreaterThan(1);
    expect(declaredKinds.has('actor')).toBe(true);
  });
});
