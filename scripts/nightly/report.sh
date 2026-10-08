#!/usr/bin/env bash
# Reconcile the nightly browser tracker from <engine>.json reports.
#
#     RUN_URL=<run> GITHUB_SHA=<commit> GH_REPO=<owner/name> \
#       scripts/nightly/report.sh [--dry-run] <reports directory> <engine>...
#
# Missing reports, failing specs, report errors and failed jobs keep it open.
# Closure also requires BROWSERS_RESULT, MERGE_RESULT and REPORTS_RESULT=success.
# --dry-run reads the open issues and prints the intended write.
set -euo pipefail

title='Nightly browser run is red in Firefox or WebKit'
# A whole engine failing to start fails every spec, and an issue body holds
# 65,536 characters.
listed=100

dry_run=''
if [ "${1:-}" = '--dry-run' ]; then
  dry_run=1
  shift
fi
reports=${1:?expected the directory holding the JSON reports}
shift
[ "$#" -gt 0 ] || {
  echo 'expected at least one engine' >&2
  exit 1
}
run_url=${RUN_URL:?RUN_URL must link the workflow run}
commit=${GITHUB_SHA:?GITHUB_SHA must name the commit the run tested}

if [ "${BROWSERS_RESULT:-}" = cancelled ] ||
  [ "${MERGE_RESULT:-}" = cancelled ] ||
  [ "${REPORTS_RESULT:-}" = cancelled ]; then
  echo 'The run was cancelled: tracker unchanged.'
  exit 0
fi

# One failing spec a line, as `file:line › describe › title`. A title is
# flattened to one line, so the count is the line count.
failing() {
  jq -r '
    def failing($path):
      (.specs[]? | select(.ok == false)
        | "\(.file):\(.line) › \($path + [.title] | join(" › "))"
        | gsub("\\s+"; " ")),
      (.suites[]? | failing($path + [.title]));
    .suites[] | failing([])
  ' "$1"
}

body=$(mktemp)
trap 'rm -f "$body"' EXIT
red=''
{
  printf 'Run: %s\nCommit: %s\n' "$run_url" "$commit"
  for engine in "$@"; do
    printf '\n### %s\n\n' "$engine"
    report="$reports/$engine.json"
    if ! jq -e '(.suites | type) == "array" and (.errors | type) == "array"' \
      "$report" >/dev/null 2>&1; then
      red=1
      echo 'No report found.'
      continue
    fi
    specs=$(failing "$report")
    errors=$(jq -r '.errors | length' "$report")
    if [ -z "$specs" ] && [ "$errors" -eq 0 ]; then
      echo 'No failing spec.'
      continue
    fi
    red=1
    if [ "$errors" -gt 0 ]; then
      printf 'Errors outside any spec: %s\n' "$errors"
    fi
    if [ -n "$specs" ]; then
      count=$(wc -l <<<"$specs" | tr -d ' ')
      # Indented as code, so a spec title cannot close the block and its
      # `@phone` tag notifies no one.
      printf 'Failing specs: %s\n\n' "$count"
      head -n "$listed" <<<"$specs" | sed 's/^/    /'
      if [ "$count" -gt "$listed" ]; then
        printf '\nThe first %s are listed. The HTML report has the rest.\n' "$listed"
      fi
    fi
  done
  for outcome in "browser shards:${BROWSERS_RESULT:-success}" \
    "report merges:${MERGE_RESULT:-success}" "report downloads:${REPORTS_RESULT:-success}"; do
    if [ "${outcome#*:}" != success ]; then
      red=1
      printf '\nThe %s ended as `%s`.\n' "${outcome%%:*}" "${outcome#*:}"
    fi
  done
  printf '\nThe HTML report of each engine is an artifact of the run, `playwright-report-<engine>`.\n'
} >"$body"

if [ -z "$red" ] && { [ "${BROWSERS_RESULT:-}" != success ] ||
  [ "${MERGE_RESULT:-}" != success ] || [ "${REPORTS_RESULT:-}" != success ]; }; then
  echo 'Missing successful shard, merge or download result: nothing to close.'
  exit 0
fi

# A listing, not a search: the search index trails a new issue, and a lookup
# that misses the open issue opens a second one. A failed listing stops here
# for the same reason.
open=$(gh issue list --state open --limit 1000 --json number,title)
number=$(jq -r --arg title "$title" \
  '[.[] | select(.title == $title) | .number] | min // empty' <<<"$open")

if [ -z "$red" ]; then
  if [ -z "$number" ]; then
    echo 'No tracking issue is open: nothing to close.'
    exit 0
  fi
  printf '\nAll browser shards, report merges and report downloads succeeded. Closing the tracking issue.\n' >>"$body"
  if [ -n "$dry_run" ]; then
    echo "Would close #$number:"
    echo
    cat "$body"
  else
    gh issue close "$number" --reason completed --comment "$(cat "$body")"
  fi
elif [ -n "$dry_run" ]; then
  if [ -n "$number" ]; then
    echo "Would comment on #$number:"
  else
    echo "Would open \"$title\":"
  fi
  echo
  cat "$body"
elif [ -n "$number" ]; then
  gh issue comment "$number" --body-file "$body"
else
  gh issue create --title "$title" --body-file "$body"
fi
