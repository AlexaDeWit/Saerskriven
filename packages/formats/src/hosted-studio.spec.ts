import { hostedStudioUrl } from './hosted-studio.js';

describe('the hosted studio', () => {
  it('is the canonical address, over https', () => {
    expect(hostedStudioUrl).toBe('https://saerskriven.com/');
  });
});
