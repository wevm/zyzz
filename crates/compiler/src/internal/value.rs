//! Parses the ` !important` and ` !custom` markers authored at the end of declaration values.

use std::sync::Arc;

use crate::data::Data;
use crate::generated::literal::Kind;
use crate::internal::token::{self, Expression, Part};
use crate::internal::{lexical, literal};
use crate::js;

/// The result of reading value markers.
#[derive(Clone, Debug)]
pub enum Parsed {
    /// Malformed markers.
    Invalid,
    /// A value with valid markers.
    Marked {
        /// Whether the value bypasses token resolution with ` !custom`.
        custom: bool,
        /// Whether the declaration is `!important`.
        important: bool,
        /// The value without markers.
        value: Data,
    },
}

/// Reads markers from a string or expression. Returns `None` when the value has no marker.
pub fn parse(input: &Data, property: &str) -> Option<Parsed> {
    match input {
        Data::Expression(expression) => parse_expression(expression, property),
        Data::String(text) => parse_text(text, property),
        _ => None,
    }
}

fn parse_expression(input: &Expression, property: &str) -> Option<Parsed> {
    let text: String = input
        .parts
        .iter()
        .map(|part| match part {
            Part::Text(text) => &**text,
            _ => "var(--z)",
        })
        .collect();
    let parsed = parse_text(&text, property)?;
    let Parsed::Marked {
        custom,
        important,
        value,
    } = parsed
    else {
        return Some(Parsed::Invalid);
    };
    let mut parts = input.parts.clone();
    let mut remaining = js::utf16_len(&text).saturating_sub(js::utf16_len(&value.to_js_string()));

    for part in parts.iter_mut().rev() {
        if remaining == 0 {
            break;
        }

        let Part::Text(text) = part else {
            return None;
        };
        let length = js::utf16_len(text);
        let count = remaining.min(length);

        *part = Part::Text(js::slice(text, 0, length - count).into());
        remaining -= count;
    }

    parts.retain(|part| !matches!(part, Part::Text(text) if text.is_empty()));

    Some(Parsed::Marked {
        custom,
        important,
        value: Data::Expression(token::compose(parts)),
    })
}

fn parse_text(input: &str, property: &str) -> Option<Parsed> {
    let bytes = input.as_bytes();
    let escaped = |index: usize| {
        bytes
            .get(..index)
            .unwrap_or_default()
            .iter()
            .rev()
            .take_while(|byte| **byte == b'\\')
            .count()
            % 2
            == 1
    };
    // Values are short, so a byte scan beats `memrchr`'s setup.
    let mut marker = bytes.iter().rposition(|byte| *byte == b'!');

    while let Some(index) = marker {
        let suffix = lexical::normalize(input.get(index + 1..).unwrap_or_default());
        let suffix = suffix.trim_matches(literal::is_css_whitespace);

        if !escaped(index) && matches!(suffix, "" | "important" | "custom") {
            break;
        }

        marker = if index == 0 {
            None
        } else {
            bytes
                .get(..index)
                .and_then(|before| before.iter().rposition(|byte| *byte == b'!'))
        };
    }

    let marker = marker?;

    // `input.slice(-1)` for a leading marker never equals a valid suffix.
    let suffix = if marker == 0 {
        ""
    } else {
        input.get(marker - 1..).unwrap_or_default()
    };

    if (suffix != " !important" && suffix != " !custom") || escaped(marker - 1) {
        return Some(Parsed::Invalid);
    }

    let mut end = marker;

    while end > 0
        && bytes
            .get(end - 1)
            .is_some_and(|byte| matches!(byte, b' ' | b'\t' | b'\n' | b'\r' | 0x0c))
        && !escaped(end - 1)
    {
        end -= 1;
    }

    let body = input.get(..end).unwrap_or_default();

    if body.is_empty() {
        return Some(Parsed::Invalid);
    }

    let nested = parse_text(body, property);
    let custom = suffix == " !custom";

    match nested {
        Some(Parsed::Invalid) => Some(Parsed::Invalid),
        Some(Parsed::Marked { important, .. }) if custom || important => Some(Parsed::Invalid),
        Some(Parsed::Marked {
            custom: nested_custom,
            value,
            ..
        }) => Some(Parsed::Marked {
            custom: custom || nested_custom,
            important: !custom,
            value,
        }),
        None => Some(Parsed::Marked {
            custom,
            important: !custom,
            value: scalar(body, property),
        }),
    }
}

/// Converts numeric text to a number for numeric properties.
fn scalar(text: &str, property: &str) -> Data {
    let numeric = literal::rule(property)
        .is_some_and(|rule| matches!(rule.kind, Kind::Number | Kind::GridLine));

    if numeric && !text.is_empty() && js::css_number_prefix(text, b"+-") == text.len() {
        return Data::Number(js::to_number(text));
    }

    Data::String(Arc::from(text))
}
