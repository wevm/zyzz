//! Quoted string escaping, following css-tree's `string` utilities.

use crate::ident::decode_range;
use crate::tokenizer::{byte_at, is_hex_digit, is_white_space};

/// Decodes a quoted or unquoted string token like css-tree's `string.decode`.
///
/// Matching outer quotes are removed and escapes decoded. css-tree replaces the whole result
/// with the remaining text when a reverse solidus precedes the final quote, and this decoder
/// reproduces that.
pub fn decode(value: &str) -> String {
    let bytes = value.as_bytes();
    let length = bytes.len();
    let first = byte_at(bytes, 0);
    let start = usize::from(first == b'"' || first == b'\'');
    let end = if start == 1 && length > 1 && byte_at(bytes, length - 1) == first {
        length - 1
    } else {
        length
    };
    let mut decoded = String::with_capacity(length);

    if let Some(index) = decode_range(value, start, end.max(start), &mut decoded)
        && index + 1 != length
    {
        return value.get(index + 1..).unwrap_or_default().to_owned();
    }

    decoded
}

/// Serializes a string like css-tree's `string.encode`, quoting with `"` or, when `apostrophe`
/// is set, with `'`.
pub fn encode(value: &str, apostrophe: bool) -> String {
    let quote = if apostrophe { '\'' } else { '"' };
    let mut encoded = String::with_capacity(value.len() + 2);
    let mut space_before_hex = false;

    encoded.push(quote);

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

        if code == quote || code == '\\' {
            encoded.push('\\');
            encoded.push(code);
            space_before_hex = false;
        } else {
            if space_before_hex
                && let Ok(byte) = u8::try_from(point)
                && (is_hex_digit(byte) || is_white_space(byte))
            {
                encoded.push(' ');
            }

            encoded.push(code);
            space_before_hex = false;
        }
    }

    encoded.push(quote);
    encoded
}
