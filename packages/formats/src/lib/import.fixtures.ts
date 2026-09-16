import { committedText } from '@saerskriven/model/fixtures';
import { otmWireSchema, type OtmDocument } from '@saerskriven/wire-otm';
import { tmbomWireSchema, type TmbomDocument } from '@saerskriven/wire-tmbom';
import { vendoredTexts } from './corpus.fixtures.js';

/**
 * Every OTM and TM-BOM document the repository vendors, named by its path
 * under `test-data`. The vendored JSON Schemas are not documents.
 */
export const importCorpus: readonly { name: string; text: string }[] =
  vendoredTexts(
    ['otm', 'tmbom'],
    (name) => name.endsWith('.json') && !name.startsWith('schema'),
  );

/** The upstream examples retain unknown fields to exercise import reports. */
export const importTexts = {
  otm: committedText('otm/example.json'),
  tmbom: committedText('tmbom/example.json'),
};

/** A fresh OTM example for tests that change source facts. */
export const otmFixture = () =>
  otmWireSchema.parse(JSON.parse(importTexts.otm) as unknown);
/** A fresh TM-BOM example for tests that change source facts. */
export const tmbomFixture = () =>
  tmbomWireSchema.parse(JSON.parse(importTexts.tmbom) as unknown);

/**
 * An OTM 0.2.0 document that sets every field the wire schema declares:
 * a parent named by trust zone and by component, a component placed by no
 * representation, an occurrence in each threat state the import maps and one
 * it does not, a mitigation reference in each state, a null one, and a
 * definition of each kind no occurrence names.
 */
export const otmFeatureComplete: OtmDocument = {
  otmVersion: '0.2.0',
  project: {
    name: 'Clinic booking',
    id: 'clinic-booking',
    description: 'Every field an OTM file carries.',
    owner: 'Alexandra de Wit',
    ownerContact: 'alexa@example.org',
    tags: ['booking'],
    attributes: { cmdbId: 'CLINIC-1' },
  },
  representations: [
    {
      name: 'Booking diagram',
      id: 'booking-diagram',
      description: 'The architecture as drawn.',
      type: 'diagram',
      size: { width: 1000, height: 800 },
      attributes: null,
    },
    {
      name: 'Booking code',
      id: 'booking-code',
      type: 'code',
      repository: { url: 'https://example.org/booking' },
    },
  ],
  assets: [
    {
      name: 'Appointment reason',
      id: 'appointment-reason',
      description: 'Why the patient booked.',
      risk: {
        confidentiality: 90,
        integrity: 60,
        availability: 30,
        comment: 'Health data.',
      },
      attributes: { owner: 'records office' },
    },
  ],
  trustZones: [
    {
      id: 'zone-internet',
      name: 'Internet',
      type: 'internet',
      description: 'Anyone with a phone.',
      risk: { trustRating: 10 },
      representations: [
        {
          representation: 'booking-diagram',
          name: 'Internet box',
          id: 'zone-internet-box',
          position: { x: 0, y: 0 },
          size: { width: 300, height: 400 },
          attributes: null,
        },
      ],
      attributes: null,
    },
    {
      id: 'zone-clinic',
      name: 'Clinic network',
      description: null,
      risk: { trustRating: 80 },
      parent: { trustZone: 'zone-internet' },
    },
    {
      id: 'zone-service',
      name: 'Service host',
      risk: { trustRating: 90 },
      parent: { component: 'booking-service' },
    },
  ],
  components: [
    {
      name: 'Patient app',
      id: 'patient-app',
      description: 'Books appointments.',
      type: 'mobile-client',
      parent: { trustZone: 'zone-internet' },
      representations: [
        {
          representation: 'booking-diagram',
          id: 'patient-app-box',
          position: { x: 40, y: 60 },
          size: { width: 120, height: 80 },
        },
        {
          representation: 'booking-code',
          id: 'patient-app-code',
          file: 'app/src/booking.ts',
          line: 12,
          codeSnippet: 'book(slot)',
        },
      ],
      threats: [
        { threat: 'threat-spoofing', state: 'exposed' },
        { threat: 'threat-spoofing', state: 'under-review' },
      ],
      tags: ['external', null],
      attributes: null,
    },
    {
      name: 'Booking service',
      id: 'booking-service',
      type: 'web-service',
      parent: { trustZone: 'zone-clinic' },
      representations: [
        {
          representation: 'booking-diagram',
          id: 'booking-service-box',
          position: { x: 400, y: 60 },
          size: { width: 120, height: 80 },
        },
      ],
      assets: { processed: ['appointment-reason', null], stored: null },
      threats: [
        {
          threat: 'threat-tampering',
          state: 'open',
          mitigations: [
            { mitigation: 'mitigation-signing', state: 'implemented' },
            { mitigation: 'mitigation-review', state: 'verified' },
            null,
            { mitigation: null, state: null },
          ],
        },
        { threat: 'threat-disclosure', state: 'mitigated' },
        { threat: 'threat-denial', state: 'accepted' },
        { threat: 'threat-repudiation', state: 'accepted-risk' },
      ],
    },
    {
      name: 'Appointments',
      id: 'appointments',
      type: 'postgresql',
      parent: { component: 'booking-service' },
      assets: { stored: ['appointment-reason'] },
      threats: [
        { threat: 'threat-elevation', state: 'transferred' },
        { threat: 'threat-backup', state: 'avoided' },
      ],
    },
  ],
  dataflows: [
    {
      name: 'Book appointment',
      id: 'flow-book',
      description: 'The booking form.',
      bidirectional: true,
      source: 'patient-app',
      destination: 'booking-service',
      assets: ['appointment-reason'],
      threats: [
        {
          threat: 'threat-replay',
          state: 'eliminated',
          mitigations: [
            { mitigation: 'mitigation-signing', state: 'required' },
          ],
        },
        {
          threat: 'threat-sniffing',
          state: 'not-applicable',
          mitigations: [
            { mitigation: 'mitigation-tls', state: 'proposed' },
            { mitigation: 'mitigation-review', state: 'rejected' },
          ],
        },
      ],
      tags: ['https'],
      attributes: null,
    },
    {
      name: 'Store booking',
      id: 'flow-store',
      bidirectional: null,
      source: 'booking-service',
      destination: 'appointments',
    },
  ],
  threats: [
    {
      name: 'Spoofed patient',
      id: 'threat-spoofing',
      description: 'Someone books as another patient.',
      categories: ['Spoofing', null],
      cwes: ['CWE-287'],
      risk: {
        likelihood: 60,
        likelihoodComment: 'Names and birth dates are easy to find.',
        impact: 70,
        impactComment: 'Fees are charged to the wrong patient.',
      },
      tags: ['identity'],
      attributes: null,
    },
    {
      name: 'Altered fee',
      id: 'threat-tampering',
      risk: { likelihood: null, impact: 50 },
    },
    {
      name: 'Leaked reason',
      id: 'threat-disclosure',
      risk: { likelihood: 20, impact: 90 },
    },
    {
      name: 'Bulk booking',
      id: 'threat-denial',
      risk: { likelihood: 40, impact: 40 },
    },
    {
      name: 'Denied booking',
      id: 'threat-repudiation',
      risk: { likelihood: 30, impact: 20 },
    },
    {
      name: 'Settings changed by the service',
      id: 'threat-elevation',
      risk: { likelihood: 10, impact: 80 },
    },
    {
      name: 'Backup copied off the host',
      id: 'threat-backup',
      risk: { likelihood: 10, impact: 90 },
    },
    {
      name: 'Replayed booking',
      id: 'threat-replay',
      risk: { likelihood: 20, impact: 30 },
    },
    {
      name: 'Form read in transit',
      id: 'threat-sniffing',
      risk: { likelihood: 10, impact: 60 },
    },
    {
      name: 'Model left unreviewed',
      id: 'threat-unattached',
      description: 'No occurrence names this threat.',
      risk: { likelihood: 50, impact: 10 },
    },
  ],
  mitigations: [
    {
      name: 'Sign the booking',
      id: 'mitigation-signing',
      description: 'The app signs each booking.',
      riskReduction: 60,
      attributes: null,
    },
    { name: 'Review the fee', id: 'mitigation-review', riskReduction: 30 },
    { name: 'TLS everywhere', id: 'mitigation-tls', riskReduction: 80 },
    {
      name: 'Rotate keys',
      id: 'mitigation-unused',
      description: 'No occurrence names this mitigation.',
      riskReduction: 10,
    },
  ],
};

const tmbom102 =
  'https://github.com/OWASP/www-project-threat-model-library/blob/v1.0.2/threat-model.schema.json';

const tmbom101 =
  'https://github.com/OWASP/www-project-threat-model-library/blob/v1.0.1/threat-model.schema.json';

const actorOf = (
  type: TmbomActorType,
  title: string,
): Tmbom102['actors'][number] => ({
  symbolic_name: `actor-${type.replaceAll('_', '-')}`,
  title,
  description: '',
  type,
  trust_zone: 'zone-internet',
});

const storeOf = (
  type: TmbomStoreType,
  title: string,
): Tmbom102['data_stores'][number] => ({
  symbolic_name: `store-${type.replaceAll('_', '-')}`,
  title,
  description: '',
  type,
  trust_zone: 'zone-clinic',
});

type Tmbom102 = Extract<TmbomDocument, { $schema: typeof tmbom102 }>;

type TmbomActorType = TmbomDocument['actors'][number]['type'];

type TmbomStoreType = TmbomDocument['data_stores'][number]['type'];

/**
 * A TM-BOM 1.0.2 document that sets every field the wire schema declares
 * and holds every enumerated value a list or a record can carry: an actor
 * and a data store of each type, a persona of each skill, a control in each
 * status and priority, a risk at each level, and an assumption of each
 * validity. One control names no threat and has an empty description. The
 * scope holds one value of each of its own enums, which
 * {@link tmbomScopeVariants} vary.
 */
export const tmbomFeatureComplete: Tmbom102 = {
  $schema: tmbom102,
  version: '1.0.2',
  scope: {
    title: 'Clinic booking',
    description: 'Every field a TM-BOM file carries.',
    business_criticality: 'maximal',
    data_sensitivity: [
      'pii',
      'phi',
      'fin',
      'ip',
      'cred',
      'biz',
      'gov',
      'pci',
      'op',
    ],
    exposure: 'external',
    tier: 'mission_critical',
  },
  description: 'A clinic books appointments online.',
  frozen: false,
  released_at: '2026-09-01',
  product_release_date: '2026-09-15T09:00:00Z',
  release_docs_link: 'https://example.org/booking/release',
  reviewed_at: '2026-09-16',
  repo_link: 'https://example.org/booking',
  diagrams: [
    {
      title: 'Booking, as Graphviz',
      description: 'Drawn by hand.',
      link: 'https://example.org/booking.dot',
      type: 'graphviz',
      source: 'digraph { patient -> booking }',
    },
    { title: 'Booking, as Mermaid', type: 'mermaid', source: 'flowchart LR' },
    { title: 'Booking, as PlantUML', type: 'plantuml', source: '@startuml' },
    { title: 'Booking, as SVG', type: 'svg', source: '<svg/>' },
  ],
  trust_zones: [
    {
      symbolic_name: 'zone-internet',
      title: 'Internet',
      description: 'Anyone with a phone.',
    },
    {
      symbolic_name: 'zone-clinic',
      title: 'Clinic network',
      description: 'Hosts the clinic runs.',
    },
  ],
  trust_boundaries: [
    {
      trust_zone_a: 'zone-internet',
      trust_zone_b: 'zone-clinic',
      access_control_methods: ['none', 'acl', 'rbac', 'mac', 'dac', 'abac'],
      authentication_methods: [
        'none',
        'password',
        'otp',
        'challenge_response',
        'public_key',
        'token',
        'biometrics',
        'sso',
        'social',
      ],
      access_token_expires: true,
      access_token_ttl: 900,
      has_refresh_token: true,
      refresh_token_expires: true,
      refresh_token_ttl: 86400,
      can_user_logout: true,
      can_system_logout: false,
    },
  ],
  actors: [
    { ...actorOf('user', 'Patient'), permissions: 'Book and cancel.' },
    actorOf('system', 'Reminder job'),
    actorOf('power_user', 'Receptionist'),
    actorOf('administrator', 'Clinic administrator'),
    actorOf('engineer', 'On-call engineer'),
    actorOf('third_party', 'Payment provider'),
  ],
  components: [
    {
      symbolic_name: 'booking-service',
      title: 'Booking service',
      description: 'Takes bookings and payment.',
      trust_zone: 'zone-clinic',
      repo_link: 'https://example.org/booking/service',
    },
    {
      symbolic_name: 'fee-calculator',
      title: 'Fee calculator',
      description: 'Works out the fee.',
      parent_component: 'booking-service',
      trust_zone: 'zone-clinic',
    },
  ],
  data_stores: [
    {
      ...storeOf('sql', 'Appointments'),
      vendor: 'PostgreSQL Global Development Group',
      product: 'PostgreSQL',
    },
    storeOf('key_value', 'Sessions'),
    storeOf('document', 'Forms'),
    storeOf('object', 'Scans'),
    storeOf('graph', 'Referrals'),
    storeOf('time_series', 'Metrics'),
  ],
  data_sets: [
    {
      symbolic_name: 'appointment-records',
      title: 'Appointment records',
      description: 'Who booked what and why.',
      placements: [{ data_store: 'store-sql', encrypted: true }, {}],
      data_sensitivity: ['phi', 'pii'],
      access_control_methods: ['rbac'],
      record_count: 120000,
    },
  ],
  data_flows: [
    {
      symbolic_name: 'flow-book',
      title: 'Book appointment',
      description: 'The booking form.',
      source: { type: 'actor', object: 'actor-user' },
      destination: { type: 'component', object: 'booking-service' },
      has_sensitive_data: true,
      encrypted: true,
    },
    {
      symbolic_name: 'flow-store',
      title: 'Store booking',
      description: 'Writes the appointment.',
      source: { type: 'component', object: 'booking-service' },
      destination: { type: 'data-store', object: 'store-sql' },
      has_sensitive_data: true,
      encrypted: false,
    },
  ],
  assumptions: [
    {
      description: 'The phone on file belongs to the patient.',
      topics: ['identity'],
      validity: 'unconfirmed',
    },
    {
      description: 'The clinic network is not reachable from the internet.',
      validity: 'confirmed',
    },
    { description: 'Backups never leave the host.', validity: 'rejected' },
  ],
  threat_personas: [
    persona('script-kid', 'script_kid', 'anonymous', 'minimal'),
    persona('insider', 'insider', 'user', 'low'),
    persona('engineer', 'engineer', 'admin', 'moderate'),
    persona('expert', 'expert_engineer', 'user', 'high'),
    persona('organised', 'oc_sponsored', 'anonymous', 'maximal'),
    persona('state', 'state_sponsored', 'anonymous', 'high'),
  ],
  threats: [
    {
      symbolic_name: 'threat-spoofing',
      title: 'Spoofed patient',
      description: 'Someone books as another patient.',
      components_affected: ['booking-service'],
      threat_persona: 'persona-insider',
      event: 'A booking arrives under a stolen name.',
      sources: [
        'adversary',
        'human_error',
        'failure',
        'events_beyond_org_control',
      ],
      attack_mechanisms: [{ capec_id: 151, capec_title: 'Identity Spoofing' }],
      weaknesses: [{ cwe_id: 287, cwe_title: 'Improper Authentication' }],
    },
    {
      symbolic_name: 'threat-fee',
      title: 'Altered fee',
      description: 'The fee changes on its way to payment.',
      threat_persona: 'persona-expert',
      event: 'A fee arrives lower than charged.',
      sources: ['adversary'],
    },
  ],
  controls: [
    control('assumed', 'none', ['threat-spoofing']),
    control('active', 'low', ['threat-spoofing'], {
      trust_zone_a: 'zone-internet',
      trust_zone_b: 'zone-clinic',
    }),
    control('suggested', 'medium', ['threat-fee']),
    control('under_review', 'high', ['threat-fee']),
    control('approved', 'critical', ['threat-fee']),
    control('scheduled', 'medium', []),
    control('retired', 'low', ['threat-spoofing']),
    control('wont_do', 'none', ['threat-fee']),
    {
      ...control('scheduled', 'low', []),
      symbolic_name: 'control-unwritten',
      title: 'Unwritten control',
      description: '',
    },
  ],
  risks: [
    risk('very_low', 'rare', 'negligible', 1),
    risk('low', 'unlikely', 'minor', 4),
    risk('medium', 'possible', 'moderate', 9),
    risk('high', 'likely', 'major', 16),
    risk('very_high', 'certain', 'severe', 25),
    risk('critical', 'certain', 'severe', 25),
  ],
  extensions: {
    'example.org/clinic': { ward: 'outpatients' },
  },
};

function persona(
  name: string,
  skill_level: Persona['skill_level'],
  access_level: Persona['access_level'],
  applicability_to_org: Persona['applicability_to_org'],
): Persona {
  return {
    symbolic_name: `persona-${name}`,
    title: name,
    description: '',
    is_person: skill_level !== 'script_kid',
    skill_level,
    access_level,
    malicious_intent: skill_level !== 'engineer',
    applicability_to_org,
  };
}

function control(
  status: Control['status'],
  priority: Control['priority'],
  threats: readonly string[],
  trust_boundary?: Control['trust_boundary'],
): Control {
  return {
    symbolic_name: `control-${status.replaceAll('_', '-')}`,
    title: `Control ${status}`,
    description: `A control the team marks ${status}.`,
    threats: [...threats],
    status,
    priority,
    ...(trust_boundary === undefined ? {} : { trust_boundary }),
  };
}

function risk(
  level: Risk['level'],
  likelihood: Risk['likelihood'],
  impact: Risk['impact'],
  score: number,
): Risk {
  return {
    symbolic_name: `risk-${level.replaceAll('_', '-')}`,
    title: `A ${level} risk`,
    description: '',
    threats: ['threat-fee'],
    likelihood,
    impact,
    impact_description: '',
    score,
    level,
  };
}

type Persona = NonNullable<TmbomDocument['threat_personas']>[number];

type Control = NonNullable<TmbomDocument['controls']>[number];

type Risk = NonNullable<Tmbom102['risks']>[number];

/**
 * {@link tmbomFeatureComplete} under each other value its scope enums take,
 * the first also as the 1.0.1 release: actors and data stores with no trust
 * zone and a risk level that is free text.
 */
export const tmbomScopeVariants: readonly TmbomDocument[] = [
  {
    ...tmbomFeatureComplete,
    $schema: tmbom101,
    scope: {
      ...tmbomFeatureComplete.scope,
      business_criticality: 'minimal',
      exposure: 'internal',
      tier: 'business_critical',
    },
    actors: tmbomFeatureComplete.actors.map(
      ({ trust_zone: _zone, ...actor }) => actor,
    ),
    data_stores: tmbomFeatureComplete.data_stores.map(
      ({ trust_zone: _zone, ...store }) => store,
    ),
    risks: (tmbomFeatureComplete.risks ?? []).map((held) => ({
      ...held,
      level: 'moderate',
    })),
  },
  {
    ...tmbomFeatureComplete,
    scope: {
      ...tmbomFeatureComplete.scope,
      business_criticality: 'low',
      tier: 'important',
    },
  },
  {
    ...tmbomFeatureComplete,
    scope: {
      ...tmbomFeatureComplete.scope,
      business_criticality: 'moderate',
      tier: 'non_critical',
    },
  },
  {
    ...tmbomFeatureComplete,
    scope: { ...tmbomFeatureComplete.scope, business_criticality: 'high' },
  },
];
