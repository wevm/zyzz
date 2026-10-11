//! `url()` escaping, following css-tree's `url` utilities.

use crate::ident::decode_range;
use crate::tokenizer::{byte_at, is_hex_digit, is_white_space};

/// Decodes an unquoted `url(...)` token like css-tree's `url.decode`.
///
/// The `url(` prefix, closing parenthesis, and surrounding whitespace are removed before
/// escapes are decoded.
pub fn decode(value: &str) -> String {
    let bytes = value.as_bytes();
    let length = bytes.len();
    let mut start = 4;
    // css-tree's inclusive end, exclusive here: before a closing parenthesis.
    let mut end = if byte_at(bytes, length.saturating_sub(1)) == b')' {
        length.saturating_sub(1)
    } else {
        length
    };

    while start + 1 < end && is_white_space(byte_at(bytes, start)) {
        start += 1;
    }

    while start + 1 < end && is_white_space(byte_at(bytes, end - 1)) {
        end -= 1;
    }

    let mut decoded = String::with_capacity(length);
    let exclusive = end.max(start);

    if let Some(index) = decode_range(value, start, exclusive, &mut decoded)
        && index + 1 != length
    {
        return value.get(index + 1..).unwrap_or_default().to_owned();
    }

    decoded
}

/// Serializes a url like css-tree's `url.encode`, always without quotes.
pub fn encode(value: &str) -> String {
    let mut encoded = String::with_capacity(value.len() + 5);
    let mut space_before_hex = false;

    encoded.push_str("url(");

    for code in value.chars() {
        let point = code as u32;

        if point == 0 {
            encoded.push('\u{FFFD}');
            continue;
        }

        if point <= 0x1F || point == 0x7F {
            use std::fmt::Write as _;

            let _ = write!(encoded, "\\{point:x}");
            space_before_hex = true;
            continue;
        }

        if matches!(code, ' ' | '\\' | '"' | '\'' | '(' | ')') {
            encoded.push('\\');
            encoded.push(code);
            space_before_hex = false;
        } else {
            if space_before_hex && u8::try_from(point).is_ok_and(is_hex_digit) {
                encoded.push(' ');
            }

            encoded.push(code);
            space_before_hex = false;
        }
    }

    encoded.push(')');
    encoded
}
