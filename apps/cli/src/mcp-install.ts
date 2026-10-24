import {
  createdFile,
  reasonOf,
  replacedFile,
  revisionOf,
  WriteFailure,
  type WriteTarget,
} from '@saerskriven/mcp';
import { Result } from 'effect';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { z } from 'zod';
import { danglingLink, resolved, withinReadBound } from './files.js';
import {
  InstallFailure,
  entryText,
  hostDocument,
  hostEntry,
  hostFile,
  hostNameSchema,
  hostRegistrations,
  hostText,
  installEnvironment,
  renderInstallFailure,
  withRegistration,
  type HostDocument,
  type HostEntry,
  type HostFile,
  type HostName,
  type HostRegistration,
  type HostScope,
  type InstallEnvironment,
} from './mcp-hosts.js';
import {
  lines,
  succeeded,
  usageError,
  type CommandOutcome,
} from './outcome.js';

/**
 * What `mcp install` needs, and the one gate on the option bag the parser
 * hands over. `--project` and `--user` name one file each, so naming both is
 * refused here rather than resolved to one of them. Naming neither leaves
 * the choice to the host: the file a project commits where it keeps one, and
 * the user-level file where it does not.
 */
export const installOptionsSchema = z
  .object({
    host: hostNameSchema,
    project: z.boolean().optional(),
    user: z.boolean().optional(),
    file: z.string().optional(),
    print: z.boolean().optional(),
  })
  .superRefine((options, ctx) => {
    if (options.project === true && options.user === true) {
      ctx.addIssue({
        code: 'custom',
        path: ['project'],
        message:
          'names the file a project commits and --user the one that covers every project, so pass one of them',
      });
    }
  });

/** The options an `mcp install` invocation was given. */
export type InstallOptions = z.infer<typeof installOptionsSchema>;

/**
 * `saer mcp install`: the host's registration for `saer mcp`, written once
 * and a no-op after that, keeping what the file already holds. A file past
 * the read bound or one that does not parse is refused rather than replaced,
 * and `--print` writes nothing. A symbolic link target is resolved first, a
 * created file is `0600` since host configuration can hold credentials, and
 * an existing file keeps its mode and is replaced against the revision read.
 */
export function installMcp(
  options: InstallOptions,
  environment: InstallEnvironment = installEnvironment(),
): CommandOutcome {
  return Result.match(reported(options, environment), {
    onFailure: (failure) => usageError(lines(...renderInstallFailure(failure))),
    onSuccess: (report) => succeeded(lines(...renderInstallReport(report)), ''),
  });
}

type InstallStatus = 'written' | 'unchanged' | 'shown';

type InstallReport = {
  readonly host: HostName;
  readonly scope: HostScope;
  readonly file: string;
  readonly status: InstallStatus;
  readonly entry: string;
};

type Requested = {
  readonly options: InstallOptions;
  readonly registration: HostRegistration;
  readonly scope: HostScope;
  readonly file: HostFile;
  readonly entry: HostEntry;
  readonly snippet: string;
};

function renderInstallReport(report: InstallReport): readonly string[] {
  return [
    `host: ${report.host}`,
    `scope: ${report.scope}`,
    `file: ${report.file}`,
    `status: ${report.status}`,
    'entry:',
    report.entry.trimEnd(),
  ];
}

function reported(
  options: InstallOptions,
  environment: InstallEnvironment,
): Result.Result<InstallReport, InstallFailure> {
  const registration = hostRegistrations[options.host];
  const scope = scopeOf(registration, options);
  const entry = hostEntry(registration, options.file);
  return Result.flatMap(hostFile(options.host, scope, environment), (file) =>
    Result.flatMap(entryText(registration, named(file), entry), (snippet) =>
      installed({ options, registration, scope, file, entry, snippet }),
    ),
  );
}

function installed(
  requested: Requested,
): Result.Result<InstallReport, InstallFailure> {
  const reporting = (status: InstallStatus): InstallReport => ({
    host: requested.options.host,
    scope: requested.scope,
    file: named(requested.file),
    status,
    entry: requested.snippet,
  });
  return requested.options.print === true
    ? Result.succeed(reporting('shown'))
    : requested.file.kind === 'undocumented'
      ? Result.fail(
          InstallFailure.Undocumented({
            host: requested.options.host,
            where: requested.file.where,
          }),
        )
      : Result.map(
          written(
            requested.registration,
            resolved(requested.file),
            requested.entry,
          ),
          reporting,
        );
}

function named(file: HostFile): string {
  return file.kind === 'file' ? file.file : file.where;
}

function scopeOf(
  registration: HostRegistration,
  options: InstallOptions,
): HostScope {
  return options.user === true ||
    (options.project !== true && registration.project === undefined)
    ? 'user'
    : 'project';
}

type HeldFile =
  | { readonly kind: 'absent' }
  | {
      readonly kind: 'held';
      readonly text: string;
      readonly revision: string;
    };

function written(
  registration: HostRegistration,
  target: WriteTarget,
  entry: HostEntry,
): Result.Result<InstallStatus, InstallFailure> {
  return Result.flatMap(heldFile(target), (held) =>
    Result.flatMap(
      document(registration, target.file, textOf(held), entry),
      (merged) =>
        Result.flatMap(hostText(registration, target.file, merged), (text) =>
          text === textOf(held)
            ? Result.succeed<InstallStatus>('unchanged')
            : Result.map(
                saved(target, text, held),
                (): InstallStatus => 'written',
              ),
        ),
    ),
  );
}

function document(
  registration: HostRegistration,
  file: string,
  held: string,
  entry: HostEntry,
): Result.Result<HostDocument, InstallFailure> {
  return Result.flatMap(hostDocument(registration, file, held), (parsed) =>
    withRegistration(registration, file, parsed, entry),
  );
}

function textOf(held: HeldFile): string {
  return held.kind === 'held' ? held.text : '';
}

function heldFile(
  target: WriteTarget,
): Result.Result<HeldFile, InstallFailure> {
  return existsSync(target.path)
    ? Result.flatMap(
        withinReadBound(target.path, (observed) =>
          InstallFailure.TooLarge({ path: target.file, observed }),
        ),
        () => readHeld(target),
      )
    : Result.succeed({ kind: 'absent' });
}

function readHeld(
  target: WriteTarget,
): Result.Result<HeldFile, InstallFailure> {
  return Result.try({
    try: () => {
      const bytes = readFileSync(target.path);
      return {
        kind: 'held',
        text: bytes.toString('utf8'),
        revision: revisionOf(bytes),
      };
    },
    catch: (error) =>
      InstallFailure.Unreadable({
        path: target.file,
        reason: reasonOf(error),
      }),
  });
}

function saved(
  target: WriteTarget,
  text: string,
  held: HeldFile,
): Result.Result<string, InstallFailure> {
  return Result.mapError(
    Result.flatMap(directoryFor(target), () =>
      held.kind === 'held'
        ? replacedFile(target, text, held.revision, ownerOnly)
        : createdFile(target, text, ownerOnly),
    ),
    (failure) => refusedWrite(target, failure),
  );
}

function refusedWrite(
  target: WriteTarget,
  failure: WriteFailure,
): InstallFailure {
  return WriteFailure.$is('Occupied')(failure)
    ? takenPath(target)
    : WriteFailure.$is('StaleRevision')(failure)
      ? InstallFailure.Changed({ path: target.file })
      : InstallFailure.Unwritten({ failure });
}

function takenPath(target: WriteTarget): InstallFailure {
  return danglingLink(target.path)
    ? InstallFailure.DanglingLink({ path: target.file })
    : InstallFailure.Occupied({ path: target.file });
}

const ownerOnly = 0o600;

function directoryFor(target: WriteTarget): Result.Result<void, WriteFailure> {
  return Result.try({
    try: () => {
      mkdirSync(dirname(target.path), { recursive: true });
    },
    catch: (error) =>
      WriteFailure.Unwritten({ file: target.file, reason: reasonOf(error) }),
  });
}
