import {
  accentParts,
  severitySchema,
  type Accent,
  type AccentSlot,
  type Severity,
} from '@saerskriven/model';
import {
  badgeTextColour,
  defaultRenderTheme,
  type RenderTheme,
} from './render-theme.js';
import {
  canvasType,
  dotPitchRatio,
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

/**
 * The classes an accent adds to a drawing, which the sheet styles only where
 * a drawing holds one: a slot and `strong` on an element's group, `tinted` on
 * the fill a strong accent tints, and the band a strong accent draws a store.
 */
export const accentClassNames = {
  slot1: 'saer-diagram-accent-1',
  slot2: 'saer-diagram-accent-2',
  slot3: 'saer-diagram-accent-3',
  slot4: 'saer-diagram-accent-4',
  strong: 'saer-diagram-accent-strong',
  tinted: 'saer-diagram-tinted',
  storeBand: 'saer-diagram-store-band',
} as const satisfies Record<string, DiagramClassName>;

const accentSlots = {
  1: { className: accentClassNames.slot1, line: 'slot1', tint: 'slot1Tint' },
  2: { className: accentClassNames.slot2, line: 'slot2', tint: 'slot2Tint' },
  3: { className: accentClassNames.slot3, line: 'slot3', tint: 'slot3Tint' },
  4: { className: accentClassNames.slot4, line: 'slot4', tint: 'slot4Tint' },
} as const satisfies Record<
  AccentSlot,
  {
    readonly className: DiagramClassName;
    readonly line: keyof Palette;
    readonly tint: keyof Palette;
  }
>;

/**
 * The classes an element's group carries for its accent: its slot, and
 * `strong` where the key is a strong one. No accent gives none.
 */
export function accentGroupClasses(accent: Accent | undefined): string[] {
  if (accent === undefined) {
    return [];
  }
  const { slot, strong } = accentParts[accent];
  return strong
    ? [accentSlots[slot].className, accentClassNames.strong]
    : [accentSlots[slot].className];
}

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
  stroke-dasharray: ${dotted(strokeWidths.outline)};
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

const strong = `.${accentClassNames.strong}`;

const strongOutOfScope = `.${canvasClassNames.outOfScope}${strong}`;

const slotRules = (
  colour: (role: keyof Palette) => string,
  rule: (className: string, line: string, tint: string) => string,
): string =>
  Object.values(accentSlots)
    .map(({ className, line, tint }) =>
      rule(className, colour(line), colour(tint)),
    )
    .join('\n');

const accentSheetFrom = (
  colour: (role: keyof Palette) => string,
): string => `${slotRules(
  colour,
  (className, line, tint) => `.${className} .${canvasClassNames.shape} {
  stroke: ${line};
}
.${className} .${canvasClassNames.flowArrow} {
  fill: ${line};
}
.${className} .${accentClassNames.tinted} {
  fill: ${tint};
}`,
)}
.${accentClassNames.storeBand} {
  stroke: none;
}
${strong} .${canvasClassNames.shape} {
  stroke-width: ${strokeWidths.strongOutline};
}
${strong} .${canvasClassNames.boundaryBox},
${strong} .${canvasClassNames.boundaryCurve} {
  stroke-width: ${strokeWidths.strongBoundary};
}
${strong} .${canvasClassNames.flow} {
  stroke-width: ${strokeWidths.strongFlow};
}
${strongOutOfScope} .${canvasClassNames.shape} {
  stroke-dasharray: ${dotted(strokeWidths.strongOutline)};
}
${strongOutOfScope} .${canvasClassNames.boundaryBox},
${strongOutOfScope} .${canvasClassNames.boundaryCurve} {
  stroke-dasharray: ${dotted(strokeWidths.strongBoundary)};
}
${strongOutOfScope} .${canvasClassNames.flow} {
  stroke-dasharray: ${dotted(strokeWidths.strongFlow)};
}
`;

/**
 * The canvas stylesheet with colours read from the studio root properties.
 * Under forced colours an accent draws no slot colour and no tint, and a
 * strong one keeps its weight.
 */
export const themedCanvasStylesheet = `${sheetFrom(paletteProperty)}${accentSheetFrom(paletteProperty)}
@media (forced-colors: active) {
  .${canvasClassNames.shape} {
    fill: Canvas;
    stroke: CanvasText;
  }
  .${canvasClassNames.store},
  .${canvasClassNames.boundaryBox},
  .${canvasClassNames.boundaryCurve},
  .${canvasClassNames.noteFrame},
  .${canvasClassNames.flow} {
    fill: none;
  }
  .${canvasClassNames.label},
  .${canvasClassNames.note},
  .${canvasClassNames.flowLabel},
  .${canvasClassNames.flowArrow},
  .${canvasClassNames.outOfScope} .${canvasClassNames.flowArrow} {
    fill: CanvasText;
  }
  .${canvasClassNames.flowBacking} {
    fill: Canvas;
  }
  .${canvasClassNames.outOfScope} .${canvasClassNames.shape} {
    stroke: CanvasText;
  }
${slotRules(
  paletteProperty,
  (className) => `  .${className} .${canvasClassNames.shape} {
    stroke: CanvasText;
  }
  .${className} .${canvasClassNames.flowArrow} {
    fill: CanvasText;
  }
  .${className} .${accentClassNames.tinted} {
    fill: Canvas;
  }
  .${className} .${accentClassNames.storeBand} {
    fill: none;
  }`,
)}
  .${canvasClassNames.badge} {
    stroke: CanvasText;
    stroke-width: 1.5;
  }
  .${canvasClassNames.badge} .${canvasClassNames.toneCritical},
  .${canvasClassNames.badge} .${canvasClassNames.toneHigh},
  .${canvasClassNames.badge} .${canvasClassNames.toneMedium},
  .${canvasClassNames.badge} .${canvasClassNames.toneLow},
  .${canvasClassNames.badge} .${canvasClassNames.toneNeutral},
  .${canvasClassNames.badge} .${canvasClassNames.toneFlag} {
    fill: Canvas;
  }
  .${canvasClassNames.badgeCount},
  .${canvasClassNames.badgeMark} {
    fill: CanvasText;
  }
}
`;

/**
 * Resolves headless drawing colours, font family, and badge appearance. The
 * accent rules are written only where `accented` says the drawing holds an
 * accent, in the light palette's slot colours, so a drawing without one gets
 * the sheet it got before accents existed.
 */
export function renderCanvasStylesheet(
  theme: RenderTheme = defaultRenderTheme,
  accented = false,
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
    ...(accented ? [accentSheetFrom((role) => palette[role])] : []),
    ...badges,
  ].join('\n');
}

function dotted(strokeWidth: number): string {
  return `0 ${String(strokeWidth * dotPitchRatio)}`;
}
