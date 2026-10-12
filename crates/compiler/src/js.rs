//! Reproduces the JavaScript string, number, and JSON semantics that reach compiler output.
//!
//! The TypeScript compiler formats numbers with `Number.prototype.toString`, serializes data with
//! `JSON.stringify`, and measures strings in UTF-16 code units. Output identity depends on every one
//! of these behaviors, so all Rust code formats through this module.

use std::fmt::Write as _;

use indexmap::IndexMap;
use oxc_syntax::number::ToJsString;
use rustc_hash::FxBuildHasher;

mod json;
mod math;

pub use json::json_error;
pub use math::{cos, sin, tan};

/// Formats a number like ECMAScript `Number.prototype.toString()`.
pub fn number(value: f64) -> String {
    if value == 0.0 {
        // `-0` prints as `0`.
        return "0".to_owned();
    }

    value.to_js_string()
}

/// Appends a number formatted like ECMAScript `Number.prototype.toString()`.
pub fn write_number(output: &mut String, value: f64) {
    if value == 0.0 {
        output.push('0');
        return;
    }

    output.push_str(&value.to_js_string());
}

/// Formats a non-negative integer like `Number.prototype.toString(radix)`.
pub fn radix(mut value: u64, radix: u32) -> String {
    const DIGITS: &[u8; 36] = b"0123456789abcdefghijklmnopqrstuvwxyz";

    debug_assert!((2..=36).contains(&radix), "radix must be within 2..=36");

    if value == 0 {
        return "0".to_owned();
    }

    let mut digits = Vec::with_capacity(16);
    let base = u64::from(radix);

    while value > 0 {
        let digit = usize::try_from(value % base).unwrap_or_default();
        digits.push(DIGITS.get(digit).copied().unwrap_or(b'0'));
        value /= base;
    }

    digits.reverse();

    String::from_utf8(digits).unwrap_or_default()
}

/// Counts UTF-16 code units, the length JavaScript reports for a string.
pub fn utf16_len(value: &str) -> usize {
    if value.is_ascii() {
        return value.len();
    }

    value.encode_utf16().count()
}

/// Converts a UTF-16 code-unit index into a byte index, clamping to the string length.
///
/// An index inside a surrogate pair rounds up to the end of that character, since Rust strings
/// cannot hold the lone surrogate JavaScript would produce.
pub fn utf16_to_byte(value: &str, index: usize) -> usize {
    if value.is_ascii() {
        return index.min(value.len());
    }

    let mut units = 0;

    for (offset, character) in value.char_indices() {
        if units >= index {
            return offset;
        }

        units += character.len_utf16();
    }

    value.len()
}

/// Slices by UTF-16 code units like `String.prototype.slice(start, end)` with non-negative bounds.
pub fn slice(value: &str, start: usize, end: usize) -> &str {
    let start = utf16_to_byte(value, start);
    let end = utf16_to_byte(value, end).max(start);

    value.get(start..end).unwrap_or_default()
}

/// Iterates UTF-16 code units, the values `String.prototype.charCodeAt` returns.
pub fn code_units(value: &str) -> impl Iterator<Item = u16> + '_ {
    value.encode_utf16()
}

/// A JSON-compatible value whose objects follow JavaScript own-property order.
#[derive(Clone, Debug, PartialEq)]
pub enum Value {
    /// An array in element order.
    Array(Vec<Value>),
    /// A boolean.
    Bool(bool),
    /// `null`.
    Null,
    /// A number, printed with JavaScript formatting.
    Number(f64),
    /// An object, printed in JavaScript own-property order.
    Object(Object),
    /// A string.
    String(String),
}

impl From<&str> for Value {
    fn from(value: &str) -> Self {
        Self::String(value.to_owned())
    }
}

impl From<String> for Value {
    fn from(value: String) -> Self {
        Self::String(value)
    }
}

impl From<f64> for Value {
    fn from(value: f64) -> Self {
        Self::Number(value)
    }
}

impl From<bool> for Value {
    fn from(value: bool) -> Self {
        Self::Bool(value)
    }
}

impl From<Object> for Value {
    fn from(value: Object) -> Self {
        Self::Object(value)
    }
}

impl From<Vec<Value>> for Value {
    fn from(value: Vec<Value>) -> Self {
        Self::Array(value)
    }
}

/// Object entries in insertion order. Serialization lists array-index keys first, ascending, as
/// JavaScript enumerates own properties.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Object {
    entries: IndexMap<String, Value, FxBuildHasher>,
}

impl Object {
    /// Creates an empty object.
    pub fn new() -> Self {
        Self::default()
    }

    /// Sets a property. An existing key keeps its position, as assignment does in JavaScript.
    pub fn insert(&mut self, key: impl Into<String>, value: impl Into<Value>) {
        self.entries.insert(key.into(), value.into());
    }

    /// Reads a property.
    pub fn get(&self, key: &str) -> Option<&Value> {
        self.entries.get(key)
    }

    /// Whether the object has no properties.
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    /// Lists entries in JavaScript own-property order.
    pub fn entries(&self) -> Vec<(&str, &Value)> {
        let mut indexes: Vec<(u32, &str, &Value)> = Vec::new();
        let mut names: Vec<(&str, &Value)> = Vec::with_capacity(self.entries.len());

        for (key, value) in &self.entries {
            match array_index(key) {
                Some(index) => indexes.push((index, key, value)),
                None => names.push((key, value)),
            }
        }

        if indexes.is_empty() {
            return names;
        }

        indexes.sort_unstable_by_key(|entry| entry.0);

        indexes
            .into_iter()
            .map(|(_, key, value)| (key, value))
            .chain(names)
            .collect()
    }
}

/// Parses a canonical array index, the keys JavaScript enumerates before other strings.
pub fn array_index(key: &str) -> Option<u32> {
    let bytes = key.as_bytes();

    if bytes.is_empty() || bytes.len() > 10 || (bytes.len() > 1 && bytes.first() == Some(&b'0')) {
        return None;
    }

    if !bytes.iter().all(u8::is_ascii_digit) {
        return None;
    }

    let index: u64 = key.parse().ok()?;

    // 2^32 - 1 is not an array index.
    u32::try_from(index).ok().filter(|index| *index != u32::MAX)
}

/// Serializes like `JSON.stringify(value)` without indentation.
pub fn stringify(value: &Value) -> String {
    let mut output = String::new();

    write_value(&mut output, value);

    output
}

/// Appends a value serialized like `JSON.stringify(value)`.
pub fn write_value(output: &mut String, value: &Value) {
    match value {
        Value::Array(items) => {
            output.push('[');

            for (index, item) in items.iter().enumerate() {
                if index > 0 {
                    output.push(',');
                }

                write_value(output, item);
            }

            output.push(']');
        }
        Value::Bool(value) => output.push_str(if *value { "true" } else { "false" }),
        Value::Null => output.push_str("null"),
        Value::Number(value) => {
            if value.is_finite() {
                write_number(output, *value);
            } else {
                output.push_str("null");
            }
        }
        Value::Object(object) => {
            output.push('{');

            for (index, (key, value)) in object.entries().into_iter().enumerate() {
                if index > 0 {
                    output.push(',');
                }

                write_string(output, key);
                output.push(':');
                write_value(output, value);
            }

            output.push('}');
        }
        Value::String(value) => write_string(output, value),
    }
}

/// Quotes a string like `JSON.stringify(value)`.
pub fn quote(value: &str) -> String {
    let mut output = String::with_capacity(value.len() + 2);

    write_string(&mut output, value);

    output
}

/// The escape letter `JSON.stringify` writes after a backslash for each byte, `u` for a
/// hexadecimal escape, or zero for a byte it copies.
const ESCAPES: [u8; 256] = {
    let mut table = [0; 256];
    let mut byte = 0;

    while byte < 0x20 {
        table[byte] = b'u';
        byte += 1;
    }

    table[0x08] = b'b';
    table[0x09] = b't';
    table[0x0a] = b'n';
    table[0x0c] = b'f';
    table[0x0d] = b'r';
    table[b'"' as usize] = b'"';
    table[b'\\' as usize] = b'\\';
    table
};

/// Flags the high bit of each of eight bytes that may need an escape: a control character, a
/// quote, or a backslash. The lowest flagged byte always needs one; higher flags can be false
/// positives from borrows.
const fn escapes(word: u64) -> u64 {
    const ONES: u64 = 0x0101_0101_0101_0101;
    const HIGH: u64 = 0x8080_8080_8080_8080;

    let quote = word ^ (ONES * b'"' as u64);
    let backslash = word ^ (ONES * b'\\' as u64);
    let found = (word.wrapping_sub(ONES * 0x20) & !word)
        | (quote.wrapping_sub(ONES) & !quote)
        | (backslash.wrapping_sub(ONES) & !backslash);

    found & HIGH
}

/// Appends an integer in decimal, as `String(value)` spells it.
pub fn write_index(output: &mut String, value: u32) {
    let mut digits = [0_u8; 10];
    let mut start = digits.len();
    let mut rest = value;

    loop {
        start -= 1;

        if let Some(digit) = digits.get_mut(start) {
            // A remainder of ten is one decimal digit.
            *digit = b'0' + u8::try_from(rest % 10).unwrap_or_default();
        }

        rest /= 10;

        if rest == 0 {
            break;
        }
    }

    for digit in digits.get(start..).unwrap_or_default() {
        output.push(char::from(*digit));
    }
}

/// Appends encoded source map mappings quoted like `JSON.stringify(value)`. Base64 digits and the
/// `,` and `;` separators never need escapes.
pub fn write_mappings(output: &mut String, mappings: &str) {
    debug_assert!(
        mappings
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'+' | b'/' | b',' | b';')),
        "mappings hold only base64 digits and separators"
    );

    output.reserve(mappings.len() + 2);
    output.push('"');
    output.push_str(mappings);
    output.push('"');
}

/// Appends a string quoted like `JSON.stringify(value)`.
pub fn write_string(output: &mut String, value: &str) {
    output.reserve(value.len() + 2);
    output.push('"');

    let bytes = value.as_bytes();
    let mut start = 0;
    let mut index = 0;

    loop {
        // Runs without escapes, such as embedded sources, advance a word at a time, and a word
        // with an escape jumps straight to its first one.
        while let Some(word) = bytes.get(index..).and_then(<[u8]>::first_chunk::<8>) {
            let found = escapes(u64::from_le_bytes(*word));

            if found != 0 {
                index += (found.trailing_zeros() / 8) as usize;
                break;
            }

            index += 8;
        }

        let Some(&byte) = bytes.get(index) else {
            break;
        };
        let escape = ESCAPES[usize::from(byte)];

        index += 1;

        if escape == 0 {
            continue;
        }

        output.push_str(value.get(start..index - 1).unwrap_or_default());
        output.push('\\');

        if escape == b'u' {
            let _ = write!(output, "u{byte:04x}");
        } else {
            output.push(char::from(escape));
        }

        start = index;
    }

    output.push_str(value.get(start..).unwrap_or_default());
    output.push('"');
}

/// Appends statically evaluated data serialized like `JSON.stringify(value)`.
///
/// Object properties holding `undefined` are omitted, and array entries holding `undefined` print
/// as `null`, as does a non-finite number. Compiler-owned references never reach static data, so
/// they print as `null`.
pub fn write_data(output: &mut String, value: &crate::data::Data) {
    use crate::data::Data;

    match value {
        Data::Array(items) => {
            output.push('[');

            for (index, item) in items.iter().enumerate() {
                if index > 0 {
                    output.push(',');
                }

                if item.is_undefined() {
                    output.push_str("null");
                } else {
                    write_data(output, item);
                }
            }

            output.push(']');
        }
        Data::Bool(value) => output.push_str(if *value { "true" } else { "false" }),
        Data::Number(value) if value.is_finite() => write_number(output, *value),
        Data::Object(object) => write_object(
            output,
            object.iter().filter(|(_, value)| !value.is_undefined()),
            write_data,
        ),
        Data::String(value) => write_string(output, value),
        Data::Binding(_)
        | Data::Expression(_)
        | Data::Null
        | Data::Number(_)
        | Data::Theme(_)
        | Data::Token(_)
        | Data::Undefined => output.push_str("null"),
    }
}

/// Appends an object serialized like `JSON.stringify`, listing array-index keys first in ascending
/// order and other keys in the given order, as JavaScript enumerates own properties.
pub fn write_object<K: AsRef<str>, V>(
    output: &mut String,
    entries: impl IntoIterator<Item = (K, V)>,
    mut write: impl FnMut(&mut String, V),
) {
    let mut indexes: Vec<(u32, K, V)> = Vec::new();
    let mut names: Vec<(K, V)> = Vec::new();

    for (key, value) in entries {
        match array_index(key.as_ref()) {
            Some(index) => indexes.push((index, key, value)),
            None => names.push((key, value)),
        }
    }

    indexes.sort_by_key(|entry| entry.0);
    output.push('{');

    let entries = indexes
        .into_iter()
        .map(|(_, key, value)| (key, value))
        .chain(names);

    for (index, (key, value)) in entries.enumerate() {
        if index > 0 {
            output.push(',');
        }

        write_string(output, key.as_ref());
        output.push(':');
        write(output, value);
    }

    output.push('}');
}

/// Whether a character matches the JavaScript regular expression class `\s`.
pub fn is_whitespace(character: char) -> bool {
    matches!(
        character,
        '\t' | '\n' | '\u{b}' | '\u{c}' | '\r' | ' ' | '\u{a0}' | '\u{1680}' | '\u{2000}'
            ..='\u{200a}'
                | '\u{2028}'
                | '\u{2029}'
                | '\u{202f}'
                | '\u{205f}'
                | '\u{3000}'
                | '\u{feff}'
    )
}

/// Trims like `String.prototype.trim`.
pub fn trim(value: &str) -> &str {
    value.trim_matches(is_whitespace)
}

/// Whether a character matches the JavaScript regular expression class `\w`.
pub fn is_word(character: char) -> bool {
    character.is_ascii_alphanumeric() || character == '_'
}

/// Parses a leading decimal number like `Number.parseFloat`, returning `NaN` when none exists.
pub fn parse_float(value: &str) -> f64 {
    let text = value.trim_start_matches(is_whitespace);

    for infinity in ["Infinity", "+Infinity", "-Infinity"] {
        if text.starts_with(infinity) {
            return if infinity.starts_with('-') {
                f64::NEG_INFINITY
            } else {
                f64::INFINITY
            };
        }
    }

    let length = decimal_prefix(text);

    text.get(..length)
        .and_then(|number| number.parse().ok())
        .unwrap_or(f64::NAN)
}

/// Measures the longest decimal literal prefix: sign, digits, fraction, and exponent.
pub fn decimal_prefix(text: &str) -> usize {
    let bytes = text.as_bytes();
    let mut index = 0;

    if matches!(bytes.first(), Some(b'+' | b'-')) {
        index += 1;
    }

    let integer = bytes
        .get(index..)
        .unwrap_or_default()
        .iter()
        .take_while(|byte| byte.is_ascii_digit())
        .count();
    index += integer;

    let mut fraction = 0;

    if bytes.get(index) == Some(&b'.') {
        fraction = bytes
            .get(index + 1..)
            .unwrap_or_default()
            .iter()
            .take_while(|byte| byte.is_ascii_digit())
            .count();

        if fraction > 0 || integer > 0 {
            index += 1 + fraction;
        }
    }

    if integer == 0 && fraction == 0 {
        return 0;
    }

    if matches!(bytes.get(index), Some(b'e' | b'E')) {
        let sign = usize::from(matches!(bytes.get(index + 1), Some(b'+' | b'-')));
        let digits = bytes
            .get(index + 1 + sign..)
            .unwrap_or_default()
            .iter()
            .take_while(|byte| byte.is_ascii_digit())
            .count();

        if digits > 0 {
            index += 1 + sign + digits;
        }
    }

    index
}

/// Matches the regular expression `[+-]?(?:\d*\.\d+|\d+)(?:[eE][+-]?\d+)?` at the start of a string.
///
/// Unlike [`decimal_prefix`], a trailing `.` without fraction digits is not consumed.
pub fn css_number_prefix(text: &str, signs: &[u8]) -> usize {
    let bytes = text.as_bytes();
    let mut index = usize::from(bytes.first().is_some_and(|byte| signs.contains(byte)));
    let integer = bytes
        .get(index..)
        .unwrap_or_default()
        .iter()
        .take_while(|byte| byte.is_ascii_digit())
        .count();
    let fraction = if bytes.get(index + integer) == Some(&b'.') {
        bytes
            .get(index + integer + 1..)
            .unwrap_or_default()
            .iter()
            .take_while(|byte| byte.is_ascii_digit())
            .count()
    } else {
        0
    };

    if fraction > 0 {
        index += integer + 1 + fraction;
    } else if integer > 0 {
        index += integer;
    } else {
        return 0;
    }

    if matches!(bytes.get(index), Some(b'e' | b'E')) {
        let sign = usize::from(matches!(bytes.get(index + 1), Some(b'+' | b'-')));
        let digits = bytes
            .get(index + 1 + sign..)
            .unwrap_or_default()
            .iter()
            .take_while(|byte| byte.is_ascii_digit())
            .count();

        if digits > 0 {
            index += 1 + sign + digits;
        }
    }

    index
}

/// Converts a string to a number like `Number(value)` for decimal spellings.
pub fn to_number(value: &str) -> f64 {
    let text = trim(value);

    if text.is_empty() {
        return 0.0;
    }

    match text {
        "Infinity" | "+Infinity" => return f64::INFINITY,
        "-Infinity" => return f64::NEG_INFINITY,
        _ => {}
    }

    if css_number_prefix(text, b"+-") == text.len() || decimal_prefix(text) == text.len() {
        return text.parse().unwrap_or(f64::NAN);
    }

    f64::NAN
}

/// Primary collation weight of an ASCII character in the ICU root collation `localeCompare` uses.
///
/// Punctuation and symbols sort before digits, and digits before letters. Letters compare without
/// case at this level.
fn collation_weight(byte: u8) -> u16 {
    const PUNCTUATION: &[u8] = b"\t\n\x0b\x0c\r _-,;:!?.'\"()[]{}@*/\\&#%`^+<=>|~$";

    if let Some(index) = PUNCTUATION.iter().position(|candidate| *candidate == byte) {
        return u16::try_from(index).unwrap_or(u16::MAX);
    }

    if byte.is_ascii_digit() {
        return 100 + u16::from(byte - b'0');
    }

    if byte.is_ascii_alphabetic() {
        return 200 + u16::from(byte.to_ascii_lowercase() - b'a');
    }

    1000 + u16::from(byte)
}

/// Orders strings like `String.prototype.localeCompare` under the ICU root collation.
///
/// ASCII text follows the collation's primary order with lowercase before uppercase as the
/// tie-breaker. Non-ASCII text falls back to code point order after the ASCII prefix.
pub fn locale_compare(left: &str, right: &str) -> std::cmp::Ordering {
    let primary = left
        .bytes()
        .map(collation_weight)
        .cmp(right.bytes().map(collation_weight));

    primary
        .then_with(|| {
            // Tertiary differences: lowercase sorts before uppercase.
            let case = |byte: u8| u8::from(byte.is_ascii_uppercase());

            left.bytes().map(case).cmp(right.bytes().map(case))
        })
        .then_with(|| left.cmp(right))
}

/// Converts UTF-8 byte offsets into the UTF-16 offsets JavaScript strings use.
///
/// ASCII sources need no table. Otherwise each non-ASCII character records the cumulative
/// difference, and lookups binary search it, so conversions need no ordering.
#[derive(Clone, Debug, Default)]
pub struct Utf16Index {
    /// UTF-8 offsets just after each non-ASCII character, with the UTF-16 offset at that point.
    marks: Vec<(u32, u32)>,
}

impl Utf16Index {
    /// Indexes a source text.
    pub fn new(source: &str) -> Self {
        if source.is_ascii() {
            return Self::default();
        }

        let mut marks = Vec::new();
        let mut units: u32 = 0;

        for (offset, character) in source.char_indices() {
            units += u32::try_from(character.len_utf16()).unwrap_or(0);

            if !character.is_ascii() {
                let end = u32::try_from(offset + character.len_utf8()).unwrap_or(u32::MAX);
                marks.push((end, units));
            }
        }

        Self { marks }
    }

    /// Converts a UTF-8 offset to a UTF-16 offset.
    pub fn utf16(&self, offset: u32) -> u32 {
        match self.marks.partition_point(|(end, _)| *end <= offset) {
            0 => offset,
            index => self
                .marks
                .get(index - 1)
                .map_or(offset, |(end, units)| units + (offset - end)),
        }
    }

    /// Converts a UTF-16 offset back to a UTF-8 offset.
    pub fn utf8(&self, offset: u32) -> u32 {
        match self.marks.partition_point(|(_, units)| *units <= offset) {
            0 => offset,
            index => self
                .marks
                .get(index - 1)
                .map_or(offset, |(end, units)| end + (offset - units)),
        }
    }
}

/// A string-keyed record that enumerates in JavaScript own-property order.
///
/// Array-index keys come first in ascending order, then other keys in insertion order, as
/// `Object.entries` and `JSON.stringify` report them. Assigning an existing key keeps its position.
#[derive(Clone, Debug)]
pub struct Record<V> {
    /// Array-index keys in ascending index order.
    indexed: Vec<(u32, std::sync::Arc<str>, V)>,
    /// Other keys in insertion order.
    named: IndexMap<std::sync::Arc<str>, V, FxBuildHasher>,
}

impl<V> Default for Record<V> {
    fn default() -> Self {
        Self {
            indexed: Vec::new(),
            named: IndexMap::default(),
        }
    }
}

// Records are equal when they enumerate equal entries in the same order, as JavaScript objects
// serialize them.
impl<V: PartialEq> PartialEq for Record<V> {
    fn eq(&self, other: &Self) -> bool {
        self.len() == other.len() && self.iter().eq(other.iter())
    }
}

impl<V> Record<V> {
    /// Creates an empty record.
    pub fn new() -> Self {
        Self::default()
    }

    /// Number of entries.
    pub fn len(&self) -> usize {
        self.indexed.len() + self.named.len()
    }

    /// Whether the record is empty.
    pub fn is_empty(&self) -> bool {
        self.indexed.is_empty() && self.named.is_empty()
    }

    fn position(&self, index: u32) -> Result<usize, usize> {
        self.indexed
            .binary_search_by_key(&index, |(other, _, _)| *other)
    }

    /// Sets a key, keeping the position of an existing key.
    pub fn insert(&mut self, key: impl Into<std::sync::Arc<str>>, value: V) {
        let key = key.into();
        let Some(index) = array_index(&key) else {
            self.named.insert(key, value);
            return;
        };

        match self.position(index) {
            Ok(position) => {
                if let Some(entry) = self.indexed.get_mut(position) {
                    entry.2 = value;
                }
            }
            Err(position) => self.indexed.insert(position, (index, key, value)),
        }
    }

    /// Reads a key.
    pub fn get(&self, key: &str) -> Option<&V> {
        match array_index(key) {
            Some(index) => self
                .position(index)
                .ok()
                .and_then(|position| self.indexed.get(position))
                .map(|(_, _, value)| value),
            None => self.named.get(key),
        }
    }

    /// Reads a key mutably.
    pub fn get_mut(&mut self, key: &str) -> Option<&mut V> {
        match array_index(key) {
            Some(index) => {
                let position = self.position(index).ok()?;

                self.indexed.get_mut(position).map(|(_, _, value)| value)
            }
            None => self.named.get_mut(key),
        }
    }

    /// Whether a key exists, like `Object.hasOwn`.
    pub fn contains_key(&self, key: &str) -> bool {
        self.get(key).is_some()
    }

    /// Removes a key.
    pub fn remove(&mut self, key: &str) -> Option<V> {
        match array_index(key) {
            Some(index) => {
                let position = self.position(index).ok()?;

                Some(self.indexed.remove(position).2)
            }
            None => self.named.shift_remove(key),
        }
    }

    /// Iterates entries in JavaScript order.
    pub fn iter(&self) -> impl Iterator<Item = (&std::sync::Arc<str>, &V)> {
        self.indexed
            .iter()
            .map(|(_, key, value)| (key, value))
            .chain(self.named.iter())
    }

    /// Iterates keys in JavaScript order.
    pub fn keys(&self) -> impl Iterator<Item = &std::sync::Arc<str>> {
        self.iter().map(|(key, _)| key)
    }

    /// Iterates values in JavaScript order.
    pub fn values(&self) -> impl Iterator<Item = &V> {
        self.iter().map(|(_, value)| value)
    }
}

impl<V> FromIterator<(std::sync::Arc<str>, V)> for Record<V> {
    fn from_iter<T: IntoIterator<Item = (std::sync::Arc<str>, V)>>(iter: T) -> Self {
        let mut record = Self::new();

        for (key, value) in iter {
            record.insert(key, value);
        }

        record
    }
}
