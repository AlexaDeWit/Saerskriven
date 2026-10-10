#!/usr/bin/env bash
# Build one Node single executable application offline, with the restriction
# every executable ships under. See docs/build.md.
set -euo pipefail

if [ "$#" -ne 4 ]; then
  echo "usage: $0 <staged tree> <entry file> <target> <output>" >&2
  exit 2
fi

readonly tree="$1"
readonly entry="$2"
readonly target="$3"
case "$4" in
  /*) readonly output="$4" ;;
  *) readonly output="${PWD}/$4" ;;
esac

for pin in SAERSKRIVEN_SEA_NODE SAERSKRIVEN_NODE_RUNTIMES \
  SAERSKRIVEN_RCODESIGN SAERSKRIVEN_UNSHARE; do
  if [ -z "${!pin-}" ]; then
    echo "${pin} is unset, so nothing pins what this build runs and embeds." >&2
    echo "Run it inside the flake shell, which sets it: nix develop" >&2
    exit 1
  fi
done

if ! "${SAERSKRIVEN_UNSHARE}" -rn true >/dev/null 2>&1; then
  echo "'${SAERSKRIVEN_UNSHARE} -rn' cannot create a network namespace here." >&2
  echo "Refusing to build with the network reachable. A network namespace" >&2
  echo "is a Linux facility, so this does not run on macOS or Windows, and" >&2
  echo "Ubuntu 24.04 and its like deny it through the sysctl" >&2
  echo "kernel.apparmor_restrict_unprivileged_userns, which the workflow" >&2
  echo "clears before it compiles." >&2
  exit 1
fi

readonly runtime="${SAERSKRIVEN_NODE_RUNTIMES}/${target}/node"
if [ ! -e "${runtime}" ]; then
  echo "no pinned Node binary for ${target} at ${runtime}." >&2
  echo "Add its hash to nodeRuntimePins in flake.nix: the build fetches" >&2
  echo "nothing." >&2
  exit 1
fi

scratch="$(mktemp -d)"
readonly scratch
trap 'rm -rf -- "${scratch}"' EXIT

# Keys and paths are relative to the tree, so no host path reaches the
# output, and sorted, so the listing order of a directory does not either.
assets='{}'
if [ -d "${tree}/assets" ]; then
  assets="$(cd -- "${tree}" && find assets -type f | LC_ALL=C sort |
    jq -R . | jq -s 'map({ (.): . }) | add // {}')"
fi
readonly assets

# The restriction. Of the permission flags this Node has, the two for files
# are granted and every other is denied by name. A denial is needed, and not
# only the absence of a grant, because Node also reads a configuration file
# that any argument names (--experimental-config-file) and applies its
# permission section. It parses execArgv after that file, so a denial here
# wins over a grant there.
readonly denied=(addons child-process ffi fs-vfs inspector net openssl-store
  wasi worker)
known="$("${SAERSKRIVEN_SEA_NODE}" --help |
  { grep -o -- '--allow-[a-z-]*' || true; } | LC_ALL=C sort -u | tr '\n' ' ')"
listed="$(printf -- '--allow-%s\n' fs-read fs-write "${denied[@]}" |
  LC_ALL=C sort | tr '\n' ' ')"
if [ "${known}" != "${listed}" ]; then
  echo "the packaging Node has the permission flags: ${known}" >&2
  echo "and $0 grants or denies: ${listed}" >&2
  echo "Grant or deny each by name before building, so that a scope a" >&2
  echo "Node bump added is not left to a configuration file to grant." >&2
  exit 1
fi
denials="$(printf '%s\n' "${denied[@]}" | jq -R '"--no-allow-" + .' | jq -s .)"
readonly denials

# execArgvExtension keeps NODE_OPTIONS and --node-options out of the
# arguments Node parses.
readonly config="${scratch}/sea-config.json"
jq -n \
  --arg main "${entry}" \
  --arg executable "${runtime}" \
  --arg output "${output}" \
  --argjson assets "${assets}" \
  --argjson denials "${denials}" \
  '{
    main: $main,
    mainFormat: "module",
    executable: $executable,
    output: $output,
    disableExperimentalSEAWarning: true,
    useSnapshot: false,
    useCodeCache: false,
    assets: $assets,
    execArgv: (
      ["--permission", "--allow-fs-read=*", "--allow-fs-write=*"] + $denials
    ),
    execArgvExtension: "none"
  }' >"${config}"

(cd -- "${tree}" &&
  "${SAERSKRIVEN_UNSHARE}" -rn "${SAERSKRIVEN_SEA_NODE}" \
    --build-sea "${config}" >/dev/null)

# The output takes the mode of the store's read-only binary.
chmod 755 -- "${output}"

# --build-sea removes the Mach-O signature, and macOS on Apple silicon runs
# no unsigned code. With no certificate rcodesign signs ad hoc. Its progress
# lines are shown only where it fails.
case "${target}" in
  *-apple-darwin)
    if ! signing="$("${SAERSKRIVEN_RCODESIGN}" sign --binary-identifier saer \
      -- "${output}" 2>&1)"; then
      echo "${signing}" >&2
      exit 1
    fi
    ;;
esac
