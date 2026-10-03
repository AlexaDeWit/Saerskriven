#!/usr/bin/env bash
# Stops a WebAssembly module's build unless the module imports nothing and
# exports exactly the names given, so no route through the source, a
# dependency feature or the linker adds a call the driver does not know
# (#622, #640). nix/wasm-module.nix runs it on every installed module, with
# wabt's wasm-objdump on its PATH:
#
#   bash ${./wasm-surface.sh} "$out/lib/module.wasm" memory compress ...
#
# rustc's wasm32-unknown-unknown target always exports the linker globals
# __data_end and __heap_base, so a module's list names them too.

set -euo pipefail

module=${1:?name the module}
shift

refuse() {
  printf 'The module surface check refuses %s: %s\n' "$module" "$1" >&2
  exit 1
}

if wasm-objdump -x -j Import "$module" >/dev/null 2>&1; then
  refuse "it imports, where a module this repository builds imports nothing."
fi

exported=$(wasm-objdump -x -j Export "$module" |
  sed -n 's/^ - [a-z]*\[[0-9]*\].* -> "\(.*\)"$/\1/p' | sort)
expected=$(printf '%s\n' "$@" | sort)
[ "$exported" = "$expected" ] ||
  refuse "it exports $(printf '%s' "$exported" | tr '\n' ' '), where its module file names $(printf '%s' "$expected" | tr '\n' ' ')"
