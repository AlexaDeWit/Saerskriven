import type { ModelInput } from '@saerskriven/model';
import type { SaerskrivenYamlDocument } from '@saerskriven/wire-saerskriven-yaml';
import {
  committedText,
  repositoryRoot,
  testDataPath,
} from '@saerskriven/model/fixtures';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const featureCompletePath = testDataPath('saerskriven/feature-complete.yaml');

/**
 * `test-data/saerskriven/feature-complete.yaml`, a version 2 file written by
 * hand to use every construct the wire schema declares, in the writer's
 * canonical form: each element kind with every security fact it can state,
 * both endpoint kinds and a side of each name, both boundary shapes, a threat
 * in every status, severity and category, a mitigation in every status, and
 * an assumption in every status, one of them applying to the model.
 */
export const featureCompleteYaml: string = committedText(
  'saerskriven/feature-complete.yaml',
);

/**
 * The model {@link featureCompleteYaml} states, written out by hand: two
 * diagrams in the order the file draws them, threats in number order up to
 * 40 with the last issued number 42, and every security fact the file
 * states, `false` and empty ones included.
 */
export const featureCompleteYamlModel: ModelInput = {
  metadata: {
    title: 'Clinic booking',
    owner: 'Alexandra de Wit',
    description:
      'Every construct a Saerskriven YAML file carries, in one small model.',
    contributors: ['Alexandra de Wit', 'Jonas Lindqvist'],
  },
  diagrams: [
    {
      id: 'diagram-booking',
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
            position: {
              x: 220,
              y: 20,
            },
            size: {
              width: 620,
              height: 420,
            },
          },
        },
        {
          kind: 'actor',
          id: 'actor-patient',
          name: 'Patient',
          description: 'Books appointments from a phone.',
          outOfScope: false,
          reasonOutOfScope: '',
          position: {
            x: 20,
            y: 180,
          },
          size: {
            width: 140,
            height: 80,
          },
          providesAuthentication: false,
        },
        {
          kind: 'process',
          id: 'process-booking',
          name: 'Booking service',
          description: 'Takes bookings and payment.',
          outOfScope: false,
          reasonOutOfScope: '',
          position: {
            x: 320,
            y: 160,
          },
          size: {
            width: 120,
            height: 120,
          },
          handlesCardPayment: true,
          handlesGoodsOrServices: false,
          isWebApplication: true,
          privilegeLevel: 'service account',
        },
        {
          kind: 'store',
          id: 'store-appointments',
          name: 'Appointments',
          description: 'Every booking, past and upcoming.',
          outOfScope: false,
          reasonOutOfScope: '',
          position: {
            x: 600,
            y: 170,
          },
          size: {
            width: 160,
            height: 80,
          },
          isALog: false,
          isEncrypted: true,
          isSigned: false,
          storesCredentials: false,
          storesInventory: true,
        },
        {
          kind: 'store',
          id: 'store-archive',
          name: 'Paper archive',
          description: '',
          outOfScope: true,
          reasonOutOfScope: 'Held by the records office.',
          position: {
            x: 600,
            y: 520,
          },
          size: {
            width: 160,
            height: 80,
          },
          isALog: true,
          isSigned: true,
          storesCredentials: true,
        },
        {
          kind: 'text',
          id: 'note-hours',
          name: 'Opening hours',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          position: {
            x: 20,
            y: 20,
          },
          size: {
            width: 180,
            height: 60,
          },
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
          source: {
            kind: 'attached',
            element: 'actor-patient',
            side: 'right',
          },
          target: {
            kind: 'attached',
            element: 'process-booking',
            side: 'left',
          },
          waypoints: [
            {
              x: 240,
              y: 210,
            },
          ],
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
          source: {
            kind: 'free',
            position: {
              x: 880.5,
              y: -60,
            },
          },
          target: {
            kind: 'attached',
            element: 'store-appointments',
          },
          waypoints: [
            {
              x: 860,
              y: 120,
            },
            {
              x: 800,
              y: 150,
            },
          ],
          bidirectional: false,
        },
      ],
    },
    {
      id: 'diagram-records',
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
              {
                x: 0,
                y: 300,
              },
              {
                x: 200,
                y: 340,
              },
              {
                x: 400,
                y: 300,
              },
            ],
          },
        },
        {
          kind: 'process',
          id: 'process-records',
          name: 'Records desk',
          description: 'Answers requests for records.',
          outOfScope: false,
          reasonOutOfScope: '',
          position: {
            x: 120,
            y: 120,
          },
          size: {
            width: 120,
            height: 120,
          },
          handlesGoodsOrServices: true,
        },
        {
          kind: 'actor',
          id: 'actor-clerk',
          name: 'Clerk',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          position: {
            x: 320,
            y: 120,
          },
          size: {
            width: 140,
            height: 80,
          },
          providesAuthentication: true,
        },
      ],
    },
  ],
  threats: [
    {
      id: 'threat-spoofing',
      number: 1,
      title: "Someone books under another patient's name",
      category: {
        methodology: 'STRIDE',
        category: 'spoofing',
      },
      severity: 'high',
      status: 'open',
      description: 'A booking asks for a name and a birth date alone.',
      elements: ['actor-patient'],
    },
    {
      id: 'threat-repudiation',
      number: 2,
      title: 'A patient denies a booking they made',
      category: {
        methodology: 'STRIDE',
        category: 'repudiation',
      },
      severity: 'medium',
      status: 'mitigated',
      description: 'No-show fees are disputed.',
      elements: ['actor-patient'],
    },
    {
      id: 'threat-tampering',
      number: 3,
      title: 'The fee is altered on its way to payment',
      category: {
        methodology: 'STRIDE',
        category: 'tampering',
      },
      severity: 'critical',
      status: 'transferred',
      description: 'The fee travels in a form field.',
      elements: ['process-booking', 'flow-request'],
    },
    {
      id: 'threat-elevation',
      number: 4,
      title: 'The service account can change clinic settings',
      category: {
        methodology: 'STRIDE',
        category: 'elevation-of-privilege',
      },
      severity: 'low',
      status: 'avoided',
      description: 'One account serves bookings and settings.',
      elements: ['process-booking'],
    },
    {
      id: 'threat-denial',
      number: 5,
      title: 'Bulk bookings fill every slot',
      category: {
        methodology: 'STRIDE',
        category: 'denial-of-service',
      },
      severity: 'undecided',
      status: 'accepted-risk',
      description: 'Nothing limits bookings per patient.',
      elements: ['process-booking'],
    },
    {
      id: 'threat-disclosure',
      number: 6,
      title: 'A backup exposes appointment reasons',
      category: {
        methodology: 'STRIDE',
        category: 'information-disclosure',
      },
      severity: 'high',
      status: 'eliminated',
      description: 'Backups were copied to a shared drive.',
      elements: ['store-appointments'],
    },
    {
      id: 'threat-cia-confidentiality',
      number: 8,
      title: 'The booking form is read in transit',
      category: {
        methodology: 'CIA',
        category: 'confidentiality',
      },
      severity: 'medium',
      status: 'not-applicable',
      description: 'The form travels over TLS.',
      elements: ['flow-request'],
    },
    {
      id: 'threat-cia-integrity',
      number: 9,
      title: 'A booking changes after it is confirmed',
      category: {
        methodology: 'CIA',
        category: 'integrity',
      },
      severity: 'low',
      status: 'open',
      description: 'Nothing signs a confirmed booking.',
      elements: ['flow-request'],
    },
    {
      id: 'threat-cia-availability',
      number: 10,
      title: 'The booking form is down during a release',
      category: {
        methodology: 'CIA',
        category: 'availability',
      },
      severity: 'high',
      status: 'mitigated',
      description: 'Releases take the only host offline.',
      elements: ['flow-request'],
    },
    {
      id: 'threat-die-confidentiality',
      number: 11,
      title: 'Sync traffic is readable on the clinic network',
      category: {
        methodology: 'CIA-DIE',
        category: 'confidentiality',
      },
      severity: 'medium',
      status: 'open',
      description: 'The sync runs without TLS.',
      elements: ['flow-sync'],
    },
    {
      id: 'threat-die-integrity',
      number: 12,
      title: 'A sync overwrites a newer booking',
      category: {
        methodology: 'CIA-DIE',
        category: 'integrity',
      },
      severity: 'high',
      status: 'mitigated',
      description: 'The last write wins.',
      elements: ['flow-sync'],
    },
    {
      id: 'threat-die-availability',
      number: 13,
      title: 'The store is unreachable during a sync',
      category: {
        methodology: 'CIA-DIE',
        category: 'availability',
      },
      severity: 'low',
      status: 'accepted-risk',
      description: 'The sync locks the table.',
      elements: ['flow-sync'],
    },
    {
      id: 'threat-die-distributed',
      number: 14,
      title: 'Every copy sits on one host',
      category: {
        methodology: 'CIA-DIE',
        category: 'distributed',
      },
      severity: 'critical',
      status: 'open',
      description: 'The store has no replica.',
      elements: ['store-appointments'],
    },
    {
      id: 'threat-die-immutable',
      number: 15,
      title: 'A sync can rewrite a past appointment',
      category: {
        methodology: 'CIA-DIE',
        category: 'immutable',
      },
      severity: 'medium',
      status: 'transferred',
      description: 'Past bookings are editable.',
      elements: ['flow-sync'],
    },
    {
      id: 'threat-die-ephemeral',
      number: 16,
      title: 'Sync credentials never expire',
      category: {
        methodology: 'CIA-DIE',
        category: 'ephemeral',
      },
      severity: 'undecided',
      status: 'avoided',
      description: 'The sync uses a long-lived key.',
      elements: ['flow-sync'],
    },
    {
      id: 'threat-linkability',
      number: 17,
      title: 'Bookings link a patient across clinics',
      category: {
        methodology: 'LINDDUN',
        category: 'linking',
      },
      severity: 'medium',
      status: 'open',
      description: 'The same patient number is used at every clinic.',
      elements: ['process-records', 'actor-clerk'],
    },
    {
      id: 'threat-identifiability',
      number: 18,
      title: 'A request log names the patient behind a pseudonym',
      category: {
        methodology: 'LINDDUN',
        category: 'identifying',
      },
      severity: 'high',
      status: 'mitigated',
      description: 'The log keeps the full name.',
      elements: ['process-records'],
    },
    {
      id: 'threat-non-repudiation',
      number: 19,
      title: 'A signed request leaves a patient no deniability',
      category: {
        methodology: 'LINDDUN',
        category: 'non-repudiation',
      },
      severity: 'low',
      status: 'not-applicable',
      description: 'Requests are not signed.',
      elements: ['process-records'],
    },
    {
      id: 'threat-detectability',
      number: 20,
      title: 'Response times show that a record exists',
      category: {
        methodology: 'LINDDUN',
        category: 'detecting',
      },
      severity: 'low',
      status: 'open',
      description: 'A hit is slower than a miss.',
      elements: ['process-records'],
    },
    {
      id: 'threat-data-disclosure',
      number: 21,
      title: 'A copy of a record includes other patients',
      category: {
        methodology: 'LINDDUN',
        category: 'data-disclosure',
      },
      severity: 'critical',
      status: 'eliminated',
      description: 'Copies were made page by page.',
      elements: ['process-records'],
    },
    {
      id: 'threat-unawareness',
      number: 22,
      title: 'Patients are not told what the desk keeps',
      category: {
        methodology: 'LINDDUN',
        category: 'unawareness',
      },
      severity: 'medium',
      status: 'accepted-risk',
      description: 'No notice describes the request log.',
      elements: ['process-records'],
    },
    {
      id: 'threat-non-compliance',
      number: 23,
      title: 'Records are kept past their retention period',
      category: {
        methodology: 'LINDDUN',
        category: 'non-compliance',
      },
      severity: 'high',
      status: 'transferred',
      description: 'Nobody reviews the archive.',
      elements: ['boundary-records'],
    },
    {
      id: 'threat-oversight',
      number: 24,
      title: 'No one reviews an automated cancellation',
      category: {
        methodology: 'PLOT4ai',
        category: 'accountability-and-human-oversight',
      },
      severity: 'high',
      status: 'open',
      description: 'Unpaid bookings are cancelled on a schedule.',
      elements: ['process-booking'],
    },
    {
      id: 'threat-bias',
      number: 25,
      title: 'Reminders reach some patients less often',
      category: {
        methodology: 'PLOT4ai',
        category: 'bias-fairness-and-discrimination',
      },
      severity: 'medium',
      status: 'accepted-risk',
      description: 'Reminders go by text message alone.',
      elements: [],
    },
    {
      id: 'threat-cybersecurity',
      number: 26,
      title: 'The reminder model is trained on unreviewed data',
      category: {
        methodology: 'PLOT4ai',
        category: 'cybersecurity',
      },
      severity: 'high',
      status: 'open',
      description: 'Training data is taken from the live store.',
      elements: ['store-appointments'],
    },
    {
      id: 'threat-governance',
      number: 27,
      title: 'Bookings enter the store with no recorded owner',
      category: {
        methodology: 'PLOT4ai',
        category: 'data-and-data-governance',
      },
      severity: 'medium',
      status: 'mitigated',
      description: 'Nothing names who answers for a booking.',
      elements: ['store-appointments'],
    },
    {
      id: 'threat-ethics',
      number: 28,
      title: 'A patient cannot ask why a request was refused',
      category: {
        methodology: 'PLOT4ai',
        category: 'ethics-and-human-rights',
      },
      severity: 'medium',
      status: 'open',
      description: 'Refusals carry no reason.',
      elements: ['actor-clerk'],
    },
    {
      id: 'threat-privacy',
      number: 29,
      title: 'Appointment reasons are kept beyond their purpose',
      category: {
        methodology: 'PLOT4ai',
        category: 'privacy-and-data-protection',
      },
      severity: 'high',
      status: 'mitigated',
      description: 'The reason field is never cleared.',
      elements: ['store-appointments'],
    },
    {
      id: 'threat-safety',
      number: 30,
      title: 'Printed schedules are not shredded',
      category: {
        methodology: 'PLOT4ai',
        category: 'safety-and-environmental-impact',
      },
      severity: 'low',
      status: 'open',
      description: 'Schedules go into the paper bin.',
      elements: ['note-hours'],
    },
    {
      id: 'threat-transparency',
      number: 31,
      title: 'The retention schedule is not published',
      category: {
        methodology: 'PLOT4ai',
        category: 'transparency-and-accessibility',
      },
      severity: 'undecided',
      status: 'not-applicable',
      description: 'The schedule is internal.',
      elements: [],
    },
    {
      id: 'threat-card',
      number: 40,
      title: "The clerk's session token is guessable",
      category: {
        methodology: 'custom',
        methodologyName: 'EOP',
        category: 'Authentication',
      },
      severity: 'medium',
      status: 'open',
      description: 'Found in a Cornucopia session.',
      elements: ['actor-clerk'],
    },
  ],
  lastIssuedThreatNumber: 42,
  mitigations: [
    {
      id: 'mitigation-one-time-code',
      title: 'One-time code',
      prose: 'Send a one-time code to the phone on file.',
      status: 'proposed',
      threats: ['threat-spoofing'],
    },
    {
      id: 'mitigation-booking-log',
      title: '',
      prose:
        'Record every booking with its session.\n\nKeep the record for a year.',
      status: 'implemented',
      threats: ['threat-repudiation', 'threat-identifiability'],
    },
    {
      id: 'mitigation-two-hosts',
      title: 'Two hosts',
      prose: 'Serve the form from two hosts.',
      status: 'verified',
      threats: ['threat-cia-availability', 'threat-die-integrity'],
    },
  ],
  assumptions: [
    {
      id: 'assumption-unconfirmed',
      prose: 'The phone on file belongs to the patient.',
      status: 'unconfirmed',
      threats: ['threat-spoofing'],
      appliesToModel: false,
    },
    {
      id: 'assumption-valid',
      prose: 'The clinic network is not reachable from the internet.',
      status: 'valid',
      threats: ['threat-die-confidentiality', 'threat-die-integrity'],
      appliesToModel: false,
    },
    {
      id: 'assumption-invalidated',
      prose: 'Backups never leave the host.',
      status: 'invalidated',
      threats: ['threat-cia-availability'],
      appliesToModel: false,
    },
    {
      id: 'assumption-model',
      prose: 'The model is reviewed when the booking service changes.',
      status: 'valid',
      threats: [],
      appliesToModel: true,
    },
  ],
};

/**
 * A cut-down of a model in the document shape v0.2.1 wrote, committed as data
 * and never regenerated, so a file from before a flow's `bidirectional` and an
 * attached endpoint's `side` still has a reader to answer to.
 */
export const frozenV021Path: string = testDataPath('saerskriven/v0.2.1.yaml');

const pilot = 'f1646094-9885-422a-b7e7-7888c72905ef';

/**
 * The model {@link frozenV021Path} describes, written out by hand: every flow
 * one-way and every attached end unpinned, since the file states neither, no
 * security fact, and one mitigation record for each non-empty mitigation
 * text in threat number order, `implemented` under a mitigated threat and
 * `proposed` under any other.
 */
export const frozenV021Model: ModelInput = {
  metadata: {
    title: '',
    owner: 'Alexandra de Wit',
    description: '',
    contributors: ['Alexandra de Wit'],
  },
  diagrams: [
    {
      id: '0',
      title: 'High Level',
      elements: [
        {
          kind: 'trust-boundary',
          id: '0ec10e5e-0000-4000-8000-000000000002',
          name: 'Public internet (untrusted)',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          shape: {
            kind: 'box',
            position: { x: -90, y: 640 },
            size: { width: 240, height: 200 },
          },
        },
        {
          kind: 'actor',
          id: '0ec10e5e-0000-4000-8000-000000000012',
          name: 'AWS IMDS + STS',
          description:
            'Instance-metadata and token endpoint. It sources the container-role credentials the worker exchanges for a CodeArtifact write token.',
          outOfScope: false,
          reasonOutOfScope: '',
          position: { x: 635, y: 740 },
          size: { width: 190, height: 90 },
        },
        {
          kind: 'flow',
          id: 'c928bb63-2ec8-44ff-b34b-39d4afb19dc6',
          name: 'mint token (container role)',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          source: {
            kind: 'attached',
            element: '0ec10e5e-0000-4000-8000-000000000012',
          },
          target: { kind: 'attached', element: pilot },
          waypoints: [],
          bidirectional: false,
        },
        {
          kind: 'flow',
          id: '4e565871-45cc-4987-abba-24859ee2cf60',
          name: 'OSV Dataset for Supported Registries',
          description: '',
          outOfScope: false,
          reasonOutOfScope: '',
          source: { kind: 'free', position: { x: 1480, y: 860 } },
          target: { kind: 'attached', element: pilot },
          waypoints: [],
          bidirectional: false,
        },
        {
          kind: 'flow',
          id: 'ec4bbc95-8582-4e22-ab64-3c87cff87239',
          name: 'Push osv.db (SQLite)',
          description: 'Pilot pushes the optimised osv.db to S3.',
          outOfScope: false,
          reasonOutOfScope: '',
          source: { kind: 'attached', element: pilot },
          target: {
            kind: 'attached',
            element: 'c8455307-cef2-4843-a821-ff90db9643d2',
          },
          waypoints: [],
          bidirectional: false,
        },
        {
          kind: 'process',
          id: pilot,
          name: 'Pilot\n(Ingestion Pipeline)',
          description:
            "Pilot is an unopinionated data ingestion pipeline. It fetches vulnerability data and delivers an optimised osv.db to S3. The proxy therefore never queries osv.dev on the critical path and never meets its rate limits. Pilot makes no security or blocking decision. The proxy's rules engine is the sole opinionated enforcement point. Only the rules engine evaluates that data, for example to block on CVE severity or an EPSS score, or to fast-lane a remediation package.",
          outOfScope: false,
          reasonOutOfScope: '',
          position: { x: 920, y: 915 },
          size: { width: 130, height: 130 },
        },
        {
          kind: 'store',
          id: 'c8455307-cef2-4843-a821-ff90db9643d2',
          name: 'S3 (OSV Datasets)',
          description:
            'Pre-compiled SQLite data files for querying against live CVEs.',
          outOfScope: false,
          reasonOutOfScope: '',
          position: { x: 920, y: 640 },
          size: { width: 180, height: 130 },
        },
      ],
    },
  ],
  threats: [
    {
      id: 'b1a6332d-8def-4df9-922e-53718c920155',
      number: 17,
      title: 'Pilot container-role privilege escalation',
      category: { methodology: 'STRIDE', category: 'elevation-of-privilege' },
      severity: 'high',
      status: 'mitigated',
      description:
        'An attacker who compromises Pilot could use its standing container credentials.',
      elements: [pilot],
    },
    {
      id: '4b73d786-865e-43fc-b1bd-0e0bc75cae03',
      number: 27,
      title: 'Poisoned OSV payload exploits parser',
      category: { methodology: 'STRIDE', category: 'denial-of-service' },
      severity: 'medium',
      status: 'mitigated',
      description:
        'A maliciously crafted or unexpectedly massive OSV payload from upstream could cause Pilot to exhaust memory or crash during JSON parsing.',
      elements: [pilot],
    },
    {
      id: 'c87367bd-fc3f-4792-94b6-8db459011823',
      number: 101,
      title: 'Oracle Blackout / Supply Chain DoS via OSV.dev compromise',
      category: { methodology: 'STRIDE', category: 'spoofing' },
      severity: 'high',
      status: 'accepted-risk',
      description:
        'An attacker who gains control of osv.dev can push malicious vulnerability records. Those records trigger false positives, or fast-lane a malicious remediation package. The attack is strongest when the attacker also publishes a malicious package.',
      elements: [pilot],
    },
  ],
  lastIssuedThreatNumber: 102,
  mitigations: [
    {
      id: 'b1a6332d-8def-4df9-922e-53718c920155-mitigation',
      title: '',
      prose:
        'Least-privilege IAM limits the role to s3:PutObject on the one bucket prefix. Pilot runs in its own container, separate from the proxy.',
      status: 'implemented',
      threats: ['b1a6332d-8def-4df9-922e-53718c920155'],
    },
    {
      id: '4b73d786-865e-43fc-b1bd-0e0bc75cae03-mitigation',
      title: '',
      prose:
        'Pilot runs apart from the proxy. If Pilot runs out of memory or fails, it only delays updates. The proxy keeps serving traffic from the last-known-good osv.db snapshot.',
      status: 'implemented',
      threats: ['4b73d786-865e-43fc-b1bd-0e0bc75cae03'],
    },
    {
      id: 'c87367bd-fc3f-4792-94b6-8db459011823-mitigation',
      title: '',
      prose:
        'Risk treatment: accepted by trust assumption. A compromised security oracle is a foundational supply-chain compromise. Pilot relies on OSV as a source of vulnerability truth. A hostile oracle defeats the defence outright. Transport, parsing, validation, and last-good-database controls mitigate tampering in transit, malformed payloads, and update outages. They cannot make a hostile source of truth trustworthy.',
      status: 'proposed',
      threats: ['c87367bd-fc3f-4792-94b6-8db459011823'],
    },
  ],
  assumptions: [],
};

/**
 * Saerskriven's own model in the document shape v0.3.0 wrote, committed as
 * data and never regenerated: version 1 with each threat's mitigation text,
 * assumption element links and an assumption that links no threat, so the v1
 * to v2 migration has a released file to answer to.
 */
export const frozenV030Path: string = testDataPath(
  'saerskriven/saerskriven-v0.3.0.yaml',
);

const twoDiagramsPath = testDataPath('saerskriven/two-diagrams.yaml');

/**
 * `test-data/saerskriven/two-diagrams.yaml`, the native encoding of
 * `test-data/two-diagrams.model.json` as the writer produced it, so the apps
 * that open files render the model the render goldens were drawn from.
 */
export const twoDiagramsYaml: string = committedText(
  'saerskriven/two-diagrams.yaml',
);

const saerskrivenModelPath = join(
  repositoryRoot,
  'threat-modelling/saerskriven.yaml',
);

/** A Saerskriven YAML file this repository commits, with its committed bytes. */
export type NativeFixture = {
  readonly name: string;
  readonly path: string;
  readonly text: string;
};

/**
 * Every Saerskriven YAML file this repository commits in the writer's
 * canonical form: what a read of the committed bytes writes back is those
 * bytes again. The suites that gate a native file read this list rather than
 * a path, so a third file joins all of them by being added here. The frozen
 * fixtures at {@link frozenV021Path} and {@link frozenV030Path} are not among
 * them, because a write of their models is a later shape.
 */
export const nativeFixtures: readonly NativeFixture[] = [
  {
    name: 'feature-complete file',
    path: featureCompletePath,
    text: featureCompleteYaml,
  },
  {
    name: 'two-diagram file',
    path: twoDiagramsPath,
    text: twoDiagramsYaml,
  },
  {
    name: 'Saerskriven model',
    path: saerskrivenModelPath,
    text: readFileSync(saerskrivenModelPath, 'utf8'),
  },
];

/**
 * How long a property over `modelInputArbitrary` is given, past the root
 * `vitest.shared.mts` sets. fast-check runs a property a hundred times by
 * default, and each run parses a model, writes it and reads it back, which
 * ten runs of the whole workspace's suites on a contended host measured at
 * 9.5 seconds.
 */
export const propertyTimeout = 30_000;

/**
 * The smallest version 1 document the read accepts: a title and every list
 * empty. A spec derives the variant it needs with a `replace`.
 */
export const minimalYamlV1 = [
  'formatVersion: 1',
  'metadata:',
  '  title: Minimal',
  '  owner: ""',
  '  description: ""',
  '  contributors: []',
  'diagrams: []',
  'threats: []',
  'lastIssuedThreatNumber: 0',
  'mitigations: []',
  'assumptions: []',
  '',
].join('\n');

/**
 * A version 1 document with one process on one diagram and one threat
 * linked to it. A spec derives the variant it needs with a `replace`.
 */
export const oneThreatYamlV1 = [
  'formatVersion: 1',
  'metadata:',
  '  title: One threat',
  '  owner: ""',
  '  description: ""',
  '  contributors: []',
  'diagrams:',
  '  - id: diagram-1',
  '    title: Only',
  '    elements:',
  '      - kind: process',
  '        id: element-1',
  '        name: Gateway',
  '        description: ""',
  '        outOfScope: false',
  '        reasonOutOfScope: ""',
  '        position:',
  '          x: 0',
  '          y: 0',
  '        size:',
  '          width: 10',
  '          height: 10',
  'threats:',
  '  - id: threat-1',
  '    number: 1',
  '    title: Spoofed caller',
  '    category:',
  '      methodology: STRIDE',
  '      category: spoofing',
  '    severity: high',
  '    status: open',
  '    description: ""',
  '    mitigation: ""',
  '    elements:',
  '      - element-1',
  'lastIssuedThreatNumber: 1',
  'mitigations: []',
  'assumptions: []',
  '',
].join('\n');

/**
 * A version 1 wire document with an untitled metadata block and every list
 * empty, with the lists and the last issued number a spec passes in their
 * place.
 */
export const version1Document = (
  overrides: Partial<Omit<SaerskrivenYamlDocument, 'formatVersion'>>,
): SaerskrivenYamlDocument => ({
  formatVersion: 1,
  metadata: { title: 'Earlier', owner: '', description: '', contributors: [] },
  diagrams: [],
  threats: [],
  lastIssuedThreatNumber: 0,
  mitigations: [],
  assumptions: [],
  ...overrides,
});
