# Saerskriven

A threat modelling studio: draw the system, and record the threats on the
diagram itself.

The name `Saerskriven` is a simplified spelling of Swedish _särskriven_,
"written separately." It nods to _särskrivningar_, compound words split into
their parts. Threat modelling does similar work: it breaks apart a complex
problem or design so each risk can be examined.

## Goal

Saerskriven keeps the paradigm of [OWASP Threat Dragon](https://github.com/OWASP/threat-dragon),
element-attached threats edited in place on a data-flow diagram, and rebuilds
it on a typed core:

- **A typed internal model** as the single authority, richer than any one file
  format, with codecs at the edge.
- **File formats as codecs**: read and write Threat Dragon v2 JSON, plus a
  [YAML format of our own](docs/saerskriven-yaml.md). A model file in git is the
  source of truth, and a codec names every place a file and the model do not
  correspond, rather than passing over it in silence.
- **A drawing UI** (React) where the diagram is the editor, not a picture
  beside a form.
- **A CLI** for headless work: validate a model, render it to SVG, PNG,
  Markdown, or PDF, in CI or a docs build.

## Relationship to OWASP Threat Dragon

Saerskriven is inspired by Threat Dragon and derives material from it, starting
with its model schema. We consider this project a derived work of Threat
Dragon and license it under the same Apache License 2.0. See
[`NOTICE`](NOTICE) for the upstream attribution.

## Structure

| Project                             | What it holds                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/model`                    | The internal data structures and operations on them                                                                                                                                                                                                                                                                                                                                  |
| `packages/wire-saerskriven-yaml`    | The Saerskriven YAML format, version 1, as a schema and nothing else. A read migrates it to version 2                                                                                                                                                                                                                                                                                |
| `packages/wire-saerskriven-yaml-v2` | The Saerskriven YAML format, version 2, as a schema and nothing else. A write emits it                                                                                                                                                                                                                                                                                               |
| `packages/wire-threat-dragon`       | The Threat Dragon v2 format as a schema and nothing else                                                                                                                                                                                                                                                                                                                             |
| `packages/formats`                  | File-format codecs, and the mappings between a file and the model                                                                                                                                                                                                                                                                                                                    |
| `packages/i18n`                     | Typed messages over `Intl`: locales, plural categories, catalogue checks, locale negotiation                                                                                                                                                                                                                                                                                         |
| `packages/canvas`                   | React canvas components, shared by the UI and headless rendering                                                                                                                                                                                                                                                                                                                     |
| `packages/render`                   | Projections of a model: SVG, markdown, Typst source, the `pdf` subpath that compiles that source, the `resvg` subpath that rasterizes a drawing, and the `png` subpath that draws one diagram through it                                                                                                                                                                             |
| `packages/mcp`                      | The MCP server object: tools over the model and the codecs, with no transport of its own                                                                                                                                                                                                                                                                                             |
| `apps/studio`                       | The drawing UI: its [canvas](apps/studio/src/canvas/README.md), its [threat panel](apps/studio/src/panel/README.md), its [model store](apps/studio/src/store/README.md), its [file bridge](apps/studio/src/files/README.md), its [commands](apps/studio/src/commands/README.md), its [controls](apps/studio/src/ui/README.md) and its [messages](apps/studio/src/messages/README.md) |
| `apps/cli`                          | The command-line interface                                                                                                                                                                                                                                                                                                                                                           |
| `apps/studio-e2e`                   | The studio's [browser suite](apps/studio-e2e/README.md)                                                                                                                                                                                                                                                                                                                              |

A wire package declares one file format and depends on zod alone, so no
change to the internal model can change what a released format version
means. `packages/formats` is the only project that knows both a format and
the model. `packages/wire-otm` and `packages/wire-tmbom` hold the schemas of
the two formats the studio [imports](docs/import.md).

[`threat-modelling/`](threat-modelling/README.md) holds Saerskriven's own threat
model, in the native format, kept valid by the same suites that read it as a
fixture.

## Documentation

| Page                                                          | For                                                           |
| ------------------------------------------------------------- | ------------------------------------------------------------- |
| [The Saerskriven YAML format](docs/saerskriven-yaml.md)       | The native file format and its compatibility contract         |
| [Using the studio](docs/studio.md)                            | Drawing, editing threats and records, files, and the keyboard |
| [Importing a foreign model](docs/import.md)                   | What OTM and TM-BOM import carries over and reports           |
| [Render themes and embedded registers](docs/render-themes.md) | Appearance overrides, website badges, heading controls        |
| [The MCP server](docs/mcp.md)                                 | `saer mcp`: tools, resources, HTTP, host registration         |
| [Nix](docs/nix.md)                                            | Consuming the released CLI from a flake                       |
| [Building the executables](docs/build.md)                     | Packaging, the WebAssembly modules, reproducible builds       |
| [Cutting a release](docs/release.md)                          | The release procedure and the website deployment              |

## Install

The CLI ships as one executable per platform, attached to every
[release](https://github.com/AlexaDeWit/Saerskriven/releases). It carries its own
runtime, so there is nothing else to install: no node, no npm, no browser.

| Executable                                  | Platform              |
| ------------------------------------------- | --------------------- |
| `saer-<version>-x86_64-unknown-linux-gnu`   | Linux, Intel or AMD   |
| `saer-<version>-aarch64-unknown-linux-gnu`  | Linux, 64-bit ARM     |
| `saer-<version>-x86_64-apple-darwin`        | macOS, Intel          |
| `saer-<version>-aarch64-apple-darwin`       | macOS, Apple silicon  |
| `saer-<version>-x86_64-pc-windows-msvc.exe` | Windows, Intel or AMD |

### macOS and Linux

Download `install.sh` from the [latest release](https://github.com/AlexaDeWit/Saerskriven/releases/latest).
The installer selects your platform and checks the executable against its
embedded SHA-256 before installing it as `~/.local/bin/saer`.
The compatibility command `saerskriven` is a symbolic link to `saer`.
It needs Bash, curl, and either `sha256sum` (Linux) or `shasum` (macOS).
Linux executables require glibc. Alpine Linux's musl is not supported.

Download the script to a file, inspect it, then run it as your own user:

```sh
curl -q --fail --show-error --location --proto '=https' --proto-redir '=https' \
  --output install.sh \
  https://github.com/AlexaDeWit/Saerskriven/releases/latest/download/install.sh
less install.sh
bash install.sh
```

The script embeds its release tag and all binary hashes at build time.
It downloads only the selected binary. A newer release appearing during installation
cannot mix the selected executable and checksums. To choose an older release,
download its `install.sh` from that release's page. Releases published before
this installer was added require a manual download.

If `~/.local/bin` is absent from your PATH, add this line to `~/.bashrc` (Bash)
or `~/.zshrc` (zsh), then open a new terminal:

```sh
export PATH="$HOME/.local/bin:$PATH"
```

Run `saer --version` to check the installed version.
Use `bash install.sh --bin-dir "$HOME/bin"` to select another absolute directory.
The installer never uses sudo or edits your shell configuration. Running a new
release's installer replaces the existing regular file after verification.
A failed download or verification leaves the existing executable unchanged.
It refuses symbolic links and directories at the `saer` executable path.
It also refuses an unrelated `saer` in the destination or on PATH. Updates
recognize an existing installation by its `saerskriven -> saer` link.
An older installation containing only a regular `saerskriven` executable migrates
to the new layout. To uninstall, remove both `~/.local/bin/saer` and
`~/.local/bin/saerskriven`.

SHA-256 checks detect changed bytes. They do not prove build origin when an
attacker can replace both the executable and the installer. For build origin
verification, install [the GitHub CLI](https://cli.github.com/) and use:

```sh
bash install.sh --verify-attestation
```

This also requires a valid attestation for this repository, `ci.yml`, and the
embedded release tag before installation. A missing or mismatched attestation
fails the install. This option needs GitHub access through `gh`.
The installer itself is also checksummed and attested. To verify it before
execution, download it from a specific release and set `release_tag` to that tag:

```sh
release_tag=v0.1.0  # replace with the release you downloaded
gh attestation verify install.sh --repo AlexaDeWit/Saerskriven \
  --signer-workflow AlexaDeWit/Saerskriven/.github/workflows/ci.yml \
  --source-ref "refs/tags/$release_tag"
```

Add `--source-digest` with the signed tag's commit to require that commit too.

On macOS the executables are unsigned. If Gatekeeper blocks a verified download,
`xattr -d com.apple.quarantine ~/.local/bin/saer` removes its quarantine
attribute. The installer does not change Gatekeeper settings or execute the download.

### Other installation methods

Nix users can consume the pinned CLI through a locked flake input.
See [Nix installation and updates](docs/nix.md).

For a manual installation, download your executable and `SHA256SUMS` from the
same release. Compare `sha256sum <filename>` (Linux) or `shasum -a 256 <filename>`
(macOS) with the exact filename's entry before setting its executable bit and
moving it to your user bin directory. The attestation command above also works
with the executable's filename in place of `install.sh`.

Windows is outside the installer's scope. Download the `.exe` and `SHA256SUMS`
from the same release. In PowerShell, run `Get-FileHash .\<filename>.exe -Algorithm SHA256`
and compare the hash with that filename's entry. Rename the verified file to
`saer.exe` and put it in a user directory on PATH.

## Usage

Use `saer` for new scripts. The `saerskriven` compatibility command accepts the
same arguments and runs the same executable.

```sh
saer validate threat-model.yaml
saer render threat-model.yaml --format md --out register.md
saer render threat-model.yaml --format svg --out diagram.svg
saer render threat-model.yaml --format png --out diagram.png
saer render threat-model.yaml --format pdf --out threat-model.pdf
saer render threat-model.yaml --format svg --out -
```

Both commands read Threat Dragon v2 JSON and Saerskriven YAML, and the content
decides which: the file name is never consulted, so a model saved under any
extension reads.

`validate` prints one line naming the format and what the model holds, and
warns on standard error wherever the file and the model do not correspond
exactly, which is what a read dropped or held less exactly than the file
stated it.

`render` writes a projection. `--format md` writes the whole threat
register. `--format svg` draws one diagram, which `--diagram <id or title>`
chooses where the model holds more than one, and which a model of one does
not have to name. `--format png` draws that same diagram as a picture,
2500 pixels on its longer edge, for a reader that takes an image and not an
SVG. `--format pdf` writes one document holding every diagram, one to a
landscape page, then that same register, so it takes no `--diagram` either.
`--out -` writes to standard output, the PDF's and the PNG's bytes included.

`--lang <tag>` chooses the written document's language: en-CA, fr-CA or sv,
matched from the tag's language subtag (`fr`, `fr-FR` and `fr-CA` all give
fr-CA). The tag is a BCP 47 tag such as `fr-CA`, not the underscore form
`fr_CA` an environment variable like `LANG` carries. Without it the document
is en-CA, whatever `LANG`, `LC_*` or `LANGUAGE` say in the environment, since
the CLI never reads them. A tag naming no supported locale is refused rather
than rendered in en-CA. The CLI's own prose, help and errors included, stays
English.

The PDF is compiled by Typst and the PNG is rasterized by resvg, both of
which the executable carries as WebAssembly modules together with the fonts
they set text in, so both formats work with no network and on a machine that
has neither Typst nor a browser installed.

| Exit code | What it means                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0         | The command did what it was asked.                                                                                                                                                                                                                                                                                                                                                                                                                |
| 1         | Saerskriven read the file and refused it: no format claimed it, or one did and either the document or the model it maps to is not valid.                                                                                                                                                                                                                                                                                                          |
| 2         | The invocation cannot be carried out: the parser or the option schema refused it, a file cannot be read or written, a choice names no diagram, a stream refused the output, a pipe whose reader closed aside, `mcp --http` cannot listen on its port, or a projection could not be produced from a model Saerskriven accepted, which is the PDF typesetter or the PNG rasterizer refusing the document or an install missing the files they read. |

Errors go to standard error, path-precise where a schema refused something,
and no failure prints a stack trace.

For appearance overrides, website badges, and heading controls, see
[Render themes and embedded registers](docs/render-themes.md).

`saer mcp` serves the same models to an agent host over the Model Context
Protocol, and `saer mcp install` registers it with one. A model file is
untrusted input to an agent: read [the MCP server](docs/mcp.md) before
connecting one.

## Development

Nix with flakes provides the toolchain (node, pnpm, deno). With
[direnv](https://direnv.net/), `cd` into the checkout and it loads itself.

The flake decides the pnpm version and `packageManager` in
[`package.json`](package.json) records the version it decided. Run pnpm from
outside the shell and it stops with a mismatch rather than fetching a pnpm of
its own, so the two are bumped together
([`pnpm-workspace.yaml`](pnpm-workspace.yaml) says how that is enforced).

```sh
nix develop            # or let direnv do it
pnpm install
pnpm check             # everything the CI gate runs
pnpm fix               # write formatting and lint fixes
pnpm nx e2e @saerskriven/studio-e2e   # browser smoke, excluded from pnpm check
semgrep scan --config auto --severity ERROR --severity WARNING --error .   # SAST scan, excluded from pnpm check
scripts/check-provenance.mjs       # dependency provenance, excluded from pnpm check
```

The live loop: `pnpm nx serve studio` hot-reloads the studio app, and
`pnpm nx test <project> --watch` reruns a project's tests on change.
[`.vscode/settings.json`](.vscode/settings.json) points VS Code at the
workspace TypeScript and wires format-on-save to the oxc extension
(`oxc.oxc-vscode`), which formats through the repository's pinned oxfmt,
so the editor and the format check inside `pnpm check` agree.

See [`CODING.md`](CODING.md) for the coding guidelines,
[`CONTRIBUTING.md`](CONTRIBUTING.md) for the contribution process,
[`SECURITY.md`](SECURITY.md) for reporting vulnerabilities, and
[`GOVERNANCE.md`](GOVERNANCE.md) for how decisions get made.

## Licence

[Apache-2.0](LICENSE). Copyright 2026 Alexandra de Wit. Includes material
derived from OWASP Threat Dragon, see [`NOTICE`](NOTICE).
