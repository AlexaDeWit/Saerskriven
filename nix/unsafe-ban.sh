#!/usr/bin/env bash
# Stops a Rust WebAssembly module's build where its crates break the ban on
# unsafe Rust (owner rulings, 2026-10-02, #622 and #640). nix/wasm-module.nix
# runs it before every module's compile, from the source root, with the export
# crate's directory and the logic crate's:
#
#   bash ${./unsafe-ban.sh} . codec
#
# rustc enforces the ban in the logic crate: its root forbids the
# `unsafe_code` lint, and no module, included file or inner attribute in that
# crate can lower a forbid. This script checks what rustc cannot:
# - the logic crate's root opens, after its `//!` header, with that forbid,
#   and its manifest has no [lib] section, no build script, and no lint
#   setting for `unsafe_code` but `forbid`
# - the export crate's `src` holds `lib.rs` alone, and every line of it is one
#   of the export table's shapes: `//!` header lines, blank lines, the one
#   `#![allow(unsafe_code)]`, one `use` of the logic crate's boundary, and
#   exports of the form `#[unsafe(no_mangle)]`, `pub extern "C" fn` with
#   primitive parameters, one call to the boundary function of the same name
#   passing those parameters in order, and `}`
# - the export crate's manifest builds a cdylib from `src/lib.rs`, depends on
#   the logic crate alone, and has no build script, patch or replacement
# - no resolved dependency feature is named `unsafe` or `ffi-api`
# - no RUSTFLAGS or rustc wrapper variable is set, and no Cargo configuration
#   on Cargo's search path caps lints, forces a warning, or wraps rustc, the
#   ways a forbid in source can be lifted

set -euo pipefail

exporter=${1:?name the export crate directory}
logic=${2:?name the logic crate directory}
table=$exporter/src/lib.rs
root=$logic/src/lib.rs

refuse() {
  printf 'The ban on unsafe Rust refuses this crate: %s\n' "$1" >&2
  exit 1
}

package_name() {
  awk '/^\[/ { section = $0 }
    section == "[package]" && $1 == "name" && $2 == "=" { gsub(/"/, "", $3); print $3; exit }' "$1"
}

opening=$(grep -v -x -e '' -e '//!.*' "$root" | head -n 1 || true)
[ "$opening" = '#![forbid(unsafe_code)]' ] ||
  refuse "$root opens with \"$opening\" after its //! header, where the ban needs #![forbid(unsafe_code)]."

if grep -q -x '\[lib\]' "$logic/Cargo.toml"; then
  refuse "$logic/Cargo.toml has a [lib] section, so its root may not be the src/lib.rs that forbids the lint."
fi

if stray=$(grep -n -E 'unsafe[-_]code' "$logic/Cargo.toml" | grep -v -x '[0-9]*:unsafe_code = "forbid"'); then
  refuse "$logic/Cargo.toml sets the lint other than to forbid, at line ${stray}"
fi

for manifest in "$exporter/Cargo.toml" "$logic/Cargo.toml"; do
  if grep -q -E '^[[:space:]]*build[[:space:]]*=' "$manifest"; then
    refuse "$manifest names a build script, and neither crate may have one."
  fi
done
for crate in "$exporter" "$logic"; do
  [ ! -e "$crate/build.rs" ] || refuse "$crate/build.rs is a build script, and neither crate may have one."
done

files=$(find "$exporter/src" -type f)
[ "$files" = "$table" ] ||
  refuse "$exporter/src holds files other than lib.rs: $(printf '%s ' "$files")"

logic_crate=$(package_name "$logic/Cargo.toml" | tr '-' '_')
[ -n "$logic_crate" ] || refuse "$logic/Cargo.toml names no package."

awk -v use_line="use ${logic_crate}::boundary;" '
  function fail(why) { printf "%s:%d: %s\n", FILENAME, FNR, why; failed = 1; exit }
  function names(parameters,   list, count, index_, result, part) {
    count = split(parameters, list, ", ")
    result = ""
    for (index_ = 1; index_ <= count; index_++) {
      part = list[index_]
      sub(/:.*/, "", part)
      result = result (index_ > 1 ? ", " : "") part
    }
    return result
  }
  BEGIN {
    state = "header"
    primitive = "(u8|u16|u32|u64|usize|i8|i16|i32|i64|isize|f32|f64|bool)"
    parameter = "[a-z_][a-z0-9_]*: " primitive
    signature = "^pub extern \"C\" fn [a-z_][a-z0-9_]*[(](" parameter "(, " parameter ")*)?[)]( -> (" primitive "|[*](const|mut) u8))? [{]$"
  }
  state == "header" && ($0 == "" || $0 ~ /^\/\/!/) { next }
  state == "header" && $0 == "#![allow(unsafe_code)]" { state = "allowed"; next }
  state == "header" { fail("the export table opens with //! lines and then #![allow(unsafe_code)]") }
  state == "allowed" && $0 == "" { next }
  state == "allowed" && $0 == use_line { state = "between"; next }
  state == "allowed" { fail("the allowance is followed by \"" use_line "\" alone") }
  state == "between" && $0 == "" { next }
  state == "between" && $0 == "#[unsafe(no_mangle)]" { state = "signature"; next }
  state == "between" { fail("between exports the table holds only blank lines and #[unsafe(no_mangle)]") }
  state == "signature" && $0 ~ signature {
    name = $0; sub(/^pub extern "C" fn /, "", name); sub(/\(.*/, "", name)
    arguments = $0; sub(/^[^(]*\(/, "", arguments); sub(/\).*/, "", arguments)
    call = "    boundary::" name "(" names(arguments) ")"
    state = "call"; next
  }
  state == "signature" { fail("an export is pub extern \"C\" fn NAME(PARAMETERS) -> TYPE { with primitive types") }
  state == "call" && $0 == call { state = "close"; exports++; next }
  state == "call" { fail("an export body is the one line \"" call "\"") }
  state == "close" && $0 == "}" { state = "between"; next }
  state == "close" { fail("an export closes with } after its one call") }
  END {
    if (failed) exit 1
    if (state != "between" || exports == 0) { printf "%s: the table ends inside an export, or holds none\n", FILENAME; exit 1 }
  }' "$table" >&2 ||
  refuse "$table is not an export table, at the line above."

lib_section=$(awk '/^\[/ { section = $0; next } section == "[lib]" && NF { print }' "$exporter/Cargo.toml")
[ "$lib_section" = 'crate-type = ["cdylib"]' ] ||
  refuse "$exporter/Cargo.toml's [lib] section holds more than crate-type = [\"cdylib\"]."

dependencies=$(awk '/^\[/ { section = $0; next } section == "[dependencies]" && NF { print }' "$exporter/Cargo.toml")
expected_dependency="$(package_name "$logic/Cargo.toml") = { path = \"$(basename "$logic")\" }"
[ "$dependencies" = "$expected_dependency" ] ||
  refuse "$exporter/Cargo.toml depends on more than \"$expected_dependency\"."

if stray=$(grep -n -E '^\[(.*dependencies.*|patch.*|replace)\]$' "$exporter/Cargo.toml" | grep -v -x '[0-9]*:\[dependencies\]'); then
  refuse "$exporter/Cargo.toml has a section that adds or swaps a dependency, at line ${stray}"
fi

for variable in RUSTFLAGS CARGO_BUILD_RUSTFLAGS CARGO_ENCODED_RUSTFLAGS \
  CARGO_TARGET_WASM32_UNKNOWN_UNKNOWN_RUSTFLAGS RUSTC_WRAPPER \
  RUSTC_WORKSPACE_WRAPPER CARGO_BUILD_RUSTC_WRAPPER; do
  [ -z "${!variable:-}" ] ||
    refuse "$variable is set, and could cap the lint the logic crate forbids."
done
configs=("${CARGO_HOME:-$HOME/.cargo}/config" "${CARGO_HOME:-$HOME/.cargo}/config.toml")
directory=$(cd "$exporter" && pwd)
while :; do
  configs+=("$directory/.cargo/config" "$directory/.cargo/config.toml")
  [ "$directory" = / ] && break
  directory=$(dirname "$directory")
done
for config in "${configs[@]}"; do
  if [ -f "$config" ] && grep -q -E 'cap-lints|force-warn|rustc-wrapper|rustc-workspace-wrapper' "$config"; then
    refuse "$config caps lints or wraps rustc, which could lift the forbid on the logic crate."
  fi
done

features=$(cd "$exporter" && cargo tree --offline --frozen --target wasm32-unknown-unknown -e features --prefix none)
if stray=$(printf '%s\n' "$features" | grep -E 'feature "(unsafe|ffi-api)"'); then
  refuse "a dependency feature that opens unsafe code or a foreign ABI is enabled: ${stray}"
fi
