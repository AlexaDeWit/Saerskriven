import { threatSchema, threatStatusSchema } from './threats.js';

const threat = {
  id: 'threat-tamper-order',
  number: 1,
  title: 'Order tampering in transit',
  category: { methodology: 'STRIDE', category: 'tampering' },
  severity: 'high',
  status: 'open',
  description: 'An order can be altered between the customer and the API.',
  elements: ['element-api'],
};

describe('threatStatusSchema', () => {
  it("rejects Threat Dragon's raw casing; the import maps it", () => {
    expect(threatStatusSchema.safeParse('Open').success).toBe(false);
  });
});

describe('threatSchema', () => {
  it('rejects a number that is not a positive integer', () => {
    expect(threatSchema.safeParse({ ...threat, number: 0 }).success).toBe(
      false,
    );
    expect(threatSchema.safeParse({ ...threat, number: 1.5 }).success).toBe(
      false,
    );
  });
});
