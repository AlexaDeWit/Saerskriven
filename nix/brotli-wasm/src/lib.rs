//! Compresses bytes to brotli and decodes them back for Saerskriven's share
//! links.
//!
//! The module instantiates with no imports and no JavaScript glue. Rust owns
//! one input buffer and one output buffer, and the caller reaches them only
//! through the addresses the module answers:
//!
//! - `input(length)` sizes the input buffer and answers its address, for the
//!   caller to write the bytes into.
//! - `compress()` and `decompress(maximum)` read the input buffer, write the
//!   output buffer, and answer a status: 0 means the output holds the bytes,
//!   1 that the decoded bytes would pass the maximum, and 2 that the input is
//!   not one whole standard brotli stream. `compress` only ever answers 0.
//! - `output()` and `output_length()` answer the output buffer's address and
//!   length, for the caller to copy the bytes from.
//!
//! Any call may grow the module's memory, so the caller reads an address after
//! the call that answered it. An allocation the module cannot make aborts it,
//! which the caller sees as a trap.
//!
//! The crate holds no memory-unsafe code. `Cargo.toml` denies the lint, every
//! logic module forbids it, and `exports.rs` is the one file allowed to name
//! it, for the markers Rust requires on an exported function. The guard in
//! `nix/unsafe-ban.sh` stops the build where that structure does not hold.

mod boundary;
mod codec;
mod exports;
