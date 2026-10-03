//! The rasterizer module's export table, the only code outside the logic crate
//! in `rasterizer/`. Every function here is one call into that crate's
//! boundary.
//!
//! The module instantiates with no imports and no JavaScript glue. Rust owns
//! one input buffer and one output buffer, and the caller reaches them only
//! through the addresses the module answers:
//!
//! - `input(length)` sizes the input buffer and answers its address, for the
//!   caller to write the bytes into.
//! - `add_font()` takes the input buffer as a font the next `render` may
//!   typeset with, and answers the number of faces it held: 0 is a buffer
//!   holding no face this renderer reads. Faces stack in call order, and a
//!   family the document names that no face carries falls back to the first
//!   face offered.
//! - `render(long_edge)` rasterizes the SVG in the input buffer, scaled so its
//!   longer side is `long_edge` pixels, or at the size the document names when
//!   `long_edge` is 0. It answers a status: 0 means the output buffer holds a
//!   PNG, and 1 that it holds a UTF-8 sentence naming what was refused.
//! - `width()` and `height()` answer the size in pixels of the PNG the output
//!   buffer holds, and 0 where it holds none.
//! - `output()` and `output_length()` answer the output buffer's address and
//!   length, for the caller to copy the bytes from.
//!
//! Every call but `width()`, `height()`, `output()` and `output_length()`
//! empties the output buffer and resets that size to 0 before it does anything
//! else, so after a call that trapped they answer nothing an earlier call
//! wrote.
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

use saerskriven_resvg_rasterizer::boundary;

#[unsafe(no_mangle)]
pub extern "C" fn input(length: usize) -> *mut u8 {
    boundary::input(length)
}

#[unsafe(no_mangle)]
pub extern "C" fn add_font() -> usize {
    boundary::add_font()
}

#[unsafe(no_mangle)]
pub extern "C" fn render(long_edge: u32) -> u32 {
    boundary::render(long_edge)
}

#[unsafe(no_mangle)]
pub extern "C" fn width() -> u32 {
    boundary::width()
}

#[unsafe(no_mangle)]
pub extern "C" fn height() -> u32 {
    boundary::height()
}

#[unsafe(no_mangle)]
pub extern "C" fn output() -> *const u8 {
    boundary::output()
}

#[unsafe(no_mangle)]
pub extern "C" fn output_length() -> usize {
    boundary::output_length()
}
