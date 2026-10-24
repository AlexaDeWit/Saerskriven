import { spawnSync } from 'node:child_process';
import { Data, Result } from 'effect';
import { z } from 'zod';

type JsonReader<Output> = Readonly<{ schema: z.ZodType<Output> }>;

/** Process result returned by the release command runner. */
export type CommandResult = Readonly<{
  error?: Error;
  status: number | null;
  stderr: string;
  stdout: string;
}>;

type RunOptions = Readonly<{ cwd: string; inherit?: boolean }>;
/** Injectable runner for operator commands. */
export type RunCommand = (
  command: string,
  args: string[],
  options: RunOptions,
) => CommandResult;

/** Plain failures shared by release operations. */
export type ReleaseFailure = Data.TaggedEnum<{
  CommandFailed: { readonly command: string; readonly reason: string };
  InvalidData: { readonly issues: readonly string[]; readonly source: string };
  InvalidVersion: { readonly input: string };
  Refused: { readonly reason: string };
}>;

/** Constructors for release failures. */
export const ReleaseFailure = Data.taggedEnum<ReleaseFailure>();

const reasonOf = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

/** Format a release failure for the operator. */
export const describeFailure = (failure: ReleaseFailure): string =>
  ReleaseFailure.$match(failure, {
    CommandFailed: ({ command, reason }) => `${command}: ${reason}`,
    InvalidData: ({ issues, source }) => `${source}: ${issues.join(', ')}`,
    InvalidVersion: ({ input }) =>
      `'${input}' is not X.Y.Z (a leading 'v' is optional)`,
    Refused: ({ reason }) => reason,
  });

/** Return a release refusal without throwing. */
export const refuse = (reason: string): Result.Result<never, ReleaseFailure> =>
  Result.fail(ReleaseFailure.Refused({ reason }));

const invalidData = (
  source: string,
  cause: unknown,
): Result.Result<never, ReleaseFailure> =>
  Result.fail(
    ReleaseFailure.InvalidData({ issues: [reasonOf(cause)], source }),
  );

/** Capture a synchronous IO failure as release data. */
export const attempt = <Value,>(
  source: string,
  read: () => Value,
): Result.Result<Value, ReleaseFailure> =>
  Result.try({
    try: read,
    catch: (cause) =>
      ReleaseFailure.InvalidData({ issues: [reasonOf(cause)], source }),
  });

/** Capture an asynchronous IO failure as release data. */
export const attemptPromise = async <Value,>(
  source: string,
  read: () => Promise<Value>,
): Promise<Result.Result<Value, ReleaseFailure>> => {
  try {
    return Result.succeed(await read());
  } catch (cause: unknown) {
    return invalidData(source, cause);
  }
};

const zodIssues = (issues: z.core.$ZodIssue[]): string[] =>
  issues.map((issue) => {
    const path = issue.path.map(String).join('.');
    return `${path ? `${path}: ` : ''}${issue.message}`;
  });

/** Decode JSON and report schema failures as plain release data. */
export const parseJson = <Output,>(
  reader: JsonReader<Output>,
  text: string,
  source: string,
): Result.Result<Output, ReleaseFailure> =>
  Result.flatMap(
    attempt(source, () => JSON.parse(text) as unknown),
    (value) => {
      const parsed = reader.schema.safeParse(value);
      return parsed.success
        ? Result.succeed(parsed.data)
        : Result.fail(
            ReleaseFailure.InvalidData({
              issues: zodIssues(parsed.error.issues),
              source,
            }),
          );
    },
  );

/** Run a command with captured output or inherited terminal streams. */
export const runProcess: RunCommand = (
  command,
  args,
  { cwd, inherit = false },
) => {
  const processResult = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  });
  return {
    error: processResult.error,
    status: processResult.status,
    stderr: processResult.stderr?.trimEnd() ?? '',
    stdout: processResult.stdout?.trimEnd() ?? '',
  };
};

const commandName = (command: string, args: string[]): string =>
  [command, ...args].join(' ');

/** Accept only the command exit statuses named by the caller. */
export const requireStatus = (
  result: CommandResult,
  allowed: number[],
  command: string,
  args: string[],
): Result.Result<CommandResult, ReleaseFailure> => {
  if (result.error) {
    return Result.fail(
      ReleaseFailure.CommandFailed({
        command: commandName(command, args),
        reason: result.error.message,
      }),
    );
  }
  return result.status !== null && allowed.includes(result.status)
    ? Result.succeed(result)
    : Result.fail(
        ReleaseFailure.CommandFailed({
          command: commandName(command, args),
          reason:
            result.stderr || `exited with status ${String(result.status)}`,
        }),
      );
};

/** Read standard output from a successful command. */
export const outputOf = (
  run: RunCommand,
  command: string,
  args: string[],
  cwd: string,
): Result.Result<string, ReleaseFailure> =>
  Result.map(
    requireStatus(run(command, args, { cwd }), [0], command, args),
    ({ stdout }) => stdout,
  );

/** Run a command attached to the terminal and require success. */
export const runChecked = (
  run: RunCommand,
  command: string,
  args: string[],
  cwd: string,
): Result.Result<void, ReleaseFailure> =>
  Result.map(
    requireStatus(
      run(command, args, { cwd, inherit: true }),
      [0],
      command,
      args,
    ),
    () => undefined,
  );

/** Read a GitHub API response through the supplied schema. */
export const githubJson = <Output,>(
  run: RunCommand,
  endpoint: string,
  cwd: string,
  reader: JsonReader<Output>,
): Result.Result<Output, ReleaseFailure> =>
  Result.flatMap(outputOf(run, 'gh', ['api', endpoint], cwd), (text) =>
    parseJson(reader, text, `GitHub ${endpoint}`),
  );
