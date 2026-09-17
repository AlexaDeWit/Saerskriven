# Orchestration reference

The project facts the orchestration skills defer to. One section per fact.
Edit here when the process changes, in the same PR as the change.

## Gating CI

- Required checks on `main`: **CI gate** and **codecov/project**.
- The release tag guard requires **CI gate** on the exact `main` commit.
  Codecov commit statuses do not gate tags. Coverage upload is advisory on
  main, tag, and manual runs, with a two-minute timeout, and required on PRs.
- "CI gate" in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)
  requires source checks, the website build, and verified artifact
  attestations. Source checks require the full CLI matrix and existing test
  and scan jobs. Wire each new gating job into its `needs` and verdict.
- The browser suite gates through two jobs. **e2e-smoke** is a four-way shard
  matrix over the `chromium` and `phone` Playwright projects, and
  **e2e-pages-floor** runs the `pages` and `frame-time` projects on one worker
  on a runner of its own, so the frame-time floor shares its host with no
  other browser. Both are in the source checks' `needs` and verdict. A third
  job, **e2e-report**, merges the shard blob reports into one HTML report when
  a browser job goes red. It reports nothing about the code and stays out of
  the gate.
- Every PR rehearses the release builds and, where its token can sign, the
  attestations. `publish` runs only on a push to a `v*` tag, and the Pages
  jobs follow it ([the release procedure](../docs/release.md)).
- The `release` and `github-pages` environments and the tag rulesets are
  repository settings rather than workflow config, so a change to them is
  invisible in the diff. [`docs/release.md`](../docs/release.md) records the
  live configuration and the commands that read it back.
- A code scanning rule on `main` additionally requires a Semgrep OSS analysis
  per PR (alerts at `errors_and_warnings`, security alerts at
  `medium_or_higher`). The CI gate's semgrep step remains the strict
  enforcement: it fails the job on any ERROR or WARNING finding before the
  ruleset thresholds matter.
- Informational contexts: **codecov/patch**, reported against the 90% target
  in `codecov.yml` and not required.

## Work decomposition

- Slices are GitHub issues. Milestones are the waves: M0, M0.5, M1, M2, M3,
  M4, M5, M6, M7, M8. A milestone's description says when it is deferred, as
  M5's is.
- An issue body carries the goal, the acceptance criteria, and its dependency
  order. A cold start reads the milestone description before its issues.
- Assignment signals in-progress. One issue, one PR.
- Issue auto-close on merge: **on**, via `Closes #NNN` in the PR body
  ([CONTRIBUTING, Pull requests](../CONTRIBUTING.md#pull-requests)).

## Definition of done, per PR

- The issue's acceptance criteria hold, shown in the PR or ticked in the issue.
- A fresh-context review has passed.
- The CI gate is green and codecov/project holds.
- Commits are Conventional, GPG-signed, DCO signed-off, and AI-disclosed.
- Documentation updated in the same PR wherever behaviour, interfaces, or
  configuration changed.

## Verification mode

- The host is shared by every agent the lead runs, so local verification is
  a floor and the draft PR's CI run is the test evidence. Before the first
  push an implementer runs the lint and the typecheck of the projects it
  touched, the formatter, and the one spec file that pins its change, once.
  Nx hashes the source, configuration, toolchain and environment inputs. A
  changed input runs and an unchanged task replays. Proving a test bites by
  breaking it happens at that scope. Nothing heavier runs locally. Do not run
  `pnpm check` or a workspace-wide `run-many`. Run Playwright only for a
  browser slice, and run that spec alone.
- The implementer pushes the draft at once. The lead starts the CI watch at
  the PR-open report and dispatches the fresh review beside it, so CI and
  the review run in parallel rather than in series. A review reads the CI
  run's logs for the suite evidence and runs locally only spec-scoped break
  experiments: a single spec file, never a project's suite.
- A red CI run is routed as a fix commit on the same PR and both re-verify
  on the new head. A criterion that measures the host itself (a repeated-run
  flake count, a frame-time floor) is the exception and says so in its
  issue.

## Model allocation (OpenCode)

When the loop runs through OpenCode Go, every role draws on one shared pool.

- Tech lead (resume-orchestration seat): GPT 5.6 Luna (`opencode-go/gpt-5.6-luna`).
- Implementers: Omen Alpha (`opencode-go/omen-alpha`).
- Implementers on a design-bearing or security-sensitive slice: Kimi K2.7
  Code (`opencode-go/kimi-k2.7-code`) or GPT 5.6 Luna, per the orchestration
  skill's pinning rule.
- Reviewers: GPT 5.6 Luna.
- Fallback once the pool is exhausted: a free model in the opencode config's
  fallback list.

## Worktrees

- One worktree per agent:
  `git worktree add .agents/worktrees/<branch> -b <branch>` from the repository
  root, and `git worktree remove .agents/worktrees/<branch>` after merge.
- `node_modules` is per-worktree, so run `pnpm install` inside the flake in
  each new worktree. The flake and direnv resolve per-worktree.

## Compaction

The team-lead seat compacts per
[`.agents/compact-prompt.md`](compact-prompt.md) and resumes with the
resume-orchestration skill.
