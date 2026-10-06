import { severitySchema, type Severity } from '@saerskriven/model';
import {
  badgeTextColour,
  defaultRenderTheme,
  type RenderTheme,
} from './render-theme.js';
import {
  canvasType,
  lightPalette,
  outOfScopeOutline,
  paletteProperty,
  strokeWidths,
  type Colour,
  type Palette,
} from './tokens.js';

type DiagramClassName = `saer-diagram-${string}`;

/** The diagram prefix separates canvas classes from rendered register classes. */
export const canvasClassNames = {
  element: 'saer-diagram-element',
  outOfScope: 'saer-diagram-out-of-scope',
  shape: 'saer-diagram-shape',
  actor: 'saer-diagram-actor',
  process: 'saer-diagram-process',
  store: 'saer-diagram-store',
  note: 'saer-diagram-note',
  noteFrame: 'saer-diagram-note-frame',
  boundaryBox: 'saer-diagram-boundary-box',
  boundaryCurve: 'saer-diagram-boundary-curve',
  label: 'saer-diagram-label',
  flow: 'saer-diagram-flow',
  flowArrow: 'saer-diagram-flow-arrow',
  flowLabel: 'saer-diagram-flow-label',
  flowBacking: 'saer-diagram-flow-backing',
  badge: 'saer-diagram-badge',
  badgePrimary: 'saer-diagram-badge-primary',
  badgeSecondary: 'saer-diagram-badge-secondary',
  badgeCount: 'saer-diagram-badge-count',
  badgeMark: 'saer-diagram-badge-mark',
  badgeFlag: 'saer-diagram-badge-flag',
  toneCritical: 'saer-diagram-tone-critical',
  toneHigh: 'saer-diagram-tone-high',
  toneMedium: 'saer-diagram-tone-medium',
  toneLow: 'saer-diagram-tone-low',
  toneNeutral: 'saer-diagram-tone-neutral',
  toneFlag: 'saer-diagram-tone-flag',
} as const satisfies Record<string, DiagramClassName>;

/** Names for interactive layers that the mounting canvas styles. */
export const canvasInteractionClassNames = {
  badgeLayer: 'saer-diagram-badge-layer',
  boundaryHitTarget: 'saer-diagram-boundary-hit-target',
  flowBlockLayer: 'saer-diagram-flow-block-layer',
  flowBlockSurface: 'saer-diagram-flow-block-surface',
  flowFocusRing: 'saer-diagram-flow-focus-ring',
  flowFocusInk: 'saer-diagram-flow-focus-ink',
} as const satisfies Record<string, DiagramClassName>;

export type WrappedTextStyle = 'label' | 'note' | 'flowLabel';

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
.${canvasClassNames.noteFrame} {
  fill: none;
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
}
.${canvasClassNames.flowBacking} {
  fill: ${colour('surfaceCanvas')};
  stroke: none;
}
.${canvasClassNames.outOfScope} .${canvasClassNames.shape} {
  stroke: ${colour(outOfScopeOutline)};
  stroke-dasharray: 0 5;
  stroke-linecap: round;
}
.${canvasClassNames.outOfScope} .${canvasClassNames.flowArrow} {
  fill: ${colour(outOfScopeOutline)};
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
