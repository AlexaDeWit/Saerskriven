# Share-link compatibility fixtures

These fixtures come from the repository's native threat-model fixtures.
They contain no external model data.

`v1-feature-complete.fragment.txt` was written with the pre-PPMd Brotli
module at `fb3f305c310b7732c6ee4839d2f3495b68b6860c`.
`v1-v021.fragment.txt` contains the frozen `saerskriven/v0.2.1.yaml`
document as a standard Brotli stream.

`v2-feature-complete.compact.txt` pins the compact representation measured
during the initial investigation. The Brotli and PPMd version-2 fragments
encode that document and pin the decoder contract.

The [wire contract](../../docs/share-link-poc.md#wire-contract) names the
field-order authority and the rules for evolving an encoding.
