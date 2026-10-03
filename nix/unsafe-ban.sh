#!/usr/bin/env bash
# Stops a Rust module's build where the crate breaks the ban on unsafe Rust
# (owner rulings, 2026-10-02, #622 and #640). A derivation runs it before the
# compile, with the crate's directory:
#
#   bash ${../unsafe-ban.sh} .
#
# The ban's structure, each part checked here:
# - Cargo.toml sets `unsafe_code = "deny"` under [lints.rust].
# - Every module but the crate root and src/exports.rs forbids the lint.
# - No attribute outside src/exports.rs sets the lint to anything else.
# - src/exports.rs names the word only on `#[unsafe(no_mangle)]` lines and on
#   its one `#![allow(unsafe_code)]`, the rule's one approved exception.
# rustc refuses unsafe code everywhere else, so this script reads only the
# lint attributes and the export file.

set -euo pipefail

crate=${1:?name the crate directory}
exports=$crate/src/exports.rs

refuse() {
  printf 'The ban on unsafe Rust refuses this crate: %s\n' "$1" >&2
  exit 1
}

awk '/^\[/ { section = $0 }
  section == "[lints.rust]" && $0 == "unsafe_code = \"deny\"" { found = 1 }
  END { exit !found }' "$crate/Cargo.toml" ||
  refuse "$crate/Cargo.toml sets no unsafe_code = \"deny\" under [lints.rust]."

[ -f "$exports" ] ||
  refuse "$exports is missing, and it is the one file an export may live in."

allowances=$(grep -c -x '#!\[allow(unsafe_code)\]' "$exports" || true)
[ "$allowances" = 1 ] ||
  refuse "$exports holds $allowances #![allow(unsafe_code)] lines, where the ban allows exactly one."

if stray=$(grep -n 'unsafe' "$exports" |
  grep -v -x -e '[0-9]*:#\[unsafe(no_mangle)\]' -e '[0-9]*:#!\[allow(unsafe_code)\]'); then
  refuse "$exports names unsafe beyond its #[unsafe(no_mangle)] lines and its one allowance, at line ${stray}"
fi

while IFS= read -r -d '' file; do
  [ "$file" = "$exports" ] && continue
  if stray=$(grep -n -E '^[[:space:]]*#!?\[.*unsafe_code' "$file" |
    grep -v -x '[0-9]*:#!\[forbid(unsafe_code)\]'); then
    refuse "$file sets the lint other than by #![forbid(unsafe_code)], at line ${stray}"
  fi
  [ "$file" = "$crate/src/lib.rs" ] && continue
  grep -q -x '#!\[forbid(unsafe_code)\]' "$file" ||
    refuse "$file is a logic module without #![forbid(unsafe_code)]."
done < <(find "$crate/src" -name '*.rs' -print0)
