//! Owned buffers shared by the Brotli and PPMd calls.

use std::cell::RefCell;

use crate::{codec, ppmd};

thread_local! {
    static INPUT: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
    static OUTPUT: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
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

/// Compresses the input buffer into the output buffer, and answers 0.
pub fn compress() -> u32 {
    empty_output();
    answer(Ok(INPUT.with_borrow(|held| codec::compressed(held))))
}

/// Decodes the input buffer into the output buffer, keeping at most `maximum`
/// bytes, and answers the status.
pub fn decompress(maximum: usize) -> u32 {
    empty_output();
    answer(INPUT.with_borrow(|held| codec::inflated(held, maximum)))
}

/// Encodes the input as the fixed PPMd profile for experimental share links.
pub fn compress_ppmd() -> u32 {
    empty_output();
    answer(INPUT.with_borrow(|held| ppmd::compressed(held)))
}

/// Decodes a PPMd frame within the caller's output bound.
pub fn decompress_ppmd(maximum: usize) -> u32 {
    empty_output();
    answer(INPUT.with_borrow(|held| ppmd::inflated(held, maximum)))
}

/// The output buffer's address.
pub fn output() -> *const u8 {
    OUTPUT.with_borrow(|held| held.as_ptr())
}

/// The output buffer's length.
pub fn output_length() -> usize {
    OUTPUT.with_borrow(Vec::len)
}

fn empty_output() {
    OUTPUT.set(Vec::new());
}

fn answer(outcome: Result<Vec<u8>, u32>) -> u32 {
    let (status, bytes) = match outcome {
        Ok(bytes) => (codec::WRITTEN, bytes),
        Err(status) => (status, Vec::new()),
    };
    OUTPUT.set(bytes);
    status
}
