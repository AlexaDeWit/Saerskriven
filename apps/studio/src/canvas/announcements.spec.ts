import { act, renderHook } from '@testing-library/react';
import { activeTranslator, chooseLanguage } from '../messages/locale.js';
import { Action } from '../store/actions.js';
import { initialState } from '../store/state.js';
import { actorElement, sampleModel } from '../store/store.fixtures.js';
import { dispatch, modelStore } from '../store/store.js';
import {
  announce,
  currentAnnouncement,
  quoted,
  resetAnnouncements,
  useAnnouncement,
} from './announcements.js';

const clusters = (text: string): number =>
  [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)]
    .length;

describe('announce', () => {
  const message = 'message';
  const said = () => message;

  beforeEach(() => {
    modelStore.setState(initialState(sampleModel), true);
    resetAnnouncements();
  });

  it('holds what was last said', () => {
    announce(said);

    expect(currentAnnouncement().message).toBe(message);
  });

  it('counts every announcement, so the same words twice over are two of them', () => {
    announce(said);
    const first = currentAnnouncement();
    announce(said);

    expect(currentAnnouncement().sequence).toBe(first.sequence + 1);
  });

  it('starts again from silence when reset', () => {
    announce(said);
    resetAnnouncements();

    expect(currentAnnouncement().message).toBe('');
  });

  it('clears when the next action changes canvas state', () => {
    announce(said);

    dispatch(Action.Select({ elementIds: [actorElement] }));

    expect(currentAnnouncement().message).toBe('');
  });

  it('stays when an action changes nothing', () => {
    announce(said);

    dispatch(Action.Undo());

    expect(currentAnnouncement().message).toBe(message);
  });
});

describe('useAnnouncement', () => {
  beforeEach(() => {
    modelStore.setState(initialState(sampleModel), true);
    resetAnnouncements();
  });

  afterEach(() => {
    act(() => {
      chooseLanguage('en-CA');
    });
    globalThis.localStorage.clear();
  });

  it('tells a subscribed component what was said, and that it was unsaid', () => {
    const { result } = renderHook(() => useAnnouncement());
    const message = 'message';

    act(() => {
      announce(() => message);
    });
    expect(result.current.message).toBe(message);

    act(() => {
      resetAnnouncements();
    });
    expect(result.current.message).toBe('');
  });

  it('rewords a standing announcement in a language chosen after it was made', () => {
    const { result } = renderHook(() => useAnnouncement());
    act(() => {
      announce((speak) => speak('canvas.selection-cleared'));
    });
    const before = result.current;

    act(() => {
      chooseLanguage('sv');
    });

    expect(result.current.message).toBe(
      activeTranslator().t('canvas.selection-cleared'),
    );
    expect(result.current.message).not.toBe(before.message);
    expect(result.current.sequence).toBe(before.sequence);
  });
});

describe('quoted', () => {
  const bound = 24;

  const { t } = activeTranslator();

  it('sets short text off whole, on one line', () => {
    const said = quoted(t, 'Callers\n never share', bound);

    expect(said).toContain('Callers never share');
    expect(said).not.toBe('Callers never share');
  });

  it('cuts long text to a bounded prefix ending in an ellipsis', () => {
    const long = 'Særskriven carries a token in a redacted type. '.repeat(20);
    const said = quoted(t, long, bound);

    expect(said).toContain(long.slice(0, bound / 2));
    expect(clusters(said)).toBeLessThanOrEqual(bound + 2);
  });

  it('never cuts inside one character a person sees', () => {
    const family = '👩‍👩‍👧';
    const said = quoted(t, family.repeat(bound * 2), bound);

    expect(said).toContain(family.repeat(bound - 1));
    expect(clusters(said)).toBeLessThanOrEqual(bound + 2);
  });
});
