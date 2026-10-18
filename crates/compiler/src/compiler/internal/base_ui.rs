//! Resolves imported Base UI components and lowers their catalogued states to selectors.

use std::sync::{Arc, LazyLock};

use oxc_allocator::{Allocator, CloneIn, Vec as ArenaVec};
use oxc_ast::ast::{
    Expression, ImportDeclarationSpecifier, ObjectPropertyKind, PropertyKey, PropertyKind,
};
use oxc_ast::builder::AstBuilder;
use oxc_semantic::Semantic;
use oxc_span::{GetSpan, Span};
use rustc_hash::FxHashMap;
use serde_json::Value;

use crate::compiler::internal::{expression::unwrap, scope, statics::key_name};
use crate::error::{Error, Result};

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

/// Resolves only lexical imports and static member chains, never arbitrary component values.
pub(crate) fn component(semantic: &Semantic<'_>, node: &Expression<'_>) -> Result<&'static Value> {
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
    let import = binding
        .import
        .filter(|import| !import.import_kind.is_type())
        .ok_or_else(|| {
            invalid(
                "Base UI components must resolve to imports from @base-ui/react.",
                node.span(),
            )
        })?;
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
    let source = import.source.value.as_str();
    let found = catalog
        .get(path.join("."))
        .filter(|entry| source == "@base-ui/react" || entry["source"].as_str() == Some(source));

    found.ok_or_else(|| invalid("Unknown Base UI component import.", node.span()))
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
