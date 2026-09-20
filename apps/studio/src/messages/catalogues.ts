import type { Catalogues, MessageId, Translator } from '@saerskriven/i18n';
import { termCatalogues, termMessages } from '@saerskriven/render';
import { canvasMessages } from './canvas/contract.js';
import { canvasEnCA } from './canvas/en-CA.js';
import { canvasFrCA } from './canvas/fr-CA.js';
import { canvasSv } from './canvas/sv.js';
import { commandMessages } from './commands/contract.js';
import { commandsEnCA } from './commands/en-CA.js';
import { commandsFrCA } from './commands/fr-CA.js';
import { commandsSv } from './commands/sv.js';
import { defaultMessages } from './defaults/contract.js';
import { defaultsEnCA } from './defaults/en-CA.js';
import { defaultsFrCA } from './defaults/fr-CA.js';
import { defaultsSv } from './defaults/sv.js';
import { divergenceMessages } from './divergence/contract.js';
import { divergenceEnCA } from './divergence/en-CA.js';
import { divergenceFrCA } from './divergence/fr-CA.js';
import { divergenceSv } from './divergence/sv.js';
import { enumMessages } from './enums/contract.js';
import { enumsEnCA } from './enums/en-CA.js';
import { enumsFrCA } from './enums/fr-CA.js';
import { enumsSv } from './enums/sv.js';
import { fieldMessages } from './fields/contract.js';
import { fieldsEnCA } from './fields/en-CA.js';
import { fieldsFrCA } from './fields/fr-CA.js';
import { fieldsSv } from './fields/sv.js';
import { issueMessages } from './issues/contract.js';
import { issuesEnCA } from './issues/en-CA.js';
import { issuesFrCA } from './issues/fr-CA.js';
import { issuesSv } from './issues/sv.js';
import { menuMessages } from './menu/contract.js';
import { menuEnCA } from './menu/en-CA.js';
import { menuFrCA } from './menu/fr-CA.js';
import { menuSv } from './menu/sv.js';
import { noticeMessages } from './notice/contract.js';
import { noticeEnCA } from './notice/en-CA.js';
import { noticeFrCA } from './notice/fr-CA.js';
import { noticeSv } from './notice/sv.js';
import { panelMessages } from './panel/contract.js';
import { panelEnCA } from './panel/en-CA.js';
import { panelFrCA } from './panel/fr-CA.js';
import { panelSv } from './panel/sv.js';
import { reportMessages } from './reports/contract.js';
import { reportsEnCA } from './reports/en-CA.js';
import { reportsFrCA } from './reports/fr-CA.js';
import { reportsSv } from './reports/sv.js';
import { shellMessages } from './shell/contract.js';
import { shellEnCA } from './shell/en-CA.js';
import { shellFrCA } from './shell/fr-CA.js';
import { shellSv } from './shell/sv.js';
import { toolMessages } from './tools/contract.js';
import { toolsEnCA } from './tools/en-CA.js';
import { toolsFrCA } from './tools/fr-CA.js';
import { toolsSv } from './tools/sv.js';

/** The studio's message contract, one section per surface. */
export const studioMessages = {
  canvas: canvasMessages,
  commands: commandMessages,
  defaults: defaultMessages,
  divergence: divergenceMessages,
  enums: enumMessages,
  fields: fieldMessages,
  issues: issueMessages,
  menu: menuMessages,
  notice: noticeMessages,
  panel: panelMessages,
  reports: reportMessages,
  shell: shellMessages,
  terms: termMessages,
  tools: toolMessages,
} as const;

export type StudioMessages = typeof studioMessages;

export type StudioMessageId = MessageId<StudioMessages>;

/** The studio's messages resolved in one locale. */
export type StudioTranslator = Translator<StudioMessages>;

/** Every locale's catalogues, bundled with the studio. */
export const studioCatalogues: Catalogues<StudioMessages> = {
  'en-CA': {
    canvas: canvasEnCA,
    commands: commandsEnCA,
    defaults: defaultsEnCA,
    divergence: divergenceEnCA,
    enums: enumsEnCA,
    fields: fieldsEnCA,
    issues: issuesEnCA,
    menu: menuEnCA,
    notice: noticeEnCA,
    panel: panelEnCA,
    reports: reportsEnCA,
    shell: shellEnCA,
    terms: termCatalogues['en-CA'],
    tools: toolsEnCA,
  },
  'fr-CA': {
    canvas: canvasFrCA,
    commands: commandsFrCA,
    defaults: defaultsFrCA,
    divergence: divergenceFrCA,
    enums: enumsFrCA,
    fields: fieldsFrCA,
    issues: issuesFrCA,
    menu: menuFrCA,
    notice: noticeFrCA,
    panel: panelFrCA,
    reports: reportsFrCA,
    shell: shellFrCA,
    terms: termCatalogues['fr-CA'],
    tools: toolsFrCA,
  },
  sv: {
    canvas: canvasSv,
    commands: commandsSv,
    defaults: defaultsSv,
    divergence: divergenceSv,
    enums: enumsSv,
    fields: fieldsSv,
    issues: issuesSv,
    menu: menuSv,
    notice: noticeSv,
    panel: panelSv,
    reports: reportsSv,
    shell: shellSv,
    terms: termCatalogues.sv,
    tools: toolsSv,
  },
};
