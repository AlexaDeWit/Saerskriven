#!/usr/bin/env bash
# Stops a Rust WebAssembly module's build where its crates break the ban on
# unsafe Rust (owner rulings, 2026-10-02, #622 and #640). nix/wasm-module.nix
# runs it before every module's compile, from the source root, with the export
# crate's directory, the logic crate's, and the names of the logic crate's
# direct dependencies, which the module's file lists:
#
#   bash ${./unsafe-ban.sh} . codec brotli
#
# rustc enforces the ban in the logic crate: its root forbids the
# `unsafe_code` lint, and no module, included file or inner attribute in that
# crate can lower a forbid. The forbid does not see an `unsafe` block that a
# dependency's macro expands to, so the logic crate's direct dependencies are
# part of the ban: adding one is a change to the module's file, which is trust
# root. This script checks what rustc cannot. It reads the crates as Cargo
# resolves them, through `cargo metadata`, and requires:
# - two local packages in the whole graph, the export crate and the logic
#   crate, and every other package from the crates.io registry
# - the logic crate to build one target, a lib whose root is its src/lib.rs,
#   and to depend on registry crates alone, whose names of every kind are
#   exactly the names the module's file lists
# - the export crate to build one target, a cdylib whose root is its
#   src/lib.rs, and to depend on the logic crate alone
# - so no build script in either crate, and no patch or replacement that
#   swaps a dependency for local code
# Text is read only where text is what the ban covers:
# - the logic crate's root opens, after its `//!` header, with that forbid
# - the export crate's src holds lib.rs alone, and every line of it is one of
#   the export table's shapes: `//!` header lines, blank lines, the one
#   `#![allow(unsafe_code)]`, one `use` of the logic crate's boundary, and
#   exports of the form `#[unsafe(no_mangle)]`, `pub extern "C" fn` with
#   32- or 64-bit integer or float parameters, which a WebAssembly caller
#   cannot pass out of range, one call to the boundary function of the same
#   name passing those parameters in order, and `}`
# And for the compile itself:
# - no resolved dependency feature is named `unsafe` or `ffi-api`
# - no RUSTFLAGS, NIX_RUSTFLAGS or rustc wrapper variable is set, and no Cargo
#   configuration on Cargo's search path caps lints, forces a warning, or
#   wraps rustc, the ways a forbid in source can be lifted

set -euo pipefail

exporter=${1:?name the export crate directory}
logic=${2:?name the logic crate directory}
shift 2
listed=$(jq -cn '$ARGS.positional | sort | unique' --args "$@")
exporter_dir=$(cd "$exporter" && pwd -P)
logic_dir=$(cd "$logic" && pwd -P)
exporter_manifest=$exporter_dir/Cargo.toml
logic_manifest=$logic_dir/Cargo.toml
crates_io=registry+https://github.com/rust-lang/crates.io-index

refuse() {
  printf 'The ban on unsafe Rust refuses this crate: %s\n' "$1" >&2
  exit 1
}

for variable in RUSTFLAGS NIX_RUSTFLAGS CARGO_BUILD_RUSTFLAGS \
  CARGO_ENCODED_RUSTFLAGS CARGO_TARGET_WASM32_UNKNOWN_UNKNOWN_RUSTFLAGS \
  RUSTC_WRAPPER RUSTC_WORKSPACE_WRAPPER CARGO_BUILD_RUSTC_WRAPPER; do
  [ -z "${!variable:-}" ] ||
    refuse "$variable is set, and could cap the lint the logic crate forbids."
done
configs=("${CARGO_HOME:-$HOME/.cargo}/config" "${CARGO_HOME:-$HOME/.cargo}/config.toml")
directory=$exporter_dir
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

metadata=$(cd "$exporter_dir" && cargo metadata --offline --frozen --format-version 1) ||
  refuse "cargo metadata could not resolve the crates offline at their lock file."

query() {
  jq -c "$@" <<<"$metadata"
}

locals=$(query '[.packages[] | select(.source == null) | .manifest_path] | sort')
expected=$(jq -cn --arg exporter "$exporter_manifest" --arg logic "$logic_manifest" '[$exporter, $logic] | sort')
[ "$locals" = "$expected" ] ||
  refuse "the local packages are $locals, where the ban admits the export crate and the logic crate alone."

foreign=$(query --arg registry "$crates_io" "[.packages[] | select(.source != null and .source != \$registry) | .id]")
[ "$foreign" = '[]' ] ||
  refuse "packages come from outside the crates.io registry: $foreign"

package() {
  query --arg manifest "$1" ".packages[] | select(.manifest_path == \$manifest) | $2"
}

for manifest in "$exporter_manifest" "$logic_manifest"; do
  [ "$(package "$manifest" '[.targets[] | select(.kind | index("custom-build"))] | length')" = 0 ] ||
    refuse "$manifest builds a build script, and neither crate may have one."
done

targets=$(package "$logic_manifest" '[.targets[] | {kind, crate_types, src_path}]')
expected=$(jq -cn --arg root "$logic_dir/src/lib.rs" '[{kind: ["lib"], crate_types: ["lib"], src_path: $root}]')
[ "$targets" = "$expected" ] ||
  refuse "the logic crate builds $targets, where the ban admits one lib whose root is its src/lib.rs."

targets=$(package "$exporter_manifest" '[.targets[] | {kind, crate_types, src_path}]')
expected=$(jq -cn --arg root "$exporter_dir/src/lib.rs" '[{kind: ["cdylib"], crate_types: ["cdylib"], src_path: $root}]')
[ "$targets" = "$expected" ] ||
  refuse "the export crate builds $targets, where the ban admits one cdylib whose root is its src/lib.rs."

logic_name=$(package "$logic_manifest" '.name')
dependencies=$(package "$exporter_manifest" '[.dependencies[] | {name, rename, path, kind, target}]')
expected=$(jq -cn --argjson name "$logic_name" --arg path "$logic_dir" '[{name: $name, rename: null, path: $path, kind: null, target: null}]')
[ "$dependencies" = "$expected" ] ||
  refuse "the export crate depends on $dependencies, where the ban admits the logic crate alone."

stray=$(query --arg manifest "$logic_manifest" --arg registry "$crates_io" ".packages[] | select(.manifest_path == \$manifest) | [.dependencies[] | select(.path != null or .source != \$registry) | .name]")
[ "$stray" = '[]' ] ||
  refuse "the logic crate depends on $stray, which do not come from the crates.io registry."

direct=$(package "$logic_manifest" '[.dependencies[].name] | sort | unique')
[ "$direct" = "$listed" ] ||
  refuse "the logic crate depends on $direct, where its module's file lists $listed. A dependency's macro can expand to unsafe code the forbid does not see, so the list is part of the ban."

root=$(package "$logic_manifest" '.targets[0].src_path' | jq -r .)
table=$(package "$exporter_manifest" '.targets[0].src_path' | jq -r .)
logic_crate=$(package "$logic_manifest" '.targets[0].name' | jq -r . | tr '-' '_')

opening=$(grep -v -x -e '' -e '//!.*' "$root" | head -n 1 || true)
[ "$opening" = '#![forbid(unsafe_code)]' ] ||
  refuse "$root opens with \"$opening\" after its //! header, where the ban needs #![forbid(unsafe_code)]."

files=$(find "$exporter_dir/src" -type f)
[ "$files" = "$table" ] ||
  refuse "$exporter_dir/src holds files other than lib.rs: $(printf '%s ' "$files")"

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
    wide = "(u32|u64|usize|i32|i64|isize|f32|f64)"
    parameter = "[a-z_][a-z0-9_]*: " wide
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
  state == "signature" { fail("an export is pub extern \"C\" fn NAME(PARAMETERS) -> TYPE { with 32- or 64-bit numeric parameters and a primitive result") }
  state == "call" && $0 == call { state = "close"; exports++; next }
  state == "call" { fail("an export body is the one line \"" call "\"") }
  state == "close" && $0 == "}" { state = "between"; next }
  state == "close" { fail("an export closes with } after its one call") }
  END {
    if (failed) exit 1
    if (state != "between" || exports == 0) { printf "%s: the table ends inside an export, or holds none\n", FILENAME; exit 1 }
  }' "$table" >&2 ||
  refuse "$table is not an export table, at the line above."

features=$(cd "$exporter_dir" && cargo tree --offline --frozen --target wasm32-unknown-unknown -e features --prefix none)
if stray=$(printf '%s\n' "$features" | grep -E 'feature "(unsafe|ffi-api)"'); then
  refuse "a dependency feature that opens unsafe code or a foreign ABI is enabled: ${stray}"
fi
