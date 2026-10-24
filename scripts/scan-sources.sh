#!/usr/bin/env bash
set -euo pipefail

: "${SAERSKRIVEN_SEMGREP_ACTION_RULE:?Run inside nix develop}"
: "${SAERSKRIVEN_SEMGREP_ACTION_TEST:?Run inside nix develop}"

semgrep --test --config "$SAERSKRIVEN_SEMGREP_ACTION_RULE" "$SAERSKRIVEN_SEMGREP_ACTION_TEST"

# Replace only the stale registry rule until semgrep-rules#4042 ships.
semgrep scan --config auto --config "$SAERSKRIVEN_SEMGREP_ACTION_RULE" \
  --exclude-rule yaml.github-actions.security.github-actions-mutable-action-tag.github-actions-mutable-action-tag \
  --severity ERROR --severity WARNING --error "$@" .
