import { reasonOf } from '@saerskriven/mcp';
import { Result } from 'effect';
import { runCli, writeOutcome } from './cli.js';
import { lines, type CommandOutput } from './outcome.js';

const wrote =
  (stream: NodeJS.WriteStream) =>
  (output: CommandOutput): Result.Result<void, string> =>
    Result.try({
      try: () => {
        stream.write(output);
      },
      catch: (error) => reasonOf(error),
    });

const watchForLostWrites = (
  stream: NodeJS.WriteStream,
  report: (reason: string) => void,
): void => {
  stream.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code !== 'EPIPE') {
      process.exitCode = 2;
      report(reasonOf(error));
    }
  });
};

watchForLostWrites(process.stdout, (reason) => {
  wrote(process.stderr)(
    lines(`error: cannot write to standard output: ${reason}`),
  );
});
watchForLostWrites(process.stderr, () => undefined);

process.exitCode = writeOutcome(await runCli(process.argv.slice(2)), {
  out: wrote(process.stdout),
  err: wrote(process.stderr),
});
