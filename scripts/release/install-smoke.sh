#!/usr/bin/env bash
set -euo pipefail

# CI supplies the packaged assets. Only transport is replaced in this smoke check.
assets="$(cd cli && pwd)"
expected="$(jq -r .version package.json)"
scratch="$(mktemp -d)"
trap 'rm -rf -- "$scratch"' EXIT
mkdir -p "$scratch/tools" "$scratch/home/.local/bin"
export INSTALL_SMOKE_ASSETS="$assets"
cat >"$scratch/tools/curl" <<'EOF'
#!/bin/bash
set -eu
while [ "$#" -gt 0 ]; do
  case "$1" in
    --output) output="$2"; shift 2 ;;
    *) url="$1"; shift ;;
  esac
done
cp "$INSTALL_SMOKE_ASSETS/${url##*/}" "$output"
if [ "${INSTALL_SMOKE_CORRUPT:-false}" = true ]; then printf 'corrupt\n' >>"$output"; fi
EOF
chmod +x "$scratch/tools/curl"
export PATH="$scratch/tools:/usr/bin:/bin:/usr/sbin:/sbin"
export HOME="$scratch/home"
destination="$HOME/.local/bin/saer"
compatibility="$HOME/.local/bin/saerskriven"
printf 'previous version\n' >"$compatibility"
# /bin/bash selects the system shell, including macOS Bash 3.2.
/bin/bash "$assets/install.sh"
first="$("$destination" --version)"
[ "$first" = "$expected" ]
[ ! -L "$destination" ]
[ "$(readlink "$compatibility")" = saer ]
[ "$("$compatibility" --version)" = "$expected" ]
/bin/bash "$assets/install.sh"
[ "$("$destination" --version)" = "$first" ]
[ "$("$compatibility" --version)" = "$first" ]
if INSTALL_SMOKE_CORRUPT=true /bin/bash "$assets/install.sh"; then
  echo 'The installer accepted a corrupted executable.' >&2
  exit 1
fi
[ "$("$destination" --version)" = "$first" ]

# The installed executable validates a model and writes the committed PNG and
# PDF bytes, with nothing on standard error.
fixture=test-data/saerskriven/two-diagrams.yaml
goldens=test-data/render
summary="$("$destination" validate "$fixture" 2>"$scratch/stderr")"
[ "$summary" = 'saerskriven-yaml: 2 diagrams, 25 elements, 10 threats' ] || {
  echo "saer validate printed: $summary" >&2
  exit 1
}
"$destination" render "$fixture" --format png --diagram storefront \
  --out "$scratch/storefront.png" 2>>"$scratch/stderr"
cmp "$scratch/storefront.png" "$goldens/two-diagrams-storefront.snapshot.png"
"$destination" render "$fixture" --format pdf --out "$scratch/model.pdf" \
  2>>"$scratch/stderr"
if command -v sha256sum >/dev/null 2>&1; then
  pdf_hash="$(sha256sum <"$scratch/model.pdf")"
else
  pdf_hash="$(shasum -a 256 <"$scratch/model.pdf")"
fi
[ "${pdf_hash%% *}" = "$(cat "$goldens/two-diagrams.snapshot.pdf.sha256")" ] || {
  echo "saer render --format pdf wrote ${pdf_hash%% *}, not the committed hash." >&2
  exit 1
}
[ ! -s "$scratch/stderr" ] || {
  echo 'saer wrote to standard error:' >&2
  cat "$scratch/stderr" >&2
  exit 1
}
printf 'Native installer smoke passed for %s on %s %s.\n' "$first" "$(uname -s)" "$(uname -m)"
