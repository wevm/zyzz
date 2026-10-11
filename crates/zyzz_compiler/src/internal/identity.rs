//! Derives deterministic names from source identities and style content.

use crate::error::{Error, Result};
use crate::js;

const ALPHABET: &[u8; 64] = b"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-";

/// Runs the paired FNV-1a and DJB2 hashes over UTF-16 code units.
fn pair(value: &str) -> (u32, u32) {
    let mut first: u32 = 2_166_136_261;
    let mut second: u32 = 5381;

    for code in js::code_units(value) {
        let code = u32::from(code);
        first = (first ^ code).wrapping_mul(16_777_619);
        second = second.wrapping_mul(33) ^ code;
    }

    (first, second)
}

/// Encodes a 64-bit hash of a string as 11 identifier-safe characters.
pub fn compact(value: &str) -> String {
    let (first, second) = pair(value);
    let mut bits = (u64::from(first) << 32) | u64::from(second);
    let mut output = [0_u8; 11];

    for slot in output.iter_mut().rev() {
        let index = usize::try_from(bits & 63).unwrap_or_default();
        *slot = ALPHABET.get(index).copied().unwrap_or(b'0');
        bits >>= 6;
    }

    String::from_utf8_lossy(&output).into_owned()
}

/// Converts arbitrary text into a readable class segment of at most 64 characters.
pub fn label(value: &str) -> String {
    let mut output = String::with_capacity(value.len());
    let mut separator = false;

    for character in value.chars() {
        if character.is_ascii_alphanumeric() || character == '-' {
            if separator {
                output.push('-');
                separator = false;
            }

            output.push(character);
        } else {
            separator = true;
        }
    }

    if separator {
        output.push('-');
    }

    let trimmed = output.trim_matches('-');
    let label = trimmed.get(..trimmed.len().min(64)).unwrap_or(trimmed);

    if label.is_empty() {
        "value".to_owned()
    } else {
        label.to_owned()
    }
}

/// Escapes every code point other than ASCII letters and digits as `_<hex>_`.
pub fn name(value: &str) -> String {
    let mut output = String::with_capacity(value.len());

    for character in value.chars() {
        if character.is_ascii_alphanumeric() {
            output.push(character);
        } else {
            output.push('_');
            output.push_str(&js::radix(u64::from(u32::from(character)), 16));
            output.push('_');
        }
    }

    output
}

/// Converts an explicit id into a contract identity.
///
/// # Errors
///
/// Returns the TypeScript message when the id is absent or empty.
pub fn require_id(id: Option<&str>, kind: &str) -> Result<String> {
    match id {
        Some(id) if !id.is_empty() => Ok(format!("id-{}", name(id))),
        _ => Err(Error::message(format!(
            "{kind} requires an explicit id without the compiler plugin."
        ))),
    }
}

/// Names the custom property that holds one field of an identity.
pub fn slot(id: &str, field: &str) -> String {
    format!(
        "--z-{}-{}",
        id.strip_prefix("id-").unwrap_or(id),
        name(field)
    )
}

/// A short hash of a string in base 36.
pub fn hash(value: &str) -> String {
    let (first, second) = pair(value);

    format!(
        "{}{}",
        js::radix(u64::from(first), 36),
        js::radix(u64::from(second), 36)
    )
}

/// Names a composition class from its ordered input names.
pub fn composition(names: &[&str]) -> String {
    let list = js::Value::Array(names.iter().map(|name| js::Value::from(*name)).collect());

    format!("z-compose-{}", name(&js::stringify(&list)))
}

/// Names a stylesheet contribution from its kind and explicit id.
///
/// # Errors
///
/// Returns the TypeScript message when the id is absent.
pub fn contribution(kind: &str, id: Option<&str>) -> Result<String> {
    let identity = require_id(id, kind)?;

    if kind == "keyframes" {
        return Ok(format!("z-k{identity}"));
    }

    Ok(format!(
        "{}z-{}{identity}",
        if kind == "counterStyle" { "" } else { "--" },
        kind.to_lowercase()
    ))
}
