import { readLimits } from '@saerskriven/formats';
import { sharePocResultSchema } from '@saerskriven/formats/share-link-poc';
import { shareLinkLimit } from '@saerskriven/formats/share-link';
import { z } from 'zod';

/** Requests accepted by one isolated codec worker. */
export const sharePocRequestSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('encode'),
    text: z.string().max(readLimits.maxTextBytes),
    base: z.string().max(shareLinkLimit),
  }),
  z.object({
    kind: z.literal('decode'),
    fragment: z.string().max(shareLinkLimit),
  }),
]);

/** The serialized request to a proof-of-concept worker. */
export type SharePocRequest = z.infer<typeof sharePocRequestSchema>;

/** Replies carry plain data across the worker boundary. */
export const sharePocReplySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('encoded'),
    result: sharePocResultSchema,
    title: z.string(),
  }),
  z.object({ kind: z.literal('decoded'), title: z.string(), yaml: z.string() }),
  z.object({ kind: z.literal('refused'), message: z.string() }),
]);

/** One result from the proof-of-concept worker. */
export type SharePocReply = z.infer<typeof sharePocReplySchema>;
