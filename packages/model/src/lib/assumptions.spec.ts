import { assumptionStatusSchema } from './assumptions.js';

describe('assumptionStatusSchema', () => {
  it("rejects 'invalid', since the status names the event of invalidation", () => {
    expect(assumptionStatusSchema.safeParse('invalid').success).toBe(false);
  });
});
