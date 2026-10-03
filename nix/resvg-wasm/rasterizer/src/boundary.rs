//! The module's two buffers and the last raster's size, which only this crate
//! allocates, sizes and frees. The caller writes its bytes at the address
//! `input` answers and copies the answer from the address and length `output`
//! and `output_length` answer, so no address the caller holds is ever read
//! here.
//!
//! Every call but the four getters, `output`, `output_length`, `width` and
//! `height`, empties the output buffer and resets the size to 0 by 0 before it
//! does anything else, so after a call that trapped they answer nothing an
//! earlier call wrote.

use std::cell::{Cell, RefCell};

use crate::raster;

const RENDERED: u32 = 0;
const REFUSED: u32 = 1;

thread_local! {
    static INPUT: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
    static OUTPUT: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
    static SIZE: Cell<(u32, u32)> = const { Cell::new((0, 0)) };
}

/// Sizes the input buffer to `length` zeroed bytes and answers its address,
/// for the caller to write the bytes into.
pub fn input(length: usize) -> *mut u8 {
    empty_output();
    INPUT.with_borrow_mut(|held| {
        held.clear();
        held.resize(length, 0);
        held.as_mut_ptr()
    })
}

/// Takes the input buffer as a font the next `render` may typeset with, and
/// answers the number of faces it held.
pub fn add_font() -> usize {
    empty_output();
    raster::offered(INPUT.take())
}

/// Rasterizes the SVG in the input buffer into the output buffer, and answers
/// 0 where the output holds a PNG or 1 where it holds the sentence naming what
/// was refused.
pub fn render(long_edge: u32) -> u32 {
    empty_output();
    let (status, size, bytes) = match INPUT.with_borrow(|svg| raster::rasterize(svg, long_edge)) {
        Ok(raster) => (RENDERED, (raster.width, raster.height), raster.png),
        Err(refusal) => (REFUSED, (0, 0), refusal.into_bytes()),
    };
    SIZE.set(size);
    OUTPUT.set(bytes);
    status
}

/// The width in pixels of the PNG the output buffer holds, 0 where it holds
/// none.
pub fn width() -> u32 {
    SIZE.get().0
}

/// The height in pixels of the PNG the output buffer holds, 0 where it holds
/// none.
pub fn height() -> u32 {
    SIZE.get().1
}

/// The output buffer's address.
pub fn output() -> *const u8 {
    OUTPUT.with_borrow(|held| held.as_ptr())
}

/// The output buffer's length.
pub fn output_length() -> usize {
    OUTPUT.with_borrow(Vec::len)
}

// The size describes the output, so it goes with it. The buffer is replaced by
// an empty one rather than cleared, so its memory is freed.
fn empty_output() {
    SIZE.set((0, 0));
    OUTPUT.set(Vec::new());
}
