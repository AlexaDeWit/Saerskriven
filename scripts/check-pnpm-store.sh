#!/usr/bin/env bash
# Fail unless pnpm's store lies under $pnpm_config_store_dir and holds something, so the
# CI cache restore and save name the directory pnpm installs into. Run inside the dev
# shell after an install: `nix develop .#ci --command scripts/check-pnpm-store.sh`.
set -euo pipefail

configured="${pnpm_config_store_dir:-}"
if [ -z "$configured" ]; then
  echo "pnpm_config_store_dir is unset, so no store directory is configured" >&2
  exit 1
fi

reported="$(pnpm store path)"
case "$reported" in
  "$configured"/*) ;;
  *)
    echo "pnpm reports its store at ${reported}, expected under ${configured}" >&2
    exit 1
    ;;
esac

if [ -z "$(ls -A "$reported" 2>/dev/null)" ]; then
  echo "pnpm's store ${reported} is missing or empty" >&2
  exit 1
fi
echo "pnpm store: ${reported}"
