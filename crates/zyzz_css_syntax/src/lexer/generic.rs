//! Generic types implemented in code, following css-tree's `generic`, `generic-an-plus-b`,
//! and `generic-urange` modules.
//!
//! Each function receives the current token and returns how many raw tokens, whitespace
//! included, it consumes. Zero means no match.

use super::MatchToken;
use crate::definition_syntax::{Bound, Range};
use crate::generated::data;
use crate::tokenizer::{TokenType, consume_number, is_digit, is_hex_digit, is_identifier_start};

/// A generic type.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum GenericKind {
    /// `<an-plus-b>`.
    AnPlusB,
    /// `<any-value>`.
    AnyValue,
    /// `<attr-unit>`.
    AttrUnit,
    /// `<custom-ident>`.
    CustomIdent,
    /// `<custom-property-name>`.
    CustomPropertyName,
    /// `<dashed-ident>`.
    DashedIdent,
    /// `<declaration-value>`.
    DeclarationValue,
    /// A dimension type, restricted to a unit group unless it is `<dimension>`.
    Dimension(Option<UnitGroup>),
    /// `<hex-color>`.
    HexColor,
    /// `<id-selector>`.
    IdSelector,
    /// `<integer>`.
    Integer,
    /// `<length>`, which also accepts a literal zero.
    Length,
    /// `<number>`.
    Number,
    /// `<percentage>`.
    Percentage,
    /// A token type such as `<ident-token>`, and the `<ident>` and `<string>` aliases.
    Token(TokenType),
    /// `<urange>`.
    Urange,
    /// `<zero>`.
    Zero,
}

/// A unit group for dimension types.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum UnitGroup {
    Angle,
    Decibel,
    Flex,
    Frequency,
    Resolution,
    Semitones,
    Time,
}

impl UnitGroup {
    fn units(self) -> &'static [&'static str] {
        match self {
            Self::Angle => data::ANGLE_UNITS,
            Self::Decibel => data::DECIBEL_UNITS,
            Self::Flex => data::FLEX_UNITS,
            Self::Frequency => data::FREQUENCY_UNITS,
            Self::Resolution => data::RESOLUTION_UNITS,
            Self::Semitones => data::SEMITONES_UNITS,
            Self::Time => data::TIME_UNITS,
        }
    }
}

impl GenericKind {
    /// Resolves a generic type name.
    pub(crate) fn from_name(name: &str) -> Option<Self> {
        Some(match name {
            "ident-token" | "ident" => Self::Token(TokenType::Ident),
            "function-token" => Self::Token(TokenType::Function),
            "at-keyword-token" => Self::Token(TokenType::AtKeyword),
            "hash-token" => Self::Token(TokenType::Hash),
            "string-token" | "string" => Self::Token(TokenType::String),
            "bad-string-token" => Self::Token(TokenType::BadString),
            "url-token" => Self::Token(TokenType::Url),
            "bad-url-token" => Self::Token(TokenType::BadUrl),
            "delim-token" => Self::Token(TokenType::Delim),
            "number-token" => Self::Token(TokenType::Number),
            "percentage-token" => Self::Token(TokenType::Percentage),
            "dimension-token" => Self::Token(TokenType::Dimension),
            "whitespace-token" => Self::Token(TokenType::WhiteSpace),
            "CDO-token" => Self::Token(TokenType::Cdo),
            "CDC-token" => Self::Token(TokenType::Cdc),
            "colon-token" => Self::Token(TokenType::Colon),
            "semicolon-token" => Self::Token(TokenType::Semicolon),
            "comma-token" => Self::Token(TokenType::Comma),
            "[-token" => Self::Token(TokenType::LeftSquareBracket),
            "]-token" => Self::Token(TokenType::RightSquareBracket),
            "(-token" => Self::Token(TokenType::LeftParenthesis),
            ")-token" => Self::Token(TokenType::RightParenthesis),
            "{-token" => Self::Token(TokenType::LeftCurlyBracket),
            "}-token" => Self::Token(TokenType::RightCurlyBracket),
            "percentage" => Self::Percentage,
            "zero" => Self::Zero,
            "number" => Self::Number,
            "integer" => Self::Integer,
            "custom-ident" => Self::CustomIdent,
            "dashed-ident" => Self::DashedIdent,
            "custom-property-name" => Self::CustomPropertyName,
            "hex-color" => Self::HexColor,
            "id-selector" => Self::IdSelector,
            "an-plus-b" => Self::AnPlusB,
            "urange" => Self::Urange,
            "declaration-value" => Self::DeclarationValue,
            "any-value" => Self::AnyValue,
            "dimension" => Self::Dimension(None),
            "angle" => Self::Dimension(Some(UnitGroup::Angle)),
            "decibel" => Self::Dimension(Some(UnitGroup::Decibel)),
            "frequency" => Self::Dimension(Some(UnitGroup::Frequency)),
            "flex" => Self::Dimension(Some(UnitGroup::Flex)),
            "length" => Self::Length,
            "resolution" => Self::Dimension(Some(UnitGroup::Resolution)),
            "semitones" => Self::Dimension(Some(UnitGroup::Semitones)),
            "time" => Self::Dimension(Some(UnitGroup::Time)),
            "attr-unit" => Self::AttrUnit,
            _ => return None,
        })
    }
}

/// An exception css-tree throws while matching, such as a `TypeError` from reading a missing
/// token or a reference to an unknown type.
#[derive(Clone, Debug)]
pub(crate) struct Thrown(pub(crate) std::borrow::Cow<'static, str>);

/// The math functions css-tree accepts in place of numeric types.
const CALC: [&str; 3] = ["calc(", "-moz-calc(", "-webkit-calc("];
const COMPARISON: [&str; 3] = ["min(", "max(", "clamp("];
const STEPPED: [&str; 3] = ["round(", "mod(", "rem("];
const TRIG_NUMBER: [&str; 3] = ["sin(", "cos(", "tan("];
const TRIG_ANGLE: [&str; 4] = ["asin(", "acos(", "atan(", "atan2("];
const OTHER_NUMBER: [&str; 5] = ["pow(", "sqrt(", "log(", "exp(", "sign("];
const HYPOT: [&str; 1] = ["hypot("];
const ABS: [&str; 1] = ["abs("];

#[derive(Clone, Copy)]
enum MathFamily {
    Dimension,
    Number,
    Percentage,
}

fn is_math_function(value: &str, family: MathFamily) -> bool {
    let matches = |names: &[&str]| names.iter().any(|name| value.eq_ignore_ascii_case(name));
    let shared = matches(&CALC) || matches(&COMPARISON) || matches(&STEPPED) || matches(&HYPOT);

    match family {
        MathFamily::Number => {
            shared || matches(&TRIG_NUMBER) || matches(&OTHER_NUMBER) || matches(&ABS)
        }
        MathFamily::Percentage => shared || matches(&ABS),
        MathFamily::Dimension => shared || matches(&TRIG_ANGLE) || matches(&ABS),
    }
}

/// Runs a generic type at `index`, returning the consumed raw token count.
pub(crate) fn call(
    kind: GenericKind,
    tokens: &[MatchToken<'_>],
    index: usize,
    opts: Option<&Range<'_>>,
) -> Result<usize, Thrown> {
    let token = tokens.get(index);
    let next = |offset: usize| tokens.get(index + offset);

    let math = |family: MathFamily| -> Option<usize> {
        let token = token?;

        if token.kind == TokenType::Function && is_math_function(&token.value, family) {
            return Some(consume_function(tokens, index));
        }

        None
    };

    Ok(match kind {
        GenericKind::Token(expected) => {
            usize::from(token.is_some_and(|token| token.kind == expected))
        }
        GenericKind::Percentage => {
            if token.is_none() {
                return Ok(0);
            }

            math(MathFamily::Percentage).unwrap_or_else(|| percentage(token, opts))
        }
        GenericKind::Zero => zero(token),
        GenericKind::Number => {
            if token.is_none() {
                return Ok(0);
            }

            math(MathFamily::Number).unwrap_or_else(|| number(token, opts))
        }
        GenericKind::Integer => {
            if token.is_none() {
                return Ok(0);
            }

            math(MathFamily::Number).unwrap_or_else(|| integer(token, opts))
        }
        GenericKind::CustomIdent => custom_ident(token),
        GenericKind::DashedIdent => usize::from(dashed_ident(token)),
        GenericKind::CustomPropertyName => {
            usize::from(dashed_ident(token) && token.is_some_and(|token| token.value != "--"))
        }
        GenericKind::HexColor => hex_color(token),
        GenericKind::IdSelector => id_selector(token),
        GenericKind::AnPlusB => return an_plus_b(token, &next),
        GenericKind::Urange => urange(token, &next),
        GenericKind::DeclarationValue => declaration_value(tokens, index, true),
        GenericKind::AnyValue => declaration_value(tokens, index, false),
        GenericKind::Dimension(group) => {
            if token.is_none() {
                return Ok(0);
            }

            math(MathFamily::Dimension)
                .unwrap_or_else(|| dimension(token, group.map(UnitGroup::units), opts))
        }
        GenericKind::Length => {
            if token.is_none() {
                return Ok(0);
            }

            math(MathFamily::Dimension).unwrap_or_else(|| match zero(token) {
                0 => dimension(token, Some(data::LENGTH_UNITS), opts),
                matched => matched,
            })
        }
        GenericKind::AttrUnit => attr_unit(token),
    })
}

/// Consumes a balanced function starting at `index`.
fn consume_function(tokens: &[MatchToken<'_>], index: usize) -> usize {
    let mut stash: Vec<Option<TokenType>> = Vec::new();
    let mut close: Option<TokenType> = None;
    let mut length = 0;

    while let Some(token) = tokens.get(index + length) {
        match token.kind {
            TokenType::RightCurlyBracket
            | TokenType::RightParenthesis
            | TokenType::RightSquareBracket => {
                if Some(token.kind) != close {
                    break;
                }

                close = stash.pop().flatten();

                if stash.is_empty() {
                    length += 1;
                    break;
                }
            }
            TokenType::Function
            | TokenType::LeftParenthesis
            | TokenType::LeftSquareBracket
            | TokenType::LeftCurlyBracket => {
                stash.push(close);
                close = token.kind.balance_pair();
            }
            _ => {}
        }

        length += 1;
    }

    length
}

/// `<declaration-value>`, or `<any-value>` when `declaration` is false.
fn declaration_value(tokens: &[MatchToken<'_>], index: usize, declaration: bool) -> usize {
    let mut stash: Vec<Option<TokenType>> = Vec::new();
    let mut close: Option<TokenType> = None;
    let mut length = 0;

    while let Some(token) = tokens.get(index + length) {
        match token.kind {
            TokenType::BadString | TokenType::BadUrl => break,
            TokenType::RightCurlyBracket
            | TokenType::RightParenthesis
            | TokenType::RightSquareBracket => {
                if Some(token.kind) != close {
                    break;
                }

                close = stash.pop().flatten();
            }
            TokenType::Semicolon if declaration && close.is_none() => break,
            TokenType::Delim if declaration && close.is_none() && token.value == "!" => break,
            TokenType::Function
            | TokenType::LeftParenthesis
            | TokenType::LeftSquareBracket
            | TokenType::LeftCurlyBracket => {
                stash.push(close);
                close = token.kind.balance_pair();
            }
            _ => {}
        }

        length += 1;
    }

    length
}

/// Reports whether a token value ends with an IE postfix hack such as `\9` at `offset`.
fn is_postfix_ie_hack(value: &str, offset: usize) -> bool {
    let bytes = value.as_bytes();

    offset + 2 == bytes.len()
        && bytes.get(offset) == Some(&b'\\')
        && bytes.get(offset + 1).is_some_and(|code| is_digit(*code))
}

/// css-tree's `outOfRange`: whether the numeric prefix violates a numeric range.
fn out_of_range(opts: Option<&Range<'_>>, value: &str, number_end: usize) -> bool {
    let Some(range) = opts else {
        return false;
    };
    let text = if number_end == value.len() {
        value
    } else {
        value.get(..number_end).unwrap_or_default()
    };
    let number = crate::js::number(text);

    if number.is_nan() {
        return true;
    }

    // Dimension bounds are strings in css-tree and never checked.
    if let Some(Bound::Number(min)) = range.min
        && number < min
    {
        return true;
    }

    if let Some(Bound::Number(max)) = range.max
        && number > max
    {
        return true;
    }

    false
}

fn dimension(
    token: Option<&MatchToken<'_>>,
    units: Option<&[&str]>,
    opts: Option<&Range<'_>>,
) -> usize {
    let Some(token) = token.filter(|token| token.kind == TokenType::Dimension) else {
        return 0;
    };
    let value: &str = &token.value;
    let number_end = consume_number(value.as_bytes(), 0);

    if let Some(units) = units {
        let solidus = value
            .get(number_end..)
            .and_then(|rest| rest.find('\\'))
            .map(|found| number_end + found);
        let unit = match solidus {
            Some(offset) if is_postfix_ie_hack(value, offset) => value.get(number_end..offset),
            _ => value.get(number_end..),
        }
        .unwrap_or_default();
        let unit = crate::js::to_lower_case(unit);

        if !units.iter().any(|candidate| *candidate == unit) {
            return 0;
        }
    }

    usize::from(!out_of_range(opts, value, number_end))
}

fn percentage(token: Option<&MatchToken<'_>>, opts: Option<&Range<'_>>) -> usize {
    let Some(token) = token.filter(|token| token.kind == TokenType::Percentage) else {
        return 0;
    };

    usize::from(!out_of_range(
        opts,
        &token.value,
        token.value.len().saturating_sub(1),
    ))
}

fn zero(token: Option<&MatchToken<'_>>) -> usize {
    usize::from(token.is_some_and(|token| {
        token.kind == TokenType::Number && crate::js::number(&token.value) == 0.0
    }))
}

/// `<number>`, which css-tree applies to any token whose text is a number.
fn number(token: Option<&MatchToken<'_>>, opts: Option<&Range<'_>>) -> usize {
    let Some(token) = token else {
        return 0;
    };
    let number_end = consume_number(token.value.as_bytes(), 0);

    if number_end != token.value.len() && !is_postfix_ie_hack(&token.value, number_end) {
        return 0;
    }

    usize::from(!out_of_range(opts, &token.value, number_end))
}

fn integer(token: Option<&MatchToken<'_>>, opts: Option<&Range<'_>>) -> usize {
    let Some(token) = token.filter(|token| token.kind == TokenType::Number) else {
        return 0;
    };
    let bytes = token.value.as_bytes();
    let start = usize::from(matches!(bytes.first(), Some(b'+' | b'-')));

    if !bytes
        .get(start..)
        .unwrap_or_default()
        .iter()
        .all(|code| is_digit(*code))
    {
        return 0;
    }

    usize::from(!out_of_range(opts, &token.value, bytes.len()))
}

fn custom_ident(token: Option<&MatchToken<'_>>) -> usize {
    let Some(token) = token.filter(|token| token.kind == TokenType::Ident) else {
        return 0;
    };
    let name = crate::js::to_lower_case(&token.value);

    if data::CSS_WIDE_KEYWORDS
        .iter()
        .any(|keyword| name.eq_ignore_ascii_case(keyword))
        || name.eq_ignore_ascii_case("default")
    {
        return 0;
    }

    1
}

fn dashed_ident(token: Option<&MatchToken<'_>>) -> bool {
    token.is_some_and(|token| token.kind == TokenType::Ident && token.value.starts_with("--"))
}

fn hex_color(token: Option<&MatchToken<'_>>) -> usize {
    let Some(token) = token.filter(|token| token.kind == TokenType::Hash) else {
        return 0;
    };
    let bytes = token.value.as_bytes();

    if !matches!(bytes.len(), 4 | 5 | 7 | 9) {
        return 0;
    }

    usize::from(
        bytes
            .get(1..)
            .unwrap_or_default()
            .iter()
            .all(|code| is_hex_digit(*code)),
    )
}

fn id_selector(token: Option<&MatchToken<'_>>) -> usize {
    let Some(token) = token.filter(|token| token.kind == TokenType::Hash) else {
        return 0;
    };
    let byte = |index: usize| token.value.as_bytes().get(index).copied().unwrap_or(0);

    usize::from(is_identifier_start(byte(1), byte(2), byte(3)))
}

fn attr_unit(token: Option<&MatchToken<'_>>) -> usize {
    let Some(token) = token else {
        return 0;
    };

    if token.kind == TokenType::Delim && token.value == "%" {
        return 1;
    }

    if token.kind != TokenType::Ident {
        return 0;
    }

    let value = crate::js::to_lower_case(&token.value);
    let groups = [
        data::LENGTH_UNITS,
        data::ANGLE_UNITS,
        data::TIME_UNITS,
        data::FREQUENCY_UNITS,
        data::RESOLUTION_UNITS,
        data::FLEX_UNITS,
        data::DECIBEL_UNITS,
        data::SEMITONES_UNITS,
    ];

    usize::from(
        groups
            .iter()
            .flat_map(|group| group.iter())
            .any(|unit| crate::js::to_lower_case(unit) == value),
    )
}

fn is_delim(token: Option<&MatchToken<'_>>, code: u8) -> bool {
    token.is_some_and(|token| {
        token.kind == TokenType::Delim && token.value.as_bytes().first() == Some(&code)
    })
}

/// Skips whitespace and comments from `offset`, returning the new offset.
fn skip_sc<'t>(
    mut token: Option<&MatchToken<'t>>,
    mut offset: usize,
    next: &impl Fn(usize) -> Option<&'t MatchToken<'t>>,
) -> usize {
    while token
        .is_some_and(|token| matches!(token.kind, TokenType::WhiteSpace | TokenType::Comment))
    {
        offset += 1;
        token = next(offset);
    }

    offset
}

/// css-tree's `checkInteger` for `An+B`: digits from `value_offset`, with an optional sign.
fn check_integer(
    token: Option<&MatchToken<'_>>,
    value_offset: usize,
    disallow_sign: bool,
    offset: usize,
) -> usize {
    let Some(token) = token else {
        return 0;
    };
    let bytes = token.value.as_bytes();
    let mut position = value_offset;

    if matches!(bytes.get(position), Some(b'+' | b'-')) {
        if disallow_sign {
            return 0;
        }

        position += 1;
    }

    while position < bytes.len() {
        if !bytes.get(position).is_some_and(|code| is_digit(*code)) {
            return 0;
        }

        position += 1;
    }

    offset + 1
}

/// Reads the `B` part of `An+B` after `offset`, returning `start` when it is absent.
fn consume_b<'t>(
    token: Option<&MatchToken<'t>>,
    start: usize,
    next: &impl Fn(usize) -> Option<&'t MatchToken<'t>>,
) -> usize {
    let mut sign = false;
    let mut offset = skip_sc(token, start, next);
    let Some(mut token) = next(offset) else {
        return start;
    };

    if token.kind != TokenType::Number {
        if is_delim(Some(token), b'+') || is_delim(Some(token), b'-') {
            sign = true;
            offset += 1;
            offset = skip_sc(next(offset), offset, next);

            match next(offset) {
                Some(found) if found.kind == TokenType::Number => token = found,
                _ => return 0,
            }
        } else {
            return start;
        }
    }

    if !sign && !matches!(token.value.as_bytes().first(), Some(b'+' | b'-')) {
        return 0;
    }

    check_integer(Some(token), usize::from(!sign), sign, offset)
}

fn cmp_char(value: &str, offset: usize, reference: u8) -> bool {
    value
        .as_bytes()
        .get(offset)
        .is_some_and(|code| code.to_ascii_lowercase() == reference)
}

/// `<an-plus-b>`.
fn an_plus_b<'t>(
    token: Option<&MatchToken<'t>>,
    next: &impl Fn(usize) -> Option<&'t MatchToken<'t>>,
) -> Result<usize, Thrown> {
    let mut offset = 0;
    let Some(mut token) = token else {
        return Ok(0);
    };
    let bytes = token.value.as_bytes();

    if token.kind == TokenType::Number {
        return Ok(check_integer(Some(token), 0, false, offset));
    }

    if token.kind == TokenType::Ident && bytes.first() == Some(&b'-') {
        if !cmp_char(&token.value, 1, b'n') {
            return Ok(0);
        }

        return Ok(match crate::js::utf16_length(&token.value) {
            2 => {
                offset += 1;
                consume_b(next(offset), offset, next)
            }
            3 => {
                if bytes.get(2) != Some(&b'-') {
                    return Ok(0);
                }

                offset += 1;
                offset = skip_sc(next(offset), offset, next);
                check_integer(next(offset), 0, true, offset)
            }
            _ => {
                if bytes.get(2) != Some(&b'-') {
                    return Ok(0);
                }

                check_integer(Some(token), 3, true, offset)
            }
        });
    }

    if token.kind == TokenType::Ident || is_delim(Some(token), b'+') {
        if token.kind != TokenType::Ident {
            // css-tree reads `getNextToken(1).type` without a null check.
            let Some(following) = next(offset + 1) else {
                return Err(Thrown(std::borrow::Cow::Borrowed(
                    "Cannot read properties of null (reading 'type')",
                )));
            };

            if following.kind != TokenType::Ident {
                return Ok(0);
            }

            offset += 1;
            token = following;
        }

        if !cmp_char(&token.value, 0, b'n') {
            return Ok(0);
        }

        let bytes = token.value.as_bytes();

        return Ok(match crate::js::utf16_length(&token.value) {
            1 => {
                offset += 1;
                consume_b(next(offset), offset, next)
            }
            2 => {
                if bytes.get(1) != Some(&b'-') {
                    return Ok(0);
                }

                offset += 1;
                offset = skip_sc(next(offset), offset, next);
                check_integer(next(offset), 0, true, offset)
            }
            _ => {
                if bytes.get(1) != Some(&b'-') {
                    return Ok(0);
                }

                check_integer(Some(token), 2, true, offset)
            }
        });
    }

    if token.kind == TokenType::Dimension {
        let sign = usize::from(matches!(bytes.first(), Some(b'+' | b'-')));
        let mut index = sign;

        while bytes.get(index).is_some_and(|code| is_digit(*code)) {
            index += 1;
        }

        if index == sign || !cmp_char(&token.value, index, b'n') {
            return Ok(0);
        }

        if index + 1 == bytes.len() {
            offset += 1;
            return Ok(consume_b(next(offset), offset, next));
        }

        if bytes.get(index + 1) != Some(&b'-') {
            return Ok(0);
        }

        if index + 2 == bytes.len() {
            offset += 1;
            offset = skip_sc(next(offset), offset, next);
            return Ok(check_integer(next(offset), 0, true, offset));
        }

        return Ok(check_integer(Some(token), index + 2, true, offset));
    }

    Ok(0)
}

/// Validates hex digits from `offset`, allowing one `-` separated range when `allow_dash`.
fn hex_sequence(token: &MatchToken<'_>, offset: usize, allow_dash: bool) -> usize {
    let bytes = token.value.as_bytes();
    let mut length = 0;
    let mut position = offset;

    while position < bytes.len() {
        let code = bytes.get(position).copied().unwrap_or(0);

        if code == b'-' && allow_dash && length != 0 {
            hex_sequence(token, offset + length + 1, false);
            // Disallow following question marks.
            return 6;
        }

        if !is_hex_digit(code) {
            return 0;
        }

        length += 1;

        if length > 6 {
            return 0;
        }

        position += 1;
    }

    length
}

fn with_question_marks<'t>(
    mut consumed: usize,
    mut length: usize,
    next: &impl Fn(usize) -> Option<&'t MatchToken<'t>>,
) -> usize {
    if consumed == 0 {
        return 0;
    }

    while is_delim(next(length), b'?') {
        consumed += 1;

        if consumed > 6 {
            return 0;
        }

        length += 1;
    }

    length
}

/// `<urange>`.
fn urange<'t>(
    token: Option<&MatchToken<'t>>,
    next: &impl Fn(usize) -> Option<&'t MatchToken<'t>>,
) -> usize {
    let mut length = 0;

    let Some(token) =
        token.filter(|token| token.kind == TokenType::Ident && cmp_char(&token.value, 0, b'u'))
    else {
        return 0;
    };
    let _ = token;

    length += 1;

    let Some(token) = next(length) else {
        return 0;
    };

    if is_delim(Some(token), b'+') {
        length += 1;

        let Some(token) = next(length) else {
            return 0;
        };

        if token.kind == TokenType::Ident {
            length += 1;
            return with_question_marks(hex_sequence(token, 0, true), length, next);
        }

        if is_delim(Some(token), b'?') {
            length += 1;
            return with_question_marks(1, length, next);
        }

        return 0;
    }

    if token.kind == TokenType::Number {
        let consumed = hex_sequence(token, 1, true);

        if consumed == 0 {
            return 0;
        }

        length += 1;

        let Some(following) = next(length) else {
            return length;
        };

        if matches!(following.kind, TokenType::Dimension | TokenType::Number) {
            if following.value.as_bytes().first() != Some(&b'-')
                || hex_sequence(following, 1, false) == 0
            {
                return 0;
            }

            return length + 1;
        }

        return with_question_marks(consumed, length, next);
    }

    if token.kind == TokenType::Dimension {
        length += 1;
        return with_question_marks(hex_sequence(token, 1, true), length, next);
    }

    0
}
