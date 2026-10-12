//! Identifier escaping, following css-tree's `ident` utilities.

use std::borrow::Cow;

use crate::tokenizer::{byte_at, consume_escaped, is_hex_digit, is_name, is_valid_escape};

/// Decodes CSS escapes in an identifier like css-tree's `ident.decode`.
///
/// A trailing reverse solidus is dropped, an escaped newline disappears, and escapes of zero,
/// surrogates, or code points past U+10FFFF decode to U+FFFD. Input without escapes is borrowed.
pub fn decode(value: &str) -> Cow<'_, str> {
    if !value.as_bytes().contains(&b'\\') {
        return Cow::Borrowed(value);
    }

    let mut decoded = String::with_capacity(value.len());

    decode_range(value, 0, value.len(), &mut decoded);
    Cow::Owned(decoded)
}

/// Decodes the escapes in `value[start..end]`, appending to `output`. Shared by the string and
/// url decoders, which differ only in how they choose the range and treat a final escape.
pub(crate) fn decode_range(
    value: &str,
    start: usize,
    end: usize,
    output: &mut String,
) -> Option<usize> {
    let bytes = value.as_bytes();
    let mut index = start;
    let mut copied = start;

    while index < end {
        if byte_at(bytes, index) != b'\\' {
            index += 1;
            continue;
        }

        output.push_str(value.get(copied..index).unwrap_or_default());

        if index + 1 == end {
            // A reverse solidus at the end of the range. Callers decide what follows it.
            return Some(index);
        }

        let code = byte_at(bytes, index + 1);

        if is_valid_escape(b'\\', code) {
            let escape_end = escape_end(value, index);

            push_escaped(value.get(index + 1..escape_end).unwrap_or_default(), output);
            index = escape_end;
        } else {
            // An escaped newline is removed, consuming `\r\n` as one newline.
            index += 2;

            if code == b'\r' && byte_at(bytes, index) == b'\n' {
                index += 1;
            }
        }

        copied = index;
    }

    output.push_str(value.get(copied..end.min(value.len())).unwrap_or_default());
    None
}

/// Returns the end of the escape whose reverse solidus is at `offset`, covering a whole
/// character when the escaped code point is not a hex digit.
fn escape_end(value: &str, offset: usize) -> usize {
    let bytes = value.as_bytes();

    if is_hex_digit(byte_at(bytes, offset + 1)) {
        return consume_escaped(bytes, offset);
    }

    value
        .get(offset + 1..)
        .and_then(|rest| rest.chars().next())
        .map_or(offset + 2, |code| offset + 1 + code.len_utf8())
}

/// Appends the code point an escape body denotes, like css-tree's `decodeEscaped`.
fn push_escaped(escaped: &str, output: &mut String) {
    let digits = escaped.trim_end_matches(|code: char| code.is_ascii_whitespace());

    if !escaped.bytes().next().is_some_and(is_hex_digit) {
        output.push_str(escaped);
        return;
    }

    let code = u32::from_str_radix(digits, 16).unwrap_or(0);
    let code = if code == 0 || (0xD800..=0xDFFF).contains(&code) || code > 0x10_FFFF {
        0xFFFD
    } else {
        code
    };

    output.push(char::from_u32(code).unwrap_or('\u{FFFD}'));
}

/// Serializes an identifier like css-tree's `ident.encode`.
pub fn encode(value: &str) -> String {
    if value == "-" {
        return "\\-".to_owned();
    }

    let bytes = value.as_bytes();
    let mut encoded = String::with_capacity(value.len());

    for (index, code) in value.char_indices() {
        let first = code as u32;

        if first == 0 {
            encoded.push('\u{FFFD}');
            continue;
        }

        let digit_needs_escape =
            code.is_ascii_digit() && (index == 0 || (index == 1 && byte_at(bytes, 0) == b'-'));

        if first <= 0x1F || first == 0x7F || digit_needs_escape {
            use std::fmt::Write as _;

            let _ = write!(encoded, "\\{first:x} ");
            continue;
        }

        if u8::try_from(first).map_or(true, is_name) {
            encoded.push(code);
        } else {
            encoded.push('\\');
            encoded.push(code);
        }
    }

    encoded
}
