//! Classifies literal declaration values against the generated property rule table.

use crate::generated::literal::{
    self, GLOBALS, Kind, LENGTH_UNITS, NAMED_COLORS, Rule, SYSTEM_COLORS,
};
use crate::internal::lexical;
use crate::js;

pub use crate::generated::literal::{alias, rule};

/// Units a CSS dimension literal may carry, beyond lengths.
const DIMENSION_UNITS: [&str; 12] = [
    "deg", "grad", "rad", "turn", "s", "ms", "fr", "dpi", "dpcm", "dppx", "Hz", "kHz",
];

/// A literal declaration value as authored.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Scalar<'a> {
    /// A number.
    Number(f64),
    /// A string.
    String(&'a str),
}

/// Converts a camelCase property name into its CSS spelling.
pub fn name(property: &str) -> String {
    if property.starts_with("--") {
        return property.to_owned();
    }

    if property == "MsScrollbar3dlightColor" {
        return "-ms-scrollbar-3dlight-color".to_owned();
    }

    let mut output = String::with_capacity(property.len() + 4);

    for character in property.chars() {
        if character.is_ascii_uppercase() {
            output.push('-');
            output.push(character.to_ascii_lowercase());
        } else {
            output.push(character);
        }
    }

    output
}

/// Whether a value is a literal spelling that must not resolve as a token name.
pub fn is_literal(property: &str, value: Scalar<'_>) -> bool {
    let text = match value {
        Scalar::Number(number) => {
            if number == 0.0 {
                return true;
            }

            js::number(number)
        }
        Scalar::String(text) => text.to_owned(),
    };

    if GLOBALS.contains(&text.to_ascii_lowercase().as_str()) {
        return true;
    }

    let Some(rule) = literal::rule(property) else {
        return false;
    };

    match value {
        Scalar::String(text) => string_literal(rule, text),
        Scalar::Number(_) => rule.kind == Kind::Number,
    }
}

fn string_literal(rule: &Rule, value: &str) -> bool {
    let normalized = lexical::normalize(value);
    let folded = fold(&normalized);

    if GLOBALS.contains(&folded.as_str()) {
        return true;
    }

    if rule.kind == Kind::Color
        && (is_color_keyword(&folded) || folded == "transparent" || folded == "currentcolor")
    {
        return true;
    }

    if rule.keywords.is_some_and(|keywords| {
        keywords
            .iter()
            .any(|keyword| keyword.to_ascii_lowercase() == folded)
    }) {
        return true;
    }

    if rule.kind == Kind::Enum
        && rule.values.is_some_and(|values| {
            values
                .iter()
                .any(|keyword| keyword.to_ascii_lowercase() == folded)
        })
    {
        return true;
    }

    if rule.auto == Some(true) && folded == "auto" {
        return true;
    }

    // Dimension and expression spellings always retain literal precedence.
    is_dimension(value) || value.contains(['#', '(', ')'])
}

/// Trims CSS whitespace and collapses internal runs to one space.
fn fold(value: &str) -> String {
    let mut output = String::with_capacity(value.len());

    for (index, part) in value
        .split(is_css_whitespace)
        .filter(|part| !part.is_empty())
        .enumerate()
    {
        if index > 0 {
            output.push(' ');
        }

        output.push_str(part);
    }

    output
}

/// Whether a character is CSS whitespace: space, tab, line feed, carriage return, or form feed.
pub const fn is_css_whitespace(character: char) -> bool {
    matches!(character, ' ' | '\t' | '\n' | '\r' | '\u{c}')
}

/// Whether a lowercase keyword names a CSS named or system color.
pub fn is_color_keyword(folded: &str) -> bool {
    NAMED_COLORS
        .iter()
        .chain(SYSTEM_COLORS)
        .any(|color| color.eq_ignore_ascii_case(folded))
}

/// Whether a value is a number with a CSS length, angle, time, flex, or resolution unit.
pub fn is_dimension(value: &str) -> bool {
    let length = js::css_number_prefix(value, b"+-");

    if length == 0 {
        return false;
    }

    let unit = value.get(length..).unwrap_or_default();

    LENGTH_UNITS
        .iter()
        .chain(&DIMENSION_UNITS)
        .any(|candidate| candidate.eq_ignore_ascii_case(unit))
}
