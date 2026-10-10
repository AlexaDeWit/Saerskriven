# Compact share-link proof of concept

This development-only page compares current share links with a compact
representation compressed by Brotli or Rust PPMd. It selects the shortest
complete URL. The released studio, CLI, and MCP share writer still use encoding 1.

Run the studio in the development shell:

```sh
nix develop --command pnpm nx serve @saerskriven/studio
```

Open `http://localhost:4200/share-poc.html`. Choose a Saerskriven YAML or
Threat Dragon JSON file, or paste its text, then choose **Generate link**.
The page reports the current and selected lengths and the selected codec.
**Inspect link** reads either a generated link or an existing encoding-1 link.
The decoded YAML appears separately from the source text.

This page is not an entry point in the production build. Its links point at
the development page and require that page to open. Do not substitute the
deployed studio URL. Promotion to the released writer requires a separate
compatibility and browser-resource decision.

Each operation runs in a new worker. **Cancel** stops that worker, and a
15-second deadline includes module loading, compression, decoding, and
validation. Completion also stops the worker and releases its WASM instances.
The displayed duration includes worker startup and asset loading, so it is not
a codec-only benchmark.

## Wire contract

Encoding 1 remains the bytes of the native YAML save, compressed with Brotli
and encoded as unpadded base64url. This proof of concept also reads its earlier
native document versions through the existing migration path.

The experimental URL is:

```text
<development-page URL>#share=2.<base64url>
```

The payload starts with one codec byte:

| Byte | Remaining bytes                                  |
| ---- | ------------------------------------------------ |
| `0`  | One standard Brotli stream over the compact JSON |
| `1`  | A PPMd frame over that same compact JSON         |

The PPMd frame contains the uncompressed length as a little-endian `u32`,
the IEEE CRC32 of those bytes as a little-endian `u32`, and one PPMd7 stream
with an end marker. Its order is 8 and its model memory is fixed at 4 MiB.
The frame cannot request a different order or a larger model.
The reader checks the declared length before allocation, then the checksum,
end marker, and full input consumption.

The compact JSON is `[ids, document]`. `ids` contains unique original
identifiers, and a numeric value in a text slot refers to that table.
A literal string in a text slot remains text. No identifier is renamed.
The field order, variant tags, literals, and enum indexes are frozen in
[`share-compact-layout.ts`](../packages/formats/src/lib/share-compact-layout.ts).
That table is independent of the current native schema.

- Objects become arrays in their frozen field order. Literal fields consume no slot.
- Enums and variant tags use zero-based indexes.
- Booleans are `0` or `1`. Finite numbers keep their JSON representation,
  with the string `"-0"` reserved for negative zero in a numeric slot.
- Empty text and empty lists are `null`. Trailing `null` object slots may be omitted.
- Optional absence is `null`. A present optional value is `[value]`, so
  explicit false and empty values remain distinct from absence.
- Lists of objects or variants become `[rowCount, column1, column2, ...]`.
  Columns keep the original row order and have exactly `rowCount` entries.
  Shorter rows have trailing `null` padding.

For example, this is an empty model titled Minimal:

```json
[[], [["Minimal"], null, null, null, null, 0]]
```

Reconstruction produces a native version-2 wire document, which then follows
the existing native validation, reference checks, and divergence reporting.
The decoder does not construct the internal model directly.

The committed fixtures under [`test-data/share-links`](../test-data/share-links/)
pin the transport. Do not regenerate them to accommodate reordered fields or
changed enum indexes. Such changes require another encoding revision.

## Limits and remaining evaluation

The complete written URL and any read fragment remain capped at 1,048,576
characters. Native input and inflated compact JSON each have the existing
8 MiB text bound. The compact parser also applies the existing nesting bound.
An ID table or list holds at most 100,000 entries. Expansion permits at most
1,000,000 values and charges text references and keys against the existing
16,777,216-unit import text budget.

PPMd uses `ppmd-rust` through the existing two-crate WASM module. The project's
Rust code keeps its unsafe-code ban, and the module still imports nothing.
The shared module grows to include PPMd even though the released writer keeps
its current encoding. The third-party crate itself contains unsafe Rust.
No C or C++ codec dependency is added.

The proof of concept is for browser evaluation. Mobile CPU and memory costs,
independent corpus coverage, and the maintenance cost of a permanent decoder
still require review before adoption. A shorter URL alone does not settle
those costs.
