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
import { outOfScopeOutline, paletteProperty, strokeWidths } from './tokens.js';

const declared = new Set<string>(Object.values(canvasClassNames));

const sheet = renderCanvasStylesheet();

const classesStyledBy = (styles: string): Set<string> =>
  new Set<string>(
    (styles.match(/\.[A-Za-z][\w-]*/gu) ?? []).map((token) => token.slice(1)),
  );

const selected = classesStyledBy(sheet);

const everyGlyphMarkup = renderToStaticMarkup(
  <DiagramGlyphs
    marks={specMarks}
    layout={layoutDiagram(everyGlyphModel.diagrams[0], everyGlyphModel)}
  />,
);

const emitted = new Set<string>(
  (everyGlyphMarkup.match(/class="[^"]*"/gu) ?? []).flatMap((attribute) =>
    attribute.slice(7, -1).split(' '),
  ),
);

const toneRule = (styles: string, className: string): string | undefined =>
  styles.split('\n').find((line) => line.startsWith(`.${className} { fill:`));

const dashOf = (rule: string | undefined): number[] | undefined =>
  /stroke-dasharray: (?<dash>[^;]+);/u
    .exec(rule ?? '')
    ?.groups?.dash.split(' ')
    .map(Number);

const selectorsOf = (rule: string | undefined): string[] =>
  (rule ?? '')
    .split('{')[0]
    .split(',')
    .map((selector) => selector.trim());

const classesNamedBy = (selector: string): number =>
  selector.split('.').length - 1;

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
  const themedRules = themedCanvasStylesheet
    .split('}')
    .map((rule) => rule.trim());
  const ruleStarting = (selector: string): string | undefined =>
    themedRules.find((rule) => rule.startsWith(selector));
  const outOfScope = `.${canvasClassNames.outOfScope} `;
  const rules = themedRules.filter((rule) => rule.startsWith(outOfScope));
  const outline = ruleStarting(`${outOfScope}.${canvasClassNames.shape} {`);
  const boundary = ruleStarting(`.${canvasClassNames.boundaryBox},`);

  it('is faded by neither sheet, so each ink is drawn at the ratio the palette measures for it', () => {
    expect(
      [sheet, themedCanvasStylesheet].filter((styles) =>
        styles.includes('opacity'),
      ),
    ).toEqual([]);
  });

  it('has only its outline, line and arrowhead drawn in the outline ink, its name, badge, note and flow name as in scope', () => {
    expect(classesStyledBy(rules.join('\n'))).toEqual(
      new Set([
        canvasClassNames.outOfScope,
        canvasClassNames.shape,
        canvasClassNames.flowArrow,
      ]),
    );
    expect(outline).toContain(`stroke: ${paletteProperty(outOfScopeOutline)};`);
    expect(
      ruleStarting(`${outOfScope}.${canvasClassNames.flowArrow} {`),
    ).toContain(`fill: ${paletteProperty(outOfScopeOutline)};`);
  });

  it("dots its outline with round caps, where an outline in scope is solid and a trust boundary's is dashed", () => {
    const [dot, gap] = dashOf(outline) ?? [];
    const [boundaryDash] = dashOf(boundary) ?? [];
    expect(
      dashOf(ruleStarting(`.${canvasClassNames.shape} {`)),
    ).toBeUndefined();
    expect(dot).toBe(0);
    expect(gap).toBeGreaterThan(strokeWidths.store);
    expect(outline).toContain('stroke-linecap: round;');
    expect(boundaryDash).toBeGreaterThan(0);
  });

  it("dots every out-of-scope outline over the dash a trust boundary has in scope, a boundary's own and a note's frame among them", () => {
    const [dotted] = selectorsOf(outline);
    const shapeIn = `class="${canvasClassNames.shape} `;
    const outlinesDrawnOutOfScope = everyGlyphMarkup
      .split(`<g class="${canvasClassNames.element}`)
      .filter((group) => group.startsWith(` ${canvasClassNames.outOfScope}"`))
      .flatMap((group) => group.split(shapeIn).slice(1))
      .map((shape) => shape.split('"')[0]);

    expect(themedRules.filter((rule) => dashOf(rule) !== undefined)).toEqual([
      boundary,
      outline,
    ]);
    expect(Math.max(...selectorsOf(boundary).map(classesNamedBy))).toBeLessThan(
      classesNamedBy(dotted),
    );
    expect(new Set(outlinesDrawnOutOfScope)).toEqual(
      new Set([
        canvasClassNames.store,
        canvasClassNames.boundaryBox,
        canvasClassNames.noteFrame,
      ]),
    );
  });
});

describe('severityToneClass', () => {
  it('gives the undecided severity the neutral tone', () => {
    expect(severityToneClass.undecided).toBe(canvasClassNames.toneNeutral);
  });
});
