//! The brotli module's logic: the encoder and the bounded decoder, and the two
//! buffers the exports reach them through. The export table in `../src/lib.rs`
//! is the only code outside this crate.
#![forbid(unsafe_code)]

pub mod boundary;
mod codec;
