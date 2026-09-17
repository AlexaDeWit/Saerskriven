import type { Catalogues, MessageId } from '@saerskriven/i18n';
import { canvasMessages } from './canvas/contract.js';
import { canvasEnCA } from './canvas/en-CA.js';
import { canvasFrCA } from './canvas/fr-CA.js';
import { canvasSv } from './canvas/sv.js';
import { noticeMessages } from './notice/contract.js';
import { noticeEnCA } from './notice/en-CA.js';
import { noticeFrCA } from './notice/fr-CA.js';
import { noticeSv } from './notice/sv.js';

/** The studio's message contract, one section per surface. */
export const studioMessages = {
  canvas: canvasMessages,
  notice: noticeMessages,
} as const;

export type StudioMessages = typeof studioMessages;

export type StudioMessageId = MessageId<StudioMessages>;

/** Every locale's catalogues, bundled with the studio. */
export const studioCatalogues: Catalogues<StudioMessages> = {
  'en-CA': { canvas: canvasEnCA, notice: noticeEnCA },
  'fr-CA': { canvas: canvasFrCA, notice: noticeFrCA },
  sv: { canvas: canvasSv, notice: noticeSv },
};
