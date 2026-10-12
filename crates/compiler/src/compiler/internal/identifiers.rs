//! Decodes CSS identifier spellings at source and packed compiler boundaries.
//!
//! Lightning CSS decodes escapes and comments exactly as the TypeScript compiler's npm
//! `lightningcss` does, since both share one parser.

use lightningcss::properties::custom::{Token, TokenOrValue};
use lightningcss::rules::CssRule;
use lightningcss::stylesheet::{ParserOptions, StyleSheet};
use oxc_ast::ast::{CallExpression, Expression, ObjectPropertyKind, PropertyKey, PropertyKind};

use crate::error::{Error, Result};

/// The delimiter an identifier list uses.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Separator {
    /// Comma-separated identifiers.
    Comma,
    /// Whitespace-separated identifiers.
    Space,
}

/// Parses `@zyzz-tokens <value>;` and returns its prelude without whitespace and comments.
fn tokens<T>(value: &str, read: impl FnOnce(&[&TokenOrValue<'_>]) -> T) -> Option<T> {
    let code = format!("@zyzz-tokens {value};");
    let sheet = StyleSheet::parse(&code, ParserOptions::default()).ok()?;
    let [CssRule::Unknown(rule)] = sheet.rules.0.as_slice() else {
        return None;
    };

    if &*rule.name != "zyzz-tokens" || rule.block.is_some() {
        return None;
    }

    let prelude: Vec<&TokenOrValue<'_>> = rule
        .prelude
        .0
        .iter()
        .filter(|token| {
            !matches!(
                token,
                TokenOrValue::Token(Token::WhiteSpace(_) | Token::Comment(_))
            )
        })
        .collect();

    Some(read(&prelude))
}

/// Reads an entire CSS identifier list, including escaped delimiters and comments.
pub fn list(value: &str, separator: Separator) -> Option<Vec<String>> {
    tokens(value, |input| {
        let mut names = Vec::new();
        let mut need_name = true;

        for token in input {
            if matches!(token, TokenOrValue::Token(Token::Comma)) {
                if separator != Separator::Comma || need_name {
                    return None;
                }

                need_name = true;
                continue;
            }

            let name = match token {
                TokenOrValue::DashedIdent(name) => name.0.to_string(),
                TokenOrValue::Token(Token::Ident(name)) => name.to_string(),
                _ => return None,
            };

            if !need_name && separator == Separator::Comma {
                return None;
            }

            names.push(name);
            need_name = false;
        }

        (!need_name && !names.is_empty()).then_some(names)
    })
    .flatten()
}

/// Checks a complete CSS URL value without accepting an injected declaration.
pub fn url(value: &str) -> bool {
    tokens(value, |input| matches!(input, [TokenOrValue::Url(_)])).unwrap_or(false)
}

/// Matches `^(?:--|-?[_a-zA-Z])[\w-]*$`.
fn plain(value: &str) -> bool {
    let bytes = value.as_bytes();
    let body = if value.starts_with("--") {
        2
    } else {
        let sign = usize::from(bytes.first() == Some(&b'-'));

        match bytes.get(sign) {
            Some(byte) if byte.is_ascii_alphabetic() || *byte == b'_' => sign + 1,
            _ => return false,
        }
    };

    bytes
        .get(body..)
        .unwrap_or_default()
        .iter()
        .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'-'))
}

/// Returns the identifier token value, or `None` for malformed input.
pub fn read(value: &str) -> Option<String> {
    if plain(value) {
        return Some(value.to_owned());
    }

    let code = format!("@namespace {value}\n\"urn:zyzz:identifier\";");
    let sheet = StyleSheet::parse(&code, ParserOptions::default()).ok()?;
    let [CssRule::Namespace(rule)] = sheet.rules.0.as_slice() else {
        return None;
    };

    if &*rule.url != "urn:zyzz:identifier" {
        return None;
    }

    rule.prefix.as_ref().map(|prefix| prefix.0.to_string())
}

/// Reads an explicit authoring identity shared with uncompiled execution.
///
/// `index` selects the options argument. Returns `None` when the argument is absent.
///
/// # Errors
///
/// Returns a plain error when the options are not one nonempty literal `id`.
pub fn explicit(call: &CallExpression<'_>, index: usize) -> Result<Option<String>> {
    let Some(argument) = call.arguments.get(index) else {
        return Ok(None);
    };
    let Some(Expression::ObjectExpression(object)) = argument.as_expression() else {
        return Err(Error::message("Definition options require one literal id."));
    };
    let [property] = object.properties.as_slice() else {
        return Err(Error::message("Definition options require one literal id."));
    };
    let ObjectPropertyKind::ObjectProperty(property) = property else {
        return Err(nonempty());
    };
    let key = match &property.key {
        PropertyKey::StaticIdentifier(identifier) => Some(identifier.name.as_str()),
        PropertyKey::StringLiteral(literal) => Some(literal.value.as_str()),
        _ => None,
    };

    match &property.value {
        Expression::StringLiteral(literal)
            if !property.computed
                && property.kind == PropertyKind::Init
                && !property.method
                && key == Some("id")
                && !literal.value.is_empty() =>
        {
            Ok(Some(literal.value.to_string()))
        }
        _ => Err(nonempty()),
    }
}

#[cold]
fn nonempty() -> Error {
    Error::message("Definition options require one nonempty literal id.")
}
