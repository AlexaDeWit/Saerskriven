import {
  assumptionStatusSchema,
  customCategorySchema,
  diagramSchema,
  inNumberOrder,
  mitigationStatusSchema,
  severitySchema,
  threatCategorySchema,
  threatFlagSchema,
  threatStatusSchema,
  type Diagram,
  type ThreatCategory,
} from '@saerskriven/model';
import {
  assumptionOf,
  boxAt,
  mitigationOf,
  modelFrom,
  repositoryRoot,
  threatOf,
} from '@saerskriven/model/fixtures';
import type { ListItem, Nodes, Strong } from 'mdast';
import { join } from 'node:path';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { exportText } from '../messages/catalogues.js';
import {
  badgedModel,
  translatedLocales,
  twoDiagramsModel,
} from '../render.fixtures.js';
import { renderRegister } from './markdown-register.js';
import {
  badgesIn,
  badgeTextsIn,
  modelSectionIn,
  recordItems,
  scopedAssumptionsModel,
  sectionItems,
  textOf,
  threatSectionsIn,
} from './register-tree.fixtures.js';
import { registerDocument } from './register-tree.js';
import { badgeLabel, renderTerms } from './terms.js';

const labelsPath = join(
  import.meta.dirname,
  'markdown-register.labels.snapshot.txt',
);

const registerGolden = join(
  repositoryRoot,
  'test-data/render/two-diagrams.register.snapshot.md',
);

const reader = unified().use(remarkParse).use(remarkGfm);

type ThreatFields = Parameters<typeof threatOf>[0];

type CategoryVariant = (typeof threatCategorySchema)['options'][number];

type EnumeratedVariant = Exclude<CategoryVariant, typeof customCategorySchema>;

function isEnumerated(variant: CategoryVariant): variant is EnumeratedVariant {
  return variant !== customCategorySchema;
}

const everyCategory: readonly ThreatCategory[] = [
  ...threatCategorySchema.options.filter(isEnumerated).flatMap((variant) =>
    [...variant.shape.category.options].map((category) =>
      threatCategorySchema.parse({
        methodology: variant.shape.methodology.value,
        category,
      }),
    ),
  ),
  threatCategorySchema.parse({
    methodology: 'custom',
    methodologyName: 'OWASP LLM Top 10',
    category: 'Prompt injection',
  }),
];

const labelledMembers: readonly {
  readonly member: string;
  readonly column: number;
  readonly fields: Omit<ThreatFields, 'number'>;
}[] = [
  ...severitySchema.options.map((severity) => ({
    member: `severity ${severity}`,
    column: 4,
    fields: { severity },
  })),
  ...threatStatusSchema.options.map((status) => ({
    member: `status ${status}`,
    column: 5,
    fields: { status },
  })),
  ...everyCategory.map((category) => ({
    member: `category ${category.methodology} ${category.category}`,
    column: 3,
    fields: { category },
  })),
];

function diagramOf(
  id: string,
  elements: readonly { readonly id: string; readonly name: string }[],
): Diagram {
  return diagramSchema.parse({
    id,
    title: id,
    elements: elements.map((element) =>
      boxAt(
        element.id,
        0,
        0,
        'process',
        { width: 100, height: 60 },
        element.name,
      ),
    ),
  });
}

function titleLine(item: ListItem): Strong[] {
  const [lead] = item.children;
  return lead.type === 'paragraph'
    ? lead.children.filter((node) => node.type === 'strong')
    : [];
}

const everyRecordLabel = modelFrom({
  threats: [
    threatOf({ number: 1, status: 'mitigated' }),
    threatOf({ number: 2 }),
  ],
  mitigations: mitigationStatusSchema.options.map((status) =>
    mitigationOf({ id: `mitigation-${status}`, threats: ['threat-2'], status }),
  ),
  assumptions: assumptionStatusSchema.options.map((status) =>
    assumptionOf({ id: `assumption-${status}`, threats: ['threat-1'], status }),
  ),
});

function headingsOf(
  document: string,
): { readonly depth: number; readonly text: string }[] {
  return reader
    .parse(document)
    .children.flatMap((node) =>
      node.type === 'heading'
        ? [{ depth: node.depth, text: textOf(node.children) }]
        : [],
    );
}

function tableRowsOf(document: string): string[][] {
  return reader
    .parse(document)
    .children.flatMap((node) =>
      node.type === 'table'
        ? node.children.map((row) =>
            row.children.map((cell) => textOf(cell.children)),
          )
        : [],
    );
}

function threatTargetsOf(document: string): string[] {
  return [...document.matchAll(/^<a name="([^"]+)"><\/a>$/gmu)].map(
    (match) => match[1],
  );
}

function overviewLinksOf(
  document: string,
): { readonly number: string; readonly target: string }[] {
  return reader.parse(document).children.flatMap((node) =>
    node.type === 'table'
      ? node.children.slice(1).flatMap((row) => {
          const link = row.children[0]?.children[0];
          return link?.type === 'link'
            ? [{ number: textOf(link.children), target: link.url }]
            : [];
        })
      : [],
  );
}

function sectionsOf(document: string): string[] {
  return document
    .split(/^(?=<a name="threat-\d+"><\/a>\n\n## Threat )/m)
    .slice(1);
}

describe('the two-diagram register', () => {
  const model = twoDiagramsModel;

  it('matches the golden file committed under test-data, on a second run too', async () => {
    const first = renderRegister(model, 'en-CA');
    const second = renderRegister(model, 'en-CA');
    expect(second).toBe(first);
    await expect(second).toMatchFileSnapshot(registerGolden);
  });

  it('carries one section per threat, in number order, after the section for the assumptions that apply to the model', () => {
    const numbers = model.threats.map((threat) => threat.number);
    numbers.sort((left, right) => left - right);
    const modelSections = model.assumptions.some(
      ({ appliesToModel }) => appliesToModel,
    )
      ? 1
      : 0;
    expect(
      headingsOf(renderRegister(model, 'en-CA'))
        .filter((entry) => entry.depth === 2)
        .slice(modelSections)
        .map((entry) => entry.text),
    ).toEqual(
      numbers.map((number) => {
        const threat = model.threats.find(
          (candidate) => candidate.number === number,
        );
        return `Threat ${number}: ${threat?.title ?? ''}`;
      }),
    );
  });

  it('carries one overview row per threat, under the six column headings', () => {
    const rows = tableRowsOf(renderRegister(model, 'en-CA'));
    expect(rows[0]).toEqual([
      'Number',
      'Title',
      'Elements',
      'Category',
      'Severity',
      'Status',
    ]);
    expect(rows.length).toBe(model.threats.length + 1);
  });

  it('links every overview number to its explicit detail target', () => {
    const numbers = model.threats.map((threat) => threat.number);
    numbers.sort((left, right) => left - right);
    const targets = numbers.map((number) => `threat-${String(number)}`);
    expect(threatTargetsOf(renderRegister(model, 'en-CA'))).toEqual(targets);
    expect(overviewLinksOf(renderRegister(model, 'en-CA'))).toEqual(
      numbers.map((number) => ({
        number: String(number),
        target: `#threat-${String(number)}`,
      })),
    );
  });
});

describe('the register document', () => {
  it('titles itself after the model', () => {
    expect(
      headingsOf(renderRegister(modelFrom({ threats: [] }), 'en-CA'))[0],
    ).toEqual({
      depth: 1,
      text: 'Sample threat register',
    });
  });

  it('titles itself bare where the model carries no title', () => {
    expect(
      headingsOf(
        renderRegister(modelFrom({ threats: [], title: '' }), 'en-CA'),
      )[0],
    ).toEqual({
      depth: 1,
      text: 'Threat register',
    });
  });

  it('keeps its title on one line where the model title carries a break', () => {
    expect(
      headingsOf(
        renderRegister(
          modelFrom({ threats: [], title: 'Two\nlines' }),
          'en-CA',
        ),
      )[0],
    ).toEqual({ depth: 1, text: 'Two lines threat register' });
  });

  it('states that a model holding no threats records none, and writes no table', () => {
    const rendered = renderRegister(modelFrom({ threats: [] }), 'en-CA');
    expect(rendered).toContain('This model records no threats.');
    expect(tableRowsOf(rendered)).toEqual([]);
  });

  it('keeps appearance out of portable output and permits the host stylesheet', () => {
    const plain = renderRegister(badgedModel, 'en-CA');
    const styled = renderRegister(badgedModel, 'en-CA', {
      styled: true,
      stylesheet: false,
    });
    expect(plain).toContain('High');
    expect(plain).toContain('Accepted risk');
    expect(plain).not.toContain('saer-badge');
    expect(styled).toContain('<span class="saer-badge-label">High</span>');
    expect(styled).not.toContain('<style>');
    expect(styled).not.toContain('style=');
    expect(styled).toContain('<div class="saer-register">');
  });
});

describe.each([false, true])('register embedding, styled %s', (styled) => {
  it('starts threats at H3 below an existing H2 without another title', () => {
    const options = { styled, title: false, headingLevel: 3 as const };
    const markdown = renderRegister(badgedModel, 'en-CA', options);
    expect(markdown).toContain('### Threat 7:');
    expect(markdown).not.toMatch(/^# /mu);
    expect(markdown).toContain('#### First');
    expect(markdown).toContain('###### Last');
    expect(markdown).toContain('<a name="threat-7"></a>');
    expect(markdown).toContain('[7](#threat-7)');
  });

  it.each([1, 2, 3, 4, 5, 6] as const)(
    'keeps anchors when the first heading is H%s',
    (headingLevel) => {
      for (const title of [false, true]) {
        const markdown = renderRegister(badgedModel, 'en-CA', {
          styled,
          title,
          headingLevel,
        });
        expect(markdown).toContain('<a name="threat-7"></a>');
        expect(markdown).toContain('[7](#threat-7)');
        const headings = registerDocument(badgedModel, 'en-CA', {
          title,
          headingLevel,
        }).children.filter((node) => node.type === 'heading');
        expect(headings[0].depth).toBe(headingLevel);
        expect(headings.every((node) => node.depth <= 6)).toBe(true);
      }
    },
  );
});

describe('a threat section', () => {
  it('leads its heading with the number, then the title', () => {
    const rendered = renderRegister(
      modelFrom({ threats: [threatOf({ number: 7, title: 'Token replay' })] }),
      'en-CA',
    );
    expect(headingsOf(rendered)).toContainEqual({
      depth: 2,
      text: 'Threat 7: Token replay',
    });
  });

  it.each([
    { named: 'ends in', title: 'Token replay\n' },
    { named: 'opens on', title: '\nToken replay' },
  ])('keeps its heading where the title $named a line break', ({ title }) => {
    const rendered = renderRegister(
      modelFrom({ threats: [threatOf({ number: 1, title })] }),
      'en-CA',
    );
    expect(headingsOf(rendered).filter((entry) => entry.depth === 2)).toEqual([
      { depth: 2, text: 'Threat 1: Token replay' },
    ]);
  });

  it('cannot forge another threat heading from a line inside a title', () => {
    const rendered = renderRegister(
      modelFrom({
        threats: [
          threatOf({
            number: 1,
            title: 'x\n\nThreat 2: Someone elses title',
          }),
          threatOf({ number: 2, title: 'The real second threat' }),
        ],
      }),
      'en-CA',
    );
    expect(headingsOf(rendered).filter((entry) => entry.depth === 2)).toEqual([
      { depth: 2, text: 'Threat 1: x Threat 2: Someone elses title' },
      { depth: 2, text: 'Threat 2: The real second threat' },
    ]);
  });

  it('gives two titles sharing a trailing line two headings of their own', () => {
    const rendered = renderRegister(
      modelFrom({
        threats: [
          threatOf({ number: 1, title: 'first\nShared tail' }),
          threatOf({ number: 2, title: 'second\nShared tail' }),
        ],
      }),
      'en-CA',
    );
    expect(headingsOf(rendered).filter((entry) => entry.depth === 2)).toEqual([
      { depth: 2, text: 'Threat 1: first Shared tail' },
      { depth: 2, text: 'Threat 2: second Shared tail' },
    ]);
  });

  it('lists the fields of the threat under the heading', () => {
    const rendered = renderRegister(
      modelFrom({
        threats: [
          threatOf({
            number: 1,
            severity: 'critical',
            status: 'accepted-risk',
            elements: ['el-a'],
          }),
        ],
        diagrams: [diagramOf('d0', [{ id: 'el-a', name: 'Gateway' }])],
      }),
      'en-CA',
    );
    expect(rendered).toContain('- **Elements**: Gateway');
    expect(rendered).toContain('- **Category**: Tampering (STRIDE)');
    expect(rendered).toContain('- **Severity**: Critical');
    expect(rendered).toContain('- **Status**: Accepted risk');
  });

  it('names every element the threat attaches to, across diagrams', () => {
    const rendered = renderRegister(
      modelFrom({
        threats: [threatOf({ number: 1, elements: ['el-a', 'el-b'] })],
        diagrams: [
          diagramOf('d0', [{ id: 'el-a', name: 'Gateway' }]),
          diagramOf('d1', [{ id: 'el-b', name: 'Ledger' }]),
        ],
      }),
      'en-CA',
    );
    expect(rendered).toContain('- **Elements**: Gateway, Ledger');
  });

  it('says None where the threat attaches to no element', () => {
    expect(
      renderRegister(
        modelFrom({ threats: [threatOf({ number: 1 })] }),
        'en-CA',
      ),
    ).toContain('- **Elements**: None');
  });

  it('falls back to the element id where the element has no name', () => {
    const rendered = renderRegister(
      modelFrom({
        threats: [threatOf({ number: 1, elements: ['el-a'] })],
        diagrams: [diagramOf('d0', [{ id: 'el-a', name: '' }])],
      }),
      'en-CA',
    );
    expect(rendered).toContain('- **Elements**: el-a');
  });

  it('falls back to the element id where the reference resolves to nothing', () => {
    const rendered = renderRegister(
      modelFrom({ threats: [threatOf({ number: 1, elements: ['el-gone'] })] }),
      'en-CA',
    );
    expect(rendered).toContain('- **Elements**: el-gone');
  });

  it('says None recorded where the threat carries neither prose nor records, and holds no mitigation prose section', () => {
    const rendered = renderRegister(
      modelFrom({ threats: [threatOf({ number: 1 })] }),
      'en-CA',
    );
    expect(rendered).toContain('**Description**\n\nNone recorded.');
    expect(rendered).not.toContain('**Mitigation**');
    expect(rendered).toContain('**Mitigations**\n\nNone recorded.');
    expect(rendered).toContain('**Assumptions**\n\nNone recorded.');
  });

  it('labels every severity, status, category, record status, flag and section the model declares', async () => {
    const rendered = renderRegister(
      modelFrom({
        threats: labelledMembers.map((entry, index) =>
          threatOf({ number: index + 1, ...entry.fields }),
        ),
      }),
      'en-CA',
    );
    const rows = tableRowsOf(rendered).slice(1);
    expect(rows.length).toBe(labelledMembers.length);
    const listing = labelledMembers
      .map((entry, index) => `${entry.member}: ${rows[index][entry.column]}`)
      .join('\n');
    const recordLines = [
      ...new Set(
        badgeTextsIn(registerDocument(everyRecordLabel, 'en-CA').children)
          .filter(({ badge }) => !['severity', 'status'].includes(badge.kind))
          .map(({ badge, label }) => `${badge.kind} ${badge.value}: ${label}`),
      ),
    ];
    expect(recordLines.length).toBe(
      mitigationStatusSchema.options.length +
        assumptionStatusSchema.options.length +
        threatFlagSchema.options.length,
    );
    const [sectionHeading] = modelSectionIn(
      registerDocument(
        modelFrom({
          threats: [],
          mitigations: [],
          assumptions: [
            assumptionOf({
              id: 'assumption-a',
              threats: [],
              appliesToModel: true,
            }),
          ],
        }),
        'en-CA',
      ),
    );
    const sectionLine = `section model-assumptions: ${textOf([sectionHeading])}`;
    await expect(
      `${listing}\n${recordLines.join('\n')}\n${sectionLine}\n`,
    ).toMatchFileSnapshot(labelsPath);
  });
});

describe("a threat's records", () => {
  const model = modelFrom({
    threats: [threatOf({ number: 1 }), threatOf({ number: 2 })],
    mitigations: [
      mitigationOf({
        id: 'mitigation-a',
        threats: ['threat-2'],
        prose: 'elsewhere',
      }),
      mitigationOf({
        id: 'mitigation-b',
        threats: ['threat-1'],
        status: 'verified',
        prose: 'second in the model',
      }),
      mitigationOf({ id: 'mitigation-c', threats: [], prose: 'unlinked' }),
      mitigationOf({
        id: 'mitigation-d',
        threats: ['threat-2', 'threat-1'],
        status: 'implemented',
        prose: 'shared',
      }),
    ],
    assumptions: [
      assumptionOf({ id: 'assumption-a', threats: [], prose: 'unlinked' }),
      assumptionOf({
        id: 'assumption-b',
        threats: ['threat-1'],
        status: 'valid',
        prose: 'held',
      }),
    ],
  });

  it('lists exactly the linked records, with their status badges, in model order', () => {
    const [first] = threatSectionsIn(registerDocument(model, 'en-CA'));
    const mitigations = recordItems(first, 'Mitigations');
    const assumptions = recordItems(first, 'Assumptions');
    expect(mitigations.map((item) => badgesIn(item.children))).toEqual([
      [{ kind: 'mitigation', value: 'verified' }],
      [{ kind: 'mitigation', value: 'implemented' }],
    ]);
    expect(assumptions.map((item) => badgesIn(item.children))).toEqual([
      [{ kind: 'assumption', value: 'valid' }],
    ]);
    const [written] = threatSectionsIn(
      reader.parse(renderRegister(model, 'en-CA')),
    );
    expect(
      recordItems(written, 'Mitigations').map((item) =>
        textOf(item.children.slice(1)),
      ),
    ).toEqual(['second in the model', 'shared']);
    expect(
      recordItems(written, 'Assumptions').map((item) =>
        textOf(item.children.slice(1)),
      ),
    ).toEqual(['held']);
  });

  it('lists a shared record in each of its threats, and in no other part of the register', () => {
    const tree = registerDocument(model, 'en-CA');
    const sections = threatSectionsIn(tree);
    expect(
      sections.map((section) =>
        recordItems(section, 'Mitigations').map((item) =>
          textOf(item.children.slice(1)),
        ),
      ),
    ).toEqual([
      ['second in the model', 'shared'],
      ['elsewhere', 'shared'],
    ]);
    const beforeSections = tree.children.slice(
      0,
      tree.children.findIndex(
        (node) => node.type === 'heading' && node.depth === 2,
      ),
    );
    expect(beforeSections.some((node) => node.type === 'list')).toBe(false);
    expect(textOf(beforeSections)).not.toContain('shared');
    expect(renderRegister(model, 'en-CA')).not.toContain('unlinked');
  });

  it('writes a mitigation title before its prose, and no title line where it has none', () => {
    const titledModel = modelFrom({
      threats: [threatOf({ number: 1 })],
      mitigations: [
        mitigationOf({
          id: 'mitigation-titled',
          threats: ['threat-1'],
          title: 'Pinned digests',
          prose: 'titled prose',
        }),
        mitigationOf({
          id: 'mitigation-bare',
          threats: ['threat-1'],
          prose: 'bare prose',
        }),
      ],
    });
    for (const tree of [
      registerDocument(titledModel, 'en-CA'),
      reader.parse(renderRegister(titledModel, 'en-CA')),
    ]) {
      const [section] = threatSectionsIn(tree);
      const [titled, bare] = recordItems(section, 'Mitigations');
      expect(titleLine(titled).map((node) => textOf(node.children))).toEqual([
        'Pinned digests',
      ]);
      expect(textOf(titled.children.slice(1))).toBe('titled prose');
      expect(titleLine(bare)).toEqual([]);
      expect(textOf(bare.children.slice(1))).toBe('bare prose');
    }
  });

  it('parses record prose as markdown, demoting its headings and keeping its lists and HTML', () => {
    const rendered = renderRegister(
      modelFrom({
        threats: [threatOf({ number: 1 })],
        mitigations: [
          mitigationOf({
            id: 'mitigation-a',
            threats: ['threat-1'],
            prose: '# Rollout\n\n* one\n* two\n\n<b>bold</b>',
          }),
        ],
        assumptions: [
          assumptionOf({
            id: 'assumption-a',
            threats: ['threat-1'],
            prose: '## Premise',
          }),
        ],
      }),
      'en-CA',
    );
    const [section] = threatSectionsIn(reader.parse(rendered));
    const [mitigation] = recordItems(section, 'Mitigations');
    const [assumption] = recordItems(section, 'Assumptions');
    expect(mitigation.children.map((node) => node.type)).toEqual([
      'paragraph',
      'heading',
      'list',
      'paragraph',
    ]);
    expect(
      [mitigation.children[1], assumption.children[1]].map((node) =>
        node.type === 'heading' ? node.depth : 0,
      ),
    ).toEqual([3, 4]);
    expect(rendered).toContain('<b>bold</b>');
  });
});

describe('the assumptions that apply to the model', () => {
  const model = scopedAssumptionsModel;

  it('sit in one section between the overview and the first threat, with their status badges in model order', () => {
    const tree = registerDocument(model, 'en-CA');
    expect(tree.children[1]?.type).toBe('table');
    const section = modelSectionIn(tree);
    expect(section.map((node) => node.type)).toEqual(['heading', 'list']);
    expect(section[0]).toMatchObject({ type: 'heading', depth: 2 });
    expect(
      sectionItems(section).map((item) => badgesIn(item.children)),
    ).toEqual([
      [{ kind: 'assumption', value: 'invalidated' }],
      [{ kind: 'assumption', value: 'unconfirmed' }],
    ]);
    const written = modelSectionIn(
      reader.parse(renderRegister(model, 'en-CA')),
    );
    expect(written.map((node) => node.type)).toEqual(['heading', 'list']);
    expect(
      sectionItems(written).map((item) => textOf(item.children.slice(1))),
    ).toEqual(['model only', 'model and threat']);
  });

  it('have no section where no assumption applies to the model', () => {
    const unscoped = modelFrom({
      threats: [threatOf({ number: 1 })],
      mitigations: [],
      assumptions: [
        assumptionOf({ id: 'assumption-a', threats: ['threat-1'] }),
      ],
    });
    expect(modelSectionIn(registerDocument(unscoped, 'en-CA'))).toEqual([]);
    expect(
      modelSectionIn(reader.parse(renderRegister(unscoped, 'en-CA'))),
    ).toEqual([]);
  });

  it('follow the no-threats paragraph in a model holding no threats', () => {
    const threatless = modelFrom({
      threats: [],
      mitigations: [],
      assumptions: [
        assumptionOf({
          id: 'assumption-a',
          threats: [],
          appliesToModel: true,
          status: 'valid',
        }),
      ],
    });
    for (const tree of [
      registerDocument(threatless, 'en-CA'),
      reader.parse(renderRegister(threatless, 'en-CA')),
    ]) {
      expect(tree.children.map((node) => node.type)).toEqual([
        'heading',
        'paragraph',
        'heading',
        'list',
      ]);
    }
    expect(
      badgesIn(modelSectionIn(registerDocument(threatless, 'en-CA'))),
    ).toEqual([{ kind: 'assumption', value: 'valid' }]);
  });

  it('parse their prose as markdown, demoting its headings and keeping its lists and HTML', () => {
    const rendered = renderRegister(
      modelFrom({
        threats: [threatOf({ number: 1 })],
        mitigations: [],
        assumptions: [
          assumptionOf({
            id: 'assumption-a',
            threats: [],
            appliesToModel: true,
            prose: '# Premise\n\n* one\n* two\n\n<b>bold</b>',
          }),
        ],
      }),
      'en-CA',
    );
    const [item] = sectionItems(modelSectionIn(reader.parse(rendered)));
    expect(item.children.map((node) => node.type)).toEqual([
      'paragraph',
      'heading',
      'list',
      'paragraph',
    ]);
    expect(item.children[1]).toMatchObject({ type: 'heading', depth: 3 });
    expect(rendered).toContain('<b>bold</b>');
  });
});

describe('threat prose', () => {
  it('splices the markdown of a description in as nodes', () => {
    const rendered = renderRegister(
      modelFrom({
        threats: [
          threatOf({
            number: 1,
            description:
              'A list:\n\n* one\n* two\n\nA [link](https://example.invalid).',
          }),
        ],
      }),
      'en-CA',
    );
    expect(rendered).toContain('- one\n- two');
    expect(rendered).toContain('A [link](https://example.invalid).');
  });

  it('demotes a heading inside prose below the section heading', () => {
    const rendered = renderRegister(
      modelFrom({
        threats: [
          threatOf({
            number: 1,
            description: '# Attack path\n\nText.\n\n###### Deep\n\nText.',
          }),
        ],
      }),
      'en-CA',
    );
    expect(headingsOf(rendered).map((entry) => entry.depth)).toEqual([
      1, 2, 3, 6,
    ]);
    expect(headingsOf(rendered)[2]).toEqual({ depth: 3, text: 'Attack path' });
  });

  it('renders prose nested past the depth bound as the text the author wrote', () => {
    const rendered = renderRegister(
      modelFrom({
        threats: [
          threatOf({ number: 1, description: `${'> '.repeat(4000)}too deep` }),
        ],
      }),
      'en-CA',
    );
    expect(rendered).toContain('too deep');
  });

  it('passes raw HTML in prose through unchanged', () => {
    const rendered = renderRegister(
      modelFrom({
        threats: [
          threatOf({
            number: 1,
            description: 'Set <span data-role="note">the flag</span> first.',
          }),
        ],
      }),
      'en-CA',
    );
    expect(rendered).toContain('Set <span data-role="note">the flag</span>');
  });
});

describe('a hostile threat title', () => {
  const title = '# Pipe | backtick ` asterisk * end';
  const rendered = renderRegister(
    modelFrom({ threats: [threatOf({ number: 1, title })] }),
    'en-CA',
  );

  it('reaches the heading as the text the author wrote', () => {
    expect(headingsOf(rendered)).toContainEqual({
      depth: 2,
      text: `Threat 1: ${title}`,
    });
  });

  it('reaches the overview table as the text the author wrote', () => {
    expect(tableRowsOf(rendered)[1]?.[1]).toBe(title);
  });

  it('is escaped rather than carried through raw', () => {
    expect(rendered).toContain('\\|');
    expect(rendered).toContain('\\`');
    expect(rendered).toContain('\\*');
  });
});

describe('a register render', () => {
  it('writes the same bytes whatever order the threats arrive in', () => {
    const threats = [
      threatOf({ number: 3 }),
      threatOf({ number: 1 }),
      threatOf({ number: 2 }),
    ];
    expect(renderRegister(modelFrom({ threats: threats }), 'en-CA')).toBe(
      renderRegister(modelFrom({ threats: inNumberOrder(threats) }), 'en-CA'),
    );
  });

  it('keeps a target when its threat title changes', () => {
    const before = renderRegister(
      modelFrom({ threats: [threatOf({ number: 7, title: 'Token replay' })] }),
      'en-CA',
    );
    const after = renderRegister(
      modelFrom({
        threats: [threatOf({ number: 7, title: 'Replay of a token' })],
      }),
      'en-CA',
    );
    expect(threatTargetsOf(after)).toEqual(threatTargetsOf(before));
    expect(overviewLinksOf(after)).toEqual(overviewLinksOf(before));
  });

  it('leaves every existing section byte-identical when a higher-numbered threat is added', () => {
    const existing = [threatOf({ number: 1 }), threatOf({ number: 2 })];
    const before = sectionsOf(
      renderRegister(modelFrom({ threats: existing }), 'en-CA'),
    );
    const after = sectionsOf(
      renderRegister(
        modelFrom({ threats: [...existing, threatOf({ number: 3 })] }),
        'en-CA',
      ),
    );
    expect(after.slice(0, before.length).join('').trimEnd()).toBe(
      before.join('').trimEnd(),
    );
    expect(after.length).toBe(before.length + 1);
  });

  it('leaves every surviving target unmoved when one threat is removed', () => {
    const existing = [
      threatOf({ number: 1 }),
      threatOf({ number: 2 }),
      threatOf({ number: 3 }),
    ];
    const targetsBefore = threatTargetsOf(
      renderRegister(modelFrom({ threats: existing }), 'en-CA'),
    );
    const targetsAfter = threatTargetsOf(
      renderRegister(
        modelFrom({ threats: [existing[0], existing[2]] }),
        'en-CA',
      ),
    );
    expect(targetsAfter).toEqual([targetsBefore[0], targetsBefore[2]]);
  });
});

function shapeOf(node: Nodes): unknown {
  return 'children' in node
    ? [node.type, ...node.children.map(shapeOf)]
    : node.type;
}

describe.each(translatedLocales)('the register in %s', (locale) => {
  const { t } = exportText(locale);
  const terms = renderTerms(locale);
  const english = registerDocument(twoDiagramsModel, 'en-CA');
  const translated = registerDocument(twoDiagramsModel, locale);
  const written = renderRegister(twoDiagramsModel, locale);

  it("heads the register, its columns and its sections in the locale's words", () => {
    expect(headingsOf(written)[0].text).toBe(
      t('register.titled', { title: twoDiagramsModel.metadata.title }),
    );
    expect(tableRowsOf(written)[0]).toEqual(
      (
        [
          'register.number',
          'register.title',
          'register.elements',
          'register.category',
          'register.severity',
          'register.status',
        ] as const
      ).map((column) => t(column)),
    );
    expect(written).toContain(t('register.model-assumptions'));
    expect(written).not.toContain('Assumptions that apply to the model');
  });

  it("labels every badge in the locale's terms, under the same roles", () => {
    const badges = badgeTextsIn(translated.children);
    expect(badges.map(({ badge }) => badge)).toEqual(
      badgesIn(english.children),
    );
    expect(badges.map(({ label }) => label)).toEqual(
      badges.map(({ badge }) => badgeLabel(badge, terms)),
    );
  });

  it('keeps the en-CA tree, only reworded', () => {
    expect(shapeOf(translated)).toEqual(shapeOf(english));
  });

  it("passes the author's text through untouched", () => {
    for (const threat of twoDiagramsModel.threats) {
      expect(written).toContain(threat.title);
      expect(written).toContain(threat.description);
    }
    expect(written).toContain('Callback integrity (Payments checklist)');
  });

  it('classes a styled badge by its role, whatever its label', () => {
    const styled = renderRegister(badgedModel, locale, { styled: true });
    expect(styled).toContain(
      `<span class="saer-badge saer-severity saer-severity-high"><span class="saer-badge-label">${terms.severity('high')}</span></span>`,
    );
  });
});
