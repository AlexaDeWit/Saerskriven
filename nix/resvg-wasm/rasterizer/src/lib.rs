//! The rasterizer module's logic: SVG to PNG through resvg, the faces offered
//! so far, and the buffers the exports reach them through. The export table in
//! `../src/lib.rs` is the only code outside this crate.
#![forbid(unsafe_code)]

pub mod boundary;
mod raster;
