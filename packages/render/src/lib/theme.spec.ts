import {
  canvasClassNames,
  defaultRenderTheme,
  severityToneClass,
} from '@saerskriven/canvas';
import { Either } from 'effect';
import { compilePdf } from '../pdf.js';
import { badgedModel, typstAssets } from '../render.fixtures.js';
import { renderRegister } from './markdown-register.js';
import {
  registerClassNames,
  registerStylesheet,
} from './register-stylesheet.js';
import { renderSvg } from './svg-document.js';
import { renderTypst } from './typst-document.js';
import { readThemeOverrides, withBundledFonts } from './theme.js';

describe('consumer themes', () => {
  it('keeps nested defaults while applying valid sibling overrides', () => {
    const read = readThemeOverrides({
      severity: { high: '#b45309', low: 'oops', typo: '#123' },
      fonts: [],
      badges: { style: 'outline', borderWidth: 99 },
      extra: true,
    });
    expect(read.theme).toEqual({
      ...defaultRenderTheme,
      severity: { ...defaultRenderTheme.severity, high: '#b45309' },
      badges: { ...defaultRenderTheme.badges, style: 'outline' },
    });
    expect(new Set(read.diagnostics.map((entry) => entry.key))).toEqual(
      new Set([
        'badges.borderWidth',
        'extra',
        'fonts',
        'severity.low',
        'severity.typo',
      ]),
    );
    expect(readThemeOverrides({}).theme).toEqual(defaultRenderTheme);
    expect(
      readThemeOverrides({ severity: { high: '#abc' } }).theme.severity.high,
    ).toBe('#aabbcc');
  });

  it.each([null, [], 2, 'text'])(
    'falls back for a non-mapping value %s',
    (value) => {
      const read = readThemeOverrides(value);
      expect(read.theme).toEqual(defaultRenderTheme);
      expect(read.diagnostics).toHaveLength(1);
    },
  );

  it('rejects appearance source while retaining ordinary values', () => {
    const read = readThemeOverrides({
      fonts: { body: 'X; color: red', code: 'Liberation Sans' },
      severity: { high: 'url(https://example.test)' },
      badges: { text: '#fff', style: 'custom()' },
    });
    expect(read.theme.fonts).toEqual({
      body: defaultRenderTheme.fonts.body,
      code: 'Liberation Sans',
    });
    expect(read.theme.badges.text).toBe('#ffffff');
    expect(read.diagnostics.map((entry) => entry.key)).toEqual([
      'severity.high',
      'fonts.body',
      'badges.style',
    ]);
  });

  it('uses the same severity override in website badges, drawings, and PDF content', () => {
    const theme = readThemeOverrides({
      severity: { high: '#b45309' },
      status: { 'accepted-risk': '#223344' },
    }).theme;
    const svg = renderSvg(badgedModel.diagrams[0], badgedModel, theme).svg;
    const markdown = renderRegister(badgedModel, { styled: true, theme });
    const typst = renderTypst(badgedModel, theme).typst;
    expect(svg).toContain(`.${severityToneClass.high} { fill: #b45309;`);
    expect(markdown).toContain('--saer-severity-high: #b45309');
    expect(markdown).toContain(
      `class="${registerClassNames.badge} saer-severity saer-severity-high"`,
    );
    expect(markdown).toContain('saer-status-accepted-risk');
    expect(typst).toContain('#saer-badge("High", rgb("#b45309"))');
    expect(typst).toContain('#saer-badge("Accepted risk", rgb("#223344"))');
    expect(svg).toContain(`class="${severityToneClass.high}"`);
    const embedded = typst.slice(
      typst.indexOf('#image(bytes('),
      typst.indexOf('format: "svg"'),
    );
    expect(embedded).toContain(`.${severityToneClass.high} { fill: #b45309;`);
  });

  it('loads a theme written before record and flag badges with no warning', () => {
    const read = readThemeOverrides({
      severity: { high: '#b45309' },
      status: { open: '#223344' },
      colours: { text: '#111111' },
      fonts: { body: 'Liberation Mono' },
      badges: { style: 'outline' },
    });
    expect(read.diagnostics).toEqual([]);
    expect(read.theme.mitigation).toEqual(defaultRenderTheme.mitigation);
    expect(read.theme.assumption).toEqual(defaultRenderTheme.assumption);
    expect(read.theme.flag).toEqual(defaultRenderTheme.flag);
  });

  it('classes and colours record status and flag badges from their theme sections', () => {
    const theme = readThemeOverrides({
      mitigation: { proposed: '#123456' },
    }).theme;
    const markdown = renderRegister(badgedModel, { styled: true, theme });
    const typst = renderTypst(badgedModel, theme).typst;
    for (const kind of ['mitigation', 'assumption', 'flag']) {
      expect(markdown).toContain(`saer-badge saer-${kind} saer-${kind}-`);
    }
    expect(markdown).toContain('saer-mitigation-proposed');
    expect(markdown).toContain('saer-assumption-invalidated');
    expect(markdown).toContain('saer-flag-rests-on-invalidated-assumption');
    expect(registerStylesheet(theme)).toContain(
      '--saer-mitigation-proposed: #123456',
    );
    expect(registerStylesheet(defaultRenderTheme)).not.toContain('#123456');
    expect(typst).toMatch(/#saer-badge\("[^"]+", rgb\("#123456"\)\)/u);
    expect(renderTypst(badgedModel).typst).not.toContain('#123456');
  });

  it('applies font and outlined badge controls without hiding labels', () => {
    const theme = readThemeOverrides({
      fonts: { body: 'Liberation Mono', code: 'Liberation Sans' },
      badges: { style: 'outline', borderWidth: 1, text: '#123456' },
    }).theme;
    const svg = renderSvg(badgedModel.diagrams[0], badgedModel, theme).svg;
    const typst = renderTypst(badgedModel, theme).typst;
    expect(svg).toContain('font-family: "Liberation Mono"');
    expect(svg).toContain(
      `fill: ${theme.colours.background}; stroke: ${theme.severity.high}; stroke-width: 1`,
    );
    expect(svg).toContain(
      `.${canvasClassNames.toneFlag} { fill: ${theme.colours.background}; stroke: ${theme.colours.text}; stroke-width: 1`,
    );
    expect(svg).toContain('fill: #123456');
    expect(typst).toContain(
      'fill: none, stroke: (paint: tone, thickness: 1pt)',
    );
    expect(typst).toContain('text(fill: rgb("#123456"), label)');
    expect(registerStylesheet(theme)).toContain(
      '--saer-badge-background: transparent',
    );
  });

  it('reports unavailable embedded fonts and preserves supported siblings', () => {
    const fitted = withBundledFonts(
      readThemeOverrides({
        fonts: { body: 'Site Font', code: 'Liberation Sans' },
      }).theme,
    );
    expect(fitted.theme.fonts).toEqual({
      body: 'Liberation Sans',
      code: 'Liberation Sans',
    });
    expect(fitted.diagnostics.map((entry) => entry.key)).toEqual([
      'fonts.body',
    ]);
  });
});

describe('themed PDF compilation', () => {
  it.each(['filled', 'outline'] as const)(
    'typesets %s badges and embedded drawings',
    async (style) => {
      const theme = readThemeOverrides({
        severity: { high: '#b45309' },
        fonts: { body: 'Liberation Mono' },
        badges: { style },
      }).theme;
      const result = await compilePdf(
        renderTypst(badgedModel, theme).typst,
        typstAssets(),
      );
      expect(Either.isRight(result)).toBe(true);
      expect(
        Buffer.from(Either.getOrThrow(result).subarray(0, 5)).toString(),
      ).toBe('%PDF-');
    },
  );
});
