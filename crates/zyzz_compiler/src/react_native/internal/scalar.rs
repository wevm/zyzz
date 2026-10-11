//! Converts portable scalar values without source parsing or device state.

use std::sync::Arc;

use crate::data::Data;
use crate::error::{Error, Result};
use crate::js;
use crate::react_native::internal::{calculation, color};

pub use crate::react_native::generated::scalar::{Kind, PROPERTIES, property};

/// A portable scalar: the `number | string` values native conversion accepts.
#[derive(Clone, Debug, PartialEq)]
pub enum Value {
    /// A number.
    Number(f64),
    /// A string.
    String(Arc<str>),
}

impl Value {
    /// Converts into static data.
    pub fn to_data(&self) -> Data {
        match self {
            Self::Number(number) => Data::Number(*number),
            Self::String(text) => Data::String(Arc::clone(text)),
        }
    }

    /// Formats like `String(value)`.
    pub fn to_js_string(&self) -> String {
        match self {
            Self::Number(number) => js::number(*number),
            Self::String(text) => text.to_string(),
        }
    }
}

impl From<&str> for Value {
    fn from(value: &str) -> Self {
        Self::String(value.into())
    }
}

impl From<f64> for Value {
    fn from(value: f64) -> Self {
        Self::Number(value)
    }
}

/// Positive logical-unit scales. `px` defaults to one and `rem` has no default.
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Units {
    /// Logical units per CSS pixel.
    pub px: Option<f64>,
    /// Logical units per root em.
    pub rem: Option<f64>,
}

/// Explicit portable-unit and font mappings.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Options {
    /// Authored family names mapped to native font names, in authored order.
    pub fonts: Vec<(Arc<str>, Arc<str>)>,
    /// Explicit logical-unit scales.
    pub units: Units,
}

impl Options {
    /// Reads validated `fonts` and `units` option values.
    ///
    /// String font mappings and numeric scales are kept. Other values are ignored, since
    /// `StyleSheet.compile` rejects them before any conversion.
    pub fn read(fonts: &Data, units: &Data) -> Self {
        let fonts = fonts
            .as_object()
            .map(|fonts| {
                fonts
                    .iter()
                    .filter_map(|(family, mapped)| {
                        mapped
                            .as_str()
                            .map(|mapped| (Arc::clone(family), Arc::from(mapped)))
                    })
                    .collect()
            })
            .unwrap_or_default();
        let scale = |name: &str| {
            units
                .as_object()
                .and_then(|units| units.get(name))
                .and_then(Data::as_number)
        };

        Self {
            fonts,
            units: Units {
                px: scale("px"),
                rem: scale("rem"),
            },
        }
    }

    /// Looks up the native family for an authored family.
    pub fn font(&self, family: &str) -> Option<&Arc<str>> {
        self.fonts
            .iter()
            .find(|(name, _)| &**name == family)
            .map(|(_, mapped)| mapped)
    }
}

/// Native longhands produced by the CSS `flex` shorthand.
#[derive(Clone, Debug, PartialEq)]
pub struct Flex {
    /// Converted basis.
    pub basis: Value,
    /// Grow factor.
    pub grow: f64,
    /// Shrink factor.
    pub shrink: f64,
}

/// Converts a validated property domain using explicit unit and font mappings.
///
/// Shorthand domains (`box`, `boxOffset`, `boxSigned`, and `flex`) validate every part and return
/// zero, as in TypeScript.
///
/// # Errors
///
/// Returns the TypeScript message describing the rejected value.
pub fn convert(kind: Kind, value: &Value, options: &Options) -> Result<Value> {
    match kind {
        Kind::Keywords(keywords) => match value {
            Value::String(text) if keywords.contains(&&**text) => {
                Ok(if &**text == "line-through underline" {
                    Value::from("underline line-through")
                } else {
                    value.clone()
                })
            }
            _ => Err(Error::message("Unsupported native keyword.")),
        },
        Kind::Ratio => {
            let ratio = match value {
                Value::Number(number) => *number,
                Value::String(text) => ratio(text).unwrap_or(f64::NAN),
            };

            if !ratio.is_finite() || ratio <= 0.0 {
                return Err(Error::message("Use a positive finite aspect ratio."));
            }

            Ok(Value::Number(ratio))
        }
        Kind::Color => match value {
            Value::String(text) => color::parse(text)
                .map(|color| Value::String(color.into()))
                .ok_or_else(|| {
                    Error::message("Use an absolute sRGB color supported by native conversion.")
                }),
            Value::Number(_) => Err(Error::message(
                "Use an absolute sRGB color supported by native conversion.",
            )),
        },
        Kind::Font => match value {
            Value::String(text) => options
                .font(text)
                .map(|mapped| Value::String(Arc::clone(mapped)))
                .ok_or_else(|| {
                    Error::message("Provide an explicit fonts mapping for this family.")
                }),
            Value::Number(_) => Err(Error::message(
                "Provide an explicit fonts mapping for this family.",
            )),
        },
        Kind::Weight => {
            let valid = match value {
                Value::String(text) => matches!(&**text, "normal" | "bold"),
                Value::Number(number) => (100.0..=900.0).contains(number) && *number % 100.0 == 0.0,
            };

            if valid {
                return Ok(value.clone());
            }

            Err(Error::message(
                "Use normal, bold, or numeric weights 100 through 900 in steps of 100.",
            ))
        }
        Kind::Number | Kind::Integer | Kind::Opacity => {
            let valid = match value {
                Value::Number(number) => {
                    number.is_finite()
                        && if kind == Kind::Integer {
                            number.fract() == 0.0
                        } else {
                            *number >= 0.0
                        }
                        && !(kind == Kind::Opacity && *number > 1.0)
                }
                Value::String(_) => false,
            };

            if !valid {
                return Err(Error::message("Unsupported native numeric value."));
            }

            Ok(value.clone())
        }
        Kind::Size if matches!(value, Value::String(text) if &**text == "auto") => {
            Ok(value.clone())
        }
        Kind::Dimension | Kind::Size | Kind::Offset if matches!(value, Value::String(text) if PERCENTAGE.matches_suffixed(text, "%")) =>
        {
            let Value::String(text) = value else {
                return Ok(value.clone());
            };
            let number = js::to_number(text.strip_suffix('%').unwrap_or_default());

            if number.is_finite() && (kind == Kind::Offset || number >= 0.0) {
                return Ok(value.clone());
            }

            Err(Error::message("Invalid native percentage."))
        }
        Kind::Flex => {
            flex(value, options)?;

            Ok(Value::Number(0.0))
        }
        Kind::Box | Kind::BoxOffset | Kind::BoxSigned => {
            let parts = shorthand(value)?;

            if parts.is_empty() || parts.len() > 4 {
                return Err(Error::message("Use one to four scalar lengths."));
            }

            for part in &parts {
                if kind == Kind::BoxOffset {
                    convert(Kind::Offset, part, options)?;
                } else {
                    length(part, options, kind == Kind::BoxSigned)?;
                }
            }

            Ok(Value::Number(0.0))
        }
        _ => length(value, options, matches!(kind, Kind::Signed | Kind::Offset)).map(Value::Number),
    }
}

/// Expands the CSS `flex` shorthand to native longhands with CSS semantics.
///
/// Omitted factors default to one and an omitted basis to zero, unlike the React Native `flex`
/// prop.
///
/// # Errors
///
/// Returns the TypeScript message for an invalid shorthand or factor.
pub fn flex(value: &Value, options: &Options) -> Result<Flex> {
    if let Value::String(text) = value {
        let keyword = js::trim(text);
        let keywords = match keyword {
            "none" => Some((0.0, 0.0)),
            "auto" => Some((1.0, 1.0)),
            "initial" => Some((0.0, 1.0)),
            _ => None,
        };

        if let Some((grow, shrink)) = keywords {
            return Ok(Flex {
                basis: Value::from("auto"),
                grow,
                shrink,
            });
        }
    }

    let parts = shorthand(value)?;
    // Whether each part is the basis rather than a factor.
    let mut kinds: Vec<bool> = Vec::with_capacity(parts.len());

    for part in &parts {
        let numeric = match part {
            Value::Number(_) => true,
            Value::String(text) => FACTOR.matches(text),
        };
        // A unitless zero after two factors is the basis, as in CSS.
        let basis = !numeric || (kinds.as_slice() == [false, false] && number_value(part) == 0.0);

        kinds.push(basis);
    }

    // Factors stay adjacent, and the basis may precede or follow them.
    let valid = matches!(
        kinds.as_slice(),
        [_] | [true, false] | [false, _] | [true, false, false] | [false, false, true]
    );

    if !valid {
        return Err(Error::message("Invalid flex shorthand."));
    }

    let mut factors = Vec::with_capacity(2);
    let mut basis = None;

    for (part, is_basis) in parts.iter().zip(&kinds) {
        if *is_basis {
            basis.get_or_insert(part);
        } else if let Value::Number(number) =
            convert(Kind::Number, &Value::Number(number_value(part)), options)?
        {
            factors.push(number);
        }
    }

    Ok(Flex {
        basis: match basis {
            None => Value::Number(0.0),
            Some(basis) => convert(Kind::Size, basis, options)?,
        },
        grow: factors.first().copied().unwrap_or(1.0),
        shrink: factors.get(1).copied().unwrap_or(1.0),
    })
}

/// Converts a portable length to logical units.
///
/// # Errors
///
/// Returns the TypeScript message for unsupported units, missing scales, or out-of-domain values.
pub fn length(value: &Value, options: &Options, signed: bool) -> Result<f64> {
    let text = match value {
        Value::Number(number) if *number == 0.0 => return Ok(0.0),
        Value::String(text) if &**text == "0" => return Ok(0.0),
        Value::Number(_) => return Err(unsupported_length()),
        Value::String(text) => text,
    };

    if is_calc(text) {
        let result = calculation::length(js::trim(text), options)?;

        if !signed && result < 0.0 {
            return Err(out_of_domain());
        }

        return Ok(result);
    }

    let number = LENGTH.prefix(text);
    let unit = text.get(number..).unwrap_or_default();

    if number == 0 || !matches!(unit, "px" | "rem") {
        return Err(unsupported_length());
    }

    let scale = if unit == "px" {
        Some(options.units.px.unwrap_or(1.0))
    } else {
        options.units.rem
    };
    let Some(scale) = scale else {
        return Err(Error::message("Provide units.rem for rem lengths."));
    };
    let result = js::to_number(text.get(..number).unwrap_or_default()) * scale;

    if !result.is_finite() || (!signed && result < 0.0) {
        return Err(out_of_domain());
    }

    Ok(result)
}

/// Whether text matches `^\s*calc\(` case-insensitively.
pub fn is_calc(text: &str) -> bool {
    text.trim_start_matches(js::is_whitespace)
        .as_bytes()
        .get(..5)
        .is_some_and(|prefix| prefix.eq_ignore_ascii_case(b"calc("))
}

#[cold]
fn unsupported_length() -> Error {
    Error::message("Use zero, px, or rem with an explicit rem conversion.")
}

#[cold]
fn out_of_domain() -> Error {
    Error::message("Converted length is outside the native property domain.")
}

/// Splits a shorthand string into parts, or wraps a number.
fn shorthand(value: &Value) -> Result<Vec<Value>> {
    match value {
        Value::Number(_) => Ok(vec![value.clone()]),
        Value::String(text) => Ok(calculation::parts(text)?
            .into_iter()
            .map(Value::from)
            .collect()),
    }
}

/// Converts like `Number(value)` for numbers and decimal strings.
fn number_value(value: &Value) -> f64 {
    match value {
        Value::Number(number) => *number,
        Value::String(text) => js::to_number(text),
    }
}

/// Matches `^\s*(\d+(?:\.\d+)?|\.\d+)\s*\/\s*(\d+(?:\.\d+)?|\.\d+)\s*$` and divides.
fn ratio(text: &str) -> Option<f64> {
    let (left, right) = text.split_once('/')?;
    let left = js::trim(left);
    let right = js::trim(right);

    if !RATIO.matches(left) || !RATIO.matches(right) {
        return None;
    }

    Some(js::to_number(left) / js::to_number(right))
}

/// The exponent clause a decimal spelling accepts.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum Exponent {
    /// `(?:[eE][+-]?\d+)?`
    Any,
    /// `(?:e[+-]?\d+)?`
    Lower,
    /// No exponent.
    None,
}

/// Whether digits may be omitted after a decimal point following integer digits.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum Fraction {
    /// `\d+(?:\.\d*)?`
    Optional,
    /// `\d+(?:\.\d+)?`
    Required,
}

/// One of the decimal number spellings the TypeScript regular expressions accept:
/// `[+-]?(?:\d+(?:\.\d+)?|\.\d+)` with variations in sign, fraction, and exponent.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) struct Decimal {
    /// Accepted exponent clause.
    pub(crate) exponent: Exponent,
    /// Fraction digit requirement.
    pub(crate) fraction: Fraction,
    /// Whether a leading `+` or `-` is accepted.
    pub(crate) sign: bool,
}

/// `[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?`, the spelling of lengths and flex factors.
pub(crate) const LENGTH: Decimal = Decimal {
    exponent: Exponent::Any,
    fraction: Fraction::Required,
    sign: true,
};

const FACTOR: Decimal = LENGTH;

/// `[+-]?(?:\d+(?:\.\d+)?|\.\d+)`, the spelling of percentages.
pub(crate) const PERCENTAGE: Decimal = Decimal {
    exponent: Exponent::None,
    fraction: Fraction::Required,
    sign: true,
};

const RATIO: Decimal = Decimal {
    exponent: Exponent::None,
    fraction: Fraction::Required,
    sign: false,
};

impl Decimal {
    /// Measures the longest matching prefix, or zero when none matches.
    pub(crate) fn prefix(self, text: &str) -> usize {
        let bytes = text.as_bytes();
        let digits = |from: usize| {
            bytes
                .get(from..)
                .unwrap_or_default()
                .iter()
                .take_while(|byte| byte.is_ascii_digit())
                .count()
        };
        let mut index = usize::from(self.sign && matches!(bytes.first(), Some(b'+' | b'-')));
        let integer = digits(index);

        if integer > 0 {
            index += integer;

            if bytes.get(index) == Some(&b'.') {
                let fraction = digits(index + 1);

                if fraction > 0 || self.fraction == Fraction::Optional {
                    index += 1 + fraction;
                }
            }
        } else if bytes.get(index) == Some(&b'.') && digits(index + 1) > 0 {
            index += 1 + digits(index + 1);
        } else {
            return 0;
        }

        let letter = match bytes.get(index) {
            Some(b'e') => self.exponent != Exponent::None,
            Some(b'E') => self.exponent == Exponent::Any,
            _ => false,
        };

        if letter {
            let sign = usize::from(matches!(bytes.get(index + 1), Some(b'+' | b'-')));
            let count = digits(index + 1 + sign);

            if count > 0 {
                index += 1 + sign + count;
            }
        }

        index
    }

    /// Whether the whole text matches.
    pub(crate) fn matches(self, text: &str) -> bool {
        let length = self.prefix(text);

        length > 0 && length == text.len()
    }

    /// Whether the text is a matching number followed by exactly `suffix`.
    pub(crate) fn matches_suffixed(self, text: &str, suffix: &str) -> bool {
        text.strip_suffix(suffix)
            .is_some_and(|number| self.matches(number))
    }
}
