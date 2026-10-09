import {
  McpServer,
  ProtocolError,
  ProtocolErrorCode,
  ResourceNotFoundError,
  ResourceTemplate,
  type CacheHint,
  type CallToolResult,
  type GetPromptResult,
  type InputRequiredResult,
  type ReadResourceResult,
  type ServerContext,
} from '@modelcontextprotocol/server';
import { Either } from 'effect';
import {
  coverage,
  coverageDescription,
  coverageResultSchema,
  renderCoverage,
} from './coverage.js';
import {
  createArgumentsSchema,
  createDescription,
  createModel,
} from './create.js';
import {
  editArgumentsSchema,
  editDescription,
  editModel,
  editResultSchema,
  renderEdit,
} from './edit.js';
import {
  getThreat,
  getThreatArgumentsSchema,
  getThreatDescription,
  getThreatResultSchema,
  renderThreatRecord,
} from './get-threat.js';
import {
  hostRoundLimits,
  hostTurnOf,
  workspaceForCall,
} from './host-directories.js';
import {
  importArgumentsSchema,
  importDescription,
  importIntoModel,
  importResultSchema,
  renderImport,
} from './import.js';
import {
  inspect,
  inspectDescription,
  inspectResultSchema,
  renderInspection,
} from './inspect.js';
import { fileArgumentSchema } from './path-arguments.js';
import {
  register,
  registerDescription,
  registerResultSchema,
  renderRegisterResult,
} from './register.js';
import {
  renderDiagram,
  renderDiagramArgumentsSchema,
  renderDiagramDescription,
  renderDiagramResultSchema,
  renderDrawing,
  type RasterizerAssets,
} from './render-diagram.js';
import {
  PromptFailure,
  promptMessages,
  type PromptParts,
} from './prompt-result.js';
import {
  completedDiagrams,
  diagramResourceDescription,
  diagramResources,
  diagramUriTemplate,
  readDiagramResource,
  readRegisterResource,
  registerResourceDescription,
  registerUri,
  ResourceFailure,
} from './resources.js';
import {
  reviewModel,
  reviewModelArgumentsSchema,
  reviewModelDescription,
} from './review-model.js';
import {
  renderElementSearch,
  searchElements,
  searchElementsArgumentsSchema,
  searchElementsDescription,
  searchElementsResultSchema,
} from './search-elements.js';
import {
  renderRecordSearch,
  searchRecords,
  searchRecordsArgumentsSchema,
  searchRecordsDescription,
  searchRecordsResultSchema,
} from './search-records.js';
import {
  renderThreatSearch,
  searchThreats,
  searchThreatsArgumentsSchema,
  searchThreatsDescription,
  searchThreatsResultSchema,
} from './search-threats.js';
import {
  renderShareLink,
  shareLink,
  shareLinkDescription,
  shareLinkResultSchema,
  type BrotliModule,
} from './share-link.js';
import {
  stridePass,
  stridePassArgumentsSchema,
  stridePassDescription,
} from './stride-pass.js';
import { attachedToolResult, toolResult } from './tool-result.js';
import {
  renderValidation,
  validate,
  validateDescription,
  validateResultSchema,
} from './validate.js';
import { renderWriteReport, writeReportSchema } from './write.js';
import type { ModelWorkspace } from './workspace.js';

/** The name the server reports to a host, and the prefix every tool carries. */
export const serverName = 'saerskriven';

/**
 * What the server object needs: where it may read, which build it is, where a
 * render finds the rasterizer module and its faces, and where a share link
 * finds the brotli module.
 */
export type SaerskrivenServerOptions = {
  readonly workspace: ModelWorkspace;
  readonly version: string;
  readonly rasterizer: RasterizerAssets;
  readonly brotli: BrotliModule;
};

const uncached: CacheHint = { ttlMs: 0, cacheScope: 'private' };

const reads = {
  readOnlyHint: true,
  openWorldHint: false,
} as const;

const writes = {
  readOnlyHint: false,
  idempotentHint: false,
  openWorldHint: false,
} as const;

/**
 * The MCP server object, with no transport of its own. It holds no model and
 * no list of the host's directories, so every call reads its file from disk
 * again and asks the host again where its path leaves the root. Every
 * cacheable result tells a 2026-07-28 client to keep it for no time and share
 * it with no other client.
 */
export function createSaerskrivenServer(
  options: SaerskrivenServerOptions,
): McpServer {
  const server = new McpServer(
    { name: serverName, title: 'Saerskriven', version: options.version },
    {
      capabilities: { tools: {} },
      inputRequired: hostRoundLimits,
      cacheHints: {
        'server/discover': uncached,
        'tools/list': uncached,
        'prompts/list': uncached,
        'resources/list': uncached,
        'resources/templates/list': uncached,
        'resources/read': uncached,
      },
    },
  );
  const within = withinReach(server, options.workspace);
  readTools(server, within);
  queryTools(server, within);
  drawingTools(server, options, within);
  sharingTools(server, options, within);
  writeTools(server, within);
  resources(server, options);
  prompts(server, within);
  return server;
}

type Within = <Result>(
  ctx: ServerContext,
  paths: readonly (string | undefined)[],
  run: (workspace: ModelWorkspace) => Result,
) => Result | InputRequiredResult;

function withinReach(server: McpServer, workspace: ModelWorkspace): Within {
  return (ctx, paths, run) =>
    Either.match(workspaceForCall(workspace, paths, hostTurnOf(server, ctx)), {
      onLeft: (round) => round,
      onRight: run,
    });
}

function fileTool<
  Arguments extends { readonly file?: string | undefined },
  Answer extends Record<string, unknown>,
>(
  within: Within,
  answer: (
    workspace: ModelWorkspace,
    args: Arguments,
  ) => Either.Either<Answer, readonly string[]>,
  render: (answer: Answer) => readonly string[],
): (
  args: Arguments,
  ctx: ServerContext,
) => CallToolResult | InputRequiredResult {
  return (args, ctx) =>
    within(ctx, [args.file], (workspace) =>
      toolResult(answer(workspace, args), render),
    );
}

function readTools(server: McpServer, within: Within): void {
  server.registerTool(
    'saer_inspect',
    {
      title: 'Inspect a threat model',
      description: inspectDescription,
      inputSchema: fileArgumentSchema,
      outputSchema: inspectResultSchema,
      annotations: reads,
    },
    fileTool(within, inspect, renderInspection),
  );
  server.registerTool(
    'saer_validate',
    {
      title: 'Check a threat model file',
      description: validateDescription,
      inputSchema: fileArgumentSchema,
      outputSchema: validateResultSchema,
      annotations: reads,
    },
    fileTool(within, validate, renderValidation),
  );
  server.registerTool(
    'saer_coverage',
    {
      title: 'Report what a threat model covers',
      description: coverageDescription,
      inputSchema: fileArgumentSchema,
      outputSchema: coverageResultSchema,
      annotations: reads,
    },
    fileTool(within, coverage, renderCoverage),
  );
  server.registerTool(
    'saer_register',
    {
      title: 'Write the threat register',
      description: registerDescription,
      inputSchema: fileArgumentSchema,
      outputSchema: registerResultSchema,
      annotations: reads,
    },
    fileTool(within, register, renderRegisterResult),
  );
}

function queryTools(server: McpServer, within: Within): void {
  server.registerTool(
    'saer_search_elements',
    {
      title: 'Find elements of a threat model',
      description: searchElementsDescription,
      inputSchema: searchElementsArgumentsSchema,
      outputSchema: searchElementsResultSchema,
      annotations: reads,
    },
    fileTool(within, searchElements, renderElementSearch),
  );
  server.registerTool(
    'saer_search_threats',
    {
      title: 'Find threats of a threat model',
      description: searchThreatsDescription,
      inputSchema: searchThreatsArgumentsSchema,
      outputSchema: searchThreatsResultSchema,
      annotations: reads,
    },
    fileTool(within, searchThreats, renderThreatSearch),
  );
  server.registerTool(
    'saer_search_records',
    {
      title: 'Find mitigations and assumptions of a threat model',
      description: searchRecordsDescription,
      inputSchema: searchRecordsArgumentsSchema,
      outputSchema: searchRecordsResultSchema,
      annotations: reads,
    },
    fileTool(within, searchRecords, renderRecordSearch),
  );
  server.registerTool(
    'saer_get_threat',
    {
      title: 'Read one threat in full',
      description: getThreatDescription,
      inputSchema: getThreatArgumentsSchema,
      outputSchema: getThreatResultSchema,
      annotations: reads,
    },
    fileTool(within, getThreat, renderThreatRecord),
  );
}

function drawingTools(
  server: McpServer,
  options: SaerskrivenServerOptions,
  within: Within,
): void {
  server.registerTool(
    'saer_render_diagram',
    {
      title: 'Draw a diagram as a picture',
      description: renderDiagramDescription,
      inputSchema: renderDiagramArgumentsSchema,
      outputSchema: renderDiagramResultSchema,
      annotations: { ...writes, destructiveHint: false },
    },
    (args, ctx) =>
      within(ctx, [args.file, args.out], async (workspace) =>
        attachedToolResult(
          await renderDiagram(workspace, options.rasterizer, args),
          renderDrawing,
        ),
      ),
  );
}

function sharingTools(
  server: McpServer,
  options: SaerskrivenServerOptions,
  within: Within,
): void {
  server.registerTool(
    'saer_share_link',
    {
      title: 'Share a threat model as a link',
      description: shareLinkDescription,
      inputSchema: fileArgumentSchema,
      outputSchema: shareLinkResultSchema,
      annotations: reads,
    },
    (args, ctx) =>
      within(ctx, [args.file], async (workspace) =>
        attachedToolResult(
          await shareLink(workspace, options.brotli, args),
          renderShareLink,
        ),
      ),
  );
}

function writeTools(server: McpServer, within: Within): void {
  server.registerTool(
    'saer_edit',
    {
      title: 'Edit a threat model',
      description: editDescription,
      inputSchema: editArgumentsSchema,
      outputSchema: editResultSchema,
      annotations: { ...writes, destructiveHint: true },
    },
    fileTool(within, editModel, renderEdit),
  );
  server.registerTool(
    'saer_create',
    {
      title: 'Start a threat model',
      description: createDescription,
      inputSchema: createArgumentsSchema,
      outputSchema: writeReportSchema,
      annotations: { ...writes, destructiveHint: false },
    },
    fileTool(within, createModel, renderWriteReport),
  );
  server.registerTool(
    'saer_import',
    {
      title: 'Convert a foreign threat model',
      description: importDescription,
      inputSchema: importArgumentsSchema,
      outputSchema: importResultSchema,
      annotations: { ...writes, destructiveHint: false },
    },
    (args, ctx) =>
      within(ctx, [args.file, args.target], (workspace) =>
        toolResult(importIntoModel(workspace, args), renderImport),
      ),
  );
}

function resources(server: McpServer, options: SaerskrivenServerOptions): void {
  server.registerResource(
    'register',
    registerUri,
    {
      title: 'Threat register',
      description: registerResourceDescription,
      mimeType: 'text/markdown',
    },
    () => resourceOrThrow(registerUri, readRegisterResource(options.workspace)),
  );
  server.registerResource(
    'diagram',
    new ResourceTemplate(diagramUriTemplate, {
      list: () => diagramResources(options.workspace),
      complete: {
        diagram: (typed) => completedDiagrams(options.workspace, typed),
      },
    }),
    {
      title: 'Diagram picture',
      description: diagramResourceDescription,
      mimeType: 'image/png',
    },
    async (uri, variables) =>
      resourceOrThrow(
        uri.href,
        await readDiagramResource(
          options.workspace,
          options.rasterizer,
          uri,
          variables,
        ),
      ),
  );
}

function prompts(server: McpServer, within: Within): void {
  server.registerPrompt(
    'stride_pass',
    {
      title: 'STRIDE pass over one element',
      description: stridePassDescription,
      argsSchema: stridePassArgumentsSchema,
    },
    (args, ctx) =>
      within(ctx, [args.file], (workspace) =>
        promptOrThrow(stridePass(workspace, args)),
      ),
  );
  server.registerPrompt(
    'review_model',
    {
      title: 'Review a threat model',
      description: reviewModelDescription,
      argsSchema: reviewModelArgumentsSchema,
    },
    (args, ctx) =>
      within(ctx, [args.file], (workspace) =>
        promptOrThrow(reviewModel(workspace, args)),
      ),
  );
}

function resourceOrThrow(
  uri: string,
  outcome: Either.Either<ReadResourceResult, ResourceFailure>,
): ReadResourceResult {
  return Either.getOrThrowWith(outcome, (failure) =>
    ResourceFailure.$match(failure, {
      NoModel: () => notFound(uri),
      NoSuchDiagram: () => notFound(uri),
      UndecodableName: () => notFound(uri),
      RasterizerFailed: () =>
        new ProtocolError(
          ProtocolErrorCode.InternalError,
          'This install could not draw the diagram as a PNG. Call saer_render_diagram for the reason.',
        ),
    }),
  );
}

function promptOrThrow(
  outcome: Either.Either<PromptParts, PromptFailure>,
): GetPromptResult {
  return Either.getOrThrowWith(
    Either.map(outcome, promptMessages),
    (failure) =>
      new ProtocolError(
        ProtocolErrorCode.InvalidParams,
        PromptFailure.$match(failure, {
          NoModel: () =>
            'There is no model to read. Name a readable model file in `file`, under the server root or a directory the host lists, or start the server with --file.',
          NoSuchElement: () =>
            'The model holds no element with that id or name. Call saer_search_elements for the ids of its elements.',
          SharedName: () =>
            'Several elements carry that name. Name the element by its id, which saer_search_elements reports.',
          UncoveredKind: () =>
            'A STRIDE pass runs over an actor, a process, a store or a flow, and that element is none of these.',
        }),
      ),
  );
}

function notFound(uri: string): ResourceNotFoundError {
  return new ResourceNotFoundError(
    uri,
    'This server has no resource to answer that URI with. The listing names every diagram it can draw.',
  );
}
