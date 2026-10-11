//! Resolves named breakpoint and container aliases in query keys.

use indexmap::IndexMap;
use rustc_hash::FxBuildHasher;

use crate::error::{Error, Result};
use crate::generated::literal::LENGTH_UNITS;
use crate::js;

/// Query thresholds declared by a theme.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Metadata {
    /// Media query thresholds by alias.
    pub breakpoint: IndexMap<String, String, FxBuildHasher>,
    /// Container query thresholds by alias.
    pub container: IndexMap<String, String, FxBuildHasher>,
    /// Declared container names.
    pub container_names: Vec<String>,
}

/// Whether a value is a positive-signed number followed by a length unit other than `%`.
pub fn threshold(value: &str) -> bool {
    let length = js::css_number_prefix(value, b"+");

    if length == 0 {
        return false;
    }

    let number = value.get(..length).unwrap_or_default();
    let unit = value.get(length..).unwrap_or_default();

    !unit.is_empty()
        && unit.bytes().all(|byte| byte.is_ascii_alphabetic())
        && js::to_number(number).is_finite()
        && LENGTH_UNITS
            .iter()
            .any(|candidate| candidate.eq_ignore_ascii_case(unit))
}

/// Expands `@media md`, `@media sm..lg`, `@media <md`, and `@container name md` aliases.
///
/// Keys with parenthesized conditions or media types return unchanged.
///
/// # Errors
///
/// Returns the TypeScript compiler's message for unknown names, malformed aliases, and ranges that
/// do not increase.
pub fn resolve(key: &str, metadata: &Metadata) -> Result<String> {
    let uncommented = strip_comments(key);
    let Some((kind, text)) = split(&uncommented) else {
        return Ok(key.to_owned());
    };
    let text = js::trim(text);

    if text.contains('(') || (kind == "media" && media_type(text)) {
        return Ok(key.to_owned());
    }

    let mut pieces: Vec<&str> = text.split(is_space).collect();
    let name = if kind == "container" && pieces.len() == 2 {
        Some(pieces.remove(0))
    } else {
        None
    };

    if let Some(name) = name
        && !metadata
            .container_names
            .iter()
            .any(|candidate| candidate == name)
    {
        return Err(Error::message("Unknown container name."));
    }

    let [alias] = pieces.as_slice() else {
        return Err(Error::message("Malformed query alias."));
    };
    let values = if kind == "media" {
        &metadata.breakpoint
    } else {
        &metadata.container
    };
    let read = |name: &str| {
        values
            .get(name)
            .ok_or_else(|| Error::message("Unknown query threshold."))
    };
    let condition = if alias.contains("..") {
        let range: Vec<&str> = alias.split("..").collect();
        let [lower, upper] = range.as_slice() else {
            return Err(Error::message("Malformed query range."));
        };
        let lower = read(lower)?;
        let upper = read(upper)?;
        let unit = |value: &str| {
            value
                .get(js::css_number_prefix(value, b"+")..)
                .unwrap_or_default()
                .to_lowercase()
        };

        if unit(lower) == unit(upper) && js::parse_float(lower) >= js::parse_float(upper) {
            return Err(Error::message("Query range must increase."));
        }

        format!("{lower} <= width < {upper}")
    } else if let Some(below) = alias.strip_prefix('<') {
        format!("width < {}", read(below)?)
    } else {
        format!(
            "width >= {}",
            read(alias.strip_prefix(">=").unwrap_or(alias))?
        )
    };

    Ok(match name {
        Some(name) => format!("@{kind} {name} ({condition})"),
        None => format!("@{kind} ({condition})"),
    })
}

const fn is_space(character: char) -> bool {
    matches!(character, ' ' | '\t' | '\n' | '\r' | '\u{c}')
}

/// Replaces each `/* ... */` comment, matched lazily, with one space.
fn strip_comments(key: &str) -> String {
    let mut output = String::with_capacity(key.len());
    let mut rest = key;

    while let Some(start) = rest.find("/*") {
        let Some(end) = rest.get(start + 2..).and_then(|after| after.find("*/")) else {
            break;
        };

        output.push_str(rest.get(..start).unwrap_or_default());
        output.push(' ');
        rest = rest.get(start + 2 + end + 2..).unwrap_or_default();
    }

    output.push_str(rest);
    output
}

/// Matches `^@(media|container)[ \t\n\r\f]+([\s\S]+)$`.
fn split(key: &str) -> Option<(&'static str, &str)> {
    let (kind, rest) = if let Some(rest) = key.strip_prefix("@media") {
        ("media", rest)
    } else {
        ("container", key.strip_prefix("@container")?)
    };
    let text = rest.trim_start_matches(is_space);

    // The regex requires at least one separator and a nonempty remainder; backtracking can return
    // trailing separators to the remainder, so an all-space remainder keeps its last character.
    if text.len() == rest.len() {
        return None;
    }

    if text.is_empty() {
        return rest
            .get(rest.len() - 1..)
            .filter(|_| rest.len() >= 2)
            .map(|last| (kind, last));
    }

    Some((kind, text))
}

/// Matches `^(?:(?:only|not)\s+)?(?:all|print|screen)(?:\s|,|$)` case-insensitively.
fn media_type(text: &str) -> bool {
    let lower = text.to_ascii_lowercase();
    let mut rest = lower.as_str();

    for prefix in ["only", "not"] {
        if let Some(after) = rest.strip_prefix(prefix) {
            let trimmed = after.trim_start_matches(js::is_whitespace);

            if trimmed.len() < after.len() {
                rest = trimmed;
                break;
            }
        }
    }

    ["all", "print", "screen"].iter().any(|kind| {
        rest.strip_prefix(kind).is_some_and(|after| {
            after.is_empty()
                || after.starts_with(',')
                || after.chars().next().is_some_and(js::is_whitespace)
        })
    }) || {
        // Without a prefix match the optional group is skipped.
        ["all", "print", "screen"].iter().any(|kind| {
            lower.strip_prefix(kind).is_some_and(|after| {
                after.is_empty()
                    || after.starts_with(',')
                    || after.chars().next().is_some_and(js::is_whitespace)
            })
        })
    }
}
