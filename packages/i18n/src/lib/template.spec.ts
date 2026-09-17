import { templateParts, wellFormedTemplate } from './template.js';

describe('templates', () => {
  it('splits literal text from placeholder names', () => {
    expect(templateParts('Showing {title} of {count}.')).toEqual([
      'Showing ',
      'title',
      ' of ',
      'count',
      '.',
    ]);
  });

  it.each([
    'Open {title',
    'Open title}',
    'Open {} now',
    'Open {a {b} c}',
    '{{title}}',
  ])('refuses the unbalanced or empty braces in %j', (template) => {
    expect(wellFormedTemplate(template)).toBe(false);
  });

  it.each(['Opened.', '{title}', 'Showing {title} of {count}.'])(
    'accepts %j',
    (template) => {
      expect(wellFormedTemplate(template)).toBe(true);
    },
  );
});
