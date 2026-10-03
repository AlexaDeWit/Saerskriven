import { handlerSlot } from './handler-slot.js';

const older = (): string => 'older';

const newer = (): string => 'newer';

describe('handlerSlot', () => {
  it('holds the latest handler registered', () => {
    const slot = handlerSlot<() => string>();

    slot.register(older);
    slot.register(newer);

    expect(slot.current()).toBe(newer);
  });

  it('empties on its handler leaving, and keeps a newer handler where an older one leaves', () => {
    const slot = handlerSlot<() => string>();
    const releaseOlder = slot.register(older);
    const releaseNewer = slot.register(newer);

    releaseOlder();
    expect(slot.current()).toBe(newer);

    releaseNewer();
    expect(slot.current()).toBeUndefined();
  });
});
