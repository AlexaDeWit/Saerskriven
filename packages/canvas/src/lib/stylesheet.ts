import { severitySchema, type Severity } from '@saerskriven/model';
import {
  badgeTextColour,
  defaultRenderTheme,
  type RenderTheme,
} from './render-theme.js';
import {
  canvasType,
  lightPalette,
  paletteProperty,
  strokeWidths,
  type Colour,
  type Palette,
} from './tokens.js';

/** Stable class names emitted by the canvas primitives. */
export const canvasClassNames = {
  element: 'pn-element',
  outOfScope: 'pn-out-of-scope',
  shape: 'pn-shape',
  actor: 'pn-actor',
  process: 'pn-process',
  store: 'pn-store',
  note: 'pn-note',
  boundaryBox: 'pn-boundary-box',
  boundaryCurve: 'pn-boundary-curve',
  label: 'pn-label',
  flow: 'pn-flow',
  flowArrow: 'pn-flow-arrow',
  flowLabel: 'pn-flow-label',
  badge: 'pn-badge',
  badgePrimary: 'pn-badge-primary',
  badgeSecondary: 'pn-badge-secondary',
  badgeCount: 'pn-badge-count',
  badgeMark: 'pn-badge-mark',
  badgeFlag: 'pn-badge-flag',
  toneCritical: 'pn-tone-critical',
  toneHigh: 'pn-tone-high',
  toneMedium: 'pn-tone-medium',
  toneLow: 'pn-tone-low',
  toneNeutral: 'pn-tone-neutral',
  toneFlag: 'pn-tone-flag',
} as const;

/** Which run of text a primitive is drawing. */
export type WrappedTextStyle = 'label' | 'note' | 'flowLabel';

/** How one run of text is named in the stylesheet and how large it is. */
export type TextStyleRule = {
  readonly className: string;
  readonly fontSize: number;
};

/** The stylesheet and text layout use the same font sizes. */
export const wrappedTextStyles = {
  label: {
    className: canvasClassNames.label,
    fontSize: canvasType.widgetLabel,
  },
  note: { className: canvasClassNames.note, fontSize: canvasType.note },
  flowLabel: {
    className: canvasClassNames.flowLabel,
    fontSize: canvasType.widgetLabel,
  },
} as const satisfies Record<WrappedTextStyle, TextStyleRule>;

/** Maps each severity to its diagram tone class. */
export const severityToneClass = {
  low: canvasClassNames.toneLow,
  medium: canvasClassNames.toneMedium,
  high: canvasClassNames.toneHigh,
  critical: canvasClassNames.toneCritical,
  undecided: canvasClassNames.toneNeutral,
} as const satisfies Record<Severity, string>;

/** Shared stroke width for drawing and bounding a trust boundary. */
export const boundaryStrokeWidth = strokeWidths.outline;

const sheetFrom = (
  colour: (role: keyof Palette) => string,
  family: string = canvasType.family,
): string => `.${canvasClassNames.element} {
  font-family: ${family};
}
.${canvasClassNames.shape} {
  fill: ${colour('surfacePanel')};
  stroke: ${colour('textPrimary')};
  stroke-width: ${strokeWidths.outline};
}
.${canvasClassNames.actor} {
  fill: ${colour('surfaceActor')};
}
.${canvasClassNames.process} {
  fill: ${colour('surfaceProcess')};
}
.${canvasClassNames.store} {
  fill: none;
  stroke-width: ${strokeWidths.store};
}
.${canvasClassNames.boundaryBox},
.${canvasClassNames.boundaryCurve} {
  fill: none;
  stroke: ${colour('textSecondary')};
  stroke-width: ${boundaryStrokeWidth};
  stroke-dasharray: 8 6;
}
.${canvasClassNames.outOfScope} {
  opacity: 0.5;
}
.${canvasClassNames.outOfScope} .${canvasClassNames.shape} {
  stroke-dasharray: 6 4;
}
.${wrappedTextStyles.label.className} {
  fill: ${colour('textPrimary')};
  font-size: ${wrappedTextStyles.label.fontSize}px;
  font-weight: 500;
  text-anchor: middle;
  dominant-baseline: central;
}
.${wrappedTextStyles.note.className} {
  fill: ${colour('textSecondary')};
  font-size: ${wrappedTextStyles.note.fontSize}px;
  text-anchor: middle;
  dominant-baseline: central;
}
.${canvasClassNames.flow} {
  fill: none;
}
.${canvasClassNames.flowArrow} {
  fill: ${colour('textPrimary')};
  stroke: none;
}
.${wrappedTextStyles.flowLabel.className} {
  fill: ${colour('textSecondary')};
  font-size: ${wrappedTextStyles.flowLabel.fontSize}px;
  text-anchor: middle;
  dominant-baseline: central;
  paint-order: stroke;
  stroke: ${colour('surfaceCanvas')};
  stroke-width: ${strokeWidths.labelHalo};
  stroke-linejoin: round;
}
.${canvasClassNames.badge} {
  stroke: ${colour('badgeGround')};
  stroke-width: ${strokeWidths.badgeRing};
}
.${canvasClassNames.badgeCount} {
  fill: ${colour('badgeGround')};
  stroke: none;
  font-weight: 600;
  text-anchor: middle;
  dominant-baseline: central;
}
.${canvasClassNames.badgePrimary} .${canvasClassNames.badgeCount} {
  font-size: ${canvasType.badgeCount}px;
}
.${canvasClassNames.badgeSecondary} .${canvasClassNames.badgeCount} {
  font-size: ${canvasType.secondaryBadgeCount}px;
}
.${canvasClassNames.badgeMark} {
  fill: ${colour('badgeGround')};
  stroke: none;
  font-size: ${canvasType.badgeMark}px;
  font-weight: 700;
  text-anchor: middle;
  dominant-baseline: central;
}
.${canvasClassNames.badgeFlag} {
  stroke-linejoin: round;
}
.${canvasClassNames.toneCritical} {
  fill: ${colour('toneCritical')};
}
.${canvasClassNames.toneHigh} {
  fill: ${colour('toneHigh')};
}
.${canvasClassNames.toneMedium} {
  fill: ${colour('toneMedium')};
}
.${canvasClassNames.toneLow} {
  fill: ${colour('toneLow')};
}
.${canvasClassNames.toneNeutral} {
  fill: ${colour('toneNeutral')};
}
.${canvasClassNames.toneFlag} {
  fill: ${colour('textPrimary')};
}
`;

/** The studio-independent canvas stylesheet with resolved light colours. */
export const canvasStylesheet = sheetFrom((role) => lightPalette[role]);

/** The canvas stylesheet with colours read from the studio root properties. */
export const themedCanvasStylesheet = sheetFrom(paletteProperty);

/** Resolves headless drawing colours, font family, and badge appearance. */
export function renderCanvasStylesheet(
  theme: RenderTheme = defaultRenderTheme,
): string {
  const palette: Palette = {
    ...lightPalette,
    surfaceCanvas: theme.colours.background,
    surfacePanel: theme.colours.element,
    surfaceActor: theme.colours.actor,
    surfaceProcess: theme.colours.process,
    textPrimary: theme.colours.text,
    textSecondary: theme.colours.muted,
    badgeGround: badgeTextColour(theme, theme.colours.text),
    toneCritical: theme.severity.critical,
    toneHigh: theme.severity.high,
    toneMedium: theme.severity.medium,
    toneLow: theme.severity.low,
    toneNeutral: theme.severity.undecided,
  };
  const tones: readonly (readonly [string, Colour])[] = [
    ...severitySchema.options.map(
      (severity) =>
        [severityToneClass[severity], theme.severity[severity]] as const,
    ),
    [canvasClassNames.toneFlag, theme.colours.text],
  ];
  const outlined = theme.badges.style === 'outline';
  const badges = tones.map(
    ([className, tone]) =>
      `.${className} { fill: ${outlined ? theme.colours.background : tone}; stroke: ${tone}; stroke-width: ${String(theme.badges.borderWidth)}; }
.${className} ~ .${canvasClassNames.badgeCount}, .${className} ~ .${canvasClassNames.badgeMark} { fill: ${badgeTextColour(theme, tone)}; }`,
  );
  return [
    sheetFrom((role) => palette[role], JSON.stringify(theme.fonts.body)),
    ...badges,
  ].join('\n');
}
