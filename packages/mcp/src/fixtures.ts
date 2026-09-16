import type {
  CallToolResult,
  GetPromptResult,
  ReadResourceResult,
} from '@modelcontextprotocol/server';
import type { z } from 'zod';
import { editResultSchema, type EditResult } from './lib/edit.js';
import { inspectResultSchema, type InspectResult } from './lib/inspect.js';
import {
  imageLinkDescription,
  renderDiagramResultSchema,
} from './lib/render-diagram.js';

/**
 * The tools a release registers, in registration order: the reads, the
 * queries, the drawing, then the writes.
 */
export const registeredTools: readonly string[] = [
  'saer_inspect',
  'saer_validate',
  'saer_coverage',
  'saer_register',
  'saer_search_elements',
  'saer_search_threats',
  'saer_get_threat',
  'saer_render_diagram',
  'saer_edit',
  'saer_create',
  'saer_import',
];

/** The prompts a release registers, in the order the server registers them. */
export const registeredPrompts: readonly string[] = [
  'stride_pass',
  'review_model',
];

/**
 * Which era a client opens a connection in. The SDK's client defaults to
 * `legacy`, so a suite that means to exercise the 2026-07-28 revision asks
 * for `modern` and gets the `server/discover` probe.
 */
export type Era = 'legacy' | 'modern';

/** Both eras a release has to serve, for a suite that runs over each. */
export const eras: readonly Era[] = ['legacy', 'modern'];

/** The text of a tool result's first text block, and nothing where it has none. */
export function textOf(result: CallToolResult): string {
  const block = result.content.find((entry) => entry.type === 'text');
  return block?.type === 'text' ? block.text : '';
}

/**
 * What a tool result says to a model. `prose` is the body text, `links` the
 * free text of resource links, which carry no data-not-instructions line, and
 * `unread` the block types or media types the reader could not look inside.
 */
export type ResultProse = {
  readonly prose: readonly string[];
  readonly links: readonly string[];
  readonly unread: readonly string[];
};

/**
 * Every string a tool result would put in front of a model. A block type the
 * reader does not know is named in `unread`.
 */
export function proseOf(result: CallToolResult): ResultProse {
  const prose: string[] = [];
  const links: string[] = [];
  const unread: string[] = [];
  for (const block of result.content) {
    if (block.type === 'text') {
      prose.push(block.text);
    } else if (block.type === 'resource') {
      const read = resourceProseOf({ contents: [block.resource] });
      prose.push(...read.prose);
      unread.push(...read.unread);
    } else if (block.type === 'resource_link') {
      links.push(block.name, block.description ?? '');
    } else if (block.type !== 'image') {
      unread.push(block.type);
    }
  }
  return { prose, links, unread };
}

/**
 * Every text a resource read would put in front of a model. A blob that is
 * not an image is named in `unread`.
 */
export function resourceProseOf(result: ReadResourceResult): ResultProse {
  const prose: string[] = [];
  const unread: string[] = [];
  for (const entry of result.contents) {
    if ('text' in entry) {
      prose.push(entry.text);
    } else if (!(entry.mimeType ?? '').startsWith('image/')) {
      unread.push(`blob ${entry.mimeType ?? 'without a media type'}`);
    }
  }
  return { prose, links: [], unread };
}

/**
 * The text of every message of a prompt, in order, with the type of any
 * content that is not text named in `unread`.
 */
export function promptProseOf(result: GetPromptResult): ResultProse {
  const prose: string[] = [];
  const unread: string[] = [];
  for (const message of result.messages) {
    if (message.content.type === 'text') {
      prose.push(message.content.text);
    } else {
      unread.push(message.content.type);
    }
  }
  return { prose, links: [], unread };
}

/** Every image blob of a resource read, as its media type and its bytes. */
export function blobsOf(
  result: ReadResourceResult,
): readonly { readonly mimeType: string; readonly bytes: Uint8Array }[] {
  return result.contents.flatMap((entry) =>
    'blob' in entry
      ? [
          {
            mimeType: entry.mimeType ?? '',
            bytes: Buffer.from(entry.blob, 'base64'),
          },
        ]
      : [],
  );
}

/**
 * A tool result's structured content, read back through the schema the tool
 * advertises, so a spec reasons about typed data and the result is held to
 * the shape a client would validate it against.
 */
export function structuredOf<Schema extends z.ZodType>(
  result: CallToolResult,
  schema: Schema,
): z.infer<Schema> {
  return schema.parse(result.structuredContent);
}

/** What `saer_inspect` reported, read back through the schema it advertises. */
export function inspectionOf(result: CallToolResult): InspectResult {
  return structuredOf(result, inspectResultSchema);
}

/** Every image block of a tool result, as its media type and its bytes. */
export function imagesOf(
  result: CallToolResult,
): readonly { readonly mimeType: string; readonly bytes: Uint8Array }[] {
  return result.content.flatMap((block) =>
    block.type === 'image'
      ? [
          {
            mimeType: block.mimeType,
            bytes: Buffer.from(block.data, 'base64'),
          },
        ]
      : [],
  );
}

/** Every media type a tool result's blocks declare, image blocks included. */
export function mediaTypesOf(result: CallToolResult): readonly string[] {
  return result.content.flatMap((block) =>
    block.type === 'image' || block.type === 'resource_link'
      ? [block.mimeType ?? '']
      : [],
  );
}

/**
 * The only text a resource link of this server may carry for one result: the
 * written path and the image description. A result that is no render with
 * `out` answers empty.
 */
export function ownLinkTextOf(result: CallToolResult): readonly string[] {
  const drawn = renderDiagramResultSchema.safeParse(result.structuredContent);
  return drawn.success && drawn.data.written !== undefined
    ? [
        drawn.data.written.file,
        imageLinkDescription(drawn.data.image.width, drawn.data.image.height),
      ]
    : [];
}

/** Every resource link of a tool result, as the file it names. */
export function resourceLinksOf(
  result: CallToolResult,
): readonly { readonly uri: string; readonly name: string }[] {
  return result.content.flatMap((block) =>
    block.type === 'resource_link'
      ? [{ uri: block.uri, name: block.name }]
      : [],
  );
}

/** The reading inside an inspection, where the call was to read a file. */
export function readingOf(
  result: CallToolResult,
): Extract<InspectResult['result'], { kind: 'inspected' }> {
  const inspection = inspectionOf(result);
  if (inspection.result.kind !== 'inspected') {
    throw new Error('the call listed candidates where it was to read a file');
  }
  return inspection.result;
}

/**
 * What `saer_edit` reported, read back through the schema the tool
 * advertises, so a spec reasons about typed data as it does for a reading.
 */
export function editOf(result: CallToolResult): EditResult {
  return structuredOf(result, editResultSchema);
}
