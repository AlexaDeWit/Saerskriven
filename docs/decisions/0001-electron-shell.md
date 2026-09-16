# 0001: Electron for the desktop shell

Status: accepted, 2026-08-29. Deferred, 2026-09-12: the desktop build waits on
code signing for macOS and Windows, which the project does not have, so the
offering is the web studio and the CLI (milestone M5).

## Context

The desktop build must render identically on every platform, the property the
project values in Threat Dragon's desktop distribution. Tauri produces
smaller binaries but renders in each platform's system webview, which
reintroduces cross-platform drift, and adds a Rust surface to a TypeScript
repo.

## Decision

Electron wraps the studio app: bundled Chromium, identical rendering
everywhere, one language in the repository.

## Consequences

Larger downloads, accepted. The shell stays thin, so a later shell swap stays
possible.
