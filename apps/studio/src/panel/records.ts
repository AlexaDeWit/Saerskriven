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
import { sectionLabel } from '@saerskriven/render';
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
 * What a record group needs to know about one kind of record: where the
 * model holds it, the text it carries, its statuses and the one it starts
 * in, and the store action for each edit. A fresh or restored record links
 * nothing until a {@link RecordTarget} attaches it.
 */
export type RecordKind<Held extends ThreatRecord> = {
  readonly noun: RecordNoun;
  readonly title: string;
  readonly heading: string;
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

/** Mitigations, which start `proposed`. */
export const mitigationKind: RecordKind<Mitigation> = {
  noun: 'mitigation',
  title: 'Mitigation',
  heading: 'Mitigations',
  parts: ['title', 'prose'],
  statuses: mitigationStatusSchema.options,
  held: (model) => model.mitigations,
  fresh: () => ({
    id: generateMitigationId(),
    title: '',
    prose: '',
    status: 'proposed',
    threats: [],
  }),
  restored: (id, status) => {
    const parsed = mitigationIdSchema.safeParse(id);
    const fresh = mitigationKind.fresh();
    return parsed.success
      ? {
          ...fresh,
          id: parsed.data,
          status: mitigationStatusSchema.catch(fresh.status).parse(status),
        }
      : undefined;
  },
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
  title: 'Assumption',
  heading: 'Assumptions',
  parts: ['prose'],
  statuses: assumptionStatusSchema.options,
  held: (model) => model.assumptions,
  fresh: () => ({
    id: generateAssumptionId(),
    prose: '',
    status: 'unconfirmed',
    threats: [],
    appliesToModel: false,
  }),
  restored: (id, status) => {
    const parsed = assumptionIdSchema.safeParse(id);
    const fresh = assumptionKind.fresh();
    return parsed.success
      ? {
          ...fresh,
          id: parsed.data,
          status: assumptionStatusSchema.catch(fresh.status).parse(status),
        }
      : undefined;
  },
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

/** A threat as a shared row names it. */
export type NumberedThreat = Pick<Threat, 'id' | 'number'>;

/**
 * What one record group's records are linked to: a threat, or for
 * assumptions the model. It heads the group, says which records the group
 * holds, links a new record to itself, gives the store action that links or
 * unlinks one, and says where else a record is referenced by threat number,
 * which describes the unlink control.
 */
export type RecordTarget<Held extends ThreatRecord> = {
  readonly heading: string;
  readonly holds: (record: Held) => boolean;
  readonly attach: (record: Held) => Held;
  readonly link: (record: Held) => Action;
  readonly unlink: (record: Held) => Action;
  readonly elsewhere: (
    record: Held,
    threats: readonly NumberedThreat[],
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
    elsewhere: (record, threats) =>
      joined([
        alsoOn(record, threats, threatId),
        'appliesToModel' in record &&
          record.appliesToModel &&
          'Also applies to the model.',
      ]),
  };
}

/** The assumptions that apply to the model. */
export const modelTarget: RecordTarget<Assumption> = {
  heading: sectionLabel('model-assumptions'),
  holds: (assumption) => assumption.appliesToModel,
  attach: (assumption) => ({ ...assumption, appliesToModel: true }),
  link: ({ id }) => Action.LinkAssumptionToModel({ assumptionId: id }),
  unlink: ({ id }) => Action.UnlinkAssumptionFromModel({ assumptionId: id }),
  elsewhere: (assumption, threats) => joined([alsoOn(assumption, threats)]),
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
  records: readonly Held[],
  target: Pick<RecordTarget<Held>, 'holds'>,
  threats: readonly NumberedThreat[],
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
    text: { ...text, detail: recordDetail(record, threats) },
  }));
}

function recordDetail(
  record: ThreatRecord,
  threats: readonly NumberedThreat[],
): string {
  const numbers = threatNumbers(record, threats);
  return [
    record.status,
    numbers.length > 0 && `${threatWord(numbers.length)} ${numbers.join(', ')}`,
    'appliesToModel' in record &&
      record.appliesToModel &&
      'applies to the model',
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
          `${String(numbers.length - namedThreats)} more`,
        ]
      : numbers;
  return `Also on ${threatWord(numbers.length)} ${listed(named)}.`;
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

function threatWord(count: number): string {
  return count === 1 ? 'threat' : 'threats';
}

function listed(items: readonly string[]): string {
  return items.length === 1
    ? items[0]
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function joined(sentences: readonly (string | false)[]): string | undefined {
  const said = sentences.filter((sentence) => sentence !== false);
  return said.length === 0 ? undefined : said.join(' ');
}

function firstLine(record: ThreatRecord): string | undefined {
  return [textOf(record, 'title'), record.prose]
    .map((text) => text.split('\n')[0].trim())
    .find((line) => line !== '');
}
