//! Compresses bytes to brotli and decodes them back for Saerskriven's share
//! links.
//!
//! The module instantiates with no imports and no JavaScript glue, on the
//! rasterizer's terms: bytes cross the boundary as a pointer and a length into
//! the module's own memory, which `alloc` hands out and `dealloc` takes back.
//! `compress` and `decompress` read the buffer they are given rather than
//! taking it, so the caller deallocs everything it allocs. Both answer with a
//! pointer to three 32-bit words, status, payload pointer and payload length,
//! which `release` frees. Status 0 means the payload holds the bytes, 1 that
//! the decoded bytes would pass the caller's maximum, and 2 that the input is
//! not one whole brotli stream. `compress` only ever answers 0.

use std::alloc::{self, Layout};

use brotli::enc::encode::{BrotliEncoderOperation, BrotliEncoderStateStruct};
use brotli::enc::{BrotliEncoderParams, StandardAlloc};
use brotli::{BrotliDecompressStream, BrotliResult, BrotliState};

const WRITTEN: u32 = 0;
const PAST_MAXIMUM: u32 = 1;
const MALFORMED: u32 = 2;

// Quality 11 with no custom dictionary (#604), so a native brotli decoder can
// read every link.
const QUALITY: i32 = 11;

// The window is the smallest that reaches back over the whole input, capped
// at standard brotli's 24 bits (#622). A window past the input shortens no
// link, and the quality 11 hasher is sized to the window, 128 MiB at 24 bits.
const FEWEST_WINDOW_BITS: i32 = 10;
const MOST_WINDOW_BITS: i32 = 24;
const WINDOW_GAP: usize = 16;

// Both directions write into a buffer this size and no larger. A decode also
// holds the ring buffer the stream's window declares (at most 16 MiB), the
// stream's own bytes, the bytes it kept, and a few MiB of decoder tables a
// crafted stream can force. The kept bytes never pass the maximum but grow by
// doubling, and the blocks a doubling frees cannot hold the next one, so they
// cost about twice the maximum.
const CHUNK: usize = 1 << 16;

// Bytes cross the boundary as bytes, so one-byte alignment is the whole
// contract, and `dealloc` rebuilds the same layout from the same length.
const ALIGNMENT: usize = 1;

/// What `compress` and `decompress` answer with, read by the caller and freed
/// by `release`.
#[repr(C)]
pub struct Outcome {
    status: u32,
    payload: *mut u8,
    length: usize,
}

/// Reserves `length` bytes of the module's memory for the caller to write
/// into, or answers null where it has no such run to give.
#[unsafe(no_mangle)]
pub extern "C" fn alloc(length: usize) -> *mut u8 {
    if length == 0 {
        return std::ptr::dangling_mut();
    }
    match Layout::from_size_align(length, ALIGNMENT) {
        Ok(layout) => unsafe { alloc::alloc(layout) },
        Err(_) => std::ptr::null_mut(),
    }
}

/// Returns a buffer `alloc` handed out, at the length it was asked for.
///
/// # Safety
///
/// `pointer` and `length` are one `alloc` call's answer and its argument.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn dealloc(pointer: *mut u8, length: usize) {
    if let (true, Ok(layout)) = (length > 0, Layout::from_size_align(length, ALIGNMENT)) {
        unsafe { alloc::dealloc(pointer, layout) };
    }
}

/// Compresses a buffer to one brotli stream at quality 11, in the smallest
/// window that covers it, up to 24 bits.
///
/// # Safety
///
/// `pointer` and `length` name a buffer the caller owns for the call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn compress(pointer: *const u8, length: usize) -> *mut Outcome {
    let input = unsafe { std::slice::from_raw_parts(pointer, length) };
    hand_over(WRITTEN, compressed(input))
}

/// Decodes one brotli stream, keeping at most `maximum` bytes of its output.
/// It stops at the first byte past the maximum rather than decoding the rest.
///
/// # Safety
///
/// `pointer` and `length` name a buffer the caller owns for the call.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn decompress(
    pointer: *const u8,
    length: usize,
    maximum: usize,
) -> *mut Outcome {
    let stream = unsafe { std::slice::from_raw_parts(pointer, length) };
    match inflated(stream, maximum) {
        Ok(bytes) => hand_over(WRITTEN, bytes),
        Err(status) => hand_over(status, Vec::new()),
    }
}

/// Frees an outcome and its payload.
///
/// # Safety
///
/// `outcome` is one `compress` or `decompress` call's answer, not yet
/// released.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn release(outcome: *mut Outcome) {
    let held = unsafe { Box::from_raw(outcome) };
    let payload = std::ptr::slice_from_raw_parts_mut(held.payload, held.length);
    drop(unsafe { Box::from_raw(payload) });
}

// The whole input goes to the encoder in one call that also finishes the
// stream. Fed in pieces, the encoder reserves its full input ring, twice the
// larger of the window and one block plus one block, on the second piece.
// Fed whole, an input under one block, which is every input up to 256 KiB,
// skips it.
fn compressed(input: &[u8]) -> Vec<u8> {
    let mut encoder = BrotliEncoderStateStruct::new(StandardAlloc::default());
    encoder.params = BrotliEncoderParams {
        quality: QUALITY,
        lgwin: window_bits(input.len()),
        ..BrotliEncoderParams::default()
    };
    let mut stream = Vec::new();
    let mut chunk = vec![0; CHUNK];
    let mut available_in = input.len();
    let mut input_offset = 0;
    while !encoder.is_finished() {
        let mut available_out = CHUNK;
        let mut output_offset = 0;
        let accepted = encoder.compress_stream(
            BrotliEncoderOperation::BROTLI_OPERATION_FINISH,
            &mut available_in,
            input,
            &mut input_offset,
            &mut available_out,
            &mut chunk,
            &mut output_offset,
            &mut None,
            &mut |_, _, _, _| (),
        );
        // The encoder refuses only parameters these constants are not, so a
        // refusal is a defect, and it aborts as an allocation the module
        // cannot make does.
        if !accepted {
            std::process::abort();
        }
        stream.extend_from_slice(&chunk[..output_offset]);
    }
    stream
}

// A window of `bits` reaches back 2^bits less 16 bytes.
fn window_bits(length: usize) -> i32 {
    let mut bits = FEWEST_WINDOW_BITS;
    while bits < MOST_WINDOW_BITS && (1_usize << bits) - WINDOW_GAP < length {
        bits += 1;
    }
    bits
}

fn inflated(stream: &[u8], maximum: usize) -> Result<Vec<u8>, u32> {
    // The strict state refuses the large-window extension, whose ring buffer
    // reaches 1 GiB, so a stream can claim no more than standard brotli's
    // 16 MiB window.
    let mut decoder = BrotliState::new_strict(
        StandardAlloc::default(),
        StandardAlloc::default(),
        StandardAlloc::default(),
    );
    let mut kept = Vec::new();
    let mut chunk = vec![0; CHUNK];
    let mut available_in = stream.len();
    let mut input_offset = 0;
    let mut total_out = 0;
    loop {
        // One byte more than may still be kept, so a stream that would pass
        // the maximum shows it here and is decoded no further.
        let room = (maximum - kept.len()).saturating_add(1).min(CHUNK);
        let mut available_out = room;
        let mut output_offset = 0;
        let result = BrotliDecompressStream(
            &mut available_in,
            &mut input_offset,
            stream,
            &mut available_out,
            &mut output_offset,
            &mut chunk[..room],
            &mut total_out,
            &mut decoder,
        );
        if output_offset > maximum - kept.len() {
            return Err(PAST_MAXIMUM);
        }
        keep(&mut kept, &chunk[..output_offset], maximum);
        match result {
            BrotliResult::NeedsMoreOutput => {}
            BrotliResult::ResultSuccess if available_in == 0 => return Ok(kept),
            _ => return Err(MALFORMED),
        }
    }
}

// Doubles the kept bytes' room as a vector would, from a seed the doubling
// lands on the maximum from. Clamped from any other start, the last step
// would reserve the maximum beside a block of nearly its size and the smaller
// blocks freed before it, about three times the maximum in all.
fn keep(kept: &mut Vec<u8>, written: &[u8], maximum: usize) {
    let needed = kept.len() + written.len();
    if needed > kept.capacity() {
        let mut room = match kept.capacity() {
            0 => seed(maximum),
            held => held,
        };
        while room < needed {
            room = room.saturating_mul(2);
        }
        kept.reserve_exact(room.min(maximum) - kept.len());
    }
    kept.extend_from_slice(written);
}

// The maximum halved, rounding up, until it fits one chunk.
fn seed(maximum: usize) -> usize {
    let mut room = maximum.max(1);
    while room > CHUNK {
        room = room.div_ceil(2);
    }
    room
}

fn hand_over(status: u32, bytes: Vec<u8>) -> *mut Outcome {
    let payload = bytes.into_boxed_slice();
    let length = payload.len();
    Box::into_raw(Box::new(Outcome {
        status,
        payload: Box::into_raw(payload).cast(),
        length,
    }))
}
