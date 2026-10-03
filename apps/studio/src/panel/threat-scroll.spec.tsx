import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Accordion } from 'radix-ui';
import { useRef } from 'react';
import styles from './threat-panel.module.css';
import { fieldScroll, keptScroll, useThreatScroll } from './threat-scroll.js';

function OpenThreat() {
  const list = useRef<HTMLDivElement>(null);
  const scroll = useThreatScroll(list);

  return (
    <div className={styles.body} data-testid="body">
      <Accordion.Root
        collapsible
        defaultValue="threat"
        onBlur={scroll.leave}
        onFocus={scroll.follow}
        onKeyDown={scroll.tab}
        onPointerDown={scroll.press}
        ref={list}
        type="single"
      >
        <Accordion.Item data-threat-item="threat" value="threat">
          <Accordion.Header className={styles.header}>
            <Accordion.Trigger>Summary</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content>
            <input aria-label="First" />
            <input aria-label="Second" data-top="300" />
          </Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>
      <button type="button">Outside</button>
    </div>
  );
}

const showOpenThreat = (): { readonly scrolled: () => number } => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function drawn(this: HTMLElement) {
      const top = Number(this.dataset['top'] ?? 0);
      return DOMRect.fromRect({ x: 0, y: top, width: 100, height: 20 });
    },
  );
  onTestFinished(() => {
    vi.restoreAllMocks();
  });
  render(<OpenThreat />);
  const body = screen.getByTestId('body');
  let scrollTop = 0;
  Object.defineProperty(body, 'clientHeight', { value: 100 });
  Object.defineProperty(body, 'scrollTop', {
    get: () => scrollTop,
    set: (value: number) => {
      scrollTop = value;
    },
  });
  return { scrolled: () => scrollTop };
};

const field = (name: string): HTMLElement =>
  screen.getByRole('textbox', { name });

describe('keptScroll', () => {
  const viewport = 400;

  it('puts the header back where it was when it fits there', () => {
    expect(keptScroll({ offset: 600, height: 80, was: 150, viewport })).toBe(
      450,
    );
  });

  it('shows the top of a header that was partly above the viewport', () => {
    expect(keptScroll({ offset: 600, height: 80, was: -12, viewport })).toBe(
      600,
    );
  });

  it('shows the bottom of a header that was partly below the viewport', () => {
    expect(keptScroll({ offset: 600, height: 80, was: 332, viewport })).toBe(
      280,
    );
  });

  it('shows the top of a header taller than the viewport', () => {
    expect(keptScroll({ offset: 600, height: 500, was: 20, viewport })).toBe(
      600,
    );
  });
});

describe('fieldScroll', () => {
  const room = { scrolled: 1000, top: 60, bottom: 500 } as const;

  it('leaves the body where it is while the field and the next one are in view', () => {
    expect(
      fieldScroll({ ...room, fieldTop: 200, fieldBottom: 240, next: 300 }),
    ).toBe(1000);
  });

  it('brings a field under the pinned summary down to just below it', () => {
    expect(
      fieldScroll({ ...room, fieldTop: 30, fieldBottom: 70, next: 120 }),
    ).toBe(970);
  });

  it('scrolls a field near the bottom up until the next field shows under it', () => {
    expect(
      fieldScroll({ ...room, fieldTop: 420, fieldBottom: 460, next: 540 }),
    ).toBe(1040);
  });

  it('stops with the field just below the summary where the next field cannot fit too', () => {
    expect(
      fieldScroll({ ...room, fieldTop: 300, fieldBottom: 340, next: 1300 }),
    ).toBe(1240);
  });

  it('shows the field whole where nothing follows it', () => {
    expect(
      fieldScroll({
        ...room,
        fieldTop: 470,
        fieldBottom: 520,
        next: undefined,
      }),
    ).toBe(1020);
  });
});

describe('useThreatScroll', () => {
  it('scrolls the field a Tab reaches into view below the pinned summary', async () => {
    const user = userEvent.setup();
    const { scrolled } = showOpenThreat();
    act(() => {
      field('First').focus();
    });

    await user.keyboard('{Tab}');

    expect(document.activeElement).toBe(field('Second'));
    expect(scrolled()).toBe(220);
  });

  it('forgets a Tab that took focus out of the list, so focus coming back moves nothing', async () => {
    const user = userEvent.setup();
    const { scrolled } = showOpenThreat();
    act(() => {
      field('Second').focus();
    });

    await user.keyboard('{Tab}');
    act(() => {
      field('Second').focus();
    });

    expect(scrolled()).toBe(0);
  });

  it('forgets a Tab at a pointer press, so a clicked field moves nothing', async () => {
    const user = userEvent.setup();
    const { scrolled } = showOpenThreat();
    act(() => {
      field('First').focus();
    });
    fireEvent.keyDown(field('First'), { key: 'Tab' });

    await user.click(field('Second'));

    expect(document.activeElement).toBe(field('Second'));
    expect(scrolled()).toBe(0);
  });
});
