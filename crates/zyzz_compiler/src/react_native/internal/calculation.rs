//! Evaluates finite `calc()` lengths using explicit native unit mappings.

use crate::error::{Error, Result};
use crate::js;
use crate::react_native::internal::scalar::Options;

const UNSUPPORTED: &str = "Unsupported native calc expression.";
const INCOMPATIBLE: &str = "Native calc requires compatible number and length operands.";
const NESTING: &str = "Native calc exceeds 64 nested operations.";

/// A number or a length in logical units.
#[derive(Clone, Copy)]
struct Quantity {
    amount: f64,
    length: bool,
}

#[derive(Clone, Copy)]
enum Token {
    Calc,
    Operator(u8),
    Value(Quantity),
}

/// Resolves number and length arithmetic, rejecting relative units and incompatible dimensions.
///
/// # Errors
///
/// Returns the TypeScript message for unsupported syntax, units, operands, or results.
pub fn length(input: &str, options: &Options) -> Result<f64> {
    let (tokens, positions) = tokenize(input, options)?;
    let mut parser = Parser {
        cursor: 0,
        depth: 0,
        input,
        positions: &positions,
        tokens: &tokens,
    };
    let value = parser.atom()?;

    if parser.cursor != tokens.len() || !value.length || !value.amount.is_finite() {
        return Err(Error::message(
            "Native calc must resolve to one finite px or rem length.",
        ));
    }

    Ok(value.amount)
}

/// Splits shorthand lengths while preserving spaces within calculations.
///
/// # Errors
///
/// Returns the TypeScript message for unbalanced or deeply nested parentheses.
pub fn parts(input: &str) -> Result<Vec<&str>> {
    let text = js::trim(input);
    let mut result = Vec::new();
    let mut depth: i32 = 0;
    let mut start = 0;

    for (index, character) in text.char_indices() {
        if character == '(' {
            depth += 1;
        }

        if character == ')' {
            depth -= 1;

            if depth < 0 {
                return Err(Error::message("Unbalanced native calculation."));
            }
        }

        if depth > 64 {
            return Err(Error::message(NESTING));
        }

        if depth == 0 && js::is_whitespace(character) {
            if index > start {
                result.push(text.get(start..index).unwrap_or_default());
            }

            start = index + character.len_utf8();
        }
    }

    if depth != 0 {
        return Err(Error::message("Unbalanced native calculation."));
    }

    if start < text.len() {
        result.push(text.get(start..).unwrap_or_default());
    }

    Ok(result)
}

/// Tokenizes like the sticky pattern
/// `\s*(?:(\d+(?:\.\d+)?|\.\d+)(?:[eE]([+-]?\d+))?(px|rem)?|(calc)|([()+*/-]))`, case-insensitively.
fn tokenize(input: &str, options: &Options) -> Result<(Vec<Token>, Vec<usize>)> {
    let end = input.trim_end_matches(js::is_whitespace).len();
    let mut tokens = Vec::new();
    let mut positions = Vec::new();
    let mut offset = 0;

    while offset < end {
        let rest = input.get(offset..).unwrap_or_default();
        let start = offset + (rest.len() - rest.trim_start_matches(js::is_whitespace).len());
        let body = input.get(start..).unwrap_or_default();
        let bytes = body.as_bytes();
        let (token, length) = if let Some((number, exponent, unit)) = number(bytes) {
            let text = body.get(..number).unwrap_or_default();
            let exponent = body.get(number..number + exponent).unwrap_or_default();
            let unit = body
                .get(number + exponent.len()..number + exponent.len() + unit)
                .unwrap_or_default();
            let scale = if unit.eq_ignore_ascii_case("rem") {
                options.units.rem
            } else if unit.eq_ignore_ascii_case("px") {
                Some(options.units.px.unwrap_or(1.0))
            } else {
                Some(1.0)
            };
            let Some(scale) = scale else {
                return Err(Error::message("Provide units.rem for rem lengths."));
            };
            // Rust parses both exponent letter cases, as `Number` does.
            let amount: f64 = body
                .get(..text.len() + exponent.len())
                .and_then(|number| number.parse().ok())
                .unwrap_or(f64::NAN);

            (
                Token::Value(Quantity {
                    amount: amount * scale,
                    length: !unit.is_empty(),
                }),
                number + exponent.len() + unit.len(),
            )
        } else if bytes
            .get(..4)
            .is_some_and(|prefix| prefix.eq_ignore_ascii_case(b"calc"))
        {
            (Token::Calc, 4)
        } else if let Some(operator @ (b'(' | b')' | b'+' | b'*' | b'/' | b'-')) = bytes.first() {
            (Token::Operator(*operator), 1)
        } else {
            return Err(Error::message(UNSUPPORTED));
        };

        positions.push(start);

        if positions.len() > 512 {
            return Err(Error::message("Native calc exceeds 512 tokens."));
        }

        tokens.push(token);
        offset = start + length;
    }

    Ok((tokens, positions))
}

/// Measures a number, its exponent, and its unit at the start of `bytes`.
fn number(bytes: &[u8]) -> Option<(usize, usize, usize)> {
    let digits = |from: usize| {
        bytes
            .get(from..)
            .unwrap_or_default()
            .iter()
            .take_while(|byte| byte.is_ascii_digit())
            .count()
    };
    let integer = digits(0);
    let length = if integer > 0 {
        let fraction = if bytes.get(integer) == Some(&b'.') {
            digits(integer + 1)
        } else {
            0
        };

        if fraction > 0 {
            integer + 1 + fraction
        } else {
            integer
        }
    } else if bytes.first() == Some(&b'.') && digits(1) > 0 {
        1 + digits(1)
    } else {
        return None;
    };
    let exponent = if matches!(bytes.get(length), Some(b'e' | b'E')) {
        let sign = usize::from(matches!(bytes.get(length + 1), Some(b'+' | b'-')));
        let count = digits(length + 1 + sign);

        if count > 0 { 1 + sign + count } else { 0 }
    } else {
        0
    };
    let after = bytes.get(length + exponent..).unwrap_or_default();
    let unit = if after
        .get(..2)
        .is_some_and(|unit| unit.eq_ignore_ascii_case(b"px"))
    {
        2
    } else if after
        .get(..3)
        .is_some_and(|unit| unit.eq_ignore_ascii_case(b"rem"))
    {
        3
    } else {
        0
    };

    Some((length, exponent, unit))
}

struct Parser<'a> {
    cursor: usize,
    depth: usize,
    input: &'a str,
    positions: &'a [usize],
    tokens: &'a [Token],
}

impl Parser<'_> {
    fn next(&mut self) -> Option<Token> {
        let token = self.tokens.get(self.cursor).copied();

        self.cursor += 1;
        token
    }

    fn atom(&mut self) -> Result<Quantity> {
        self.depth += 1;

        if self.depth > 64 {
            return Err(Error::message(NESTING));
        }

        let value = self.read_atom();

        self.depth -= 1;
        value
    }

    fn read_atom(&mut self) -> Result<Quantity> {
        match self.next() {
            Some(Token::Operator(operator @ (b'+' | b'-'))) => {
                let value = self.atom()?;

                Ok(Quantity {
                    amount: if operator == b'-' {
                        -value.amount
                    } else {
                        value.amount
                    },
                    ..value
                })
            }
            Some(token @ (Token::Calc | Token::Operator(b'('))) => {
                if matches!(token, Token::Calc)
                    && !matches!(self.next(), Some(Token::Operator(b'(')))
                {
                    return Err(Error::message(UNSUPPORTED));
                }

                let value = self.sum()?;

                if !matches!(self.next(), Some(Token::Operator(b')'))) {
                    return Err(Error::message(UNSUPPORTED));
                }

                Ok(value)
            }
            Some(Token::Value(value)) => Ok(value),
            _ => Err(Error::message(UNSUPPORTED)),
        }
    }

    fn peek_operator(&self, candidates: &[u8]) -> Option<u8> {
        match self.tokens.get(self.cursor) {
            Some(Token::Operator(operator)) if candidates.contains(operator) => Some(*operator),
            _ => None,
        }
    }

    fn product(&mut self) -> Result<Quantity> {
        let mut value = self.atom()?;

        while let Some(operator) = self.peek_operator(b"*/") {
            self.cursor += 1;

            let right = self.atom()?;

            if (operator == b'*' && value.length && right.length)
                || (operator == b'/' && (right.length || right.amount == 0.0))
            {
                return Err(Error::message(INCOMPATIBLE));
            }

            value = Quantity {
                amount: if operator == b'*' {
                    value.amount * right.amount
                } else {
                    value.amount / right.amount
                },
                length: value.length || right.length,
            };
        }

        Ok(value)
    }

    fn sum(&mut self) -> Result<Quantity> {
        let mut value = self.product()?;

        while let Some(operator) = self.peek_operator(b"+-") {
            let position = self.positions.get(self.cursor).copied().unwrap_or_default();
            let before = self
                .input
                .get(..position)
                .and_then(|text| text.chars().next_back());
            let after = self
                .input
                .get(position + 1..)
                .and_then(|text| text.chars().next());

            // Additive operators require surrounding whitespace, as in CSS.
            if !before.is_some_and(js::is_whitespace) || !after.is_some_and(js::is_whitespace) {
                return Err(Error::message(UNSUPPORTED));
            }

            self.cursor += 1;

            let right = self.product()?;

            if value.length != right.length {
                return Err(Error::message(INCOMPATIBLE));
            }

            value = Quantity {
                amount: if operator == b'+' {
                    value.amount + right.amount
                } else {
                    value.amount - right.amount
                },
                length: value.length,
            };
        }

        Ok(value)
    }
}
