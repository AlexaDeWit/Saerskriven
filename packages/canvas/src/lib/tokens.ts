/**
 * One colour of a palette, as a six-digit hex triple. One form throughout, so
 * {@link contrastRatio} has one string to read and a stylesheet one to emit.
 */
export type Colour = `#${string}`;

/**
 * The roles a palette assigns a colour to. A palette names roles rather than
 * shades, so the dark table answers the same questions as the light one and a
 * consumer never learns which table it was handed.
 */
export type Palette = {
  /** The studio shell, and the cream a badge lifts itself off the canvas. */
  readonly surfaceApp: Colour;
  /** What a diagram is drawn on, and the halo a flow name is stroked in. */
  readonly surfaceCanvas: Colour;
  /** Panels, overlays, and the fill inside an element's outline. */
  readonly surfacePanel: Colour;
  /** The wash inside an actor. */
  readonly surfaceActor: Colour;
  /** The wash inside a process. */
  readonly surfaceProcess: Colour;
  /** Names, outlines and arrowheads: the pencil the diagram is drawn with. */
  readonly textPrimary: Colour;
  /** Notes, flow names, boundary dashes, and muted text in the chrome. */
  readonly textSecondary: Colour;
  /** Every hairline, the outline that identifies a control among them. */
  readonly border: Colour;
  /**
   * The ruled lines of the graph paper the studio draws a diagram on. It is
   * lighter than the hairline on purpose: nothing is read off the grid, so it
   * sits below the ratio a mark needs rather than at it.
   */
  readonly gridLine: Colour;
  /** The primary action, which is also the focus indicator. */
  readonly actionPrimary: Colour;
  /** The primary action under the pointer. */
  readonly actionHover: Colour;
  /** Text drawn on the primary action. */
  readonly actionText: Colour;
  /** The cream a threat badge is outlined and lettered in. */
  readonly badgeGround: Colour;
  /** Severity critical, a rust. */
  readonly toneCritical: Colour;
  /** Severity high, an ochre. */
  readonly toneHigh: Colour;
  /** Severity medium, a slate blue. */
  readonly toneMedium: Colour;
  /** Severity low, the olive of the primary action. */
  readonly toneLow: Colour;
  /** No severity assessed, a warm grey. */
  readonly toneNeutral: Colour;
};

/**
 * The light palette: the maintainer's draftsman colours with the lightness
 * moved where a contrast floor demanded it and the hue left alone. The ochre
 * and the warm grey are darker, because cream lettering on them measured 3.2
 * and 4.4 where a badge needs 4.5. The secondary text and the hairline are
 * darker, because they measured 3.2 and 1.4 on the canvas ground where text
 * needs 4.5 and a control's outline 3. The fifth severity, which the starting
 * palette lacks, is the olive of the primary action, and the grid line is a
 * warm taupe measured on a band, 1.3 to 1.6 on the canvas ground, since it is
 * worse for being darker.
 */
export const lightPalette = {
  surfaceApp: '#F0EDE5',
  surfaceCanvas: '#F9F6F0',
  surfacePanel: '#FAF8F2',
  surfaceActor: '#EAE5DA',
  surfaceProcess: '#E7E9E1',
  textPrimary: '#38342E',
  textSecondary: '#6B655C',
  border: '#847C70',
  gridLine: '#E0D8C4',
  actionPrimary: '#4A635D',
  actionHover: '#3C504B',
  actionText: '#F9F6F0',
  badgeGround: '#FAF8F2',
  toneCritical: '#C14339',
  toneHigh: '#A85E1D',
  toneMedium: '#46788A',
  toneLow: '#4B6B50',
  toneNeutral: '#756E63',
} as const satisfies Palette;

/**
 * The dark palette: the same hues over warm ink grounds, measured against the
 * same floors, its hairline lightened so it clears 3 on the wash a process is
 * filled with. The studio takes it under the system's dark preference, and
 * the headless render stays on the light table.
 */
export const darkPalette = {
  surfaceApp: '#282522',
  surfaceCanvas: '#1F1C19',
  surfacePanel: '#2E2A26',
  surfaceActor: '#38332E',
  surfaceProcess: '#302F2B',
  textPrimary: '#EAE5DB',
  textSecondary: '#A39B8F',
  border: '#8A8175',
  gridLine: '#36312C',
  actionPrimary: '#6B8A82',
  actionHover: '#83A39A',
  actionText: '#1F1C19',
  badgeGround: '#1F1C19',
  toneCritical: '#DE6258',
  toneHigh: '#E89A4F',
  toneMedium: '#5F95A8',
  toneLow: '#6B8A82',
  toneNeutral: '#9A9185',
} as const satisfies Palette;

/**
 * The type the studio's chrome is set in. Every value is a CSS length or a
 * font stack, since the chrome is laid out by a browser.
 */
export const uiType = {
  family:
    "system-ui, -apple-system, 'Segoe UI', roboto, 'Helvetica Neue', arial, sans-serif",
  size: '0.875rem',
  lineHeight: '1.5',
} as const;

/**
 * The type a diagram is drawn in. Every size is in user units, the units the
 * wrap estimates columns in. The stack ends on Arial, which Liberation Sans,
 * the face the CLI typesets a PDF with, is metric-compatible with.
 */
export const canvasType = {
  family: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  widgetLabel: 10,
  note: 12,
  badgeCount: 11,
  secondaryBadgeCount: 9,
  badgeMark: 9,
} as const;

/**
 * Every stroke the drawing lays down, in user units. One weight carries an
 * element's outline, a trust boundary's dashes and a flow's line. A store's
 * two lines are heavier, being its whole glyph. The badge ring and the halo
 * under a flow name are drawn in a ground colour, cutting the mark out of
 * what lies beneath.
 */
export const strokeWidths = {
  outline: 2,
  store: 2.5,
  badgeRing: 3,
  labelHalo: 3,
} as const;

/**
 * How heavily the studio marks what is selected and what the pointer is
 * over, in the units of {@link strokeWidths}. Each is a step above the
 * outline weight, so a selection reads without colour, and no more than one
 * step past the heaviest stroke, or a flow swells past its arrowhead. A
 * selected flow stays heavier than a hovered one, its line carrying both
 * cues. {@link tokenStylesheet} writes each as a pixel length, which serves a
 * CSS border and an SVG stroke alike. The headless render draws none.
 */
export const cueWidths = {
  selection: 3,
  flowHover: 3,
  flowSelection: 4,
} as const;

/**
 * A square resize handle in the interactive canvas, in pixels at full zoom:
 * `size` is its side inside React Flow's 1px `border`, and `badgeGap` is how
 * far a handle beside a threat badge keeps from the badge's ink, on screen at
 * every zoom.
 */
export const resizeHandle = {
  size: 9,
  border: 1,
  badgeGap: 3,
} as const;

/** The invisible stroke widths that make thin diagram lines easier to grab. */
export const interactionWidths = {
  boundary: 20,
  flow: 20,
} as const;

/**
 * The triangle that marks where a flow ends, in user units: how far its base
 * sits back from the tip, and how far each wing reaches from the line.
 */
export const arrowhead = {
  length: 18,
  halfWidth: 7,
} as const;

/**
 * How far a threat badge reaches from its own centre, in user units. Half the
 * ring in {@link strokeWidths} falls inside each circle, and each radius
 * leaves room for the count inside that. `flag` is the half-width and
 * half-height of the flag mark's triangle.
 */
export const badgeRadius = {
  primary: 13,
  secondary: 9,
  flag: 11,
} as const;

/**
 * The gap between the ruled lines of the studio's graph paper, in user units,
 * so the grid scales with the viewport. The headless render draws no grid.
 */
export const gridSpacing = 25;

/** Every gap and every pad in the chrome, as four steps of a quarter rem. */
export const spacingScale = {
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
} as const;

/** Every corner in the chrome. */
export const radius = '4px';

/**
 * The one focus indicator. The width is separate from the ring so a control
 * drawing the ring in another colour, over the primary action say, still
 * draws it at the one width.
 */
export const focusRing = {
  width: '2px',
  offset: '2px',
} as const;

/** Default threat pane coverage with its outer inset, in screen pixels. */
export const panelCover = 472;

/**
 * What the controls below the studio's chrome card offset by until the card
 * has measured itself onto the document root. The card writes its own height
 * back over this, its tool row being able to wrap.
 */
export const chromeCard = '5rem';

/**
 * The room a pane leaves under the chrome card and its notices for the canvas
 * announcement: two lines, with the announcement's gap, border and padding.
 * The `lh` resolves where a pane reads the property, on a box with the body's
 * line height, not on the root.
 */
export const announcementSlot = 'calc(var(--pn-space-2) * 3 + 2px + 2lh)';

const colourProperties = {
  surfaceApp: '--pn-colour-surface',
  surfaceCanvas: '--pn-colour-canvas',
  surfacePanel: '--pn-colour-surface-raised',
  surfaceActor: '--pn-colour-actor',
  surfaceProcess: '--pn-colour-process',
  textPrimary: '--pn-colour-text',
  textSecondary: '--pn-colour-text-muted',
  border: '--pn-colour-border',
  gridLine: '--pn-colour-grid',
  actionPrimary: '--pn-colour-accent',
  actionHover: '--pn-colour-accent-hover',
  actionText: '--pn-colour-accent-text',
  badgeGround: '--pn-colour-badge-ground',
  toneCritical: '--pn-colour-tone-critical',
  toneHigh: '--pn-colour-tone-high',
  toneMedium: '--pn-colour-tone-medium',
  toneLow: '--pn-colour-tone-low',
  toneNeutral: '--pn-colour-tone-neutral',
} as const satisfies Record<keyof Palette, string>;

/**
 * How a stylesheet inside a document names one colour role: the custom
 * property carrying it, so the rule draws with whichever table the document
 * root resolved. A role added to {@link Palette} does not compile until it is
 * named a property.
 */
export function paletteProperty(role: keyof Palette): string {
  return `var(${colourProperties[role]})`;
}

const colourBlock = (palette: Palette, indent: string): string => {
  const byRole: Record<string, Colour> = palette;
  return Object.entries(colourProperties)
    .map(([role, property]) => `${indent}${property}: ${byRole[role]};`)
    .join('\n');
};

/**
 * The tokens as the `--pn-*` custom properties the studio's CSS modules read,
 * injected once at the app root: the light table on the root, the dark one
 * under the system's dark preference, and each forced by
 * `data-pn-colour-mode`. `color-scheme` rides along, so scrollbars and native
 * controls follow the same preference. The headless render reads none of it.
 */
export const tokenStylesheet = `:root {
  color-scheme: light dark;

  --pn-font-family: ${uiType.family};
  --pn-font-size: ${uiType.size};
  --pn-line-height: ${uiType.lineHeight};

${colourBlock(lightPalette, '  ')}

  --pn-space-1: ${spacingScale[1]};
  --pn-space-2: ${spacingScale[2]};
  --pn-space-3: ${spacingScale[3]};
  --pn-space-4: ${spacingScale[4]};

  --pn-radius: ${radius};

  --pn-panel-cover: ${String(panelCover)}px;
  --pn-chrome-block-size: ${chromeCard};
  --pn-chrome-reports-block-size: 0px;
  --pn-announcement-slot: ${announcementSlot};
  --pn-pane-block-start: calc(
    var(--pn-space-3) * 2 + var(--pn-chrome-block-size) +
      var(--pn-chrome-reports-block-size) + var(--pn-announcement-slot)
  );

  --pn-focus-ring-width: ${focusRing.width};
  --pn-focus-ring: var(--pn-focus-ring-width) solid var(--pn-colour-accent);
  --pn-focus-ring-offset: ${focusRing.offset};

  --pn-cue-selection: ${cueWidths.selection}px;
  --pn-cue-flow-hover: ${cueWidths.flowHover}px;
  --pn-cue-flow-selection: ${cueWidths.flowSelection}px;

  --pn-resize-handle-size: ${String(resizeHandle.size)}px;
}

@media (prefers-color-scheme: dark) {
  :root {
${colourBlock(darkPalette, '    ')}
  }
}

:root[data-pn-colour-mode='light'] {
  color-scheme: light;
${colourBlock(lightPalette, '  ')}
}

:root[data-pn-colour-mode='dark'] {
  color-scheme: dark;
${colourBlock(darkPalette, '  ')}
}
`;

const channels = (colour: Colour): readonly number[] =>
  [1, 3, 5].map((at) => parseInt(colour.slice(at, at + 2), 16));

const linear = (channel: number): number => {
  const scaled = channel / 255;
  return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
};

const relativeLuminance = (colour: Colour): number => {
  const [red, green, blue] = channels(colour).map(linear);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

/**
 * The contrast ratio of two colours, per WCAG 2.2: the lighter relative
 * luminance plus 0.05 over the darker plus 0.05, so between 1 and 21. WCAG
 * 2.2 AA asks 4.5 of text, and 3 of a mark or of the outline that identifies
 * a control.
 */
export function contrastRatio(one: Colour, other: Colour): number {
  const [first, second] = [relativeLuminance(one), relativeLuminance(other)];
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

/**
 * One colour as a browser writes it back out of a computed style, which is
 * `rgb(r, g, b)` over the same channels. A spec that reads a rendered colour
 * compares against this rather than against the hex a sheet was written in.
 */
export function rgbColour(colour: Colour): string {
  const [red, green, blue] = channels(colour);
  return `rgb(${red}, ${green}, ${blue})`;
}

/**
 * How far apart two colours are over the sRGB channels. A coarse measure,
 * enough to catch two tones that have collapsed onto one shade. What tells
 * one severity from another is the badge's mark rather than this number, so
 * adjacent hues need only stay apart, not stay far apart.
 */
export function channelDistance(one: Colour, other: Colour): number {
  const [from, to] = [channels(one), channels(other)];
  return Math.hypot(from[0] - to[0], from[1] - to[1], from[2] - to[2]);
}
