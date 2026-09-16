import {
  defaultRenderTheme,
  renderThemeSchema,
  type RenderTheme,
} from '@saerskriven/canvas';
import { z } from 'zod';

const themeDiagnosticSchema = z.object({
  key: z.string(),
  message: z.string(),
});

const themeReadSchema = z.object({
  theme: renderThemeSchema,
  diagnostics: z.array(themeDiagnosticSchema),
});

/** A complete, usable theme and a diagnostic for every entry left out. */
export type ThemeRead = z.infer<typeof themeReadSchema>;

/**
 * Reads a partial theme leaf by leaf over the defaults. A valid leaf is kept
 * on its own, and an unknown key or invalid value is reported and left at its
 * default, so the read always gives a complete theme.
 */
export function readThemeOverrides(value: unknown): ThemeRead {
  const mapping = mappingSchema.safeParse(value);
  if (!mapping.success) {
    return {
      theme: defaultRenderTheme,
      diagnostics: [{ key: '', message: 'expected a mapping, using defaults' }],
    };
  }
  const diagnostics: ThemeRead['diagnostics'] = [];
  const kept: Record<string, Record<string, unknown>> = {};
  for (const section of renderThemeSchema.keyof().options) {
    const overrides = sectionOverrides(section, mapping.data);
    kept[section] = overrides.kept;
    diagnostics.push(...overrides.diagnostics);
  }
  for (const key of Object.keys(mapping.data)) {
    if (!Object.hasOwn(renderThemeSchema.shape, key)) {
      diagnostics.push({ key, message: 'unknown key, ignored' });
    }
  }
  const parsed = renderThemeSchema.safeParse(kept);
  return {
    theme: parsed.success ? parsed.data : defaultRenderTheme,
    diagnostics,
  };
}

/**
 * The theme with each font family the PDF and PNG outputs do not carry
 * replaced by the default, and a diagnostic naming each substitution.
 */
export function withBundledFonts(theme: RenderTheme): ThemeRead {
  const diagnostics: ThemeRead['diagnostics'] = [];
  const fonts = { ...theme.fonts };
  const bundled: readonly string[] = Object.values(defaultRenderTheme.fonts);
  for (const key of ['body', 'code'] as const) {
    if (!bundled.includes(fonts[key])) {
      diagnostics.push({
        key: `fonts.${key}`,
        message: `${fonts[key]} is not bundled, using ${defaultRenderTheme.fonts[key]}`,
      });
      fonts[key] = defaultRenderTheme.fonts[key];
    }
  }
  return { theme: { ...theme, fonts }, diagnostics };
}

type ThemeSection = keyof RenderTheme;

const mappingSchema = z.record(z.string(), z.unknown());

function sectionOverrides(
  section: ThemeSection,
  mapping: Readonly<Record<string, unknown>>,
): {
  readonly kept: Record<string, unknown>;
  readonly diagnostics: ThemeRead['diagnostics'];
} {
  const kept: Record<string, unknown> = { ...defaultRenderTheme[section] };
  if (!Object.hasOwn(mapping, section)) {
    return { kept, diagnostics: [] };
  }
  const entries = mappingSchema.safeParse(mapping[section]);
  if (!entries.success) {
    return {
      kept,
      diagnostics: [
        { key: section, message: 'expected a mapping, using defaults' },
      ],
    };
  }
  const diagnostics: ThemeRead['diagnostics'] = [];
  const fields: Readonly<Record<string, z.ZodType>> =
    renderThemeSchema.shape[section].shape;
  for (const [key, entry] of Object.entries(entries.data)) {
    const field = Object.hasOwn(fields, key) ? fields[key] : undefined;
    const parsed = field?.safeParse(entry);
    if (parsed?.success === true) {
      kept[key] = parsed.data;
    } else {
      diagnostics.push({
        key: `${section}.${key}`,
        message:
          field === undefined
            ? 'unknown key, ignored'
            : 'invalid value, using default',
      });
    }
  }
  return { kept, diagnostics };
}
