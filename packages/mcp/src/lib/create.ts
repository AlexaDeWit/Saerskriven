import {
  emptyModel,
  modelMetadataSchema,
  type Model,
} from '@saerskriven/model';
import type { Result } from 'effect';
import { z } from 'zod';
import { pathReach } from './path-arguments.js';
import { createdModel, readBoundPhrase, type WriteReport } from './write.js';
import type { ModelWorkspace } from './workspace.js';

const metadata = modelMetadataSchema.shape;

export const createArgumentsSchema = z.object({
  file: z
    .string()
    .describe(
      `Where to write the new model. ${pathReach} The call is refused when a file is already there, so this never replaces one.`,
    ),
  title: metadata.title.describe('What the model is called.'),
  owner: metadata.owner
    .optional()
    .describe(
      'Who answers for the model. Left out, the field is written empty, and saer_edit sets it later with set_model_metadata.',
    ),
  description: metadata.description
    .optional()
    .describe('What the model covers. Left out, the field is written empty.'),
  contributors: metadata.contributors
    .optional()
    .describe(
      'Who worked on the model, one name per entry. Left out, the list is written empty.',
    ),
});

export type CreateArguments = z.infer<typeof createArgumentsSchema>;

export type CreateResult = WriteReport;

export const createDescription = [
  'Create an empty native YAML version 2 model with title and optional owner, description and contributors. No diagrams or analysis exist yet.',
  '`file` must not exist. Use saer_edit to change an existing model.',
  'The result revision can go directly to saer_edit without another read.',
  `A model past ${readBoundPhrase}, is refused and not written, since the server could not open it again.`,
  'Populate with saer_edit: diagrams, then elements, then attached threats. Record ops add mitigations and assumptions to threats or model-wide assumptions. set_model_metadata changes title, owner, description and contributors.',
].join(' ');

/** Create an empty model without replacing an existing file. */
export function createModel(
  workspace: ModelWorkspace,
  args: CreateArguments,
): Result.Result<CreateResult, readonly string[]> {
  return createdModel(workspace, args.file, described(args), []);
}

function described(args: CreateArguments): Model {
  return {
    ...emptyModel,
    metadata: {
      title: args.title,
      owner: args.owner ?? '',
      description: args.description ?? '',
      contributors: args.contributors ?? [],
    },
  };
}
