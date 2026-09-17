import { smallYaml } from '../fixtures.js';
import {
  answerOf,
  crowdedThreats,
  crowdedTree,
  everyRecordTree,
  featureCompleteWorkspace,
  treeHolding,
} from './read-tools.fixtures.js';
import { dataNotInstructions } from './preface.js';
import { renderThreatSearch, searchThreats } from './search-threats.js';
import { searchLimits } from './search.js';
import { toolResult } from './tool-result.js';

const workspace = featureCompleteWorkspace();

const search = (args: Parameters<typeof searchThreats>[1]) =>
  answerOf(searchThreats(workspace, args));

describe('what saer_search_threats finds', () => {
  it('matches every threat of the fixture where nothing narrows it', () => {
    expect(search({ response_format: 'concise' }).counts.matched).toBe(24);
  });

  it('keeps only the severity a call names', () => {
    const found = search({ severity: 'high', response_format: 'concise' });
    expect(found.threats.map((row) => row.severity)).toEqual(
      found.threats.map(() => 'high'),
    );
  });

  it('keeps only the threats referencing the element a call names', () => {
    const [any] = search({ response_format: 'concise' }).threats;
    const element = any?.elements[0];
    const found = search({ element, response_format: 'concise' });
    expect(
      found.threats.every((row) => row.elements.some((one) => one === element)),
    ).toBe(true);
  });

  it('matches nothing rather than refusing an element id no element carries', () => {
    expect(
      search({ element: 'no-such-element', response_format: 'concise' }).counts,
    ).toEqual({ matched: 0, returned: 0, truncated: false });
  });

  it('adds the description and the linked mitigations where detail is asked for', () => {
    const [threat] = search({
      severity: 'high',
      response_format: 'detailed',
    }).threats;
    expect(threat?.description).toBeDefined();
    expect(threat?.mitigations).toBeDefined();
  });

  it('leaves the prose and the records out of a concise row, and carries its flags', () => {
    const [threat] = search({ response_format: 'concise' }).threats;
    expect(threat?.flags).toEqual([]);
    expect(
      Object.keys(threat ?? {}).filter((key) =>
        ['description', 'mitigations', 'assumptions'].includes(key),
      ),
    ).toEqual([]);
  });

  it('cuts a detailed listing at its limit and says the count it matched', () => {
    const found = search({ response_format: 'detailed' });
    expect({
      returned: found.threats.length,
      matched: found.counts.matched,
      truncated: found.counts.truncated,
    }).toEqual({
      returned: searchLimits.detailed,
      matched: 24,
      truncated: true,
    });
  });

  it('names the methodology and the category of each match in its text', () => {
    const rendered = renderThreatSearch(
      search({ severity: 'high', response_format: 'concise' }),
    );
    expect(rendered.join('\n')).toContain('category STRIDE/');
  });
});

describe('a Threat Dragon threat found by the text of its mitigation', () => {
  const outcome = searchThreats(workspace, {
    query: 'two hosts',
    response_format: 'detailed',
  });
  const found = answerOf(outcome);
  const [row] = found.threats;

  it('is the one threat whose text says it', () => {
    expect(found.threats.map((threat) => threat.number)).toEqual([10]);
  });

  it('carries that text as the mitigation record the read made of it', () => {
    expect(
      row?.mitigations?.map(({ id, status, threats, prose }) => ({
        id,
        status,
        threats,
        mentions: prose.includes('two hosts'),
      })),
    ).toEqual([
      {
        id: `${row?.id ?? ''}-mitigation`,
        status: 'implemented',
        threats: [row?.id],
        mentions: true,
      },
    ]);
  });

  it('opens its text result with the line saying it is data', () => {
    const [content] = toolResult(outcome, renderThreatSearch).content;
    expect(
      content?.type === 'text' ? content.text.split('\n')[0] : undefined,
    ).toBe(dataNotInstructions);
  });
});

describe('a version 1 threat found by the mitigation text its file held', () => {
  const found = answerOf(
    searchThreats(
      treeHolding(
        smallYaml
          .replace('title: Small', 'title: Held text')
          .replace('status: open', 'status: mitigated')
          .replace("mitigation: ''", 'mitigation: Pin the certificate.'),
      ),
      { query: 'pin the certificate', response_format: 'detailed' },
    ),
  );
  const [row] = found.threats;

  it('matches through the record the read made of that text', () => {
    expect(found.threats.map(({ id }) => id)).toEqual(['threat-1']);
    expect(
      row?.mitigations?.map(({ id, status, prose }) => ({ id, status, prose })),
    ).toEqual([
      {
        id: 'threat-1-mitigation',
        status: 'implemented',
        prose: 'Pin the certificate.',
      },
    ]);
  });

  it('carries no mitigation prose on the threat itself', () => {
    expect(row).not.toHaveProperty('mitigation');
  });
});

describe('a detailed row of a threat carrying both record kinds', () => {
  const found = answerOf(
    searchThreats(everyRecordTree(), {
      query: 'tampering',
      response_format: 'detailed',
    }),
  );
  const [row] = found.threats;

  it('carries the mitigation and assumption records linked to it', () => {
    expect({
      mitigations: row?.mitigations?.map(({ id }) => id),
      assumptions: row?.assumptions?.map(({ id }) => id),
    }).toEqual({
      mitigations: ['mitigation-tls'],
      assumptions: ['assumption-managed-db'],
    });
  });

  it('names its flags and both records in its text', () => {
    const rendered = renderThreatSearch(found);
    expect(rendered).toEqual(
      expect.arrayContaining([
        '    flags: none',
        expect.stringMatching(
          /^ {4}mitigation "mitigation-tls" \(proposed\): /u,
        ),
        expect.stringMatching(
          /^ {4}assumption "assumption-managed-db" \(valid\): /u,
        ),
      ]),
    );
  });
});

describe('a threat under a methodology of its own', () => {
  const rich = everyRecordTree();

  const found = answerOf(
    searchThreats(rich, {
      status: 'accepted-risk',
      response_format: 'detailed',
    }),
  );

  it('keeps only the status a call names', () => {
    expect(found.threats.map((row) => row.status)).toEqual(['accepted-risk']);
  });

  it('names the methodology the model gave it rather than a label', () => {
    expect(renderThreatSearch(found).join('\n')).toContain(
      'category House/process gap',
    );
  });

  it('leaves the prose lines out where the record carries none', () => {
    const rendered = renderThreatSearch(found).join('\n');
    expect(rendered).not.toContain('description:');
    expect(rendered).not.toContain('mitigation:');
  });
});

describe('a concise listing past its limit', () => {
  const crowded = answerOf(
    searchThreats(crowdedTree(), { response_format: 'concise' }),
  );

  it('carries the concise limit and says what it matched', () => {
    expect({
      returned: crowded.threats.length,
      matched: crowded.counts.matched,
      truncated: crowded.counts.truncated,
    }).toEqual({
      returned: searchLimits.concise,
      matched: crowdedThreats,
      truncated: true,
    });
  });

  it('offers a narrower query and not the form it is already in', () => {
    const steering = renderThreatSearch(crowded).join('\n');
    expect(steering).toContain('Narrow it with `status`');
    expect(steering).not.toContain('concise form');
  });

  it('offers the concise form to a detailed listing that was cut', () => {
    expect(
      renderThreatSearch(
        answerOf(searchThreats(crowdedTree(), { response_format: 'detailed' })),
      ).join('\n'),
    ).toContain('or ask for the concise form');
  });
});
