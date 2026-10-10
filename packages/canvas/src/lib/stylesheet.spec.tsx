import { severitySchema } from '@saerskriven/model';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  accentsLayout,
  everyGlyphModel,
  specMarks,
} from './canvas.fixtures.js';
import { layoutDiagram } from './layout.js';
import { defaultRenderTheme, type RenderTheme } from './render-theme.js';
import { DiagramGlyphs } from './scene.js';
import {
  accentClassNames,
  canvasClassNames,
  renderCanvasStylesheet,
  severityToneClass,
  themedCanvasStylesheet,
  wrappedTextStyles,
} from './stylesheet.js';
import {
  contrastRatio,
  darkPalette,
  dotPitchRatio,
  lightPalette,
  outOfScopeOutline,
  paletteProperty,
  strokeWidths,
  type Colour,
} from './tokens.js';

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

const classesEmittedBy = (markup: string): Set<string> =>
  new Set<string>(
    (markup.match(/class="[^"]*"/gu) ?? []).flatMap((attribute) =>
      attribute.slice(7, -1).split(' '),
    ),
  );

const emitted = classesEmittedBy(everyGlyphMarkup);

const accentClasses = new Set<string>(Object.values(accentClassNames));

const accentedSheet = renderCanvasStylesheet(defaultRenderTheme, true);

const rulesOf = (styles: string): string[] =>
  styles.split('}').map((rule) => rule.trim());

const forcedColours = '@media (forced-colors: active) {';

const slotClasses = [
  { className: accentClassNames.slot1, line: 'slot1', tint: 'slot1Tint' },
  { className: accentClassNames.slot2, line: 'slot2', tint: 'slot2Tint' },
  { className: accentClassNames.slot3, line: 'slot3', tint: 'slot3Tint' },
  { className: accentClassNames.slot4, line: 'slot4', tint: 'slot4Tint' },
] as const;

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
  it('styles the classes the resolved sheet does and the accent classes, with every colour left to a custom property', () => {
    expect(classesStyledBy(themedCanvasStylesheet)).toEqual(
      new Set([...selected, ...accentClasses]),
    );
    expect(themedCanvasStylesheet).not.toMatch(/#[0-9A-Fa-f]{3,8}/u);
  });

  it('uses system paint only in the studio forced-colours suffix', () => {
    const [base, forced] = themedCanvasStylesheet.split(forcedColours);
    expect(base.trim()).not.toMatch(/Canvas|Highlight/u);
    expect(sheet).not.toContain('forced-colors');
    const rules = (forced ?? '').split('}').map((rule) => rule.trim());
    const ruleFor = (name: string) =>
      rules.find((rule) => selectorsOf(rule).includes(name));

    expect(ruleFor(`.${canvasClassNames.shape}`)).toContain(
      'fill: Canvas;\n    stroke: CanvasText;',
    );
    for (const name of [
      canvasClassNames.store,
      canvasClassNames.boundaryBox,
      canvasClassNames.boundaryCurve,
      canvasClassNames.noteFrame,
      canvasClassNames.flow,
    ]) {
      expect(ruleFor(`.${name}`)).toContain('fill: none;');
    }
    for (const name of [
      canvasClassNames.label,
      canvasClassNames.note,
      canvasClassNames.flowLabel,
      canvasClassNames.flowArrow,
      canvasClassNames.badgeCount,
      canvasClassNames.badgeMark,
    ]) {
      expect(ruleFor(`.${name}`)).toContain('fill: CanvasText;');
    }
    expect(ruleFor(`.${canvasClassNames.flowBacking}`)).toContain(
      'fill: Canvas;',
    );
    expect(
      ruleFor(`.${canvasClassNames.outOfScope} .${canvasClassNames.shape}`),
    ).toContain('stroke: CanvasText;');
    expect(
      ruleFor(`.${canvasClassNames.outOfScope} .${canvasClassNames.flowArrow}`),
    ).toContain('fill: CanvasText;');
    expect(ruleFor(`.${canvasClassNames.badge}`)).toContain(
      'stroke: CanvasText;\n    stroke-width: 1.5;',
    );
    for (const tone of [
      ...Object.values(severityToneClass),
      canvasClassNames.toneFlag,
    ]) {
      expect(ruleFor(`.${canvasClassNames.badge} .${tone}`)).toContain(
        'fill: Canvas;',
      );
      expect(ruleFor(`.${tone}`)).toBeUndefined();
    }
    expect(forced).not.toMatch(/stroke-dasharray|opacity|forced-color-adjust/u);
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

  it("dots every out-of-scope outline over the dash a trust boundary has in scope, a boundary's own, a note's frame and a flow's line among them", () => {
    const [dotted] = selectorsOf(outline);
    const shapeIn = `class="${canvasClassNames.shape} `;
    const outlinesDrawnOutOfScope = everyGlyphMarkup
      .split(`<g class="${canvasClassNames.element}`)
      .filter((group) => group.startsWith(` ${canvasClassNames.outOfScope}"`))
      .flatMap((group) => group.split(shapeIn).slice(1))
      .map((shape) => shape.split('"')[0]);

    expect(
      themedRules.filter(
        (rule) =>
          dashOf(rule) !== undefined && !rule.includes(accentClassNames.strong),
      ),
    ).toEqual([boundary, outline]);
    expect(Math.max(...selectorsOf(boundary).map(classesNamedBy))).toBeLessThan(
      classesNamedBy(dotted),
    );
    expect(new Set(outlinesDrawnOutOfScope)).toEqual(
      new Set([
        canvasClassNames.store,
        canvasClassNames.boundaryBox,
        canvasClassNames.noteFrame,
        canvasClassNames.flow,
      ]),
    );
  });
});

const ruleIn = (
  rules: readonly string[],
  selector: string,
): string | undefined =>
  rules.find((rule) => selectorsOf(rule).includes(selector));

describe('an accent', () => {
  const accentsMarkup = renderToStaticMarkup(
    <DiagramGlyphs marks={specMarks} layout={accentsLayout} />,
  );
  const [themedBase, forced = ''] = themedCanvasStylesheet.split(forcedColours);
  const themedRules = rulesOf(themedBase);
  const forcedRules = rulesOf(forced);
  const strong = `.${accentClassNames.strong}`;
  const strongOutOfScope = `.${canvasClassNames.outOfScope}${strong}`;
  const weights = [
    [canvasClassNames.shape, strokeWidths.strongOutline, strokeWidths.store],
    [
      canvasClassNames.boundaryBox,
      strokeWidths.strongBoundary,
      strokeWidths.outline,
    ],
    [
      canvasClassNames.boundaryCurve,
      strokeWidths.strongBoundary,
      strokeWidths.outline,
    ],
    [canvasClassNames.flow, strokeWidths.strongFlow, strokeWidths.outline],
  ] as const;

  it('is styled by the resolved sheet only where a drawing holds one, in the light palette and with no property to resolve', () => {
    expect(renderCanvasStylesheet(defaultRenderTheme, false)).toBe(sheet);
    expect(classesStyledBy(accentedSheet)).toEqual(
      new Set([...selected, ...accentClasses]),
    );
    expect(accentedSheet).not.toContain('var(');
    for (const { className, line, tint } of slotClasses) {
      expect(accentedSheet).toContain(
        `.${className} .${canvasClassNames.shape} {\n  stroke: ${lightPalette[line]};\n}`,
      );
      expect(accentedSheet).toContain(
        `.${className} .${accentClassNames.tinted} {\n  fill: ${lightPalette[tint]};\n}`,
      );
    }
  });

  it('is drawn with every accent class by the diagram that holds each key, and with none by a diagram that holds no accent', () => {
    const drawn = classesEmittedBy(accentsMarkup);
    expect([...accentClasses].filter((name) => !drawn.has(name))).toEqual([]);
    expect([...accentClasses].filter((name) => emitted.has(name))).toEqual([]);
  });

  it.each(slotClasses)(
    "draws slot $line as an outline, a line and an arrowhead in the slot's colour, and tints only the fill marked for it",
    ({ className, line, tint }) => {
      expect(
        ruleIn(themedRules, `.${className} .${canvasClassNames.shape}`),
      ).toContain(`stroke: ${paletteProperty(line)};`);
      expect(
        ruleIn(themedRules, `.${className} .${canvasClassNames.flowArrow}`),
      ).toContain(`fill: ${paletteProperty(line)};`);
      expect(
        ruleIn(themedRules, `.${className} .${accentClassNames.tinted}`),
      ).toContain(`fill: ${paletteProperty(tint)};`);
      expect(
        themedRules.filter(
          (rule) => rule.includes(className) && rule.includes('stroke-width'),
        ),
      ).toEqual([]);
    },
  );

  it.each(weights)(
    'draws a strong %s heavier than a plain one',
    (className, weight, plain) => {
      expect(ruleIn(themedRules, `${strong} .${className}`)).toContain(
        `stroke-width: ${String(weight)};`,
      );
      expect(weight).toBeGreaterThan(plain);
    },
  );

  it('colours the dots of an out-of-scope outline, its rule following the out-of-scope one with as many classes', () => {
    const outOfScope = `.${canvasClassNames.outOfScope} .${canvasClassNames.shape} {`;
    for (const { className } of slotClasses) {
      const slot = `.${className} .${canvasClassNames.shape} {`;
      expect(themedBase.indexOf(slot)).toBeGreaterThan(
        themedBase.indexOf(outOfScope),
      );
      expect(classesNamedBy(slot)).toBe(classesNamedBy(outOfScope));
    }
  });

  it.each(weights)(
    'keeps the dots of a strong out-of-scope %s apart, at the pitch its weight asks',
    (className, weight) => {
      expect(
        dashOf(ruleIn(themedRules, `${strongOutOfScope} .${className}`)),
      ).toEqual([0, weight * dotPitchRatio]);
    },
  );

  it("mixes each tint from the theme's own element colour, so a theme of light text on dark elements keeps a name at the ratio of text on every tint", () => {
    const darkTheme: RenderTheme = {
      ...defaultRenderTheme,
      colours: {
        background: darkPalette.surfaceCanvas,
        text: darkPalette.textPrimary,
        muted: darkPalette.textSecondary,
        element: darkPalette.surfacePanel,
        actor: darkPalette.surfaceActor,
        process: darkPalette.surfaceProcess,
      },
    };
    const themed = rulesOf(renderCanvasStylesheet(darkTheme, true));
    const tintOf = (className: string): Colour => {
      const rule = ruleIn(themed, `.${className} .${accentClassNames.tinted}`);
      return `#${/fill: #(?<tint>[0-9A-F]{6});/u.exec(rule ?? '')?.groups?.tint ?? ''}`;
    };

    expect(
      slotClasses.filter(
        ({ className }) =>
          !(contrastRatio(darkTheme.colours.text, tintOf(className)) >= 4.5),
      ),
    ).toEqual([]);
    expect(
      slotClasses.filter(
        ({ tint }) =>
          contrastRatio(darkTheme.colours.text, lightPalette[tint]) >= 4.5,
      ),
    ).toEqual([]);
  });

  it('draws no slot colour and no tint under forced colours, and leaves the strong weights standing', () => {
    for (const { className } of slotClasses) {
      expect(
        ruleIn(forcedRules, `.${className} .${canvasClassNames.shape}`),
      ).toContain('stroke: CanvasText;');
      expect(
        ruleIn(forcedRules, `.${className} .${canvasClassNames.flowArrow}`),
      ).toContain('fill: CanvasText;');
      expect(
        ruleIn(forcedRules, `.${className} .${accentClassNames.tinted}`),
      ).toContain('fill: Canvas;');
      expect(
        ruleIn(forcedRules, `.${className} .${accentClassNames.storeBand}`),
      ).toContain('fill: none;');
    }
    expect(forced).not.toMatch(/--saer-colour-slot/u);
    expect(
      forcedRules.filter((rule) => rule.includes(accentClassNames.strong)),
    ).toEqual([]);
  });
});

describe('severityToneClass', () => {
  it('gives the undecided severity the neutral tone', () => {
    expect(severityToneClass.undecided).toBe(canvasClassNames.toneNeutral);
  });
});
