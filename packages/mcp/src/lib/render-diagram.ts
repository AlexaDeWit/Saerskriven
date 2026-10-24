import type { ContentBlock } from '@modelcontextprotocol/server';
import {
  collapsedWhitespace,
  escapedForTerminal,
  quotedForTerminal,
} from '@saerskriven/formats';
import {
  acceptedTextSchema,
  chosenDiagram,
  DiagramChoiceFailure,
  diagramIdSchema,
  elementIdSchema,
  type Diagram,
  type Model,
} from '@saerskriven/model';
import {
  diagramOptionsSchema,
  renderUnplacedWarning,
} from '@saerskriven/render';
import {
  renderPng,
  ResvgFailure,
  type PngImage,
} from '@saerskriven/render/png';
import type { ResvgAssets } from '@saerskriven/render/resvg';
import { Result } from 'effect';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { flowEndSchema } from './element-rows.js';
import {
  defaultedFileSentence,
  fileArgumentSchema,
  pathReach,
} from './path-arguments.js';
import {
  readNamed,
  readingSchema,
  renderReading,
  reportedReading,
  type ModelReading,
} from './reading.js';
import type { WithBlocks } from './tool-result.js';
import { createdBytes, renderWriteFailure, type WriteTarget } from './write.js';
import {
  confined,
  extensionOf,
  renderWorkspaceFailure,
  resultPath,
  type ModelWorkspace,
} from './workspace.js';

/** The media type of every image this server puts in a result. */
export const imageMediaType = 'image/png';

/** MCP hosts downscale image blocks to this longer edge, independent of the render default. */
export const mcpImageLongEdge = 1568;

const imageExtension = '.png';

/**
 * Where a render gets the rasterizer module and its faces, found by the host
 * process. The faces lead with `drawingFace` from `@saerskriven/render/png`.
 */
export type RasterizerAssets = () => Result.Result<ResvgAssets, string>;

export const renderDiagramArgumentsSchema = fileArgumentSchema.extend({
  diagram: z
    .string()
    .optional()
    .describe(
      'Which diagram to draw, named by its id or its exact title. An id is tried first. A model holding one diagram does not have to name it; a model holding several is refused until this names one.',
    ),
  showThreatLabels: diagramOptionsSchema.shape.showThreatLabels.describe(
    'Show threat badges. Defaults to true. Set false for architecture diagrams.',
  ),
  width: z
    .int()
    .min(1)
    .max(mcpImageLongEdge)
    .optional()
    .describe(
      `The pixel length of the longer edge of the image, whichever edge that is. It defaults to ${String(mcpImageLongEdge)}, which is what a host downscales an image block to, and it cannot be asked for larger than that.`,
    ),
  out: z
    .string()
    .optional()
    .describe(
      `Where to also write the PNG. ${pathReach} The path has to end in ${imageExtension}, in any case, since that is what the bytes are, and a path already holding a file is refused rather than replaced. Left out, nothing is written and the image reaches you in the result alone.`,
    ),
});

export type RenderDiagramArguments = z.infer<
  typeof renderDiagramArgumentsSchema
>;

const unplacedSchema = z.object({
  flow: elementIdSchema,
  side: flowEndSchema,
  element: elementIdSchema,
});

const writtenImageSchema = z.object({
  file: z.string(),
  uri: z.string(),
  revision: z.string(),
});

/**
 * What `saer_render_diagram` answers with. The picture's bytes travel in the
 * result's image block alone.
 */
export const renderDiagramResultSchema = readingSchema.extend({
  diagram: z.object({ id: diagramIdSchema, title: acceptedTextSchema }),
  image: z.object({
    mimeType: z.literal(imageMediaType),
    width: z.int().positive(),
    height: z.int().positive(),
    bytes: z.int().positive(),
  }),
  unplaced: z.array(unplacedSchema),
  written: writtenImageSchema.optional(),
});

export type RenderDiagramResult = z.infer<typeof renderDiagramResultSchema>;

/**
 * What a resource link says about the picture it points at, built from the
 * image's own numbers and no text out of the model file.
 */
export function imageLinkDescription(width: number, height: number): string {
  return `One diagram of a Saerskriven threat model, drawn as a PNG ${String(width)} by ${String(height)} pixels.`;
}

/** What a render produced: the answer a client validates, and the blocks it carries. */
export type DrawnDiagram = WithBlocks<RenderDiagramResult>;

export const renderDiagramDescription = [
  'Draw one diagram of a Saerskriven threat model as a picture and return it as a PNG image block, so you can see the shape of the system rather than read a listing of its parts.',
  'Call this when the geometry matters: which elements a trust boundary encloses, where a flow runs, what the diagram looks like to the people who drew it. Do not call it to enumerate elements or threats, which saer_search_elements and saer_search_threats answer in a fraction of the context a picture costs.',
  defaultedFileSentence,
  '`diagram` names which diagram to draw by id or exact title, and a model of one diagram does not need it. `width` is the pixel length of the longer edge. `out` also writes the PNG to the path it names, which comes back as a resource link.',
  `The image is always PNG, never SVG, and never larger than ${String(mcpImageLongEdge)} pixels on its longer edge. A flow whose endpoint names an element the canvas draws as no box is left out of the drawing, and the text of the result names every such endpoint, so a picture is not the whole diagram where that list is not empty.`,
  'Called without `out` this tool writes nothing. Called with it, it writes that one PNG and never a model, and it refuses a path that is already taken rather than replacing what is there.',
].join(' ');

/** One diagram as a picture, or the lines saying why there is none. */
export async function renderDiagram(
  workspace: ModelWorkspace,
  assets: RasterizerAssets,
  args: RenderDiagramArguments,
): Promise<Result.Result<DrawnDiagram, readonly string[]>> {
  const prepared = Result.flatMap(readNamed(workspace, args.file), (reading) =>
    Result.mapBoth(chosenDiagram(reading.model.diagrams, args.diagram), {
      onFailure: refusedChoice,
      onSuccess: (diagram) => ({ reading, diagram }),
    }),
  );
  return Result.isFailure(prepared)
    ? Result.fail(prepared.failure)
    : drawn(workspace, assets, args, prepared.success);
}

/** The render as the lines its text result carries. */
export function renderDrawing(result: RenderDiagramResult): readonly string[] {
  return [
    ...renderReading(result),
    `diagram: ${quotedForTerminal(result.diagram.id)} (${escapedForTerminal(result.diagram.title)})`,
    `image: ${result.image.mimeType}, ${String(result.image.width)} by ${String(result.image.height)} pixels, ${String(result.image.bytes)} bytes`,
    ...(result.written === undefined
      ? []
      : [`written: ${escapedForTerminal(result.written.file)}`]),
    ...unplacedLines(result.unplaced),
  ];
}

/**
 * One diagram as PNG bytes, or the lines saying why this install drew
 * nothing: a rasterizer it cannot find or start, or one that refused the
 * drawing.
 */
export async function rasterized(
  diagram: Diagram,
  model: Model,
  assets: RasterizerAssets,
  longEdge: number,
  showThreatLabels?: boolean,
): Promise<Result.Result<PngImage, readonly string[]>> {
  const found = assets();
  if (Result.isFailure(found)) {
    return Result.fail([
      `This install cannot draw a PNG: ${escapedForTerminal(found.failure)}.`,
    ]);
  }
  const image = await renderPng(diagram, model, 'en-CA', {
    assets: found.success,
    longEdge,
    showThreatLabels,
  });
  return Result.mapError(image, refused);
}

/** A drawing written nowhere, as the answer and the image block it carries. */
export function drawnOf(
  reading: ModelReading,
  diagram: Diagram,
  drawing: PngImage,
): DrawnDiagram {
  const answer = resultOf({ reading, diagram }, drawing, undefined);
  return { answer, blocks: blocksOf(answer, drawing.png) };
}

function unplacedLines(
  unplaced: readonly z.infer<typeof unplacedSchema>[],
): readonly string[] {
  const warning = renderUnplacedWarning(unplaced, 'en-CA');
  return warning === '' ? [] : warning.trimEnd().split('\n');
}

type ChosenDiagram = {
  readonly reading: ModelReading;
  readonly diagram: Diagram;
};

async function drawn(
  workspace: ModelWorkspace,
  assets: RasterizerAssets,
  args: RenderDiagramArguments,
  chosen: ChosenDiagram,
): Promise<Result.Result<DrawnDiagram, readonly string[]>> {
  const target = writeTarget(workspace, args.out);
  if (Result.isFailure(target)) {
    return Result.fail(target.failure);
  }
  const image = await rasterized(
    chosen.diagram,
    chosen.reading.model,
    assets,
    args.width ?? mcpImageLongEdge,
    args.showThreatLabels,
  );
  return Result.flatMap(image, (drawing) =>
    answered(chosen, drawing, target.success),
  );
}

function writeTarget(
  workspace: ModelWorkspace,
  out: string | undefined,
): Result.Result<WriteTarget | undefined, readonly string[]> {
  if (out === undefined) {
    return Result.succeed(undefined);
  }
  return Result.flatMap(
    Result.mapError(confined(workspace, out), renderWorkspaceFailure),
    (path) =>
      Result.map(endsInPng(out), () => ({
        file: resultPath(workspace, path),
        path,
      })),
  );
}

function endsInPng(out: string): Result.Result<void, readonly string[]> {
  return extensionOf(out) === imageExtension
    ? Result.succeed(undefined)
    : Result.fail([
        `The path ${quotedForTerminal(out)} does not end in ${imageExtension}, and this tool writes the bytes of a PNG.`,
        `Name it with a ${imageExtension} extension, so a later reader of that path finds what the name says it holds.`,
      ]);
}

function answered(
  chosen: ChosenDiagram,
  drawing: PngImage,
  target: WriteTarget | undefined,
): Result.Result<DrawnDiagram, readonly string[]> {
  return Result.map(saved(target, drawing.png), (written) => {
    const answer = resultOf(chosen, drawing, written);
    return { answer, blocks: blocksOf(answer, drawing.png) };
  });
}

function saved(
  target: WriteTarget | undefined,
  png: Uint8Array,
): Result.Result<
  z.infer<typeof writtenImageSchema> | undefined,
  readonly string[]
> {
  return target === undefined
    ? Result.succeed(undefined)
    : Result.mapBoth(createdBytes(target, png), {
        onFailure: renderWriteFailure,
        onSuccess: (revision) => ({
          file: target.file,
          uri: pathToFileURL(target.path).href,
          revision,
        }),
      });
}

function resultOf(
  chosen: ChosenDiagram,
  drawing: PngImage,
  written: z.infer<typeof writtenImageSchema> | undefined,
): RenderDiagramResult {
  return {
    ...reportedReading(chosen.reading),
    diagram: { id: chosen.diagram.id, title: chosen.diagram.title },
    image: {
      mimeType: imageMediaType,
      width: drawing.width,
      height: drawing.height,
      bytes: drawing.png.length,
    },
    unplaced: drawing.unplaced.map((endpoint) => ({
      flow: endpoint.flow,
      side: endpoint.side,
      element: endpoint.element,
    })),
    ...(written === undefined ? {} : { written }),
  };
}

function blocksOf(
  answer: RenderDiagramResult,
  png: Uint8Array,
): readonly ContentBlock[] {
  return [
    {
      type: 'image',
      data: Buffer.from(png).toString('base64'),
      mimeType: answer.image.mimeType,
    },
    ...(answer.written === undefined
      ? []
      : [
          {
            type: 'resource_link' as const,
            uri: answer.written.uri,
            name: answer.written.file,
            mimeType: answer.image.mimeType,
            description: imageLinkDescription(
              answer.image.width,
              answer.image.height,
            ),
          },
        ]),
  ];
}

function refused(failure: ResvgFailure): readonly string[] {
  return ResvgFailure.$match(failure, {
    Refused: ({ sentence }) => [
      `The diagram was not drawn: ${escapedForTerminal(sentence)}.`,
    ],
    Unusable: ({ sentence }) => [
      `This install cannot draw a PNG: ${escapedForTerminal(sentence)}.`,
    ],
  });
}

function refusedChoice(failure: DiagramChoiceFailure): readonly string[] {
  return DiagramChoiceFailure.$match(failure, {
    NoDiagram: () => [
      'The model holds no diagram, so there is nothing to draw.',
    ],
    SeveralDiagrams: ({ diagrams }) => [
      'The model holds several diagrams, so `diagram` has to name the one to draw:',
      ...diagramList(diagrams),
    ],
    NoDiagramNamed: ({ name, diagrams }) => [
      `The model holds no diagram named ${quotedForTerminal(name)}.`,
      ...diagramList(diagrams),
    ],
  });
}

function diagramList(diagrams: readonly Diagram[]): readonly string[] {
  return diagrams.map(
    (diagram) =>
      `  ${quotedForTerminal(diagram.id)}: ${escapedForTerminal(collapsedWhitespace(diagram.title))}`,
  );
}
