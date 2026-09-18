import type { Catalogues, MessageId } from '@saerskriven/i18n';
import { canvasMessages } from './canvas/contract.js';
import { canvasEnCA } from './canvas/en-CA.js';
import { canvasFrCA } from './canvas/fr-CA.js';
import { canvasSv } from './canvas/sv.js';
import { noticeMessages } from './notice/contract.js';
import { noticeEnCA } from './notice/en-CA.js';
import { noticeFrCA } from './notice/fr-CA.js';
import { noticeSv } from './notice/sv.js';
import { shellMessages } from './shell/contract.js';
import { shellEnCA } from './shell/en-CA.js';
import { shellFrCA } from './shell/fr-CA.js';
import { shellSv } from './shell/sv.js';

/** The studio's message contract, one section per surface. */
export const studioMessages = {
  canvas: canvasMessages,
  notice: noticeMessages,
  shell: shellMessages,
} as const;

export type StudioMessages = typeof studioMessages;

export type StudioMessageId = MessageId<StudioMessages>;

/** Every locale's catalogues, bundled with the studio. */
export const studioCatalogues: Catalogues<StudioMessages> = {
  'en-CA': { canvas: canvasEnCA, notice: noticeEnCA, shell: shellEnCA },
  'fr-CA': { canvas: canvasFrCA, notice: noticeFrCA, shell: shellFrCA },
  sv: { canvas: canvasSv, notice: noticeSv, shell: shellSv },
};
