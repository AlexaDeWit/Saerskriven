import type { ModelInput } from '@saerskriven/model';
import { committedText } from '@saerskriven/model/fixtures';
import type {
  ThreatDragonDocument,
  threatDragonWireSchema,
  ThreatDragonThreat,
} from '@saerskriven/wire-threat-dragon';
import { Either } from 'effect';
import type { ReadResult } from './codec.js';
import { allCells, threatsOf } from './threat-dragon-document.js';
import { readThreatDragon } from './threat-dragon-read.js';

const linkability: ThreatDragonThreat = {
  id: 'threat-linkability',
  number: 3,
  title: 'Two records join on the operator id',
  modelType: 'LINDDUN',
  type: 'Linkability',
  status: 'NotApplicable',
  severity: 'TBD',
  description: 'The same identifier appears on both sides.',
  mitigation: 'Rotate the identifier per audience.',
};

const ethics: ThreatDragonThreat = {
  id: 'threat-ethics',
  number: 4,
  title: 'The ranking is not explained to the person it ranks',
  modelType: 'PLOT4ai',
  type: 'Ethics & Human Rights',
  status: 'Open',
  severity: 'Low',
  description: 'No recourse is offered.',
  mitigation: '',
};

/**
 * `test-data/threat-dragon/feature-complete.json`, a Threat Dragon 2.6.2 file
 * written by hand to use every construct the wire schema declares: each cell
 * shape, both curve spellings, a port on each side, a free flow end, every
 * security fact, a threat in each status, severity and enumerated category,
 * a threat nested under two cells, an Elevation of Privilege card, a gap in
 * the threat numbers, and a `threatTop` below the highest of them.
 */
export const featureCompleteText: string = committedText(
  'threat-dragon/feature-complete.json',
);

const node = (
  kind: 'actor' | 'process' | 'store',
  id: string,
  name: string,
  description: string,
  [x, y, width, height]: readonly [number, number, number, number],
) => ({
  kind,
  id,
  name,
  description,
  outOfScope: false,
  reasonOutOfScope: '',
  position: { x, y },
  size: { width, height },
});

const recorded = (
  id: string,
  number: number,
  title: string,
  category: ModelInput['threats'][number]['category'],
  severity: ModelInput['threats'][number]['severity'],
  status: ModelInput['threats'][number]['status'],
  description: string,
  elements: readonly string[],
): ModelInput['threats'][number] => ({
  id,
  number,
  title,
  category,
  severity,
  status,
  description,
  elements: [...elements],
});

const fromText = (
  threat: string,
  prose: string,
  status: 'proposed' | 'implemented',
): ModelInput['mitigations'][number] => ({
  id: `${threat}-mitigation`,
  title: '',
  prose,
  status,
  threats: [threat],
});

/**
 * The internal model a read of {@link featureCompleteText} lands as, written
 * out by hand from the file: cells in the order the file draws them, threats
 * in the order the cells nest them with the one nested twice joined into one
 * record, a mitigation record for each non-empty text in threat number
 * order, the last issued number the greater of `threatTop` 30 and the
 * highest number 40, and each security fact the file states, `false` and
 * empty ones included.
 */
export const featureCompleteModel: ModelInput = {
  metadata: {
    title: 'Clinic booking',
    owner: 'Alexandra de Wit',
    description:
      'Every construct a Threat Dragon file carries, in one small model.',
    contributors: ['Alexandra de Wit', 'Jonas Lindqvist'],
  },
  diagrams: [
    {
      id: '0',
      title: 'Booking',
      elements: [
        {
          kind: 'trust-boundary',
          id: 'zone-clinic',
          name: 'Clinic network',
          description: 'Hosts the clinic runs.',
          outOfScope: false,
          reasonOutOfScope: '',
          containedElements: ['process-booking', 'store-appointments'],
          crossingFlows: ['flow-request'],
          shape: {
            kind: 'box',
            position: { x: 220, y: 20 },
            size: { width: 620, height: 420 },
          },
        },
        {
          ...node(
            'actor',
            'actor-patient',
            'Patient',
            'Books appointments from a phone.',
            [20, 180, 140, 80],
          ),
          providesAuthentication: false,
        },
        {
          ...node(
            'process',
            'process-booking',
            'Booking service',
            'Takes bookings and payment.',
            [320, 160, 120, 120],
          ),
          handlesCardPayment: true,
          handlesGoodsOrServices: false,
          isWebApplication: true,
          privilegeLevel: 'service account',
        },
        {
          ...node(
            'store',
            'store-appointments',
            'Appointments',
            'Every booking, past and upcoming.',
            [600, 170, 160, 80],
          ),
          isALog: false,
          isEncrypted: true,
          isSigned: false,
          storesCredentials: false,
          storesInventory: true,
        },
        {
          ...node(
            'store',
            'store-archive',
            'Paper archive',
            '',
            [600, 520, 160, 80],
          ),
          outOfScope: true,
          reasonOutOfScope: 'Held by the records office.',
          isALog: true,
          isSigned: true,
          storesCredentials: true,
        },
        {
          kind: 'text',
          id: 'note-hours',
          name: '',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          position: { x: 20, y: 20 },
          size: { width: 180, height: 60 },
          text: 'Open 8 to 18 on weekdays',
        },
        {
          kind: 'flow',
          id: 'flow-request',
          name: 'Book appointment',
          description: 'The booking form, sent over the internet.',
          outOfScope: false,
          reasonOutOfScope: '',
          protocol: 'HTTPS',
          isEncrypted: true,
          isPublicNetwork: true,
          trustBoundaryIds: ['zone-clinic'],
          source: { kind: 'attached', element: 'actor-patient', side: 'right' },
          target: {
            kind: 'attached',
            element: 'process-booking',
            side: 'left',
          },
          waypoints: [{ x: 240, y: 210 }],
          bidirectional: false,
        },
        {
          kind: 'flow',
          id: 'flow-sync',
          name: 'Sync appointments',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          protocol: '',
          isEncrypted: false,
          isPublicNetwork: false,
          trustBoundaryIds: [],
          source: {
            kind: 'attached',
            element: 'process-booking',
            side: 'bottom',
          },
          target: {
            kind: 'attached',
            element: 'store-appointments',
            side: 'top',
          },
          waypoints: [],
          bidirectional: true,
        },
        {
          kind: 'flow',
          id: 'flow-feed',
          name: 'Holiday feed',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          source: { kind: 'free', position: { x: 880, y: 60 } },
          target: { kind: 'attached', element: 'store-appointments' },
          waypoints: [
            { x: 860, y: 120 },
            { x: 800, y: 150 },
          ],
          bidirectional: false,
        },
      ],
    },
    {
      id: '1',
      title: 'Records',
      elements: [
        {
          kind: 'trust-boundary',
          id: 'boundary-records',
          name: 'Records office',
          description: 'Where paper records are kept.',
          outOfScope: false,
          reasonOutOfScope: '',
          containedElements: ['process-records'],
          crossingFlows: [],
          shape: {
            kind: 'curve',
            waypoints: [
              { x: 0, y: 300 },
              { x: 200, y: 340 },
              { x: 400, y: 300 },
            ],
          },
        },
        {
          kind: 'trust-boundary',
          id: 'boundary-legacy',
          name: 'Legacy zone',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          shape: {
            kind: 'curve',
            waypoints: [
              { x: 0, y: 40 },
              { x: 400, y: 40 },
            ],
          },
        },
        {
          ...node(
            'process',
            'process-records',
            'Records desk',
            'Answers requests for records.',
            [120, 120, 120, 120],
          ),
          handlesGoodsOrServices: true,
        },
        {
          ...node('actor', 'actor-clerk', 'Clerk', '', [320, 120, 140, 80]),
          providesAuthentication: true,
        },
      ],
    },
  ],
  threats: [
    recorded(
      'threat-spoofing',
      1,
      "Someone books under another patient's name",
      { methodology: 'STRIDE', category: 'spoofing' },
      'high',
      'open',
      'A booking asks for a name and a birth date alone.',
      ['actor-patient'],
    ),
    recorded(
      'threat-repudiation',
      2,
      'A patient denies a booking they made',
      { methodology: 'STRIDE', category: 'repudiation' },
      'medium',
      'mitigated',
      'No-show fees are disputed.',
      ['actor-patient'],
    ),
    recorded(
      'threat-tampering',
      3,
      'The fee is altered on its way to payment',
      { methodology: 'STRIDE', category: 'tampering' },
      'critical',
      'transferred',
      'The fee travels in a form field.',
      ['process-booking'],
    ),
    recorded(
      'threat-elevation',
      4,
      'The service account can change clinic settings',
      { methodology: 'STRIDE', category: 'elevation-of-privilege' },
      'low',
      'avoided',
      'One account serves bookings and settings.',
      ['process-booking'],
    ),
    recorded(
      'threat-denial',
      5,
      'Bulk bookings fill every slot',
      { methodology: 'STRIDE', category: 'denial-of-service' },
      'undecided',
      'accepted-risk',
      'Nothing limits bookings per patient.',
      ['process-booking'],
    ),
    recorded(
      'threat-disclosure',
      6,
      'A backup exposes appointment reasons',
      { methodology: 'STRIDE', category: 'information-disclosure' },
      'high',
      'eliminated',
      'Backups were copied to a shared drive.',
      ['store-appointments'],
    ),
    recorded(
      'threat-cia-confidentiality',
      8,
      'The booking form is read in transit',
      { methodology: 'CIA', category: 'confidentiality' },
      'medium',
      'not-applicable',
      'The form travels over TLS.',
      ['flow-request'],
    ),
    recorded(
      'threat-cia-integrity',
      9,
      'A booking changes after it is confirmed',
      { methodology: 'CIA', category: 'integrity' },
      'low',
      'open',
      'Nothing signs a confirmed booking.',
      ['flow-request'],
    ),
    recorded(
      'threat-cia-availability',
      10,
      'The booking form is down during a release',
      { methodology: 'CIA', category: 'availability' },
      'high',
      'mitigated',
      'Releases take the only host offline.',
      ['flow-request'],
    ),
    recorded(
      'threat-die-confidentiality',
      11,
      'Sync traffic is readable on the clinic network',
      { methodology: 'CIA-DIE', category: 'confidentiality' },
      'medium',
      'open',
      'The sync runs without TLS.',
      ['flow-sync'],
    ),
    recorded(
      'threat-die-integrity',
      12,
      'A sync overwrites a newer booking',
      { methodology: 'CIA-DIE', category: 'integrity' },
      'high',
      'mitigated',
      'The last write wins.',
      ['flow-sync'],
    ),
    recorded(
      'threat-die-availability',
      13,
      'The store is unreachable during a sync',
      { methodology: 'CIA-DIE', category: 'availability' },
      'low',
      'accepted-risk',
      'The sync locks the table.',
      ['flow-sync'],
    ),
    recorded(
      'threat-die-distributed',
      14,
      'Every copy sits on one host',
      { methodology: 'CIA-DIE', category: 'distributed' },
      'critical',
      'open',
      'The store has no replica.',
      ['flow-sync'],
    ),
    recorded(
      'threat-die-immutable',
      15,
      'A sync can rewrite a past appointment',
      { methodology: 'CIA-DIE', category: 'immutable' },
      'medium',
      'transferred',
      'Past bookings are editable.',
      ['flow-sync'],
    ),
    recorded(
      'threat-die-ephemeral',
      16,
      'Sync credentials never expire',
      { methodology: 'CIA-DIE', category: 'ephemeral' },
      'undecided',
      'avoided',
      'The sync uses a long-lived key.',
      ['flow-sync'],
    ),
    recorded(
      'threat-linkability',
      17,
      'Bookings link a patient across clinics',
      { methodology: 'LINDDUN', category: 'linking' },
      'medium',
      'open',
      'The same patient number is used at every clinic.',
      ['process-records', 'actor-clerk'],
    ),
    recorded(
      'threat-identifiability',
      18,
      'A request log names the patient behind a pseudonym',
      { methodology: 'LINDDUN', category: 'identifying' },
      'high',
      'mitigated',
      'The log keeps the full name.',
      ['process-records'],
    ),
    recorded(
      'threat-non-repudiation',
      19,
      'A signed request leaves a patient no deniability',
      { methodology: 'LINDDUN', category: 'non-repudiation' },
      'low',
      'not-applicable',
      'Requests are not signed.',
      ['process-records'],
    ),
    recorded(
      'threat-detectability',
      20,
      'Response times show that a record exists',
      { methodology: 'LINDDUN', category: 'detecting' },
      'low',
      'open',
      'A hit is slower than a miss.',
      ['process-records'],
    ),
    recorded(
      'threat-data-disclosure',
      21,
      'A copy of a record includes other patients',
      { methodology: 'LINDDUN', category: 'data-disclosure' },
      'critical',
      'eliminated',
      'Copies were made page by page.',
      ['process-records'],
    ),
    recorded(
      'threat-unawareness',
      22,
      'Patients are not told what the desk keeps',
      { methodology: 'LINDDUN', category: 'unawareness' },
      'medium',
      'accepted-risk',
      'No notice describes the request log.',
      ['process-records'],
    ),
    recorded(
      'threat-non-compliance',
      23,
      'Records are kept past their retention period',
      { methodology: 'LINDDUN', category: 'non-compliance' },
      'high',
      'transferred',
      'Nobody reviews the archive.',
      ['process-records'],
    ),
    recorded(
      'threat-ethics',
      24,
      'A patient cannot ask why a request was refused',
      {
        methodology: 'custom',
        methodologyName: 'PLOT4ai',
        category: 'Ethics & Human Rights',
      },
      'medium',
      'open',
      'Refusals carry no reason.',
      ['actor-clerk'],
    ),
    recorded(
      'threat-card',
      40,
      "The clerk's session token is guessable",
      {
        methodology: 'custom',
        methodologyName: 'EOP',
        category: 'Authentication',
      },
      'medium',
      'open',
      'Found in a Cornucopia session.',
      ['actor-clerk'],
    ),
  ],
  lastIssuedThreatNumber: 40,
  mitigations: [
    fromText(
      'threat-spoofing',
      'Send a one-time code to the phone on file.',
      'proposed',
    ),
    fromText(
      'threat-repudiation',
      'Record every booking with its session.\n\nKeep the record for a year.',
      'implemented',
    ),
    fromText(
      'threat-elevation',
      'Split the settings into their own service.',
      'proposed',
    ),
    fromText(
      'threat-disclosure',
      'Stop copying backups off the host.',
      'proposed',
    ),
    fromText(
      'threat-cia-availability',
      'Serve the form from two hosts.',
      'implemented',
    ),
    fromText(
      'threat-die-confidentiality',
      'Turn TLS on for the sync.',
      'proposed',
    ),
    fromText(
      'threat-die-integrity',
      'Compare versions before a write.',
      'implemented',
    ),
    fromText('threat-die-ephemeral', 'Issue a key per sync.', 'proposed'),
    fromText('threat-linkability', 'Issue a number per clinic.', 'proposed'),
    fromText(
      'threat-identifiability',
      'Log the pseudonym alone.',
      'implemented',
    ),
    fromText(
      'threat-data-disclosure',
      'Print from the record alone.',
      'proposed',
    ),
    fromText(
      'threat-non-compliance',
      'Review the archive every year.',
      'proposed',
    ),
    fromText('threat-ethics', 'Write the reason on every refusal.', 'proposed'),
  ],
  assumptions: [],
};

/**
 * A Threat Dragon document stamped `2.0.0`, holding boundary curves under
 * both the correct shape name and the misspelling Threat Dragon registers
 * for compatibility, a boundary named in `data` and another named nowhere,
 * one threat nested under two cells, a methodology that reaches the model as
 * a custom category, a contributor with no name, a cell whose `data` holds
 * nothing but its type, and a diagram with no cells at all. A read of it is
 * also evidence that the version pin accepts the major rather than one
 * release.
 */
export const complementFixture: ThreatDragonDocument = {
  version: '2.0.0',
  summary: { title: 'Complement', id: 'model-1' },
  detail: {
    contributors: [{ name: 'Alexandra de Wit' }, {}],
    diagrams: [
      {
        id: 4,
        title: 'Curves and defaults',
        diagramType: 'LINDDUN',
        version: '2.0.0',
        cells: [
          {
            id: 'boundary-curve',
            shape: 'trust-boundary-curve',
            data: {
              type: 'tm.Boundary',
              name: 'Operator zone',
              description: 'Drawn freehand.',
            },
            attrs: { label: { text: 'Operator zone, as drawn' } },
            source: { x: 0, y: 0 },
            target: { x: 40, y: 40 },
            vertices: [{ x: 20, y: 10 }],
          },
          {
            id: 'boundary-typo',
            shape: 'trust-broundary-curve',
            data: { type: 'tm.Boundary' },
            source: { x: 0, y: 60 },
            target: { x: 40, y: 60 },
          },
          {
            id: 'actor-1',
            shape: 'actor',
            position: { x: 0, y: 0 },
            size: { width: 100, height: 60 },
            data: {
              type: 'tm.Actor',
              name: 'Operator',
              threats: [linkability],
            },
          },
          {
            id: 'store-1',
            shape: 'store',
            position: { x: 200, y: 0 },
            size: { width: 100, height: 60 },
            data: { type: 'tm.Store', threats: [linkability, ethics] },
          },
          {
            id: 'flow-1',
            shape: 'flow',
            data: { type: 'tm.Flow', name: 'reads' },
            source: { cell: 'actor-1' },
            target: { cell: 'store-1' },
          },
        ],
      },
      { id: 5, title: 'Nothing drawn yet', diagramType: 'STRIDE' },
    ],
  },
};

const textThreat = (
  id: string,
  number: number,
  status: string,
  mitigation: string,
): ThreatDragonThreat => ({
  id,
  number,
  title: '',
  modelType: 'STRIDE',
  type: 'Tampering',
  status,
  severity: 'Low',
  description: '',
  mitigation,
});

/**
 * The mitigation text a Threat Dragon threat holds in each shape a read and
 * a write must keep to the byte: a mitigated threat whose text carries a
 * blank line, a carriage return and trailing spaces, an open threat with one
 * line, and an open threat with no text. Written by the release this codec
 * writes, so a merge onto it stamps nothing.
 */
export const mitigationTextFixture: ThreatDragonDocument = {
  version: '2.6.2',
  summary: { title: 'Mitigation text' },
  detail: {
    threatTop: 3,
    diagrams: [
      {
        id: 0,
        title: '',
        diagramType: 'STRIDE',
        version: '2.6.2',
        cells: [
          {
            id: 'process-1',
            shape: 'process',
            position: { x: 0, y: 0 },
            size: { width: 100, height: 60 },
            data: {
              type: 'tm.Process',
              threats: [
                textThreat(
                  'threat-mitigated',
                  1,
                  'Mitigated',
                  'Rotate the key.\n\nRevoke it on leave.\r\n  ',
                ),
                textThreat(
                  'threat-open',
                  2,
                  'Open',
                  'Rate limit the endpoint.',
                ),
                textThreat('threat-empty', 3, 'Open', ''),
              ],
            },
          },
        ],
      },
    ],
  },
};

/**
 * A Threat Dragon document holding nothing the format does not require, so
 * a read of it is a read of the defaults. Stamped with a 2.x release Threat
 * Dragon never shipped, which the version pin accepts all the same.
 */
export const minimalFixture: ThreatDragonDocument = {
  version: '2.9.13',
  summary: { title: 'Nothing but a title' },
  detail: { diagrams: [] },
};

/**
 * A Threat Dragon document holding what Threat Dragon writes and the
 * internal model has no home for: a text block, a threat with no number, a
 * severity outside the five the editor offers, a category label in the
 * author's own locale, and an EOP threat whose type is null and whose
 * identity is a playing card. Stamped `2.0`, the two-part version Threat
 * Dragon's own models carry. The wire schema reads all of it, and how any
 * of it reaches the model is not settled.
 */
export const unmodelledFixture: ThreatDragonDocument = {
  version: '2.0',
  summary: { title: 'Beyond the model' },
  detail: {
    diagrams: [
      {
        id: 0,
        title: 'Zahlungen',
        diagramType: 'STRIDE',
        version: '2.0',
        cells: [
          {
            id: 'text-1',
            shape: 'td-text-block',
            position: { x: 0, y: 0 },
            size: { width: 200, height: 100 },
            visible: true,
            attrs: { text: { text: 'Arbitrary Text' } },
            data: {
              type: 'tm.Text',
              name: 'Arbitrary Text',
              hasOpenThreats: false,
            },
          },
          {
            id: 'text-2',
            shape: 'td-text-block',
            position: { x: 0, y: 120 },
            size: { width: 200, height: 40 },
            attrs: { text: { text: 'Drawn before the note carried a name' } },
            data: { type: 'tm.Text' },
          },
          {
            id: 'text-3',
            shape: 'td-text-block',
            position: { x: 0, y: 180 },
            size: { width: 200, height: 40 },
            data: { type: 'tm.Text' },
          },
          {
            id: 'process-1',
            shape: 'process',
            position: { x: 0, y: 200 },
            size: { width: 100, height: 100 },
            data: {
              type: 'tm.Process',
              name: 'Zahlungsdienst',
              threats: [
                {
                  id: 'threat-translated',
                  title: 'Manipulation der Anfrage',
                  modelType: 'STRIDE',
                  type: 'Manipulation',
                  status: 'Accepted',
                  severity: 'TBA',
                  description: '',
                  mitigation: '',
                },
                {
                  id: 'threat-unplaceable',
                  title: 'Recorded under a vocabulary of its own',
                  modelType: 'STRIDE',
                  type: 'F\u00e4lschung',
                  status: 'Deferred',
                  severity: 'Catastrophic',
                  description: '',
                  mitigation: '',
                },
                {
                  id: 'threat-card',
                  number: 4,
                  title: 'The attacker reads the session token',
                  modelType: 'EOP',
                  type: null,
                  eopGameId: 'cornucopia',
                  cardSuit: 'Data Validation & Encoding',
                  cardNumber: '3',
                  status: 'Open',
                  severity: 'TBD',
                  description: '',
                  mitigation: '',
                  new: true,
                  score: '',
                },
              ],
            },
          },
        ],
      },
    ],
  },
};

/**
 * A model holding what Threat Dragon has no place for, so that a write of
 * it reports every reason a write can report: threats attached to two
 * elements at once, to a trust boundary, and to nothing at all, a PLOT4ai
 * category from the eight the model enumerates rather than the eight Threat
 * Dragon ships, a note carrying a name beside its text, an out-of-scope
 * trust boundary, a diagram named rather than numbered, a titled mitigation
 * record, which the format's one text per threat narrows, and an assumption
 * record the format keeps none of. Every extent is 10 or more and every
 * coordinate is whole, which is what Threat Dragon's own JSON Schema demands
 * of a diagram it will open.
 */
export const richerThanFormatFixture: ModelInput = {
  metadata: {
    title: 'Ledger',
    owner: 'Alexandra de Wit',
    description: 'Richer than the format it is written to.',
    contributors: ['Alexandra de Wit', 'Jonas Lindqvist'],
  },
  diagrams: [
    {
      id: '0',
      title: 'Ledger flows',
      elements: [
        {
          kind: 'actor',
          id: 'element-clerk',
          name: 'Clerk',
          description: 'Posts entries by hand.',
          outOfScope: false,
          reasonOutOfScope: '',
          position: { x: 40, y: 40 },
          size: { width: 160, height: 80 },
        },
        {
          kind: 'process',
          id: 'element-ledger',
          name: 'Ledger service',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          position: { x: 320, y: 40 },
          size: { width: 160, height: 80 },
        },
        {
          kind: 'store',
          id: 'element-vault',
          name: 'Entry vault',
          description: '',
          outOfScope: true,
          reasonOutOfScope: 'Operated by the records department.',
          position: { x: 600, y: 40 },
          size: { width: 160, height: 80 },
        },
        {
          kind: 'flow',
          id: 'element-post',
          name: 'Post entry',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          source: { kind: 'attached', element: 'element-clerk' },
          target: { kind: 'free', position: { x: 300, y: 200 } },
          waypoints: [{ x: 220, y: 120 }],
          bidirectional: false,
        },
        {
          kind: 'trust-boundary',
          id: 'element-zone',
          name: 'Records zone',
          description: '',
          outOfScope: true,
          reasonOutOfScope: 'Drawn for context alone.',
          shape: {
            kind: 'box',
            position: { x: 560, y: 10 },
            size: { width: 240, height: 140 },
          },
        },
        {
          kind: 'text',
          id: 'element-note',
          name: 'Review note',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          position: { x: 40, y: 240 },
          size: { width: 200, height: 40 },
          text: 'Reviewed in August.',
        },
      ],
    },
    {
      id: 'perimeter-review',
      title: 'Perimeter review',
      elements: [
        {
          kind: 'trust-boundary',
          id: 'element-perimeter',
          name: 'Perimeter',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          shape: {
            kind: 'curve',
            waypoints: [
              { x: 0, y: 0 },
              { x: 40, y: 20 },
              { x: 80, y: 0 },
            ],
          },
        },
      ],
    },
  ],
  threats: [
    {
      id: 'threat-split',
      number: 1,
      title: 'An entry is altered between the service and the vault',
      category: { methodology: 'STRIDE', category: 'tampering' },
      severity: 'high',
      status: 'open',
      description: 'Nothing signs an entry on its way to storage.',
      elements: ['element-ledger', 'element-vault'],
    },
    {
      id: 'threat-privacy',
      number: 2,
      title: 'The clerk terminal is not hardened',
      category: { methodology: 'PLOT4ai', category: 'cybersecurity' },
      severity: 'medium',
      status: 'mitigated',
      description: 'The terminal runs unattended.',
      elements: ['element-clerk'],
    },
    {
      id: 'threat-zone',
      number: 3,
      title: 'The records zone outlives its purpose',
      category: { methodology: 'CIA-DIE', category: 'ephemeral' },
      severity: 'low',
      status: 'accepted-risk',
      description: 'Nobody retires the zone.',
      elements: ['element-zone'],
    },
    {
      id: 'threat-unattached',
      number: 5,
      title: 'The model falls behind the system',
      category: {
        methodology: 'custom',
        methodologyName: 'Process',
        category: 'documentation',
      },
      severity: 'undecided',
      status: 'open',
      description: 'The diagrams are not reviewed with a release.',
      elements: [],
    },
  ],
  lastIssuedThreatNumber: 9,
  mitigations: [
    {
      id: 'mitigation-sign-entries',
      title: 'Sign every entry',
      prose: 'The service signs an entry before the vault accepts it.',
      status: 'proposed',
      threats: ['threat-split'],
    },
    {
      id: 'threat-privacy-mitigation',
      title: '',
      prose: 'Lock the session after a minute.',
      status: 'implemented',
      threats: ['threat-privacy'],
    },
  ],
  assumptions: [
    {
      id: 'assumption-vault-audited',
      prose: 'The vault is audited every year.',
      status: 'valid',
      threats: ['threat-split'],
      appliesToModel: false,
    },
  ],
};

/**
 * A Threat Dragon document the model above can be merged onto: written by a
 * release this codec does not stamp, carrying styling and ports the model
 * never holds, a diagram and a cell and a threat an edit has since removed,
 * and a threat high-water mark below the model's own.
 */
export const richerThanFormatSource: ThreatDragonDocument = {
  version: '2.0.0',
  summary: { title: 'Ledger', id: 4, tags: ['finance'] },
  detail: {
    contributors: [{ name: 'Alexandra de Wit' }],
    reviewer: 'Jonas Lindqvist',
    diagramTop: 8,
    threatTop: 3,
    diagrams: [
      {
        id: 0,
        title: 'Ledger flows',
        diagramType: 'STRIDE',
        thumbnail: './public/content/images/thumbnail.stride.jpg',
        version: '2.0.0',
        cells: [
          {
            id: 'element-clerk',
            shape: 'actor',
            zIndex: 4,
            position: { x: 40, y: 40 },
            size: { width: 160, height: 80 },
            attrs: {
              body: {
                stroke: '#333333',
                strokeWidth: 1.5,
                strokeDasharray: null,
              },
            },
            ports: { items: [{ group: 'top', id: 'port-1' }] },
            data: {
              type: 'tm.Actor',
              name: 'Clerk',
              description: 'Posts entries by hand.',
              hasOpenThreats: true,
              providesAuthentication: true,
              threats: [
                {
                  id: 'threat-gone',
                  number: 3,
                  title: 'A threat an edit has since removed',
                  modelType: 'STRIDE',
                  type: 'Spoofing',
                  status: 'Open',
                  severity: 'High',
                  description: '',
                  mitigation: '',
                },
                {
                  id: 'threat-privacy',
                  number: 2,
                  title: 'The clerk terminal is not hardened',
                  modelType: 'STRIDE',
                  type: 'Tampering',
                  status: 'Mitigated',
                  severity: 'Medium',
                  description: 'The terminal runs unattended.',
                  mitigation: 'Lock the session after a minute.',
                  score: '7',
                },
              ],
            },
          },
          {
            id: 'element-gone',
            shape: 'store',
            zIndex: 5,
            position: { x: 900, y: 40 },
            size: { width: 160, height: 80 },
            data: { type: 'tm.Store', name: 'A store an edit removed' },
          },
        ],
      },
      {
        id: 7,
        title: 'An older sketch',
        diagramType: 'STRIDE',
        thumbnail: './public/content/images/thumbnail.stride.jpg',
        version: '2.0.0',
      },
    ],
  },
};

/** Every threat of a document, in the order its cells nest them. */
export function allThreats(
  document: ThreatDragonDocument,
): readonly ThreatDragonThreat[] {
  return allCells(document).flatMap(threatsOf);
}

/** What the Threat Dragon read makes of a text, throwing where it refuses one. */
export const threatDragonReading = (
  text: string,
): ReadResult<typeof threatDragonWireSchema> =>
  Either.getOrThrowWith(
    readThreatDragon(text),
    (failure) =>
      new Error(`The Threat Dragon codec refused a text: ${failure._tag}`),
  );
