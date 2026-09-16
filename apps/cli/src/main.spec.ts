import { repositoryRoot } from '@saerskriven/model/fixtures';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, openSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderGolden, scratchDirectory } from './cli.fixtures.js';
import {
  bytePathCompileTimeout,
  outlineTitles,
  pageCount,
} from './pdf.fixtures.js';
import {
  ran,
  runners,
  spawnTimeout,
  text,
  titleOf,
} from './runners.fixtures.js';
import { cliVersion } from './version.js';

type Scenario = {
  readonly name: string;
  readonly args: readonly string[];
  readonly code: number;
  readonly out: string;
  readonly err: string;
};

const directory = scratchDirectory('main');

const fullDevice = '/dev/full';

const twoDiagrams = 'test-data/saerskriven/two-diagrams.yaml';

const digestOf = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

const scenarios: readonly Scenario[] = [
  {
    name: 'validates a Threat Dragon file',
    args: ['validate', 'test-data/threat-dragon/feature-complete.json'],
    code: 0,
    out: 'threat-dragon: 2 diagrams, 13 elements, 24 threats\n',
    err:
      'warning: the file and the model do not correspond exactly.\n' +
      'threat "threat-card": the Elevation of Privilege card, of which the model holds the suit alone (reduced to fit the format)\n',
  },
  {
    name: 'reports a file that is not there',
    args: ['validate', 'test-data/absent.json'],
    code: 2,
    out: '',
    err: "error: cannot read test-data/absent.json: ENOENT: no such file or directory, open 'test-data/absent.json'\n",
  },
  {
    name: 'prints a host registration, writing no file',
    args: ['mcp', 'install', '--host', 'claude-code', '--print'],
    code: 0,
    out: `host: claude-code
scope: project
file: .mcp.json
status: shown
entry:
{
  "mcpServers": {
    "saerskriven": {
      "command": "saer",
      "args": [
        "mcp"
      ]
    }
  }
}
`,
    err: '',
  },
  {
    name: 'reports the version the workspace carries',
    args: ['--version'],
    code: 0,
    out: `${cliVersion}\n`,
    err: '',
  },
];

for (const runner of runners) {
  const register = runner.absence === undefined ? describe : describe.skip;
  register(
    titleOf(runner, 'the CLI'),
    () => {
      it.each(scenarios)('$name', (scenario) => {
        expect(text(runner, scenario.args)).toEqual({
          code: scenario.code,
          out: scenario.out,
          err: scenario.err,
        });
      });

      it('writes the register of the two-diagram model as the golden file', () => {
        const out = join(directory, `${runner.name}.register.md`);
        expect(
          text(runner, ['render', twoDiagrams, '--format', 'md', '--out', out]),
        ).toEqual({ code: 0, out: '', err: '' });
        expect(readFileSync(out)).toEqual(
          renderGolden('two-diagrams.register.snapshot.md'),
        );
      });

      it('draws each diagram a model of several names to standard output', () => {
        const chosen = [
          ['storefront', 'two-diagrams-storefront.snapshot.svg'],
          ['Shipping an order', 'two-diagrams-fulfilment.snapshot.svg'],
        ];
        for (const [name, file] of chosen) {
          const result = ran(runner, [
            'render',
            twoDiagrams,
            '--format',
            'svg',
            '--out',
            '-',
            '--diagram',
            name,
          ]);
          expect(result.code).toEqual(0);
          expect(result.out).toEqual(renderGolden(file));
          expect(result.err.toString('utf8')).toEqual('');
        }
      });

      it('writes a PNG to standard output as bytes, not as text', () => {
        const streamed = ran(runner, [
          'render',
          twoDiagrams,
          '--format',
          'png',
          '--out',
          '-',
          '--diagram',
          'storefront',
        ]);
        expect(streamed.code).toEqual(0);
        expect(digestOf(streamed.out)).toEqual(
          digestOf(renderGolden('two-diagrams-storefront.snapshot.png')),
        );
      });

      it(
        'writes a PDF of diagrams and register, to a file and to standard output alike',
        () => {
          const out = join(directory, `${runner.name}.pdf`);
          const streamed = ran(runner, [
            'render',
            twoDiagrams,
            '--format',
            'pdf',
            '--out',
            '-',
          ]);
          expect(
            text(runner, [
              'render',
              twoDiagrams,
              '--format',
              'pdf',
              '--out',
              out,
            ]),
          ).toEqual({ code: 0, out: '', err: '' });
          const pdf = readFileSync(out);
          expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
          expect(pageCount(pdf)).toBe(6);
          expect(outlineTitles(pdf)).toContain('Two diagrams threat register');
          expect(digestOf(pdf)).toEqual(
            renderGolden('two-diagrams.snapshot.pdf.sha256')
              .toString('utf8')
              .trim(),
          );
          expect(streamed.code).toEqual(0);
          expect(digestOf(streamed.out)).toEqual(digestOf(pdf));
        },
        bytePathCompileTimeout,
      );

      it('says one line and exits 2 where standard output will not take it', (ctx) => {
        if (!existsSync(fullDevice)) {
          ctx.skip(`this platform has no ${fullDevice}`);
        }
        const device = openSync(fullDevice, 'w');
        const result = spawnSync(
          runner.command,
          [
            ...runner.leading,
            'render',
            twoDiagrams,
            '--format',
            'svg',
            '--out',
            '-',
            '--diagram',
            'storefront',
          ],
          { cwd: repositoryRoot, stdio: ['ignore', device, 'pipe'] },
        );
        closeSync(device);
        const reported = result.stderr.toString('utf8');
        expect(result.status).toEqual(2);
        expect(reported).toContain('error: cannot write to standard output: ');
        expect(reported.split('\n')).toHaveLength(2);
      });
    },
    spawnTimeout,
  );
}
