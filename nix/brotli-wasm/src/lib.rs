//! Export table for the shared Brotli and experimental PPMd module.
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

#[unsafe(no_mangle)]
pub extern "C" fn compress_ppmd() -> u32 {
    boundary::compress_ppmd()
}

#[unsafe(no_mangle)]
pub extern "C" fn decompress_ppmd(maximum: usize) -> u32 {
    boundary::decompress_ppmd(maximum)
}
