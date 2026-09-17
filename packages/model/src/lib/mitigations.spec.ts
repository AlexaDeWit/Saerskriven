import { mitigationStatusSchema } from './mitigations.js';

describe('mitigationStatusSchema', () => {
  it("rejects 'mitigated'; that word belongs to threat status", () => {
    expect(mitigationStatusSchema.safeParse('mitigated').success).toBe(false);
  });
});
