import { smallYaml, unplacedFlowYaml } from '@saerskriven/mcp/fixtures';
import {
  committedText,
  repositoryRoot,
  sha256Of,
  testDataPath,
} from '@saerskriven/model/fixtures';
import { copyFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  danglingReferenceYaml,
  fixtureFile,
  renderGolden,
  scratchDirectory,
} from './cli.fixtures.js';
import { compileTimeout, pageCount } from './pdf.fixtures.js';
import { render, type RenderOptions } from './render.js';

const directory = scratchDirectory('render');

const twoDiagrams = testDataPath('saerskriven/two-diagrams.yaml');

const golden = (name: string): string => renderGolden(name).toString('utf8');

const pdfDigest = golden('two-diagrams.snapshot.pdf.sha256').trim();

const storefront = { diagram: 'storefront' };

const options = (given: Partial<RenderOptions>): RenderOptions => ({
  format: 'svg',
  out: '-',
  ...given,
});

const assets = join(repositoryRoot, 'apps/cli/dist/assets');

const bytesOf = (out: string | Uint8Array): Uint8Array =>
  typeof out === 'string' ? Buffer.from(out, 'utf8') : out;

const written = async (
  name: string,
  file: string,
  given: Partial<RenderOptions>,
) => {
  const out = join(directory, name);
  return {
    outcome: await render(file, options({ ...given, out }), assets),
    bytes: () => readFileSync(out),
    text: () => readFileSync(out, 'utf8'),
  };
};

describe('render', () => {
  it('writes the register of the two-diagram model as the golden file', async () => {
    const run = await written('two-diagrams.register.md', twoDiagrams, {
      format: 'md',
    });
    expect(run.outcome).toEqual({ code: 0, out: '', err: '' });
    expect(run.text()).toEqual(golden('two-diagrams.register.snapshot.md'));
  });

  it('draws a diagram of the two-diagram model as the golden file', async () => {
    const run = await written('storefront.svg', twoDiagrams, {
      format: 'svg',
      ...storefront,
    });
    expect(run.outcome).toEqual({ code: 0, out: '', err: '' });
    expect(run.text()).toEqual(golden('two-diagrams-storefront.snapshot.svg'));
  });

  it('writes the register to standard output for an out of -', async () => {
    await expect(
      render(twoDiagrams, options({ format: 'md', out: '-' })),
    ).resolves.toEqual({
      code: 0,
      out: golden('two-diagrams.register.snapshot.md'),
      err: '',
    });
  });

  it('rasterizes the diagram a model of several names by id', async () => {
    const run = await written('fulfilment.png', twoDiagrams, {
      format: 'png',
      diagram: 'fulfilment',
    });
    expect(run.outcome).toEqual({ code: 0, out: '', err: '' });
    expect(run.bytes()).toEqual(
      renderGolden('two-diagrams-fulfilment.snapshot.png'),
    );
  });

  it('writes a PNG to standard output as bytes, not as text', async () => {
    const outcome = await render(
      twoDiagrams,
      options({ format: 'png', out: '-', ...storefront }),
      assets,
    );
    expect(outcome.code).toBe(0);
    expect(outcome.out).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(bytesOf(outcome.out))).toEqual(
      renderGolden('two-diagrams-storefront.snapshot.png'),
    );
  });

  it('refuses an install with the module and no font face', async () => {
    const bare = scratchDirectory('bare');
    copyFileSync(
      join(assets, 'saerskriven_resvg.wasm'),
      join(bare, 'saerskriven_resvg.wasm'),
    );
    const outcome = await render(
      twoDiagrams,
      options({ format: 'png', out: '-', ...storefront }),
      bare,
    );
    expect(outcome.code).toBe(2);
    expect(outcome.out).toBe('');
    expect(outcome.err).toBe(
      `error: cannot draw the PNG: ${bare} holds no .ttf font face\n`,
    );
  });

  it('refuses an install whose faces the drawing is not lettered in', async () => {
    const bare = scratchDirectory('mono');
    copyFileSync(
      join(assets, 'saerskriven_resvg.wasm'),
      join(bare, 'saerskriven_resvg.wasm'),
    );
    copyFileSync(
      join(assets, 'LiberationMono-Regular.ttf'),
      join(bare, 'LiberationMono-Regular.ttf'),
    );
    const outcome = await render(
      twoDiagrams,
      options({ format: 'png', out: '-', ...storefront }),
      bare,
    );
    expect(outcome.code).toBe(2);
    expect(outcome.err).toBe(
      `error: cannot draw the PNG: ${bare} holds no LiberationSans-Regular.ttf, which text is set in\n`,
    );
  });

  it('reports an install missing the module it rasterizes with', async () => {
    const outcome = await render(
      twoDiagrams,
      options({ format: 'png', out: '-', ...storefront }),
      join(repositoryRoot, 'apps/cli/dist/absent'),
    );
    expect(outcome.code).toBe(2);
    expect(outcome.out).toBe('');
    expect(outcome.err).toContain('error: cannot draw the PNG');
  });

  it.each([
    {
      named:
        'a diagram of the two-diagram model to standard output for an out of -',
      file: () => twoDiagrams,
      diagram: 'storefront',
      golden: 'two-diagrams-storefront.snapshot.svg',
    },
    {
      named: 'the diagram a model of several names by title',
      file: () => twoDiagrams,
      diagram: 'Shipping an order',
      golden: 'two-diagrams-fulfilment.snapshot.svg',
    },
    {
      named: 'the diagram whose id a name is before one titled with it',
      file: () =>
        fixtureFile(
          directory,
          'colliding.yaml',
          committedText('saerskriven/two-diagrams.yaml').replace(
            'title: Taking an order',
            'title: fulfilment',
          ),
        ),
      diagram: 'fulfilment',
      golden: 'two-diagrams-fulfilment.snapshot.svg',
    },
  ])('draws $named', async ({ file, diagram, golden: goldenName }) => {
    await expect(
      render(file(), options({ format: 'svg', out: '-', diagram })),
    ).resolves.toEqual({ code: 0, out: golden(goldenName), err: '' });
  });

  it('lists the diagrams where a model of several names none', async () => {
    await expect(render(twoDiagrams, options({}))).resolves.toEqual({
      code: 2,
      out: '',
      err:
        'error: --diagram chooses which diagram to draw, and the model holds several:\n' +
        '  storefront: Taking an order\n' +
        '  fulfilment: Shipping an order\n',
    });
  });

  it('lists the diagrams where the name given is none of them', async () => {
    await expect(
      render(twoDiagrams, options({ diagram: 'nope' })),
    ).resolves.toEqual({
      code: 2,
      out: '',
      err:
        'error: the model holds no diagram named "nope".\n' +
        '  storefront: Taking an order\n' +
        '  fulfilment: Shipping an order\n',
    });
  });

  it('refuses to draw a model that holds no diagram', async () => {
    const file = fixtureFile(directory, 'no-diagram.yaml', smallYaml);
    await expect(render(file, options({}))).resolves.toEqual({
      code: 2,
      out: '',
      err: 'error: the model holds no diagram, so there is nothing to draw.\n',
    });
  });

  it('reports a flow endpoint the layout left out of the drawing', async () => {
    const file = fixtureFile(directory, 'unplaced.yaml', unplacedFlowYaml);
    await expect(render(file, options({ out: '-' }))).resolves.toMatchObject({
      code: 0,
      err:
        'warning: a flow endpoint names an element the canvas draws as no box, so its flow is not in the drawing.\n' +
        '  flow "flow-2" target names "flow-1"\n',
    });
  });

  it('refuses a diagram chosen for a register, which holds them all', async () => {
    await expect(
      render(twoDiagrams, options({ format: 'md', ...storefront })),
    ).resolves.toEqual({
      code: 2,
      out: '',
      err: 'error: --diagram chooses one diagram, and --format md writes the whole register.\n',
    });
  });

  it('refuses a diagram chosen for a PDF, which draws them all', async () => {
    await expect(
      render(twoDiagrams, options({ format: 'pdf', ...storefront })),
    ).resolves.toEqual({
      code: 2,
      out: '',
      err: 'error: --diagram chooses one diagram, and --format pdf writes every diagram and the register.\n',
    });
  });

  it(
    'compiles the two-diagram model to a PDF of diagrams and register',
    async () => {
      const run = await written('two-diagrams.pdf', twoDiagrams, {
        format: 'pdf',
      });
      expect(run.outcome).toEqual({ code: 0, out: '', err: '' });
      const pdf = run.bytes();
      expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      expect(pageCount(pdf)).toBe(6);
      expect(sha256Of(pdf)).toBe(pdfDigest);
    },
    compileTimeout,
  );

  it(
    'writes a PDF to standard output for an out of -',
    async () => {
      const outcome = await render(
        twoDiagrams,
        options({ format: 'pdf', out: '-' }),
        assets,
      );
      expect(outcome.code).toBe(0);
      expect(outcome.out).toBeInstanceOf(Uint8Array);
      expect(pageCount(bytesOf(outcome.out))).toBe(6);
    },
    compileTimeout,
  );

  it('reports an install missing the files it typesets with, and exits 2', async () => {
    const outcome = await render(
      twoDiagrams,
      options({ format: 'pdf', out: '-' }),
      join(repositoryRoot, 'apps/cli/dist/absent'),
    );
    expect(outcome.code).toBe(2);
    expect(outcome.out).toBe('');
    expect(outcome.err).toContain('error: cannot compile the PDF');
    expect(outcome.err).toContain('typst_ts_web_compiler_bg.wasm');
  });

  it('refuses an install with the module and no font face, and writes nothing', async () => {
    const bareAssets = scratchDirectory('render-no-font');
    copyFileSync(
      join(assets, 'typst_ts_web_compiler_bg.wasm'),
      join(bareAssets, 'typst_ts_web_compiler_bg.wasm'),
    );
    const outcome = await render(
      twoDiagrams,
      options({ format: 'pdf', out: '-' }),
      bareAssets,
    );
    expect(outcome).toEqual({
      code: 2,
      out: '',
      err: `error: cannot compile the PDF: ${bareAssets} holds no .ttf font face\n`,
    });
  });

  it('reports an out it cannot write as the invocation being wrong', async () => {
    const out = join(directory, 'absent', 'storefront.svg');
    await expect(
      render(twoDiagrams, options({ out, ...storefront })),
    ).resolves.toEqual({
      code: 2,
      out: '',
      err: `error: cannot write ${out}: ENOENT: no such file or directory, open '${out}'\n`,
    });
  });

  it('reports a file it read and refused before drawing anything', async () => {
    const file = fixtureFile(directory, 'dangling.yaml', danglingReferenceYaml);
    await expect(render(file, options({}))).resolves.toMatchObject({
      code: 1,
      out: '',
    });
  });
});
