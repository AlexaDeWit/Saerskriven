import {
  contentHeight,
  growToContent,
  sizesFieldsToContent,
} from './grow-to-content.js';

const withScrollHeight = (
  style: Partial<CSSStyleDeclaration>,
  scrollHeight: number,
): HTMLTextAreaElement => {
  const element = document.createElement('textarea');
  Object.assign(element.style, style);
  Object.defineProperty(element, 'scrollHeight', { value: scrollHeight });
  return element;
};

describe('contentHeight', () => {
  it('takes the padding off a content box and adds the border to a border box', () => {
    expect(
      contentHeight(
        withScrollHeight(
          { boxSizing: 'content-box', paddingTop: '4px', paddingBottom: '6px' },
          100,
        ),
      ),
    ).toBe(90);
    expect(
      contentHeight(
        withScrollHeight(
          {
            boxSizing: 'border-box',
            borderTopWidth: '1px',
            borderBottomWidth: '2px',
          },
          100,
        ),
      ),
    ).toBe(103);
  });

  it('is nothing for an element with no layout', () => {
    expect(contentHeight(withScrollHeight({}, 0))).toBeUndefined();
  });
});

describe('growToContent', () => {
  it('sets the height from the content, and clears it where the element has no layout', () => {
    const element = withScrollHeight(
      { boxSizing: 'border-box', borderWidth: '0px', height: '10px' },
      120,
    );
    growToContent(element);
    expect(element.style.height).toBe('120px');

    const unlaid = withScrollHeight({ height: '10px' }, 0);
    growToContent(unlaid);
    expect(unlaid.style.height).toBe('');
    expect(() => {
      growToContent(null);
    }).not.toThrow();
  });
});

describe('sizesFieldsToContent', () => {
  it('follows what CSS.supports says about field-sizing', () => {
    vi.stubGlobal('CSS', {
      supports: (property: string, value: string) =>
        property === 'field-sizing' && value === 'content',
    });
    onTestFinished(() => {
      vi.unstubAllGlobals();
    });
    expect(sizesFieldsToContent()).toBe(true);
    vi.stubGlobal('CSS', { supports: () => false });
    expect(sizesFieldsToContent()).toBe(false);
  });
});
