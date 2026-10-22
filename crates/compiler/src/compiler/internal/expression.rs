//! Reads literal expressions: TypeScript wrappers, templates, and interpolated references.

use std::sync::Arc;

use css::Lexer;
use oxc_ast::ast::{BinaryOperator, Expression, TemplateLiteral, UnaryOperator};
use oxc_semantic::Semantic;

use crate::compiler::internal::scope;
use crate::internal::binding::Domain;
use crate::internal::literal;
use crate::internal::token::{self, Part, Value};
use crate::js;

/// Matches a CSS value against a property grammar, as css-tree's `lexer.matchProperty` does.
///
/// Arguments are the CSS property name, such as `box-shadow`, and the value text. The matcher
/// returns whether the match reports no error, and `false` where css-tree would throw.
/// [`matcher`] supplies the css-tree grammar from `css`.
pub type Matcher<'m> = &'m dyn Fn(&str, &str) -> bool;

/// Returns the [`Matcher`] backed by the css-tree property grammar.
///
/// A lexer exception, such as a grammar referencing an unknown type, counts as a mismatch, as
/// the TypeScript `try`/`catch` around `lexer.matchProperty` does.
pub fn matcher() -> impl Fn(&str, &str) -> bool {
    |property, value| {
        Lexer::get()
            .match_property(property, value)
            .is_ok_and(|result| result.error.is_none())
    }
}

/// Removes a trailing ` !custom`, ` !important`, or both, like
/// `.replace(/(?: !custom)?(?: !important)?$/, '')`.
fn declaration_value(value: &str) -> &str {
    value
        .strip_suffix(" !custom !important")
        .or_else(|| value.strip_suffix(" !important"))
        .or_else(|| value.strip_suffix(" !custom"))
        .unwrap_or(value)
}

/// Checks color substitutions inside compound CSS values without widening direct reference
/// domains.
pub fn accepts_color(expression: &token::Expression, property: &str, matches: Matcher<'_>) -> bool {
    let mut value = String::new();

    for part in &expression.parts {
        match part {
            Part::Text(text) => value.push_str(text),
            Part::Binding(binding) if binding.domain == Domain::Color => {
                value.push_str("rgb(1 2 3)");
            }
            Part::Reference(reference) if reference.group == "color" => {
                value.push_str("rgb(1 2 3)");
            }
            _ => value.push_str("var(--zyzz-reference)"),
        }
    }

    matches(&literal::name(property), declaration_value(&value))
}

/// The text alternatives of a token value: every conditional branch, as `Object.values` lists
/// them.
fn alternatives(value: &Value, output: &mut Vec<String>) {
    match value {
        Value::Reference(reference) => alternatives(&reference.value, output),
        Value::Record(entries) => {
            for (_, entry) in entries.iter() {
                alternatives(entry, output);
            }
        }
        Value::Composition(expression) => {
            if let Some(group) = &expression.group {
                output.push(group.to_string());
            }

            for part in &expression.parts {
                match part {
                    Part::Text(text) => output.push(text.to_string()),
                    Part::Reference(reference) => alternatives(&reference.value, output),
                    Part::Binding(binding) => {
                        output.push(binding.name.clone());
                        output.push(binding.domain.as_str().to_owned());
                        output.push("true".to_owned());
                    }
                }
            }
        }
        Value::Number(number) => output.push(js::number(*number)),
        Value::String(text) => output.push(text.to_string()),
    }
}

/// Validates explicit variable substitutions in compound values, including every conditional
/// fallback.
pub fn accepts_variables(
    expression: &token::Expression,
    property: &str,
    matches: Matcher<'_>,
) -> bool {
    if !matches!(
        property,
        "filter" | "backdropFilter" | "boxShadow" | "textShadow"
    ) {
        return false;
    }

    let mut candidates = vec![String::new()];

    for part in &expression.parts {
        let options = match part {
            Part::Binding(_) => return false,
            Part::Text(text) => vec![text.to_string()],
            Part::Reference(reference) => {
                let mut output = Vec::new();

                alternatives(&reference.value, &mut output);
                output
            }
        };

        // Bound combinations of independent responsive variables before grammar checks.
        if candidates.len() * options.len() > 256 {
            return false;
        }

        candidates = candidates
            .iter()
            .flat_map(|prefix| options.iter().map(move |value| format!("{prefix}{value}")))
            .collect();
    }

    let name = literal::name(property);

    candidates
        .iter()
        .all(|value| matches(&name, declaration_value(value)))
}

/// Checks every identifier-token branch before its value becomes a CSS variable.
pub fn accepts_identifier(
    reference: &token::Reference,
    property: &str,
    matches: Matcher<'_>,
) -> bool {
    let name = literal::name(property);
    let mut values = Vec::new();

    alternatives(&reference.value, &mut values);

    values.iter().all(|value| matches(&name, value))
}

/// Whether an expression reads values without calls, getters, conversions, or rewritten names, so
/// moving or repeating it changes no result. A global name can be an accessor of the global object.
pub fn reorderable(
    expression: &Expression<'_>,
    semantic: &Semantic<'_>,
    rewritten: &dyn Fn(&str) -> bool,
) -> bool {
    match unwrap(expression) {
        Expression::BooleanLiteral(_)
        | Expression::NullLiteral(_)
        | Expression::NumericLiteral(_)
        | Expression::StringLiteral(_) => true,
        Expression::Identifier(identifier) => {
            !rewritten(identifier.name.as_str()) && scope::resolve(semantic, identifier).is_some()
        }
        Expression::ParenthesizedExpression(inner) => {
            reorderable(&inner.expression, semantic, rewritten)
        }
        Expression::UnaryExpression(unary) => {
            unary.operator == UnaryOperator::LogicalNot
                && reorderable(&unary.argument, semantic, rewritten)
        }
        Expression::BinaryExpression(binary) => {
            matches!(
                binary.operator,
                BinaryOperator::StrictEquality | BinaryOperator::StrictInequality
            ) && reorderable(&binary.left, semantic, rewritten)
                && reorderable(&binary.right, semantic, rewritten)
        }
        _ => false,
    }
}

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
    node: &'a TemplateLiteral<'a>,
    depth: usize,
    resolve: &mut dyn FnMut(&'a Expression<'a>, &str) -> Option<Part>,
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
                        parts.extend(expression.parts.iter().cloned());
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
