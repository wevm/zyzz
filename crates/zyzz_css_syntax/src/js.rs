//! JavaScript string and number semantics that css-tree's behavior depends on.

use std::borrow::Cow;

/// Lowercases like `String.prototype.toLowerCase`, borrowing when nothing changes.
///
/// ASCII input takes a byte fast path. Other input uses Unicode default case mapping, which,
/// like JavaScript, maps U+0130 to `i̇` and U+212A to `k`.
pub(crate) fn to_lower_case(value: &str) -> Cow<'_, str> {
    if value.is_ascii() {
        if value.bytes().any(|byte| byte.is_ascii_uppercase()) {
            return Cow::Owned(value.to_ascii_lowercase());
        }

        return Cow::Borrowed(value);
    }

    let lower = value.to_lowercase();

    if lower == value {
        Cow::Borrowed(value)
    } else {
        Cow::Owned(lower)
    }
}

/// Counts UTF-16 code units, the unit of JavaScript string lengths.
pub(crate) fn utf16_length(value: &str) -> usize {
    if value.is_ascii() {
        return value.len();
    }

    value.chars().map(char::len_utf16).sum()
}

/// Converts a numeric string like JavaScript `Number(value)` for the shapes css-tree passes:
/// optional sign, digits, fraction, and exponent. An empty string is zero and anything else
/// unparsable is `NaN`.
pub(crate) fn number(value: &str) -> f64 {
    let trimmed = value.trim_matches(|code: char| code.is_ascii_whitespace());

    if trimmed.is_empty() {
        return 0.0;
    }

    // Rust accepts `inf` and `nan` spellings that JavaScript rejects, and JavaScript accepts
    // `Infinity`, which a CSS number token never contains.
    if !trimmed
        .bytes()
        .all(|byte| byte.is_ascii_digit() || matches!(byte, b'+' | b'-' | b'.' | b'e' | b'E'))
    {
        return match trimmed {
            "Infinity" | "+Infinity" => f64::INFINITY,
            "-Infinity" => f64::NEG_INFINITY,
            _ => f64::NAN,
        };
    }

    trimmed.parse().unwrap_or(f64::NAN)
}

/// Formats an integral number like JavaScript string conversion. Definition syntax numbers are
/// digit strings, so other values only appear for absurd inputs and print through their integer
/// part.
pub(crate) fn integer_to_string(value: f64, output: &mut String) {
    use std::fmt::Write as _;

    if value == 0.0 {
        output.push('0');
        return;
    }

    if value.is_infinite() {
        output.push_str(if value > 0.0 { "Infinity" } else { "-Infinity" });
        return;
    }

    if value.is_nan() {
        output.push_str("NaN");
        return;
    }

    #[expect(
        clippy::cast_possible_truncation,
        reason = "Definition syntax numbers are small digit strings."
    )]
    let integer = value.trunc() as i128;
    let _ = write!(output, "{integer}");
}
