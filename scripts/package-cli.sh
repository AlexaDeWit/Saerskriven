#!/usr/bin/env bash
# Package the release executables offline. See docs/build.md for the runtime pins and rebuilds.
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
readonly repo_root
cd -- "${repo_root}"

readonly bundle='apps/cli/dist/saer.js'
readonly assets='apps/cli/dist/assets'
readonly out_dir='dist/cli'

readonly all_targets=(
  x86_64-unknown-linux-gnu
  aarch64-unknown-linux-gnu
  aarch64-apple-darwin
  x86_64-pc-windows-msvc
)

case "$(uname -s) $(uname -m)" in
  'Linux x86_64') readonly host_target='x86_64-unknown-linux-gnu' ;;
  'Linux aarch64') readonly host_target='aarch64-unknown-linux-gnu' ;;
  *)
    echo "no release target is built on $(uname -s) $(uname -m): package on" >&2
    echo "Linux, or in a Linux container, where every target is built." >&2
    exit 1
    ;;
esac

targets=("${host_target}")
if [ "${1-}" = '--all' ]; then
  targets=("${all_targets[@]}")
elif [ "$#" -ne 0 ]; then
  echo "usage: $0 [--all]" >&2
  exit 2
fi

if [ ! -f "${bundle}" ]; then
  echo "no bundle at ${bundle}: run 'nx build @saerskriven/cli' first" >&2
  exit 1
fi

if [ ! -d "${assets}" ]; then
  echo "no assets at ${assets}: run 'nx build @saerskriven/cli' first" >&2
  exit 1
fi

version="$(node -p 'require("./package.json").version')"
readonly version

scratch="$(mktemp -d)"
readonly scratch
readonly repeat_dir="${scratch}/cli-repeat"
trap 'rm -rf -- "${scratch}"' EXIT

stage_into() {
  mkdir -p -- "$1"
  cp -- "${bundle}" "$1/saer.js"
  cp -R -- "${assets}" "$1/assets"
}

readonly staged="${scratch}/first"
readonly repeat_staged="${scratch}/repeat"
stage_into "${staged}"
stage_into "${repeat_staged}"

# The repeat tree differs in the time and mode of every file and directory,
# so a build that reads either into its output fails the comparison below.
find "${repeat_staged}" -type f -exec chmod 600 -- {} +
find "${repeat_staged}" -type d -exec chmod 700 -- {} +
find "${repeat_staged}" -depth -exec touch -m -d '@1000000000' -- {} +

rm -rf -- "${out_dir}"
mkdir -p -- "${out_dir}" "${repeat_dir}"

for target in "${targets[@]}"; do
  name="saer-${version}-${target}"
  case "${target}" in
    *-windows-*) name="${name}.exe" ;;
  esac

  echo "packaging ${name}"
  scripts/sea-executable.sh "${staged}" saer.js "${target}" \
    "${repo_root}/${out_dir}/${name}"
  scripts/sea-executable.sh "${repeat_staged}" saer.js "${target}" \
    "${repeat_dir}/${name}"

  first="$(sha256sum <"${out_dir}/${name}" | cut -d ' ' -f 1)"
  second="$(sha256sum <"${repeat_dir}/${name}" | cut -d ' ' -f 1)"
  if [ "${first}" != "${second}" ]; then
    echo "${name} is not reproducible: one bundle staged twice, once with" >&2
    echo "another time and mode, gave ${first} and ${second}." >&2
    exit 1
  fi
done

(cd -- "${out_dir}" && sha256sum -- saer-* >SHA256SUMS)

readonly host_binary="${out_dir}/saer-${version}-${host_target}"

reported="$("${host_binary}" --version)"
if [ "${reported}" != "${version}" ]; then
  echo "the executable reports ${reported}, the workspace carries ${version}" >&2
  exit 1
fi

readonly fixture='test-data/saerskriven/two-diagrams.yaml'
summary="$("${host_binary}" validate "${fixture}")"
readonly summary

# Rendering detects a missing embedded Typst module that validation cannot catch.
readonly pdf_check="${scratch}/pdf-check.pdf"
"${host_binary}" render "${fixture}" --format pdf --out "${pdf_check}"
pdf_header="$(head -c 5 -- "${pdf_check}")"
readonly pdf_header
if [ "${pdf_header}" != '%PDF-' ]; then
  echo "saer render --format pdf wrote a file opening '${pdf_header}'," >&2
  echo "not a PDF. The executable carries no working Typst compiler." >&2
  exit 1
fi

# The same for the embedded resvg module, which the PDF check does not reach.
readonly png_check="${scratch}/png-check.png"
"${host_binary}" render "${fixture}" --format png --diagram storefront \
  --out "${png_check}"
png_header="$(head -c 8 -- "${png_check}" | od -An -tx1 | tr -d ' \n')"
readonly png_header
if [ "${png_header}" != '89504e470d0a1a0a' ]; then
  echo "saer render --format png wrote a file opening '${png_header}'," >&2
  echo "not a PNG. The executable carries no working rasterizer." >&2
  exit 1
fi

# The same for the embedded brotli module, which neither render reaches.
share_link="$("${host_binary}" share "${fixture}")"
readonly share_link
case "${share_link}" in
  https://*'#share=1.'?*) ;;
  *)
    echo "saer share printed '${share_link:0:60}', not a share link. The" >&2
    echo "executable carries no working brotli module." >&2
    exit 1
    ;;
esac

echo "saer --version reports ${reported}, saer validate ${fixture}"
echo "reports ${summary}, saer render writes a PDF and a PNG, saer share"
echo "writes a link, and every target was built twice to the same bytes"

# Log input hashes to locate differences when rebuilding a release.
sha256sum -- "${bundle}" "${assets}"/*.ttf \
  "${assets}"/LICENSE.liberation-fonts.txt "${assets}/saerskriven_resvg.wasm" \
  "${assets}/saerskriven_brotli.wasm"
cat -- "${out_dir}/SHA256SUMS"
