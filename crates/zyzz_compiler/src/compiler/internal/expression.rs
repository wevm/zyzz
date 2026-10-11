//! Reads literal expressions: TypeScript wrappers, templates, and interpolated references.

use std::sync::Arc;

use oxc_ast::ast::{Expression, TemplateLiteral, UnaryOperator};

use crate::internal::token::{self, Part};
use crate::js;

/// Removes `as`, `satisfies`, non-null, and angle-bracket assertions.
pub fn unwrap<'b, 'a>(mut node: &'b Expression<'a>) -> &'b Expression<'a> {
    loop {
        node = match node {
            Expression::TSAsExpression(inner) => &inner.expression,
            Expression::TSSatisfiesExpression(inner) => &inner.expression,
            Expression::TSNonNullExpression(inner) => &inner.expression,
            Expression::TSTypeAssertion(inner) => &inner.expression,
            _ => return node,
        };
    }
}

/// The value of a template literal: text, or an expression when it interpolates references.
#[derive(Clone, Debug)]
pub enum Template {
    /// Interpolated text and references.
    Expression(Arc<token::Expression>),
    /// Plain text.
    Text(String),
}

/// Formats a literal like `String(value)`, or `None` for non-literals and non-finite numbers.
pub fn literal_text(node: &Expression<'_>) -> Option<String> {
    match node {
        Expression::StringLiteral(literal) => Some(literal.value.to_string()),
        Expression::NumericLiteral(literal) => {
            literal.value.is_finite().then(|| js::number(literal.value))
        }
        Expression::BooleanLiteral(literal) => Some(literal.value.to_string()),
        Expression::NullLiteral(_) => Some("null".to_owned()),
        Expression::BigIntLiteral(literal) => Some(literal.value.to_string()),
        _ => None,
    }
}

/// Evaluates a template literal whose expressions are literals, nested templates, or references.
///
/// `resolve` maps an interpolated expression and the CSS text before it to a reference part. A
/// reference must stand as a whole CSS token outside quotes and comments.
pub fn template<'a>(
    node: &TemplateLiteral<'a>,
    depth: usize,
    resolve: &mut dyn FnMut(&Expression<'a>, &str) -> Option<Part>,
    context: &str,
) -> Option<Template> {
    if depth >= 128 {
        return None;
    }

    let mut parts: Vec<Part> = Vec::new();
    let text = |parts: &[Part]| -> String {
        parts
            .iter()
            .map(|part| match part {
                Part::Text(text) => &**text,
                _ => "var(--zyzz-expression)",
            })
            .collect()
    };

    for (index, quasi) in node.quasis.iter().enumerate() {
        let cooked = quasi.value.cooked.as_ref()?;

        parts.push(Part::Text(Arc::from(cooked.as_str())));

        let Some(expression) = node.expressions.get(index) else {
            continue;
        };
        let value = unwrap(expression);
        let prefix = format!("{context}{}", text(&parts));
        let reference = resolve(expression, &prefix).or_else(|| resolve(value, &prefix));

        if let Some(reference) = reference {
            let strings: String = parts
                .iter()
                .filter_map(|part| match part {
                    Part::Text(text) => Some(&**text),
                    _ => None,
                })
                .collect();

            if quoted(&strings) {
                return None;
            }

            // var() substitutions must remain whole CSS tokens.
            let next = node
                .quasis
                .get(index + 1)
                .and_then(|next| next.value.cooked.as_ref())
                .and_then(|cooked| cooked.chars().next());
            let before = cooked.chars().last();

            if next.is_some_and(|character| {
                character == '%'
                    || character == '_'
                    || character == '.'
                    || character == '-'
                    || character.is_ascii_alphanumeric()
            }) || before.is_some_and(|character| {
                js::is_word(character) || matches!(character, '.' | '#' | '@' | '+' | '\\' | '-')
            }) {
                return None;
            }

            parts.push(reference);
            continue;
        }

        match value {
            Expression::TemplateLiteral(nested) => {
                match template(nested, depth + 1, resolve, &prefix)? {
                    Template::Text(text) => parts.push(Part::Text(text.into())),
                    Template::Expression(expression) => {
                        parts.extend(expression.parts.iter().cloned())
                    }
                }
            }
            Expression::UnaryExpression(unary) => {
                let argument = &unary.argument;

                let text = match (unary.operator, argument) {
                    (
                        UnaryOperator::UnaryNegation | UnaryOperator::UnaryPlus,
                        Expression::NumericLiteral(literal),
                    ) if literal.value.is_finite() => {
                        js::number(if unary.operator == UnaryOperator::UnaryNegation {
                            -literal.value
                        } else {
                            literal.value
                        })
                    }
                    (UnaryOperator::UnaryNegation, Expression::BigIntLiteral(literal)) => {
                        if literal.value.as_str() == "0" {
                            "0".to_owned()
                        } else {
                            format!("-{}", literal.value)
                        }
                    }
                    _ => return None,
                };

                parts.push(Part::Text(text.into()));
            }
            _ => parts.push(Part::Text(literal_text(value)?.into())),
        }
    }

    if parts.iter().all(|part| matches!(part, Part::Text(_))) {
        return Some(Template::Text(text(&parts)));
    }

    Some(Template::Expression(token::compose(parts)))
}

/// Whether text ends inside a quoted string or an unterminated comment.
fn quoted(text: &str) -> bool {
    let bytes = text.as_bytes();
    let mut characters = text.char_indices();
    let mut quote = None;

    while let Some((index, character)) = characters.next() {
        if character == '\\' {
            characters.next();
            continue;
        }

        if let Some(open) = quote {
            if character == open {
                quote = None;
            }
        } else if character == '"' || character == '\'' {
            quote = Some(character);
        } else if character == '/' && bytes.get(index + 1) == Some(&b'*') {
            let Some(end) = text
                .get(index + 2..)
                .and_then(|rest| rest.find("*/"))
                .map(|end| index + 2 + end)
            else {
                return true;
            };

            while characters
                .clone()
                .next()
                .is_some_and(|(next, _)| next <= end + 1)
            {
                characters.next();
            }
        }
    }

    quote.is_some()
}
