use std::io::{Read, Write};

use ppmd_rust::{Ppmd7Decoder, Ppmd7Encoder};

use crate::codec::{MALFORMED, PAST_MAXIMUM};

const ORDER: u32 = 8;
const MEMORY: u32 = 4 * 1024 * 1024;
const HEADER: usize = 8;
const MAXIMUM: usize = 8 * 1024 * 1024;

pub(crate) fn compressed(input: &[u8]) -> Result<Vec<u8>, u32> {
    if input.len() > MAXIMUM {
        return Err(PAST_MAXIMUM);
    }
    let mut output = Vec::new();
    output.extend_from_slice(&(input.len() as u32).to_le_bytes());
    output.extend_from_slice(&crc32fast::hash(input).to_le_bytes());
    let mut encoder = Ppmd7Encoder::new(output, ORDER, MEMORY).map_err(|_| MALFORMED)?;
    encoder.write_all(input).map_err(|_| MALFORMED)?;
    encoder.finish(true).map_err(|_| MALFORMED)
}

pub(crate) fn inflated(input: &[u8], maximum: usize) -> Result<Vec<u8>, u32> {
    let header = input.get(..HEADER).ok_or(MALFORMED)?;
    let length = u32::from_le_bytes(header[..4].try_into().map_err(|_| MALFORMED)?) as usize;
    let checksum = u32::from_le_bytes(header[4..].try_into().map_err(|_| MALFORMED)?);
    if length > maximum.min(MAXIMUM) {
        return Err(PAST_MAXIMUM);
    }
    let reader = Input { remaining: &input[HEADER..], truncated: false };
    let mut decoder = Ppmd7Decoder::new(reader, ORDER, MEMORY).map_err(|_| MALFORMED)?;
    let mut output = vec![0; length];
    decoder.read_exact(&mut output).map_err(|_| MALFORMED)?;
    let mut tail = [0];
    if decoder.read(&mut tail).map_err(|_| MALFORMED)? != 0 {
        return Err(MALFORMED);
    }
    let reader = decoder.into_inner();
    if reader.truncated || !reader.remaining.is_empty() || crc32fast::hash(&output) != checksum {
        return Err(MALFORMED);
    }
    Ok(output)
}

struct Input<'a> {
    remaining: &'a [u8],
    truncated: bool,
}

impl Read for Input<'_> {
    fn read(&mut self, buffer: &mut [u8]) -> std::io::Result<usize> {
        let count = self.remaining.read(buffer)?;
        self.truncated |= count == 0 && !buffer.is_empty();
        Ok(count)
    }
}
