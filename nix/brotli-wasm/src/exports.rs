//! The module's exports, each a one-line call into the boundary. This file is
//! the crate's one exception to its lint ban, which the owner approved on
//! 2026-10-02: Rust refuses to export a function under an outright ban, and
//! the build's guard holds this file to these markers and that one allowance.

#![allow(unsafe_code)]

use crate::boundary;

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
