import {
  assumptionSchema,
  mitigationSchema,
  parseModel,
  threatSchema,
  type Assumption,
  type Model,
  type Threat,
} from '@saerskriven/model';
import { Either } from 'effect';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderRegister } from './markdown-register.js';
import { badgeLabel } from './register-labels.js';
import { deepestProse } from './register-tree.js';
import { renderTypst } from './typst-document.js';

const repositoryRoot = join(import.meta.dirname, '../../../..');

const goldenPath = join(repositoryRoot, 'test-data/render/ecluse.snapshot.typ');

const committedModel = (name: string): Model =>
  Either.getOrThrow(
    parseModel(JSON.parse(readFileSync(join(repositoryRoot, name), 'utf8'))),
  );

const ecluseModel = committedModel('test-data/ecluse.model.json');

const saerskrivenModel = committedModel('test-data/saerskriven.model.json');

const threatOf = (fields: {
  readonly number: number;
  readonly title?: string;
  readonly description?: string;
  readonly status?: Threat['status'];
}): Threat =>
  threatSchema.parse({
    id: `threat-${String(fields.number)}`,
    title: `Threat ${String(fields.number)}`,
    category: { methodology: 'STRIDE', category: 'tampering' },
    severity: 'medium',
    status: 'open',
    description: '',
    elements: [],
    ...fields,
  });

const modelOf = (threats: readonly Threat[], title = 'Sample'): Model => ({
  metadata: { title, owner: '', description: '', contributors: [] },
  diagrams: [],
  threats: [...threats],
  lastIssuedThreatNumber: Math.max(
    0,
    ...threats.map((threat) => threat.number),
  ),
  mitigations: [],
  assumptions: [],
});

const sourceOf = (model: Model): string => renderTypst(model).typst;

const recordsModel = (
  mitigations: readonly {
    readonly prose: string;
    readonly threats?: readonly string[];
  }[],
  assumptions: readonly {
    readonly prose: string;
    readonly status?: Assumption['status'];
    readonly threats?: readonly string[];
    readonly appliesToModel?: boolean;
  }[] = [],
): Model => ({
  ...modelOf([threatOf({ number: 1 }), threatOf({ number: 2 })]),
  mitigations: mitigations.map((fields, index) =>
    mitigationSchema.parse({
      id: `mitigation-${String(index)}`,
      title: '',
      status: 'proposed',
      threats: ['threat-1'],
      ...fields,
    }),
  ),
  assumptions: assumptions.map((fields, index) =>
    assumptionSchema.parse({
      id: `assumption-${String(index)}`,
      status: 'valid',
      threats: ['threat-1'],
      appliesToModel: false,
      ...fields,
    }),
  ),
});

const modelScoped = { threats: [], appliesToModel: true } as const;

const modelSectionOf = (source: string): string => {
  const [, section = '', next = ''] = source.split('#heading(level: 2)[');
  return next.startsWith('#"Threat 1: ') ? section : '';
};

const callsOutsideLiterals = (source: string): Set<string> =>
  new Set(
    [...withoutLiterals(source).matchAll(/#(""|[a-z-]+|.)/gu)].map(
      (found) => found[1],
    ),
  );

const between = (source: string, from: string, to: string): string =>
  source.slice(source.indexOf(from), source.indexOf(to, source.indexOf(from)));

const proseOf = (written: string): string =>
  sourceOf(modelOf([threatOf({ number: 1, description: written })]));

const nested = (levels: number): string => `${'> '.repeat(levels)}bottom`;

const quotesIn = (source: string): number =>
  source.split('#quote(block: true)[').length - 1;

const withoutLiterals = (source: string): string =>
  source.replace(/"(?:[^"\\]|\\[\s\S])*"/gu, '""');

describe('the Typst document', () => {
  it('matches the golden file committed under test-data', async () => {
    await expect(sourceOf(ecluseModel)).toMatchFileSnapshot(goldenPath);
  });

  it('keeps Markdown navigation out of the PDF text', () => {
    const source = sourceOf(modelOf([threatOf({ number: 7 })]));
    expect(source).not.toContain('<a name="threat-7">');
    expect(source).not.toContain('(#threat-7)');
  });

  it('draws every diagram of the model, ahead of the register', () => {
    const source = sourceOf(saerskrivenModel);
    const images = source.split('#image(bytes(').length - 1;
    expect(images).toBe(saerskrivenModel.diagrams.length);
    expect(source.indexOf('#image(bytes(')).toBeLessThan(
      source.indexOf('threat register'),
    );
  });

  it('reports a flow endpoint no diagram could draw', () => {
    expect(renderTypst(ecluseModel).unplaced).toEqual([]);
  });

  it('writes the same source twice for the same model', () => {
    expect(sourceOf(ecluseModel)).toBe(sourceOf(ecluseModel));
  });
});

describe('a value out of the model', () => {
  it('reaches the source inside a string literal and nowhere else', () => {
    const source = proseOf(
      '#eval("1+1") #include "/etc/passwd" #read("/etc/passwd")',
    );
    expect(source).toContain('#eval(\\"1+1\\")');
    expect(withoutLiterals(source)).not.toContain('#eval');
    expect(withoutLiterals(source)).not.toContain('#read');
    expect(withoutLiterals(source)).not.toContain('#include');
  });

  it('cannot close the literal it is written in', () => {
    const source = proseOf('a" + read("/etc/passwd") + "b');
    expect(source).toContain('a\\" + read(\\"/etc/passwd\\") + \\"b');
    expect(withoutLiterals(source)).not.toContain('read');
  });

  it('cannot escape the literal with a trailing backslash', () => {
    expect(proseOf('trailing \\')).toContain('"trailing \\\\"');
  });

  it('carries markup characters through as text', () => {
    const source = proseOf('stars \\*not bold\\* and \\_not italic\\_');
    expect(source).toContain('stars *not bold* and _not italic_');
    expect(withoutLiterals(source)).not.toContain('*');
    expect(withoutLiterals(source)).not.toContain('_');
  });

  it('writes a control character as a Typst escape', () => {
    const title = `bell${String.fromCodePoint(7)}end`;
    expect(sourceOf(modelOf([], title))).toContain('bell\\u{7}end');
  });
});

describe('threat prose', () => {
  it('writes a raw HTML node as the text the author wrote', () => {
    const source = proseOf('Set <span onclick="boom()">the flag</span> first.');
    expect(source).toContain('#"<span onclick=\\"boom()\\">"');
    expect(source).toContain('the flag');
    expect(withoutLiterals(source)).not.toContain('<span');
    expect(withoutLiterals(source)).not.toContain('onclick');
  });

  it('keeps a mitigation an author wrote as HTML alone', () => {
    const model = recordsModel([{ prose: '<img src=x onerror="alert(1)">' }]);
    expect(sourceOf(model)).toContain('<img src=x onerror=');
    expect(renderRegister(model)).toContain('<img src=x onerror=');
  });

  it('writes a list as a Typst list', () => {
    expect(proseOf('- one\n- two')).toContain('#list([#"one"], [#"two"])');
  });

  it('writes a numbered list as a Typst enumeration', () => {
    expect(proseOf('3. one\n4. two')).toContain(
      '#enum(start: 3, [#"one"], [#"two"])',
    );
  });

  it('writes emphasis, strong and code through Typst functions', () => {
    const source = proseOf('*a* **b** `c`');
    expect(source).toContain('#emph[#"a"]');
    expect(source).toContain('#strong[#"b"]');
    expect(source).toContain('#raw("c")');
  });

  it('keeps the lines of a fenced code block', () => {
    expect(proseOf('```\nfirst\nsecond\n```')).toContain(
      '#raw(block: true, "first\nsecond")',
    );
  });

  it('writes a link as its own text with the address beside it', () => {
    const source = proseOf('A [link](https://example.invalid/x).');
    expect(source).toContain('#"link"');
    expect(source).toContain('#" (https://example.invalid/x)"');
    expect(withoutLiterals(source)).not.toContain('#link(');
  });

  it('writes an autolink once, not as its own address twice', () => {
    const source = proseOf('See <https://example.invalid/x> for more.');
    expect(source).toContain('#"https://example.invalid/x"');
    expect(source).not.toContain('#" (https://example.invalid/x)"');
  });

  it('keeps the address of a link definition and of an image', () => {
    expect(proseOf('![a picture](https://example.invalid/p.png)')).toContain(
      '#" (https://example.invalid/p.png)"',
    );
    expect(proseOf('[cite]: https://example.invalid/d')).toContain(
      '#"[cite]: https://example.invalid/d"',
    );
  });

  it('writes a quote, a rule, a break and a strikethrough', () => {
    expect(proseOf('> quoted')).toContain('#quote(block: true)[');
    expect(proseOf('a\n\n---\n\nb')).toContain('#line(length: 100%)');
    expect(proseOf('a\\\nb')).toContain('#linebreak()');
    expect(proseOf('~~gone~~')).toContain('#strike[#"gone"]');
  });

  it('writes a table and a heading inside prose', () => {
    const source = proseOf('| a | b |\n| - | - |\n| 1 | 2 |\n\n## Inside');
    expect(source).toContain('#table(columns: 2,');
    expect(source).toContain('#heading(level: 4)[#"Inside"]');
  });

  it('writes a footnote as its reference and its text', () => {
    const source = proseOf('A claim[^1].\n\n[^1]: The evidence.');
    expect(source).toContain('#"[1]"');
    expect(source).toContain('#"The evidence."');
  });

  it('writes a reference-style image as its alternative text', () => {
    const source = proseOf(
      '![a picture][p]\n\n[p]: https://example.invalid/p.png',
    );
    expect(source).toContain('#"a picture"');
  });

  it('writes a reference-style link as its text', () => {
    const source = proseOf(
      'See [the policy][p].\n\n[p]: https://example.invalid/p',
    );
    expect(source).toContain('#"the policy"');
    expect(source).toContain('#"[p]: https://example.invalid/p"');
  });

  it('collapses a soft line break inside a paragraph to a space', () => {
    expect(proseOf('first\nsecond')).toContain('#"first second"');
  });
});

describe("a threat's records", () => {
  it('lists the linked records with their status badges, in model order', () => {
    const source = sourceOf(
      recordsModel(
        [
          { prose: 'alpha' },
          { prose: 'elsewhere', threats: ['threat-2'] },
          { prose: 'beta' },
        ],
        [{ prose: 'gamma' }],
      ),
    );
    const threatOne = between(source, '#"Threat 1: ', '#"Threat 2: ');
    const mitigations = between(
      threatOne,
      '#strong[#"Mitigations"]',
      '#strong[#"Assumptions"]',
    );
    const assumptions = threatOne.slice(
      threatOne.indexOf('#strong[#"Assumptions"]'),
    );
    expect(mitigations.split('#saer-badge(').length - 1).toBe(2);
    expect(mitigations.indexOf('#"alpha"')).toBeLessThan(
      mitigations.indexOf('#"beta"'),
    );
    expect(mitigations.indexOf('#"alpha"')).toBeGreaterThan(-1);
    expect(assumptions.split('#saer-badge(').length - 1).toBe(1);
    expect(assumptions).toContain('#"gamma"');
    expect(threatOne).not.toContain('elsewhere');
  });

  it('writes record prose under the promises threat prose keeps', () => {
    const source = sourceOf(
      recordsModel([
        { prose: '# Rollout\n\n- one\n- two\n\n<b onclick="x()">bold</b>' },
      ]),
    );
    expect(source).toContain('#heading(level: 3)[#"Rollout"]');
    expect(source).toContain('#list([#"one"], [#"two"])');
    expect(source).toContain('#"<b onclick=\\"x()\\">"');
    expect(withoutLiterals(source)).not.toContain('<b');
  });

  it('writes record prose past the depth bound, counted from the register root, as the bytes the author wrote', () => {
    const admitted = sourceOf(
      recordsModel([{ prose: nested(deepestProse - 4) }]),
    );
    const refused = sourceOf(
      recordsModel([{ prose: nested(deepestProse - 3) }]),
    );
    expect(quotesIn(admitted)).toBe(deepestProse - 4);
    expect(quotesIn(refused)).toBe(0);
  });
});

describe("a threat's flags", () => {
  it('carry the badge of a mitigated threat with only proposed work in its Flags field', () => {
    const source = sourceOf({
      ...recordsModel([{ prose: 'alpha' }]),
      threats: [
        threatOf({ number: 1, status: 'mitigated' }),
        threatOf({ number: 2 }),
      ],
    });
    const flagsOf = (heading: string): string =>
      between(source.slice(source.indexOf(heading)), '#strong[#"Flags"]', '\n');
    const flagged = flagsOf('#"Threat 1: ');
    expect(flagged.split('#saer-badge(').length - 1).toBe(1);
    expect(flagged).toContain(
      `#saer-badge("${badgeLabel({ kind: 'flag', value: 'mitigated-without-implemented-work' })}"`,
    );
    expect(flagsOf('#"Threat 2: ')).not.toContain('#saer-badge(');
  });
});

describe('the assumptions that apply to the model', () => {
  it('sit in one section after the overview table and before the first threat, with their badges in model order', () => {
    const source = sourceOf(
      recordsModel(
        [],
        [
          { ...modelScoped, prose: 'alpha', status: 'invalidated' },
          { prose: 'threat only' },
          {
            ...modelScoped,
            prose: 'beta',
            threats: ['threat-1'],
            status: 'unconfirmed',
          },
        ],
      ),
    );
    const section = modelSectionOf(source);
    expect(source.indexOf('#table(')).toBeLessThan(source.indexOf(section));
    expect(section.split('#saer-badge(').length - 1).toBe(2);
    const invalidated = section.indexOf(
      `#saer-badge("${badgeLabel({ kind: 'assumption', value: 'invalidated' })}"`,
    );
    const unconfirmed = section.indexOf(
      `#saer-badge("${badgeLabel({ kind: 'assumption', value: 'unconfirmed' })}"`,
    );
    expect(invalidated).toBeGreaterThan(-1);
    expect(invalidated).toBeLessThan(section.indexOf('#"alpha"'));
    expect(section.indexOf('#"alpha"')).toBeLessThan(unconfirmed);
    expect(unconfirmed).toBeLessThan(section.indexOf('#"beta"'));
    expect(section).not.toContain('threat only');
  });

  it('write no section where no assumption applies to the model', () => {
    const source = sourceOf(recordsModel([], [{ prose: 'threat only' }]));
    expect(source.split('#heading(level: 2)[').length - 1).toBe(2);
  });

  it('write their prose under the promises threat prose keeps', () => {
    const source = modelSectionOf(
      sourceOf(
        recordsModel(
          [],
          [
            {
              ...modelScoped,
              prose: '# Premise\n\n- one\n- two\n\n<b onclick="x()">bold</b>',
            },
          ],
        ),
      ),
    );
    expect(source).toContain('#heading(level: 3)[#"Premise"]');
    expect(source).toContain('#list([#"one"], [#"two"])');
    expect(source).toContain('#"<b onclick=\\"x()\\">"');
    expect(withoutLiterals(source)).not.toContain('<b');
  });

  it("write a hostile assumption's prose with no # but the package's own", () => {
    const hostile = sourceOf(
      recordsModel(
        [],
        [
          {
            ...modelScoped,
            prose:
              '# Heading #eval("1+1")\n\n- #read("/etc/passwd")\n\n<script>alert(5)</script> a" + read("/etc/passwd") + "b #include "/etc/passwd" \\',
          },
        ],
      ),
    );
    const benign = sourceOf(
      recordsModel(
        [],
        [{ ...modelScoped, prose: '# Heading\n\n- item\n\nplain text' }],
      ),
    );
    expect(modelSectionOf(hostile)).toContain('#read(\\"/etc/passwd\\")');
    expect(callsOutsideLiterals(hostile)).toEqual(callsOutsideLiterals(benign));
  });

  it('write prose past the depth bound, counted from the register root, as the bytes the author wrote', () => {
    const admitted = modelSectionOf(
      sourceOf(
        recordsModel([], [{ ...modelScoped, prose: nested(deepestProse - 4) }]),
      ),
    );
    const refused = modelSectionOf(
      sourceOf(
        recordsModel([], [{ ...modelScoped, prose: nested(deepestProse - 3) }]),
      ),
    );
    expect(quotesIn(admitted)).toBe(deepestProse - 4);
    expect(quotesIn(refused)).toBe(0);
    expect(refused).toContain('bottom');
  });
});

describe('the prose depth bound', () => {
  it('is the depth both writers survive, counted from the root', () => {
    expect(deepestProse).toBe(16);
  });

  it('writes the deepest prose it admits as the nesting the author wrote', () => {
    const admitted = deepestProse - 2;
    const source = proseOf(nested(admitted));
    expect(quotesIn(source)).toBe(admitted);
    expect(
      renderRegister(
        modelOf([threatOf({ number: 1, description: nested(admitted) })]),
      ),
    ).toContain('bottom');
  });

  it("writes prose one level past the bound as the author's own bytes", () => {
    const source = proseOf(nested(deepestProse - 1));
    expect(quotesIn(source)).toBe(0);
    expect(source).toContain('bottom');
  });
});
