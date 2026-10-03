//! Brotli encoding and bounded decoding over Rust's own slices, at the
//! parameters share links use.

#![forbid(unsafe_code)]

use brotli::enc::encode::{BrotliEncoderOperation, BrotliEncoderStateStruct};
use brotli::enc::{BrotliEncoderParams, StandardAlloc};
use brotli::{BrotliDecompressStream, BrotliResult, BrotliState};

pub(crate) const WRITTEN: u32 = 0;
pub(crate) const PAST_MAXIMUM: u32 = 1;
pub(crate) const MALFORMED: u32 = 2;

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

// The whole input goes to the encoder in one call that also finishes the
// stream. Fed in pieces, the encoder reserves its full input ring, twice the
// larger of the window and one block plus one block, on the second piece.
// Fed whole, an input under one block, which is every input up to 256 KiB,
// skips it.
pub(crate) fn compressed(input: &[u8]) -> Vec<u8> {
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

pub(crate) fn inflated(stream: &[u8], maximum: usize) -> Result<Vec<u8>, u32> {
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
