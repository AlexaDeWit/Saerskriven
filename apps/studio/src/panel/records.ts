import {
  assumptionIdSchema,
  assumptionStatusSchema,
  generateAssumptionId,
  generateMitigationId,
  inNumberOrder,
  mitigationIdSchema,
  mitigationStatusSchema,
  type Assumption,
  type Mitigation,
  type Model,
  type Threat,
  type ThreatId,
} from '@saerskriven/model';
import type { z } from 'zod';
import type { StudioTranslator } from '../messages/catalogues.js';
import { sentences } from '../messages/said.js';
import { Action } from '../store/actions.js';
import type { OptionText } from '../ui/enum-field.js';
import { distinctTexts } from './distinct-labels.js';

const recordParts = ['title', 'prose'] as const;

/** The text a record carries: a mitigation has a title and prose, an assumption prose alone. */
export type RecordPart = (typeof recordParts)[number];

/** A mitigation or an assumption, as a record group edits either. */
export type ThreatRecord = Mitigation | Assumption;

/** Names one text field of one record, so a refused draft typed there can be put back. */
export type RecordFieldName =
  `${RecordNoun | `new-${RecordNoun}`}/${RecordPart}/${string}`;

type RecordNoun = 'mitigation' | 'assumption';

/**
 * One kind of record as a record group edits it. A fresh or restored record
 * links nothing until a {@link RecordTarget} attaches it.
 */
export type RecordKind<Held extends ThreatRecord> = {
  readonly noun: RecordNoun;
  readonly title: 'enums.mitigation' | 'enums.assumption';
  readonly nounMessage: 'enums.noun-mitigation' | 'enums.noun-assumption';
  readonly heading: 'terms.mitigations' | 'terms.assumptions';
  readonly statusMessage: (status: Held['status']) => RecordStatusMessage;
  readonly parts: readonly RecordPart[];
  readonly statuses: readonly Held['status'][];
  readonly held: (model: Model) => readonly Held[];
  readonly fresh: () => Held;
  readonly restored: (
    id: string,
    status: string | undefined,
  ) => Held | undefined;
  readonly withText: (record: Held, part: RecordPart, text: string) => Held;
  readonly add: (record: Held) => Action;
  readonly replace: (record: Held) => Action;
  readonly link: (record: Held, threatId: ThreatId) => Action;
  readonly unlink: (record: Held, threatId: ThreatId) => Action;
  readonly setStatus: (record: Held, status: Held['status']) => Action;
};

/** The catalogue label of one record status, of either kind. */
export type RecordStatusMessage =
  | 'terms.mitigation-proposed'
  | 'terms.mitigation-implemented'
  | 'terms.mitigation-verified'
  | 'terms.assumption-unconfirmed'
  | 'terms.assumption-valid'
  | 'terms.assumption-invalidated';

const mitigationStatusMessages = {
  proposed: 'terms.mitigation-proposed',
  implemented: 'terms.mitigation-implemented',
  verified: 'terms.mitigation-verified',
} as const satisfies Record<Mitigation['status'], RecordStatusMessage>;

const assumptionStatusMessages = {
  unconfirmed: 'terms.assumption-unconfirmed',
  valid: 'terms.assumption-valid',
  invalidated: 'terms.assumption-invalidated',
} as const satisfies Record<Assumption['status'], RecordStatusMessage>;

/** Mitigations, which start `proposed`. */
export const mitigationKind: RecordKind<Mitigation> = {
  noun: 'mitigation',
  title: 'enums.mitigation',
  nounMessage: 'enums.noun-mitigation',
  heading: 'terms.mitigations',
  statusMessage: (status) => mitigationStatusMessages[status],
  parts: ['title', 'prose'],
  statuses: mitigationStatusSchema.options,
  held: (model) => model.mitigations,
  fresh: freshMitigation,
  restored: restoredRecord(
    mitigationIdSchema,
    mitigationStatusSchema,
    freshMitigation,
  ),
  withText: (record, part, text) =>
    part === 'title' ? { ...record, title: text } : { ...record, prose: text },
  add: (mitigation) => Action.AddMitigation({ mitigation }),
  replace: (mitigation) => Action.ReplaceMitigation({ mitigation }),
  link: ({ id }, threatId) =>
    Action.LinkMitigation({ mitigationId: id, threatId }),
  unlink: ({ id }, threatId) =>
    Action.UnlinkMitigation({ mitigationId: id, threatId }),
  setStatus: ({ id }, status) =>
    Action.SetMitigationStatus({ mitigationId: id, status }),
};

/** Assumptions, which start `unconfirmed` and carry prose alone. */
export const assumptionKind: RecordKind<Assumption> = {
  noun: 'assumption',
  title: 'enums.assumption',
  nounMessage: 'enums.noun-assumption',
  heading: 'terms.assumptions',
  statusMessage: (status) => assumptionStatusMessages[status],
  parts: ['prose'],
  statuses: assumptionStatusSchema.options,
  held: (model) => model.assumptions,
  fresh: freshAssumption,
  restored: restoredRecord(
    assumptionIdSchema,
    assumptionStatusSchema,
    freshAssumption,
  ),
  withText: (record, part, text) =>
    part === 'prose' ? { ...record, prose: text } : record,
  add: (assumption) => Action.AddAssumption({ assumption }),
  replace: (assumption) => Action.ReplaceAssumption({ assumption }),
  link: ({ id }, threatId) =>
    Action.LinkAssumption({ assumptionId: id, threatId }),
  unlink: ({ id }, threatId) =>
    Action.UnlinkAssumption({ assumptionId: id, threatId }),
  setStatus: ({ id }, status) =>
    Action.SetAssumptionStatus({ assumptionId: id, status }),
};

type NumberedThreat = Pick<Threat, 'id' | 'number'>;

/**
 * What one record group's records are linked to: a threat, or for
 * assumptions the model. `elsewhere` says which other threats hold a record.
 */
export type RecordTarget<Held extends ThreatRecord> = {
  readonly heading:
    | 'terms.mitigations'
    | 'terms.assumptions'
    | 'terms.model-assumptions';
  readonly holds: (record: Held) => boolean;
  readonly attach: (record: Held) => Held;
  readonly link: (record: Held) => Action;
  readonly unlink: (record: Held) => Action;
  readonly elsewhere: (
    record: Held,
    threats: readonly NumberedThreat[],
    translator: StudioTranslator,
  ) => string | undefined;
};

/** The records of one kind on one threat. */
export function threatTarget<Held extends ThreatRecord>(
  kind: RecordKind<Held>,
  threatId: ThreatId,
): RecordTarget<Held> {
  return {
    heading: kind.heading,
    holds: (record) => record.threats.includes(threatId),
    attach: (record) => ({ ...record, threats: [threatId] }),
    link: (record) => kind.link(record, threatId),
    unlink: (record) => kind.unlink(record, threatId),
    elsewhere: (record, threats, translator) =>
      joined([
        alsoOn(record, threats, translator, threatId),
        'appliesToModel' in record &&
          record.appliesToModel &&
          translator.t('panel.also-applies-to-model'),
      ]),
  };
}

/** The assumptions that apply to the model. */
export const modelTarget: RecordTarget<Assumption> = {
  heading: 'terms.model-assumptions',
  holds: (assumption) => assumption.appliesToModel,
  attach: (assumption) => ({ ...assumption, appliesToModel: true }),
  link: ({ id }) => Action.LinkAssumptionToModel({ assumptionId: id }),
  unlink: ({ id }) => Action.UnlinkAssumptionFromModel({ assumptionId: id }),
  elsewhere: (assumption, threats, translator) =>
    joined([alsoOn(assumption, threats, translator)]),
};

/** The text of one part of a record. */
export function textOf(record: ThreatRecord, part: RecordPart): string {
  return part === 'title'
    ? 'title' in record
      ? record.title
      : ''
    : record.prose;
}

/** What a person calls a record: its title or the first line of its text, and its id while both are empty. */
export function recordLabel(record: ThreatRecord): string {
  return firstLine(record) ?? record.id;
}

/**
 * The records of one kind that "Link existing" offers a target: every one
 * not already linked to it, each under a label a person can tell apart and
 * a line giving its status and the threats, by number, that hold it.
 */
export function linkableRecords<Held extends ThreatRecord>(
  kind: RecordKind<Held>,
  records: readonly Held[],
  target: Pick<RecordTarget<Held>, 'holds'>,
  threats: readonly NumberedThreat[],
  translator: StudioTranslator,
): readonly { readonly record: Held; readonly text: OptionText }[] {
  return distinctTexts(
    records
      .filter((record) => !target.holds(record))
      .map((record) => ({
        id: record.id,
        label: recordLabel(record),
        unnamed: firstLine(record) === undefined,
        record,
      })),
  ).map(([{ record }, text]) => ({
    record,
    text: { ...text, detail: recordDetail(kind, record, threats, translator) },
  }));
}

function restoredRecord<Held extends ThreatRecord>(
  idSchema: Pick<z.ZodType<Held['id']>, 'safeParse'>,
  statusSchema: Pick<z.ZodType<Held['status']>, 'safeParse'>,
  fresh: () => Held,
): RecordKind<Held>['restored'] {
  return (id, status) => {
    const parsed = idSchema.safeParse(id);
    const record = fresh();
    const restoredStatus = statusSchema.safeParse(status);
    return parsed.success
      ? {
          ...record,
          id: parsed.data,
          status: restoredStatus.success ? restoredStatus.data : record.status,
        }
      : undefined;
  };
}

function recordDetail<Held extends ThreatRecord>(
  kind: RecordKind<Held>,
  record: Held,
  threats: readonly NumberedThreat[],
  { t }: StudioTranslator,
): string {
  const numbers = threatNumbers(record, threats);
  return [
    t(kind.statusMessage(record.status)),
    numbers.length > 0 &&
      t('panel.detail-threats', {
        count: numbers.length,
        list: numbers,
      }),
    'appliesToModel' in record &&
      record.appliesToModel &&
      t('panel.detail-applies-to-model'),
  ]
    .filter((part) => part !== false)
    .join(', ');
}

/**
 * `rows` in the order of the ids a group has shown, and that order with the
 * ids of rows it has not shown before appended. A shown id whose row is gone
 * keeps its slot, so the row takes it back when it returns. The order comes
 * back as `shown` itself when no row is new.
 */
export function inShownOrder<Row extends { readonly id: string }>(
  rows: readonly Row[],
  shown: readonly string[],
): { readonly rows: readonly Row[]; readonly shown: readonly string[] } {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const known = new Set(shown);
  const arrived = [...byId.keys()].filter((id) => !known.has(id));
  const order =
    arrived.length === 0 && known.size === shown.length
      ? shown
      : [...known, ...arrived];
  return {
    rows: order.flatMap((id) => byId.get(id) ?? []),
    shown: order,
  };
}

/**
 * The record `text` makes of one part of `record`, and nothing where the
 * part already holds that text, so an edit nobody made dispatches nothing.
 */
export function editedRecord<Held extends ThreatRecord>(
  kind: RecordKind<Held>,
  record: Held,
  part: RecordPart,
  text: string,
): Held | undefined {
  return textOf(record, part) === text
    ? undefined
    : kind.withText(record, part, text);
}

/** One text field of one record, and whether that record is still an empty row the model does not hold. */
export type RecordField = {
  readonly noun: RecordNoun;
  readonly part: RecordPart;
  readonly recordId: string;
  readonly pending: boolean;
};

/**
 * The name a refused draft in one text field of one record is held under.
 * A pending row's name is marked, so a draft held for it reopens the row
 * where a draft held for a record the model has since dropped does not.
 */
export function recordFieldName({
  noun,
  part,
  recordId,
  pending,
}: RecordField): RecordFieldName {
  return pending
    ? `new-${noun}/${part}/${recordId}`
    : `${noun}/${part}/${recordId}`;
}

/** The record field a held name belongs to, where it names a record of this kind. */
export function recordFieldIn(
  field: string | undefined,
  noun: RecordNoun,
): RecordField | undefined {
  for (const pending of [false, true]) {
    for (const part of recordParts) {
      const prefix = `${pending ? `new-${noun}` : noun}/${part}/`;
      if (field?.startsWith(prefix) === true) {
        return { noun, part, recordId: field.slice(prefix.length), pending };
      }
    }
  }
  return undefined;
}

/** Whether a held name names a text field of a record of this kind. */
export function isRecordField(
  field: string,
  noun: RecordNoun,
): field is RecordFieldName {
  return recordFieldIn(field, noun) !== undefined;
}

const namedThreats = 3;

function alsoOn(
  record: ThreatRecord,
  threats: readonly NumberedThreat[],
  { t }: StudioTranslator,
  except?: ThreatId,
): string | false {
  const numbers = threatNumbers(record, threats, except);
  if (numbers.length === 0) {
    return false;
  }
  const named =
    numbers.length > namedThreats + 1
      ? [
          ...numbers.slice(0, namedThreats),
          t('panel.more-threats', { count: numbers.length - namedThreats }),
        ]
      : numbers;
  return t('panel.also-on-threats', {
    count: numbers.length,
    list: named,
  });
}

function threatNumbers(
  record: ThreatRecord,
  threats: readonly NumberedThreat[],
  except?: ThreatId,
): readonly string[] {
  return inNumberOrder(
    threats.filter(({ id }) => id !== except && record.threats.includes(id)),
  ).map(({ number }) => String(number));
}

function joined(said: readonly (string | false)[]): string | undefined {
  const text = sentences(...said.filter((sentence) => sentence !== false));
  return text === '' ? undefined : text;
}

function firstLine(record: ThreatRecord): string | undefined {
  return [textOf(record, 'title'), record.prose]
    .map((text) => text.split('\n')[0].trim())
    .find((line) => line !== '');
}

function freshMitigation(): Mitigation {
  return {
    id: generateMitigationId(),
    title: '',
    prose: '',
    status: 'proposed',
    threats: [],
  };
}

function freshAssumption(): Assumption {
  return {
    id: generateAssumptionId(),
    prose: '',
    status: 'unconfirmed',
    threats: [],
    appliesToModel: false,
  };
}
