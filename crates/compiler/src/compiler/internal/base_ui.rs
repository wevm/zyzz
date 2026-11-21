//! Resolves imported Base UI components and declared parts, and lowers their states to
//! selectors.

use std::borrow::Cow;
use std::sync::{Arc, LazyLock};

use oxc_allocator::{Allocator, CloneIn, Vec as ArenaVec};
use oxc_ast::ast::{
    Argument, ArrayExpressionElement, Expression, ImportDeclarationSpecifier, ObjectPropertyKind,
    PropertyKey, PropertyKind,
};
use oxc_ast::builder::AstBuilder;
use oxc_semantic::Semantic;
use oxc_span::{GetSpan, Span};
use rustc_hash::FxHashMap;
use serde_json::{Map, Value};

use crate::compiler::internal::{expression::unwrap, scope, statics::key_name};
use crate::error::{Error, Result};
use crate::js::Record;

// Immutable generated definitions are shared, never per-module compiler state.
static CATALOG: LazyLock<serde_json::Result<Value>> =
    LazyLock::new(|| serde_json::from_str(include_str!("../../generated/base_ui.json")));

#[cold]
fn invalid(message: impl Into<String>, span: Span) -> Error {
    Error::Themes {
        message: message.into(),
        span,
    }
}

/// Whether a state name is camelCase ASCII, so its kebab-case attribute is a valid name.
fn state_name(name: &str) -> bool {
    let mut bytes = name.bytes();

    bytes.next().is_some_and(|byte| byte.is_ascii_lowercase())
        && bytes.all(|byte| byte.is_ascii_alphanumeric())
}

/// Whether a state is `"boolean"` or a nonempty list of values, as `part` validates it.
fn valid_state(name: &str, domain: &Value) -> bool {
    state_name(name)
        && match domain {
            Value::String(kind) => kind == "boolean",
            Value::Array(values) => {
                !values.is_empty()
                    && values
                        .iter()
                        .all(|value| value.as_str().is_some_and(|value| !value.contains('\0')))
            }
            _ => false,
        }
}

/// Whether a library contract's part descriptor is valid.
pub(crate) fn valid(text: &str) -> bool {
    serde_json::from_str::<Value>(text).is_ok_and(|value| {
        value.as_object().is_some_and(|states| {
            states
                .iter()
                .all(|(name, domain)| valid_state(name, domain))
        })
    })
}

/// Reads the descriptor of a `part(component, states)` call imported from
/// `zyzz/base-ui/react` as JSON. Returns `None` for any other expression.
pub(crate) fn declaration(
    semantic: &Semantic<'_>,
    node: &Expression<'_>,
) -> Option<Result<Arc<str>>> {
    let Expression::CallExpression(call) = unwrap(node) else {
        return None;
    };
    let Expression::Identifier(callee) = unwrap(&call.callee) else {
        return None;
    };
    let binding = scope::resolve(semantic, callee)?;
    let import = binding
        .import
        .filter(|import| import.source.value == "zyzz/base-ui/react")?;
    let specifier = import
        .specifiers
        .iter()
        .flatten()
        .find(|entry| entry.span().start == binding.start())?;

    if !matches!(
        specifier,
        ImportDeclarationSpecifier::ImportSpecifier(named)
            if !named.import_kind.is_type() && named.imported.name() == "part"
    ) {
        return None;
    }

    let fail = || invalid("Part states require a static object.", call.span);
    let Some(Expression::ObjectExpression(states)) = call
        .arguments
        .get(1)
        .and_then(Argument::as_expression)
        .map(unwrap)
    else {
        return Some(Err(fail()));
    };
    let mut output = Map::new();

    for state in &states.properties {
        let ObjectPropertyKind::ObjectProperty(state) = state else {
            return Some(Err(fail()));
        };
        let Some(name) = key_name(state)
            .filter(|_| state.kind == PropertyKind::Init && !state.method && !state.shorthand)
        else {
            return Some(Err(fail()));
        };
        let domain = match unwrap(&state.value) {
            Expression::StringLiteral(kind) => Value::String(kind.value.to_string()),
            Expression::ArrayExpression(values) => Value::Array(
                values
                    .elements
                    .iter()
                    .map(|value| match value {
                        ArrayExpressionElement::StringLiteral(value) => {
                            Value::String(value.value.to_string())
                        }
                        _ => Value::Null,
                    })
                    .collect(),
            ),
            _ => Value::Null,
        };

        if !valid_state(&name, &domain) {
            return Some(Err(invalid(
                format!("Invalid part state: {name}."),
                state.span,
            )));
        }

        output.insert(name.into_owned(), domain);
    }

    Some(Ok(Arc::from(Value::Object(output).to_string())))
}

/// Builds the catalog entry [`lower`] reads from descriptor JSON. Each camelCase name maps to
/// its kebab-case `data-*` attribute, as Base UI spells attributes.
fn entry(text: &str, span: Span) -> Result<Value> {
    let Ok(Value::Object(states)) = serde_json::from_str::<Value>(text) else {
        return Err(invalid("Invalid part states.", span));
    };
    let mut output = Map::new();

    for (name, domain) in states {
        let mut attribute = String::with_capacity(name.len() + 8);

        attribute.push_str("data-");

        for character in name.chars() {
            if character.is_ascii_uppercase() {
                attribute.push('-');
            }

            attribute.push(character.to_ascii_lowercase());
        }

        let values = if domain.is_array() {
            domain
        } else {
            Value::Null
        };

        output.insert(
            name,
            serde_json::json!({ "attribute": attribute, "values": values }),
        );
    }

    Ok(serde_json::json!({ "states": output }))
}

/// Resolves only lexical imports and static member chains, never arbitrary component values.
///
/// A part declared in the same module resolves through its `part` call. A part imported from
/// another module resolves through `parts`, keyed by local name and member path.
pub(crate) fn component(
    semantic: &Semantic<'_>,
    node: &Expression<'_>,
    parts: &Record<Arc<str>>,
) -> Result<Cow<'static, Value>> {
    let mut current = unwrap(node);
    let mut path = Vec::new();

    while let Expression::StaticMemberExpression(member) = current {
        if member.optional {
            return Err(invalid(
                "Base UI components require non-optional static import references.",
                node.span(),
            ));
        }

        path.push(member.property.name.as_str());
        current = unwrap(&member.object);
    }

    let Expression::Identifier(identifier) = current else {
        return Err(invalid(
            "Base UI components must resolve to imports from @base-ui/react.",
            node.span(),
        ));
    };
    let binding = scope::resolve(semantic, identifier).ok_or_else(|| {
        invalid(
            "Base UI components must resolve to imports from @base-ui/react.",
            node.span(),
        )
    })?;

    if path.is_empty()
        && let Some(init) = binding
            .declarator
            .filter(|_| binding.kind == scope::Kind::Variable)
            .and_then(|declarator| declarator.init.as_ref())
        && let Some(states) = declaration(semantic, init)
    {
        return entry(&states?, node.span()).map(Cow::Owned);
    }

    let import = binding
        .import
        .filter(|import| !import.import_kind.is_type())
        .ok_or_else(|| {
            invalid(
                "Base UI components must resolve to imports from @base-ui/react.",
                node.span(),
            )
        })?;
    let source = import.source.value.as_str();

    if source != "@base-ui/react" && !source.starts_with("@base-ui/react/") {
        let mut key = identifier.name.to_string();

        for member in path.iter().rev() {
            key.push('.');
            key.push_str(member);
        }

        return match parts.get(&key) {
            Some(states) => entry(states, node.span()).map(Cow::Owned),
            None => Err(invalid(
                "Components outside Base UI must declare their states with part().",
                node.span(),
            )),
        };
    }

    let specifier = import
        .specifiers
        .iter()
        .flatten()
        .find(|entry| entry.span().start == binding.start());

    match specifier {
        Some(ImportDeclarationSpecifier::ImportSpecifier(named))
            if !named.import_kind.is_type() =>
        {
            path.push(named.imported.name().as_str());
        }
        Some(ImportDeclarationSpecifier::ImportNamespaceSpecifier(_)) => {}
        _ => {
            return Err(invalid(
                "Unsupported Base UI component import.",
                node.span(),
            ));
        }
    }

    path.reverse();

    let catalog = CATALOG
        .as_ref()
        .map_err(|_| invalid("Invalid generated Base UI catalog.", node.span()))?;
    let found = catalog
        .get(path.join("."))
        .filter(|entry| source == "@base-ui/react" || entry["source"].as_str() == Some(source));

    found
        .map(Cow::Borrowed)
        .ok_or_else(|| invalid("Unknown Base UI component import.", node.span()))
}

fn property<'a>(
    allocator: &'a Allocator,
    span: Span,
    key: &str,
    value: Expression<'a>,
) -> ObjectPropertyKind<'a> {
    let builder = AstBuilder::new(allocator);
    let key = PropertyKey::new_string_literal(span, allocator.alloc_str(key), None, &builder);

    ObjectPropertyKind::new_object_property(
        span,
        PropertyKind::Init,
        key,
        value,
        false,
        false,
        false,
        &builder,
    )
}

fn object<'a>(
    allocator: &'a Allocator,
    span: Span,
    properties: ArenaVec<'a, ObjectPropertyKind<'a>>,
) -> Expression<'a> {
    Expression::new_object_expression(span, properties, &AstBuilder::new(allocator))
}

/// Expands each state separately so repeated selectors retain their authored positions.
pub(crate) fn lower<'a>(
    allocator: &'a Allocator,
    node: &Expression<'a>,
    component: &Value,
    conditions: &mut FxHashMap<u32, Arc<str>>,
    depth: u32,
) -> Result<Expression<'a>> {
    if depth > 64 {
        return Err(invalid(
            "Base UI style nesting exceeds 64 levels.",
            node.span(),
        ));
    }

    let Expression::ObjectExpression(body) = unwrap(node) else {
        return Err(invalid(
            "Base UI component styles require static object bodies.",
            node.span(),
        ));
    };
    let mut properties = ArenaVec::new_in(&allocator);

    for entry in &body.properties {
        let ObjectPropertyKind::ObjectProperty(entry) = entry else {
            return Err(invalid(
                "Base UI component styles require static object properties.",
                entry.span(),
            ));
        };
        let key = key_name(entry).unwrap_or_default();

        if key != "states" {
            let mut cloned = entry.clone_in_with_semantic_ids(allocator);

            if key == "selectors"
                && let Expression::ObjectExpression(selectors) = unwrap(&entry.value)
            {
                let mut entries = ArenaVec::new_in(&allocator);

                for selector in &selectors.properties {
                    let ObjectPropertyKind::ObjectProperty(selector) = selector else {
                        return Err(invalid(
                            "Selectors require static properties.",
                            selector.span(),
                        ));
                    };
                    let mut selector = selector.clone_in_with_semantic_ids(allocator);
                    selector.value =
                        lower(allocator, &selector.value, component, conditions, depth + 1)?;
                    entries.push(ObjectPropertyKind::ObjectProperty(selector));
                }

                cloned.value = object(allocator, selectors.span, entries);
            } else if key != "vars"
                && matches!(unwrap(&entry.value), Expression::ObjectExpression(_))
            {
                cloned.value = lower(allocator, &entry.value, component, conditions, depth + 1)?;
            }

            properties.push(ObjectPropertyKind::ObjectProperty(cloned));
            continue;
        }

        let Expression::ObjectExpression(states) = unwrap(&entry.value) else {
            return Err(invalid(
                "Base UI states require a static object.",
                entry.value.span(),
            ));
        };

        if entry.kind != PropertyKind::Init || entry.method || entry.shorthand {
            return Err(invalid(
                "Base UI states require static properties.",
                entry.span,
            ));
        }

        for state in &states.properties {
            let ObjectPropertyKind::ObjectProperty(state) = state else {
                return Err(invalid(
                    "Base UI states require static properties.",
                    state.span(),
                ));
            };

            if state.kind != PropertyKind::Init || state.method || state.shorthand {
                return Err(invalid(
                    "Base UI states require static properties.",
                    state.span,
                ));
            }

            let name = key_name(state)
                .ok_or_else(|| invalid("Base UI states require static names.", state.span))?;
            let definition = component["states"]
                .get(name.as_ref())
                .ok_or_else(|| invalid(format!("Unknown Base UI state: {name}."), state.span))?;
            let attribute = definition["attribute"]
                .as_str()
                .ok_or_else(|| invalid("Invalid Base UI state attribute.", state.span))?;

            if definition["values"].is_null() {
                let selector = definition["selector"]
                    .as_str()
                    .map_or_else(|| format!("&[{attribute}]"), str::to_owned);

                conditions.insert(state.span.start, Arc::from(selector.as_str()));
                properties.push(property(
                    allocator,
                    state.span,
                    &selector,
                    lower(allocator, &state.value, component, conditions, depth + 1)?,
                ));
            } else {
                let Expression::ObjectExpression(choices) = unwrap(&state.value) else {
                    return Err(invalid(
                        "Valued Base UI states require a static value map.",
                        state.value.span(),
                    ));
                };

                for choice in &choices.properties {
                    let ObjectPropertyKind::ObjectProperty(choice) = choice else {
                        return Err(invalid(
                            "Base UI state values require static properties.",
                            choice.span(),
                        ));
                    };

                    if choice.kind != PropertyKind::Init || choice.method || choice.shorthand {
                        return Err(invalid(
                            "Base UI state values require static properties.",
                            choice.span,
                        ));
                    }

                    let value = key_name(choice).ok_or_else(|| {
                        invalid("Base UI state values require static keys.", choice.span)
                    })?;

                    let valid = match definition["values"].as_str() {
                        Some("string") => true,
                        Some("number") => {
                            let number = crate::js::to_number(&value);
                            number.is_finite() && crate::js::number(number) == value
                        }
                        _ => definition["values"].as_array().is_some_and(|values| {
                            values
                                .iter()
                                .any(|entry| entry.as_str() == Some(value.as_ref()))
                        }),
                    };

                    if !valid {
                        return Err(invalid(
                            format!("Unknown Base UI state value: {name}.{value}."),
                            choice.span,
                        ));
                    }

                    if value.contains('\0') {
                        return Err(invalid(
                            "Base UI state values cannot contain NUL.",
                            choice.span,
                        ));
                    }

                    let selector = format!("&[{attribute}={}]", css::string::encode(&value, false));

                    conditions.insert(choice.span.start, Arc::from(selector.as_str()));
                    properties.push(property(
                        allocator,
                        choice.span,
                        &selector,
                        lower(allocator, &choice.value, component, conditions, depth + 1)?,
                    ));
                }
            }
        }
    }

    Ok(object(allocator, body.span, properties))
}
