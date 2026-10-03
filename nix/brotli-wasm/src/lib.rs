//! The brotli module's export table, the only code outside the logic crate in
//! `codec/`. Every function here is one call into that crate's boundary.
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
//! Any call may grow the module's memory, so the caller makes each view of the
//! memory after the call that answered its address, never before. An
//! allocation the module cannot make aborts it, which the caller sees as a
//! trap.
//!
//! The logic crate forbids the `unsafe_code` lint at its root, which no
//! module, included file or inner attribute in it can lower. This file allows
//! the lint, because Rust refuses an exported function under `forbid`, and
//! `nix/unsafe-ban.sh` refuses the build unless every line here is one of the
//! export table's few shapes.
#![allow(unsafe_code)]

use saerskriven_brotli_codec::boundary;

#[unsafe(no_mangle)]
pub extern "C" fn input(length: usize) -> *mut u8 {
    boundary::input(length)
}

#[unsafe(no_mangle)]
pub extern "C" fn compress() -> u32 {
    boundary::compress()
}

#[unsafe(no_mangle)]
pub extern "C" fn decompress(maximum: usize) -> u32 {
    boundary::decompress(maximum)
}

#[unsafe(no_mangle)]
pub extern "C" fn output() -> *const u8 {
    boundary::output()
}

#[unsafe(no_mangle)]
pub extern "C" fn output_length() -> usize {
    boundary::output_length()
}
