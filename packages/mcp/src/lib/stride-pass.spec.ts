import { Either } from 'effect';
import { promptProseOf } from '../fixtures.js';
import { dataNotInstructions } from './preface.js';
import { PromptFailure, promptMessages } from './prompt-result.js';
import {
  featureCompleteWorkspace,
  rootWorkspace,
  treeHolding,
  twoDiagramsWorkspace,
  twoDiagramsYaml,
} from './read-tools.fixtures.js';
import { strideBrief, strideByKind, stridePass } from './stride-pass.js';

const dragon = featureCompleteWorkspace();

const twoDiagrams = twoDiagramsWorkspace();

const section = (data: readonly string[], heading: string) => {
  const start = data.indexOf(heading) + 1;
  const end = data.findIndex(
    (line, index) => index >= start && !line.startsWith(' '),
  );
  return data
    .slice(start, end === -1 ? undefined : end)
    .filter((line) => /^ {2}\S/.test(line))
    .map((line) => line.trim().split(' ')[0]);
};

describe('what stride_pass renders', () => {
  it('renders on a Threat Dragon file for an element named by its name', () => {
    const pass = Either.getOrThrow(
      stridePass(dragon, { element: 'Booking service' }),
    );
    const [data, brief] = promptProseOf(promptMessages(pass)).prose;
    expect(data?.split('\n')[0]).toEqual(dataNotInstructions);
    expect(brief).toEqual(strideBrief('process').join('\n'));
    expect(section(pass.data, 'flows:').length).toBeGreaterThan(0);
  });

  it('renders on a native file, alike by id and by name', () => {
    const byId = Either.getOrThrow(
      stridePass(twoDiagrams, { element: 'el-web-shop' }),
    );
    expect(
      Either.getOrThrow(stridePass(twoDiagrams, { element: 'Web shop' })),
    ).toEqual(byId);
    expect({
      element: section(byId.data, 'element:'),
      flows: section(byId.data, 'flows:'),
      stores: section(byId.data, 'stores the flows reach:'),
    }).toEqual({
      element: ['el-web-shop'],
      flows: [
        'el-browse',
        'el-page',
        'el-listings',
        'el-charge',
        'el-confirm',
        'el-record',
      ],
      stores: ['el-catalogue', 'el-ledger'],
    });
  });

  it('asks the questions of the kind, and the brief carries nothing from the model', () => {
    const store = Either.getOrThrow(
      stridePass(twoDiagrams, { element: 'el-ledger' }),
    );
    const flow = Either.getOrThrow(
      stridePass(twoDiagrams, { element: 'el-record' }),
    );
    expect(store.brief).toEqual(strideBrief('store'));
    expect(flow.brief).toEqual(strideBrief('flow'));
    expect(section(flow.data, 'stores the flows reach:')).toEqual([
      'el-ledger',
    ]);
    expect(strideByKind.process).toHaveLength(6);
  });
});

describe('why stride_pass has no prompt', () => {
  it('fails on an element the model does not hold', () => {
    expect(stridePass(dragon, { element: 'Nothing' })).toEqual(
      Either.left(PromptFailure.NoSuchElement()),
    );
  });

  it('fails on a name several elements share', () => {
    const shared = treeHolding(
      twoDiagramsYaml().replace('name: Order ledger', 'name: Web shop'),
    );
    expect(stridePass(shared, { element: 'Web shop' })).toEqual(
      Either.left(PromptFailure.SharedName()),
    );
  });

  it('fails on a trust boundary', () => {
    expect(stridePass(twoDiagrams, { element: 'el-shop-network' })).toEqual(
      Either.left(PromptFailure.UncoveredKind()),
    );
  });

  it('fails with no model on a file outside the root', () => {
    expect(
      stridePass(rootWorkspace(), { file: '../outside.yaml', element: 'x' }),
    ).toEqual(Either.left(PromptFailure.NoModel()));
  });
});
