import { threatCategorySchema } from './categories.js';

describe('threatCategorySchema', () => {
  it("rejects a category outside its methodology's set", () => {
    expect(
      threatCategorySchema.safeParse({
        methodology: 'CIA',
        category: 'spoofing',
      }).success,
    ).toBe(false);
  });

  it("rejects Threat Dragon's older PLOT4ai category names", () => {
    expect(
      threatCategorySchema.safeParse({
        methodology: 'PLOT4ai',
        category: 'technique-and-processes',
      }).success,
    ).toBe(false);
  });

  it('rejects a custom category with an empty methodology name', () => {
    expect(
      threatCategorySchema.safeParse({
        methodology: 'custom',
        methodologyName: '',
        category: 'attack-modelling',
      }).success,
    ).toBe(false);
  });
});
