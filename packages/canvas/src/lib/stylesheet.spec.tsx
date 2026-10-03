import { severitySchema } from '@saerskriven/model';
import { renderToStaticMarkup } from 'react-dom/server';
import { everyGlyphModel, specMarks } from './canvas.fixtures.js';
import { layoutDiagram } from './layout.js';
import { defaultRenderTheme, type RenderTheme } from './render-theme.js';
import { DiagramGlyphs } from './scene.js';
import {
  canvasClassNames,
  renderCanvasStylesheet,
  severityToneClass,
  themedCanvasStylesheet,
  wrappedTextStyles,
} from './stylesheet.js';
import { outOfScopeInk, paletteProperty } from './tokens.js';

const declared = new Set<string>(Object.values(canvasClassNames));

const sheet = renderCanvasStylesheet();

const classesStyledBy = (styles: string): Set<string> =>
  new Set<string>(
    (styles.match(/\.[A-Za-z][\w-]*/gu) ?? []).map((token) => token.slice(1)),
  );

const selected = classesStyledBy(sheet);

const emitted = new Set<string>(
  (
    renderToStaticMarkup(
      <DiagramGlyphs
        marks={specMarks}
        layout={layoutDiagram(everyGlyphModel.diagrams[0], everyGlyphModel)}
      />,
    ).match(/class="[^"]*"/gu) ?? []
  ).flatMap((attribute) => attribute.slice(7, -1).split(' ')),
);

const toneRule = (styles: string, className: string): string | undefined =>
  styles.split('\n').find((line) => line.startsWith(`.${className} { fill:`));

const toned = (theme: RenderTheme): [string, string][] => [
  ...severitySchema.options.map((severity): [string, string] => [
    severityToneClass[severity],
    theme.severity[severity],
  ]),
  [canvasClassNames.toneFlag, theme.colours.text],
];

describe('renderCanvasStylesheet', () => {
  it('styles every class name the map declares', () => {
    expect(selected).toEqual(declared);
  });

  it('styles no class name the primitives never emit', () => {
    expect(selected).toEqual(emitted);
  });

  it('renders each run of text at the size its wrap estimates with', () => {
    const mismatched = Object.values(wrappedTextStyles).filter((rule) => {
      const block = sheet.split(`.${rule.className} {`)[1] ?? '';
      return !block.split('}')[0].includes(`font-size: ${rule.fontSize}px`);
    });
    expect(mismatched.map((rule) => rule.className)).toEqual([]);
  });

  it('uses the ten-unit widget label token for element and flow names', () => {
    expect(wrappedTextStyles.label.fontSize).toBe(10);
    expect(wrappedTextStyles.flowLabel.fontSize).toBe(
      wrappedTextStyles.label.fontSize,
    );
    expect(wrappedTextStyles.note.fontSize).not.toBe(
      wrappedTextStyles.label.fontSize,
    );
  });

  it("fills a flow block's backing with the ground the diagram is drawn on", () => {
    const block = sheet
      .split(`.${canvasClassNames.flowBacking} {`)[1]
      .split('}')[0];
    expect(block).toContain(`fill: ${defaultRenderTheme.colours.background}`);
  });

  it('is styled with properties SVG applies, so it needs no HTML around it', () => {
    expect(sheet).not.toContain('background');
    expect(sheet).toContain('stroke');
  });

  it('leaves the resolved sheet the values it has, the standalone SVG carrying no root to read a property from', () => {
    expect(sheet).not.toContain('var(');
  });

  const outlined: RenderTheme = {
    ...defaultRenderTheme,
    colours: { ...defaultRenderTheme.colours, text: '#123456' },
    badges: { ...defaultRenderTheme.badges, style: 'outline', borderWidth: 1 },
  };

  it.each([
    ['filled', defaultRenderTheme],
    ['outlined', outlined],
  ] as const)(
    'writes the %s badge rule for every severity tone and the flag tone, the flag in the text colour',
    (_style, theme) => {
      const themed = renderCanvasStylesheet(theme);
      const fill = (tone: string) =>
        theme.badges.style === 'outline' ? theme.colours.background : tone;
      expect(
        toned(theme).map(([className]) => toneRule(themed, className)),
      ).toEqual(
        toned(theme).map(
          ([className, tone]) =>
            `.${className} { fill: ${fill(tone)}; stroke: ${tone}; stroke-width: ${String(theme.badges.borderWidth)}; }`,
        ),
      );
    },
  );
});

describe('themedCanvasStylesheet', () => {
  it('styles the classes the resolved sheet does, with every colour left to a custom property', () => {
    expect(classesStyledBy(themedCanvasStylesheet)).toEqual(selected);
    expect(themedCanvasStylesheet).not.toMatch(/#[0-9A-Fa-f]{3,8}/u);
  });
});

describe('an out-of-scope element', () => {
  const outOfScope = `.${canvasClassNames.outOfScope} `;
  const rules = themedCanvasStylesheet
    .split('}')
    .map((rule) => rule.trim())
    .filter((rule) => rule.startsWith(outOfScope));
  const ruleFor = (className: string): string | undefined =>
    rules.find((rule) => rule.startsWith(`${outOfScope}.${className} {`));

  it('is faded by neither sheet, so each ink is drawn at the ratio the palette measures for it', () => {
    expect(
      [sheet, themedCanvasStylesheet].filter((styles) =>
        styles.includes('opacity'),
      ),
    ).toEqual([]);
  });

  it('has its outline, line, arrowhead and name drawn in its own inks, its badge, note and flow name as in scope', () => {
    expect(classesStyledBy(rules.join('\n'))).toEqual(
      new Set([
        canvasClassNames.outOfScope,
        canvasClassNames.shape,
        canvasClassNames.flowArrow,
        canvasClassNames.label,
      ]),
    );
    expect(ruleFor(canvasClassNames.shape)).toContain(
      `stroke: ${paletteProperty(outOfScopeInk.outline)};`,
    );
    expect(ruleFor(canvasClassNames.flowArrow)).toContain(
      `fill: ${paletteProperty(outOfScopeInk.outline)};`,
    );
    expect(ruleFor(canvasClassNames.label)).toContain(
      `fill: ${paletteProperty(outOfScopeInk.name)};`,
    );
  });
});

describe('severityToneClass', () => {
  it('gives the undecided severity the neutral tone', () => {
    expect(severityToneClass.undecided).toBe(canvasClassNames.toneNeutral);
  });
});
