import {
  channelDistance,
  contrastRatio,
  darkPalette,
  lightPalette,
  outOfScopeOutline,
  tokenStylesheet,
  type Palette,
} from './tokens.js';

const palettes = [
  { name: 'the light palette', palette: lightPalette },
  { name: 'the dark palette', palette: darkPalette },
] as const;

const surfaces = [
  'surfaceApp',
  'surfaceCanvas',
  'surfacePanel',
  'surfaceActor',
  'surfaceProcess',
] as const satisfies readonly (keyof Palette)[];

const tones = [
  'toneCritical',
  'toneHigh',
  'toneMedium',
  'toneLow',
  'toneNeutral',
] as const satisfies readonly (keyof Palette)[];

const slots = [
  { line: 'slot1', tint: 'slot1Tint' },
  { line: 'slot2', tint: 'slot2Tint' },
  { line: 'slot3', tint: 'slot3Tint' },
  { line: 'slot4', tint: 'slot4Tint' },
] as const satisfies readonly {
  readonly line: keyof Palette;
  readonly tint: keyof Palette;
}[];

const elementGrounds = [
  'surfaceCanvas',
  'surfacePanel',
  'surfaceActor',
  'surfaceProcess',
] as const satisfies readonly (keyof Palette)[];

const textFloor = 4.5;

const markFloor = 3;

const toneDistanceFloor = 40;

const gridFloor = 1.3;

const gridCeiling = 1.6;

type Pair = {
  readonly ink: keyof Palette;
  readonly ground: keyof Palette;
  readonly floor: number;
};

const pairsOf = (
  inks: readonly (keyof Palette)[],
  grounds: readonly (keyof Palette)[],
  floor: number,
): Pair[] =>
  inks.flatMap((ink) => grounds.map((ground) => ({ ink, ground, floor })));

const measured = (palette: Palette, pairs: readonly Pair[]) =>
  pairs.map((pair) => ({
    pair: `${pair.ink} on ${pair.ground}`,
    ratio:
      Math.round(contrastRatio(palette[pair.ink], palette[pair.ground]) * 100) /
      100,
    floor: pair.floor,
  }));

const below = (palette: Palette, pairs: readonly Pair[]) =>
  measured(palette, pairs).filter(
    (entry) => !Number.isFinite(entry.ratio) || entry.ratio < entry.floor,
  );

describe.each(palettes)('$name', ({ palette }) => {
  it('sets text on every surface at the ratio WCAG 2.2 AA asks of text', () => {
    expect(
      below(
        palette,
        pairsOf(['textPrimary', 'textSecondary'], surfaces, textFloor),
      ),
    ).toEqual([]);
  });

  it('letters a badge and the primary action at that same ratio', () => {
    expect(
      below(palette, [
        ...pairsOf(['badgeGround'], [...tones, 'textPrimary'], textFloor),
        ...pairsOf(['actionText'], ['actionPrimary', 'actionHover'], textFloor),
      ]),
    ).toEqual([]);
  });

  it('draws every mark on a surface at the ratio it asks of a mark', () => {
    expect(
      below(
        palette,
        pairsOf([...tones, 'border', 'actionPrimary'], surfaces, markFloor),
      ),
    ).toEqual([]);
  });

  it('draws an out-of-scope outline on every surface at the ratio it asks of a mark', () => {
    expect(
      below(palette, pairsOf([outOfScopeOutline], surfaces, markFloor)),
    ).toEqual([]);
  });

  it('rings the cursor row at the ratio of a mark against its tint and both list grounds, and keeps both inks legible on the tint', () => {
    expect(
      below(palette, [
        ...pairsOf(
          ['actionPrimary'],
          ['actionTint', 'surfaceApp', 'surfacePanel'],
          markFloor,
        ),
        ...pairsOf(['textPrimary', 'textSecondary'], ['actionTint'], textFloor),
      ]),
    ).toEqual([]);
  });

  it('rules the graph paper at a weight nothing is read off, above its ground and far under the 3 a mark needs, so darkening it to a control weight fails here', () => {
    const ruled = contrastRatio(palette.gridLine, palette.surfaceCanvas);
    expect(ruled).toBeGreaterThanOrEqual(gridFloor);
    expect(ruled).toBeLessThanOrEqual(gridCeiling);
  });

  it("draws each accent slot's outline at the ratio of a mark on the canvas ground, on every fill of an element and on its own tint", () => {
    expect(
      below(
        palette,
        slots.flatMap(({ line, tint }) =>
          pairsOf([line], [...elementGrounds, tint], markFloor),
        ),
      ),
    ).toEqual([]);
  });

  it("sets an element's name on the tint of each strong accent at the ratio of text", () => {
    expect(
      below(
        palette,
        pairsOf(
          ['textPrimary'],
          slots.map(({ tint }) => tint),
          textFloor,
        ),
      ),
    ).toEqual([]);
  });

  it('gives no accent slot the colour of a severity tone or of another slot', () => {
    const marks = [...slots.map(({ line }) => line), ...tones];
    expect(new Set(marks.map((mark) => palette[mark])).size).toBe(marks.length);
  });

  it('keeps the five severity tones apart', () => {
    const collapsed = tones.flatMap((one, at) =>
      tones.slice(at + 1).map((other) => ({
        pair: `${one} / ${other}`,
        distance: Math.round(channelDistance(palette[one], palette[other])),
      })),
    );
    expect(new Set(tones.map((tone) => palette[tone])).size).toBe(tones.length);
    expect(
      collapsed.filter((entry) => entry.distance < toneDistanceFloor),
    ).toEqual([]);
  });
});

describe('the accent slots', () => {
  it('are the four colours the maintainer chose on the dark canvas', () => {
    expect(slots.map(({ line }) => darkPalette[line])).toEqual([
      '#D988AF',
      '#AD84F2',
      '#CABD99',
      '#80BFC6',
    ]);
  });

  it('are each darker on the light canvas, where an outline is read against a light ground', () => {
    expect(
      slots.filter(
        ({ line }) =>
          contrastRatio(lightPalette[line], '#000000') >=
          contrastRatio(darkPalette[line], '#000000'),
      ),
    ).toEqual([]);
  });
});

describe('contrastRatio', () => {
  it('is the WCAG ratio, so the extremes are 21 and 1', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBe(21);
    expect(contrastRatio('#FFFFFF', '#000000')).toBe(21);
    expect(
      contrastRatio(lightPalette.surfaceApp, lightPalette.surfaceApp),
    ).toBe(1);
  });
});

const darkScheme = '@media (prefers-color-scheme: dark)';

const propertiesOf = (block: string): Set<string> =>
  new Set(block.match(/--saer-colour-[\w-]+(?=:)/gu) ?? []);

describe('tokenStylesheet', () => {
  const [root, dark] = tokenStylesheet.split(darkScheme);

  it('publishes the light table on the document root, a property per role', () => {
    expect(tokenStylesheet.startsWith(':root {')).toBe(true);
    expect(tokenStylesheet).toContain(darkScheme);
    expect(root).toContain(lightPalette.surfaceApp);
    expect(root).not.toContain(darkPalette.surfaceApp);
    expect(propertiesOf(root).size).toBe(Object.keys(lightPalette).length);
  });

  it('overrides those same properties from the dark table under the system preference', () => {
    expect(dark).toBeDefined();
    expect(dark).toContain(darkPalette.surfaceApp);
    expect(propertiesOf(dark)).toEqual(propertiesOf(root));
  });
});
