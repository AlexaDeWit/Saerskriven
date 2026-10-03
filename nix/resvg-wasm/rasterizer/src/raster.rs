//! SVG to PNG over Rust's own slices, with the faces offered so far.

use std::cell::RefCell;
use std::sync::Arc;

use resvg::tiny_skia;
use resvg::usvg;

// Four bytes a pixel, so a 268 MB image. An allocation this module cannot
// satisfy aborts it rather than unwinding, and a pixel count fitting in a
// 32-bit usize reaches that band long before it overflows, so what is
// drawable is decided before the pixmap is asked for.
const MOST_PIXELS: u64 = 1 << 26;

thread_local! {
    static FONTS: RefCell<Arc<usvg::fontdb::Database>> =
        RefCell::new(Arc::new(usvg::fontdb::Database::new()));
}

pub(crate) struct Raster {
    pub(crate) width: u32,
    pub(crate) height: u32,
    pub(crate) png: Vec<u8>,
}

// Faces stack in call order, and the answer is the number of faces the
// database gained: 0 is a buffer holding no face this renderer reads, which
// would otherwise draw text in another caller's font or in none.
pub(crate) fn offered(face: Vec<u8>) -> usize {
    FONTS.with_borrow_mut(|held| {
        let known = held.len();
        let fonts = Arc::make_mut(held);
        fonts.load_font_data(face);
        fall_back_to_first(fonts);
        fonts.len() - known
    })
}

// usvg answers an unmatched family with its serif generic, which resolves
// through these names and defaults to faces no caller here loads. Left alone,
// a document asking for Helvetica draws no text at all.
fn fall_back_to_first(fonts: &mut usvg::fontdb::Database) {
    let Some((family, _)) = fonts
        .faces()
        .next()
        .and_then(|face| face.families.first())
        .cloned()
    else {
        return;
    };
    fonts.set_serif_family(family.clone());
    fonts.set_sans_serif_family(family.clone());
    fonts.set_cursive_family(family.clone());
    fonts.set_fantasy_family(family.clone());
    fonts.set_monospace_family(family);
}

pub(crate) fn rasterize(svg: &[u8], long_edge: u32) -> Result<Raster, String> {
    let tree = usvg::Tree::from_data(svg, &options()).map_err(|refusal| refusal.to_string())?;
    let scale = scale_of(tree.size(), long_edge);
    let width = pixels(tree.size().width() * scale);
    let height = pixels(tree.size().height() * scale);
    if u64::from(width) * u64::from(height) > MOST_PIXELS {
        return Err(format!(
            "a {width} by {height} pixel image is past the {MOST_PIXELS} pixels drawn at most"
        ));
    }
    let mut pixmap = tiny_skia::Pixmap::new(width, height)
        .ok_or_else(|| format!("a {width} by {height} pixel image is not one to draw"))?;
    resvg::render(
        &tree,
        tiny_skia::Transform::from_scale(scale, scale),
        &mut pixmap.as_mut(),
    );
    let png = pixmap
        .encode_png()
        .map_err(|refusal| format!("the image did not encode as a PNG: {refusal}"))?;
    Ok(Raster { width, height, png })
}

// This module resolves no image from any href. usvg's default resolve_data
// takes a data URL's bytes as an image, and parses them as a nested document
// where they are an SVG. Its default resolve_string treats any other href as a
// file path. Answering None from both leaves every image undrawn, and keeps
// this module off every path the host might hold, on top of a target that has
// no syscall to reach one with.
fn options<'a>() -> usvg::Options<'a> {
    let mut options = usvg::Options {
        fontdb: FONTS.with_borrow(Arc::clone),
        ..usvg::Options::default()
    };
    options.image_href_resolver.resolve_data = Box::new(|_mime, _data, _options| None);
    options.image_href_resolver.resolve_string = Box::new(|_href, _options| None);
    options
}

fn scale_of(size: usvg::Size, long_edge: u32) -> f32 {
    match long_edge {
        0 => 1.0,
        edge => edge as f32 / size.width().max(size.height()),
    }
}

fn pixels(edge: f32) -> u32 {
    edge.round().max(1.0) as u32
}
