import type { RenderTheme, UnplacedEndpoint } from '@saerskriven/canvas';
import { escapedForTerminal } from '@saerskriven/formats';
import {
  defaultLocale,
  locales,
  supportedLocale,
  type Locale,
} from '@saerskriven/i18n';
import {
  chosenDiagram,
  DiagramChoiceFailure,
  type Diagram,
  type Model,
} from '@saerskriven/model';
import {
  renderRegister,
  registerOptionsSchema,
  renderSvg,
  renderTypst,
  renderUnplacedWarning,
  type ThemeRead,
} from '@saerskriven/render';
import { Either } from 'effect';
import { z } from 'zod';
import { runtimeAssets } from './assets.js';
import { writeFile } from './files.js';
import { readModel } from './input.js';
import {
  lines,
  succeeded,
  usageError,
  type CommandOutcome,
  type CommandOutput,
} from './outcome.js';
import { compilePdf } from './pdf.js';
import { drawPng } from './png.js';
import { commandTheme, themeWarnings } from './theme.js';

/** Validated arguments for the render command. */
export const renderOptionsSchema = registerOptionsSchema.extend({
  theme: z.string().optional(),
  styled: z.boolean().optional(),
  stylesheet: z.boolean().optional(),
  headingLevel: z.coerce
    .number()
    .pipe(registerOptionsSchema.shape.headingLevel.unwrap())
    .optional(),
  format: z.enum(['svg', 'png', 'md', 'pdf'], {
    error: 'must be svg, png, md or pdf',
  }),
  out: z.string({ error: 'must be a path, or - for standard output' }),
  diagram: z.string().optional(),
  lang: z.string().optional(),
});

/** The options a render was asked for. */
export type RenderOptions = z.infer<typeof renderOptionsSchema>;

type DiagramFormat = 'svg' | 'png';

type WholeModelFormat = Exclude<RenderOptions['format'], DiagramFormat>;

const wholeModelFormats = {
  md: 'writes the whole register',
  pdf: 'writes every diagram and the register',
} satisfies Record<WholeModelFormat, string>;

/** Runs the CLI render command, with the assets beside the built bundle. */
export function render(
  file: string,
  options: RenderOptions,
  assets: string = runtimeAssets,
): Promise<CommandOutcome> {
  return Either.match(chosenLocale(options.lang), {
    onLeft: (message) => Promise.resolve(usageError(message)),
    onRight: (locale) => withLocale(file, options, assets, locale),
  });
}

function withLocale(
  file: string,
  options: RenderOptions,
  assets: string,
  locale: Locale,
): Promise<CommandOutcome> {
  return Either.match(readModel(file), {
    onLeft: (outcome) => Promise.resolve(outcome),
    onRight: async (read) => {
      const selected = commandTheme(
        options.theme,
        options.format,
        options.styled === true,
      );
      const outcome = await projection(
        read.model,
        options,
        assets,
        selected.theme,
        locale,
      );
      const diagnostics = [
        ...selected.diagnostics,
        ...markdownOptionDiagnostics(options),
      ];
      return {
        ...outcome,
        err: themeWarnings(options.theme, diagnostics) + outcome.err,
      };
    },
  });
}

function chosenLocale(lang: string | undefined): Either.Either<Locale, string> {
  if (lang === undefined) {
    return Either.right(defaultLocale);
  }
  const locale = supportedLocale(lang);
  return locale === undefined
    ? Either.left(refusedLanguage(lang))
    : Either.right(locale);
}

function refusedLanguage(lang: string): string {
  return lines(
    `error: --lang names no supported locale: ${quoted(lang)}`,
    `  supported locales: ${locales.join(', ')}`,
  );
}

function markdownOptionDiagnostics(
  options: RenderOptions,
): ThemeRead['diagnostics'] {
  return [
    ...(options.format === 'md' &&
    options.styled === true &&
    options.stylesheet === false &&
    options.theme !== undefined
      ? [
          {
            key: '',
            message:
              'the stylesheet is omitted, so the host CSS controls appearance',
          },
        ]
      : []),
    ...(options.format !== 'md' &&
    (options.title === false ||
      options.headingLevel !== undefined ||
      options.styled === true ||
      options.stylesheet === false)
      ? [
          {
            key: '',
            message: 'Markdown embedding options do not apply to this output',
          },
        ]
      : []),
  ];
}

function projection(
  model: Model,
  options: RenderOptions,
  assets: string,
  theme: RenderTheme,
  locale: Locale,
): Promise<CommandOutcome> {
  return options.format === 'svg' || options.format === 'png'
    ? drawing(model, options.format, options, assets, theme, locale)
    : wholeModel(model, options.format, options, assets, theme, locale);
}

function wholeModel(
  model: Model,
  format: WholeModelFormat,
  options: RenderOptions,
  assets: string,
  theme: RenderTheme,
  locale: Locale,
): Promise<CommandOutcome> {
  return options.diagram === undefined
    ? document(model, format, options, assets, theme, locale)
    : Promise.resolve(usageError(lines(refusedDiagram(format))));
}

function refusedDiagram(format: WholeModelFormat): string {
  return `error: --diagram chooses one diagram, and --format ${format} ${wholeModelFormats[format]}.`;
}

function document(
  model: Model,
  format: WholeModelFormat,
  options: RenderOptions,
  assets: string,
  theme: RenderTheme,
  locale: Locale,
): Promise<CommandOutcome> {
  return format === 'md'
    ? Promise.resolve(
        written(
          options.out,
          renderRegister(model, locale, {
            title: options.title,
            headingLevel: options.headingLevel,
            styled: options.styled,
            stylesheet: options.stylesheet,
            theme,
          }),
          '',
        ),
      )
    : compiled(model, options.out, assets, theme, locale);
}

async function compiled(
  model: Model,
  out: string,
  assets: string,
  theme: RenderTheme,
  locale: Locale,
): Promise<CommandOutcome> {
  const source = renderTypst(model, locale, theme);
  return Either.match(await compilePdf(source.typst, assets), {
    onLeft: (reason) => usageError(lines(`error: ${reason}`)),
    onRight: (pdf) => written(out, pdf, unplacedWarning(source.unplaced)),
  });
}

function drawing(
  model: Model,
  format: DiagramFormat,
  options: RenderOptions,
  assets: string,
  theme: RenderTheme,
  locale: Locale,
): Promise<CommandOutcome> {
  return Either.match(chosenDiagram(model.diagrams, options.diagram), {
    onLeft: (failure) => Promise.resolve(usageError(refusedChoice(failure))),
    onRight: (diagram) =>
      drawn(diagram, model, format, options.out, assets, theme, locale),
  });
}

function drawn(
  diagram: Diagram,
  model: Model,
  format: DiagramFormat,
  out: string,
  assets: string,
  theme: RenderTheme,
  locale: Locale,
): Promise<CommandOutcome> {
  return format === 'svg'
    ? Promise.resolve(vector(diagram, model, out, theme, locale))
    : raster(diagram, model, out, assets, theme, locale);
}

function vector(
  diagram: Diagram,
  model: Model,
  out: string,
  theme: RenderTheme,
  locale: Locale,
): CommandOutcome {
  const rendered = renderSvg(diagram, model, locale, theme);
  return written(out, rendered.svg, unplacedWarning(rendered.unplaced));
}

async function raster(
  diagram: Diagram,
  model: Model,
  out: string,
  assets: string,
  theme: RenderTheme,
  locale: Locale,
): Promise<CommandOutcome> {
  return Either.match(await drawPng(diagram, model, assets, locale, theme), {
    onLeft: (reason) => usageError(lines(`error: ${reason}`)),
    onRight: (image) =>
      written(out, image.png, unplacedWarning(image.unplaced)),
  });
}

function unplacedWarning(unplaced: readonly UnplacedEndpoint[]): string {
  return renderUnplacedWarning(unplaced, 'en-CA');
}

function written(
  out: string,
  content: CommandOutput,
  warning: string,
): CommandOutcome {
  return out === '-'
    ? succeeded(content, warning)
    : Either.match(writeFile(out, content), {
        onLeft: (reason) => usageError(lines(`error: ${reason}`)),
        onRight: () => succeeded('', warning),
      });
}

function refusedChoice(failure: DiagramChoiceFailure): string {
  return DiagramChoiceFailure.$match(failure, {
    NoDiagram: () =>
      lines('error: the model holds no diagram, so there is nothing to draw.'),
    SeveralDiagrams: ({ diagrams }) =>
      lines(
        'error: --diagram chooses which diagram to draw, and the model holds several:',
        ...diagramList(diagrams),
      ),
    NoDiagramNamed: ({ name, diagrams }) =>
      lines(
        `error: the model holds no diagram named ${quoted(name)}.`,
        ...diagramList(diagrams),
      ),
  });
}

function diagramList(diagrams: readonly Diagram[]): readonly string[] {
  return diagrams.map((diagram) =>
    escapedForTerminal(`  ${diagram.id}: ${collapsed(diagram.title)}`),
  );
}

function collapsed(text: string): string {
  return text.replace(/\s+/gu, ' ');
}

function quoted(text: string): string {
  return JSON.stringify(text);
}
