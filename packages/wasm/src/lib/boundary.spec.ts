import { Either } from 'effect';
import {
  answeringPastMemory,
  growingAPage,
  moduleWhoseEveryCall,
  trapping,
} from '../fixtures.js';
import { answered, instantiated, type BoundaryModule } from './boundary.js';

const boundaryCalls = ['input', 'output', 'output_length'];

const absent = 'the module exports no test calls';

const started = async (
  body: readonly number[],
): Promise<BoundaryModule<'run'>> =>
  Either.getOrThrow(
    await instantiated(
      moduleWhoseEveryCall([...boundaryCalls, 'run'], body),
      ['run'],
      absent,
    ),
  );

const bytes = new TextEncoder().encode('Saerskriven');

describe('a module instantiated on the boundary', () => {
  it('is refused where the bytes are not a module', async () => {
    expect(
      Either.isLeft(
        await instantiated(new Uint8Array([1, 2, 3]), ['run'], absent),
      ),
    ).toBe(true);
  });

  it.each([
    ['one of its own calls', boundaryCalls],
    ['a call of the boundary', ['input', 'output', 'run']],
  ])(
    'is refused with the sentence named where it lacks %s',
    async (_what, calls) => {
      expect(
        await instantiated(
          moduleWhoseEveryCall(calls, trapping),
          ['run'],
          absent,
        ),
      ).toEqual(Either.left(absent));
    },
  );

  it('compiles once for every call handed the same bytes', async () => {
    const wasm = moduleWhoseEveryCall([...boundaryCalls, 'run'], trapping);
    const compile = vi.spyOn(WebAssembly, 'compile');
    try {
      await instantiated(wasm, ['run'], absent);
      await instantiated(wasm, ['run'], absent);
      expect(compile).toHaveBeenCalledTimes(1);
    } finally {
      compile.mockRestore();
    }
  });

  it('compiles again after a compile that failed, rather than keeping the failure', async () => {
    const wasm = moduleWhoseEveryCall([...boundaryCalls, 'run'], trapping);
    const compile = vi
      .spyOn(WebAssembly, 'compile')
      .mockRejectedValueOnce(new Error('the compile was refused'));
    try {
      expect(await instantiated(wasm, ['run'], absent)).toEqual(
        Either.left('the compile was refused'),
      );
      expect(Either.isRight(await instantiated(wasm, ['run'], absent))).toBe(
        true,
      );
    } finally {
      compile.mockRestore();
    }
  });
});

describe('a call through the boundary', () => {
  it('writes into memory the input call grew, and copies the output from memory the later calls grew', async () => {
    const module = await started(growingAPage);
    const answer = Either.getOrThrow(
      answered(module, bytes, () => module.run()),
    );
    expect(answer.value).toBe(65_536);
    expect(answer.output.subarray(0, bytes.length)).toEqual(bytes);
  });

  it('reports a module that trapped, rather than throwing out of the call', async () => {
    const module = await started(trapping);
    expect(Either.isLeft(answered(module, bytes, () => module.run()))).toBe(
      true,
    );
  });

  it('reports a module that answers an address past its own memory', async () => {
    const module = await started(answeringPastMemory);
    expect(Either.isLeft(answered(module, bytes, () => module.run()))).toBe(
      true,
    );
  });
});
