import { reasonOf } from './reason.js';

describe('reasonOf', () => {
  it('takes the message of what was thrown', () => {
    expect(reasonOf(new Error('NotAllowedError'))).toBe('NotAllowedError');
  });

  it('renders what was thrown where it is no error at all', () => {
    expect(reasonOf('refused')).toBe('refused');
  });
});
