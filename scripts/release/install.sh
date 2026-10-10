#!/usr/bin/env bash
set -euo pipefail

readonly release_tag='@RELEASE_TAG@'
readonly repository='AlexaDeWit/Saerskriven'
readonly last_intel_mac_release='v0.8.3'
readonly release_checksums='
@RELEASE_SHA256SUMS@
'

fail() {
  printf 'Install failed: %s\n' "$*" >&2
  exit 1
}

main() {
  local bin_dir="${HOME:?HOME is unset}/.local/bin"
  local attest=false
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --bin-dir)
        [ "$#" -ge 2 ] || fail '--bin-dir needs an absolute directory.'
        bin_dir="$2"
        shift 2
        ;;
      --verify-attestation) attest=true; shift ;;
      --help)
        printf '%s\n' \
          'Usage: bash install.sh [--bin-dir /absolute/path] [--verify-attestation]' \
          "Installs ${release_tag} to \$HOME/.local/bin by default." \
          'Provides saer and the compatibility command saerskriven.' \
          'Checks SHA-256 before replacing an existing executable.' \
          'On Linux, starts the new executable once before installing it, and changes nothing when it does not start.' \
          '--verify-attestation also requires gh and verifies the release build origin.'
        return
        ;;
      *) fail "Unknown argument: $1" ;;
    esac
  done
  [ "$(id -u)" != 0 ] || fail 'Run as your own user, without sudo.'
  case "$bin_dir" in
    /*) ;;
    *) fail '--bin-dir must be an absolute directory.' ;;
  esac
  [[ "$release_tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]] ||
    fail 'Download the release installer. This source template has no release tag.'
  check_install_paths "$bin_dir"

  local os arch target
  os="$(uname -s)"
  arch="$(uname -m)"
  case "$os" in
    Linux) target=unknown-linux-gnu ;;
    Darwin) target=apple-darwin ;;
    *) fail "Unsupported operating system: $os. This installer supports macOS and Linux." ;;
  esac
  case "$arch" in
    x86_64|amd64) arch=x86_64 ;;
    arm64|aarch64) arch=aarch64 ;;
    *) fail "Unsupported architecture: $arch. Use a 64-bit Intel, AMD, or ARM system." ;;
  esac
  # A translated shell on Apple silicon reports x86_64.
  if [ "$os" = Darwin ] && [ "$arch" = x86_64 ] &&
    [ "$(sysctl -n hw.optional.arm64 2>/dev/null || true)" = 1 ]; then
    arch=aarch64
  fi
  if [ "$os" = Darwin ] && [ "$arch" = x86_64 ]; then
    fail "No executable is built for an Intel Mac. $last_intel_mac_release is the last release with one: run the install.sh from https://github.com/${repository}/releases/tag/$last_intel_mac_release"
  fi

  local checksum_command
  if command -v sha256sum >/dev/null 2>&1; then
    checksum_command=(sha256sum)
  elif command -v shasum >/dev/null 2>&1; then
    checksum_command=(shasum -a 256)
  else
    fail 'Install sha256sum or shasum before running this installer.'
  fi
  command -v curl >/dev/null 2>&1 || fail 'Install curl before running this installer.'
  if "$attest"; then
    command -v gh >/dev/null 2>&1 || fail '--verify-attestation requires the GitHub CLI (gh).'
  fi

  local asset="saer-${release_tag#v}-${arch}-${target}"
  local base_url="https://github.com/${repository}/releases/download/${release_tag}"
  umask 077
  scratch="$(mktemp -d "${TMPDIR:-/tmp}/saerskriven-install.XXXXXXXX")"
  local expected actual
  expected="$(awk -v name="$asset" '
    $NF == name {
      count++
      hash = substr($0, 1, 64)
      if ($0 != hash "  " name || hash !~ /^[0-9a-f]+$/ || length(hash) != 64) bad = 1
    }
    END {
      if (count != 1 || bad) exit 1
      print hash
    }
  ' <<<"$release_checksums")" || fail "Expected exactly one SHA-256 entry for $asset."
  download "$base_url/$asset" "$scratch/$asset"
  actual="$("${checksum_command[@]}" <"$scratch/$asset")"
  actual="${actual%% *}"
  [ "$actual" = "$expected" ] || fail "SHA-256 mismatch for $asset."
  if "$attest"; then
    gh attestation verify "$scratch/$asset" --repo "$repository" \
      --signer-workflow "$repository/.github/workflows/ci.yml" \
      --source-ref "refs/tags/$release_tag" || fail 'Release attestation verification failed.'
  fi

  install_binary "$bin_dir" "$scratch/$asset" "$os"
  printf 'Installed %s to %s/saer (SHA-256 verified).\n' "$release_tag" "$bin_dir"
  case ":${PATH-}:" in
    *:"$bin_dir":*) ;;
    *) printf 'Add %s to PATH in your shell configuration, then open a new terminal.\n' "$bin_dir" ;;
  esac
}

check_install_paths() {
  local destination="$1/saer"
  local compatibility="$1/saerskriven"
  [ ! -L "$destination" ] || fail "Refusing to replace a symbolic link: $destination"
  if [ -e "$destination" ] && [ ! -f "$destination" ]; then
    fail "The destination is not a regular file: $destination"
  fi
  if [ -L "$compatibility" ]; then
    [ "$(readlink "$compatibility")" = saer ] ||
      fail "Refusing to replace an unrelated symbolic link: $compatibility"
  elif [ -e "$compatibility" ] && [ ! -f "$compatibility" ]; then
    fail "The compatibility path is not a regular file: $compatibility"
  fi
  if [ -e "$destination" ] && [ ! -L "$compatibility" ]; then
    fail "Refusing to replace an existing saer without its saerskriven compatibility link: $destination"
  fi
  local found
  found="$(command -v saer || true)"
  if [ -n "$found" ] && [ ! "$found" -ef "$destination" ]; then
    fail "Another saer command is already on PATH: $found"
  fi
}

# The executable is started where it will be installed, before it replaces
# anything: a temporary directory may forbid running a program.
check_start() {
  local status=0
  "$2" --version >/dev/null </dev/null || status=$?
  [ "$status" != 0 ] || return 0
  if [ "$status" = 126 ]; then
    printf '%s\n' \
      "$1 does not let a program run. It may be mounted noexec: choose another directory with --bin-dir." >&2
  else
    printf '%s\n' \
      "${release_tag} does not start on this system." \
      'It needs glibc 2.28 or newer, libstdc++ and libatomic (the package libatomic1 or libatomic).' \
      "Install them and run this installer again, or use the Nix package, which brings its own: https://github.com/${repository}/blob/${release_tag}/docs/nix.md" >&2
  fi
  fail "Nothing in $1 was changed."
}

install_binary() {
  local bin_dir="$1"
  mkdir -p "$bin_dir"
  check_install_paths "$bin_dir"
  # Stage on the destination filesystem so replacement is a single rename.
  staging="$(mktemp -d "$bin_dir/.saerskriven-install.XXXXXXXX")"
  cp "$2" "$staging/saer"
  chmod 755 "$staging/saer"
  if [ "$3" = Linux ]; then
    check_start "$bin_dir" "$staging/saer"
  fi
  if [ ! -L "$bin_dir/saerskriven" ]; then
    ln -s saer "$staging/saerskriven"
    rollback_binary="$bin_dir/saer"
  fi
  mv -f "$staging/saer" "$bin_dir/saer"
  if [ -n "$rollback_binary" ]; then
    mv -f "$staging/saerskriven" "$bin_dir/saerskriven"
  fi
  rollback_binary=''
}

download() {
  curl -q --fail --silent --show-error --location \
    --proto '=https' --proto-redir '=https' --tlsv1.2 \
    --connect-timeout 15 --max-time 300 --retry 2 \
    --output "$2" "$1" || fail "Download failed: $1"
}

cleanup() {
  if [ -n "$rollback_binary" ]; then
    local compatibility="${rollback_binary%/*}/saerskriven"
    if [ ! -L "$compatibility" ] || [ "$(readlink "$compatibility")" != saer ]; then
      rm -f -- "$rollback_binary"
    fi
  fi
  if [ -n "$staging" ]; then rm -rf -- "$staging"; fi
  if [ -n "$scratch" ]; then rm -rf -- "$scratch"; fi
}

scratch=''
staging=''
rollback_binary=''
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# A piped, truncated download cannot call main before its definition is complete.
main "$@"
