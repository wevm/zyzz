//! Replays compiler fixture cases and prints results in the TypeScript oracle's JSON shape.
//!
//! Usage: `cargo run --example source_replay -- cases.json > actual.json`, then compare with the
//! oracle's output for the same cases.

use std::sync::Arc;

use oxc_allocator::Allocator;
use oxc_ast::AstKind;
use oxc_ast::ast::{Expression, ObjectExpression, ObjectPropertyKind, PropertyKey};
use oxc_span::GetSpan;
use rustc_hash::FxHashSet;
use serde_json::{Map, Value, json};
use zyzz_compiler::compiler::internal::recipe_payloads::{self, Payloads};
use zyzz_compiler::compiler::internal::{applications, names, recipes, relative, statics, syntax};
use zyzz_compiler::compiler::source::Call;
use zyzz_compiler::runtime::recipe as runtime;

fn calls<'a>(case: &Value) -> Vec<Call<'a>> {
    case["calls"]
        .as_array()
        .map(|calls| {
            calls
                .iter()
                .map(|call| Call {
                    end: call["end"]
                        .as_u64()
                        .and_then(|end| u32::try_from(end).ok())
                        .unwrap_or_default(),
                    name: Arc::from(call["name"].as_str().unwrap_or_default()),
                    recipe: call["recipe"].as_bool().filter(|recipe| *recipe).map(|_| {
                        zyzz_compiler::runtime::recipe::Definition {
                            axes: zyzz_compiler::js::Record::new(),
                            conditions: None,
                            default_payloads: None,
                            defaults: zyzz_compiler::js::Record::new(),
                            payloads: None,
                        }
                    }),
                    start: call["start"]
                        .as_u64()
                        .and_then(|start| u32::try_from(start).ok())
                        .unwrap_or_default(),
                    ..Call::default()
                })
                .collect()
        })
        .unwrap_or_default()
}

fn replay(case: &Value) -> Value {
    let source = case["source"].as_str().unwrap_or_default();
    let module_id = case["moduleId"].as_str().unwrap_or("m.tsx");

    match case["kind"].as_str() {
        Some("names") => {
            let allocator = Allocator::default();
            let parsed = syntax::parse(&allocator, source, module_id);
            let mut names: Vec<(u32, String)> =
                names::collect(parsed.program).into_iter().collect();

            names.sort_unstable();

            Value::Object(
                names
                    .into_iter()
                    .map(|(start, name)| (start.to_string(), Value::String(name)))
                    .collect(),
            )
        }
        Some("relative") => {
            let modules: Vec<&str> = case["modules"]
                .as_array()
                .map(|modules| modules.iter().filter_map(Value::as_str).collect())
                .unwrap_or_default();
            let specifier = case["specifier"].as_str().unwrap_or_default();

            match relative::resolve(module_id, specifier, |path| modules.contains(&path)) {
                Ok(path) => path.map_or(Value::Null, Value::String),
                Err(error) => json!({ "error": error.text() }),
            }
        }
        Some("applications") => {
            let allocator = Allocator::default();
            let parsed = syntax::parse(&allocator, source, module_id);
            let calls = calls(case);
            let Some(applications) = applications::create(
                parsed.program,
                &parsed.semantic,
                &calls,
                applications::Options::default(),
            ) else {
                return Value::Null;
            };
            let mut dead: Vec<String> = applications
                .dead()
                .iter()
                .map(ToString::to_string)
                .collect();

            dead.sort();

            let definitions = applications.definitions();
            let values: Map<String, Value> = definitions
                .values
                .iter()
                .map(|(name, value)| (name.to_string(), Value::Bool(*value)))
                .collect();
            let namespaces: Vec<Value> = definitions
                .namespaces
                .iter()
                .map(|namespace| {
                    let ends: Map<String, Value> = namespace
                        .ends
                        .iter()
                        .map(|(name, end)| (name.to_string(), json!(end)))
                        .collect();

                    json!({ "ends": ends, "start": namespace.start })
                })
                .collect();
            let find: Vec<Value> = applications
                .find()
                .iter()
                .map(|application| {
                    json!({
                        "calleeEnd": application.callee_end,
                        "end": application.end,
                        "initialized": application.initialized,
                        "name": &*application.name,
                        "start": application.start,
                        "terminal": application.terminal,
                    })
                })
                .collect();

            json!({ "dead": dead, "definitions": { "namespaces": namespaces, "values": values }, "find": find })
        }
        Some("recipes") => recipe(source, module_id),
        kind => json!({ "error": format!("unknown kind {kind:?}") }),
    }
}

fn estree(node: &Expression<'_>) -> &'static str {
    match node {
        Expression::StringLiteral(_)
        | Expression::NumericLiteral(_)
        | Expression::BooleanLiteral(_)
        | Expression::NullLiteral(_) => "Literal",
        Expression::Identifier(_) => "Identifier",
        Expression::StaticMemberExpression(_) | Expression::ComputedMemberExpression(_) => {
            "MemberExpression"
        }
        Expression::TemplateLiteral(_) => "TemplateLiteral",
        Expression::CallExpression(_) => "CallExpression",
        Expression::ArrowFunctionExpression(_) => "ArrowFunctionExpression",
        Expression::UnaryExpression(_) => "UnaryExpression",
        Expression::ArrayExpression(_) => "ArrayExpression",
        _ => "Other",
    }
}

fn value(node: &Expression<'_>, bindings: &Payloads<'_, '_>) -> Value {
    if let Some(slot) = bindings.resolve(node) {
        return Value::String(format!("slot:{}", slot.name));
    }

    match node {
        Expression::ObjectExpression(object) => properties(object, bindings),
        node => json!([estree(node), node.span().start, node.span().end]),
    }
}

fn properties(node: &ObjectExpression<'_>, bindings: &Payloads<'_, '_>) -> Value {
    Value::Array(
        node.properties
            .iter()
            .map(|property| match property {
                ObjectPropertyKind::ObjectProperty(property) => {
                    let key = match &property.key {
                        PropertyKey::StaticIdentifier(identifier) => identifier.name.to_string(),
                        key => statics::key_literal(key).unwrap_or_default(),
                    };

                    json!([
                        key,
                        property.span.start,
                        property.span.end,
                        value(&property.value, bindings)
                    ])
                }
                ObjectPropertyKind::SpreadProperty(spread) => {
                    json!(["spread", spread.span.start, spread.span.end])
                }
            })
            .collect(),
    )
}

fn scalar(value: &runtime::Scalar) -> Value {
    match value {
        runtime::Scalar::Number(number) => json!(number),
        runtime::Scalar::String(text) => json!(&**text),
    }
}

fn recipe(source: &str, module_id: &str) -> Value {
    let allocator = Allocator::default();
    let parsed = syntax::parse(&allocator, source, module_id);
    let statics = statics::collect(
        &allocator,
        parsed.program,
        &parsed.semantic,
        rustc_hash::FxHashMap::default(),
    );
    let Some(call) = parsed.semantic.nodes().iter().find_map(|node| match node.kind() {
        AstKind::CallExpression(call)
            if matches!(&call.callee, Expression::Identifier(callee) if callee.name == "variants") =>
        {
            Some(call)
        }
        _ => None,
    }) else {
        return json!({ "error": "no variants call" });
    };
    let allowed: FxHashSet<u32> = std::iter::once(call.span.start).collect();
    let opaque = FxHashSet::default();
    let Some(argument) = call
        .arguments
        .first()
        .and_then(|argument| argument.as_expression())
    else {
        return json!({ "error": "no argument" });
    };
    let expanded = statics
        .normalize(argument, &allowed, &opaque, false)
        .and_then(|argument| {
            recipes::expand(
                argument,
                recipes::Options {
                    identity: "id",
                    payloads: recipe_payloads::Options {
                        allocator: &allocator,
                        allowed: &allowed,
                        opaque: &opaque,
                        statics: &statics,
                    },
                    queries: None,
                    source,
                },
            )
        });
    let expanded = match expanded {
        Ok(expanded) => expanded,
        Err(error) => return json!({ "error": error.text() }),
    };
    let bindings = &expanded.bindings;
    let definition = &expanded.recipe;
    let mut recipe = Map::new();

    recipe.insert(
        "axes".to_owned(),
        Value::Object(
            definition
                .axes
                .iter()
                .map(|(axis, choices)| {
                    (
                        axis.to_string(),
                        json!(choices.iter().map(|choice| &**choice).collect::<Vec<_>>()),
                    )
                })
                .collect(),
        ),
    );
    recipe.insert(
        "defaults".to_owned(),
        Value::Object(
            definition
                .defaults
                .iter()
                .map(|(axis, choice)| {
                    (
                        axis.to_string(),
                        choice
                            .as_deref()
                            .map_or(Value::Null, |choice| json!(choice)),
                    )
                })
                .collect(),
        ),
    );

    if let Some(payloads) = &definition.payloads {
        recipe.insert(
            "payloads".to_owned(),
            Value::Array(
                payloads
                    .iter()
                    .map(|payload| {
                        json!({
                            "axis": &*payload.axis,
                            "choice": &*payload.choice,
                            "slots": payload.slots.iter().map(|slots| Value::Object(slots.iter().map(|(field, slot)| (field.to_string(), json!(&**slot))).collect())).collect::<Vec<_>>(),
                        })
                    })
                    .collect(),
            ),
        );
        recipe.insert(
            "defaultPayloads".to_owned(),
            Value::Object(
                definition
                    .default_payloads
                    .iter()
                    .flat_map(zyzz_compiler::js::Record::iter)
                    .map(|(axis, values)| {
                        (
                            axis.to_string(),
                            Value::Object(
                                values
                                    .iter()
                                    .map(|(field, value)| (field.to_string(), scalar(value)))
                                    .collect(),
                            ),
                        )
                    })
                    .collect(),
            ),
        );
    }

    if let Some(conditions) = &definition.conditions {
        recipe.insert(
            "conditions".to_owned(),
            json!(
                conditions
                    .iter()
                    .map(|condition| &**condition)
                    .collect::<Vec<_>>()
            ),
        );
    }

    let alternatives = expanded
        .static_recipe
        .as_ref()
        .or(expanded.dynamic_recipe.as_ref());
    let kind = if expanded.static_recipe.is_some() {
        "static"
    } else if expanded.dynamic_recipe.is_some() {
        "dynamic"
    } else {
        "none"
    };
    let rules = alternatives.map(|alternatives| {
        alternatives
            .rules
            .iter()
            .map(|rule| {
                let matches: Vec<Value> = rule
                    .matches
                    .iter()
                    .map(|(axis, choices)| {
                        json!([
                            &**axis,
                            choices.iter().map(|choice| &**choice).collect::<Vec<_>>()
                        ])
                    })
                    .collect();

                json!([
                    matches,
                    rule.value.span.start,
                    rule.value.span.end,
                    properties(rule.value, bindings)
                ])
            })
            .collect::<Vec<_>>()
    });
    let types: Map<String, Value> = expanded
        .types
        .iter()
        .map(|(axis, choices)| {
            (
                axis.to_string(),
                Value::Object(
                    choices
                        .iter()
                        .map(|(choice, text)| (choice.to_string(), json!(&**text)))
                        .collect(),
                ),
            )
        })
        .collect();
    let mut slots: Vec<&str> = bindings.slots.keys().map(|slot| &**slot).collect();

    slots.sort_unstable();

    json!({
        "body": [expanded.body.span.start, expanded.body.span.end, properties(expanded.body, bindings)],
        "kind": kind,
        "recipe": recipe,
        "rules": rules,
        "slots": slots,
        "types": types,
    })
}

#[expect(
    clippy::disallowed_methods,
    clippy::print_stdout,
    reason = "The replay harness reads a case file and prints results."
)]
fn main() {
    let Some(path) = std::env::args().nth(1) else {
        println!("usage: source_replay <cases.json>");
        return;
    };
    let text = std::fs::read_to_string(path).unwrap_or_default();
    let cases: Vec<Value> = serde_json::from_str(&text).unwrap_or_default();
    let results: Vec<Value> = cases.iter().map(replay).collect();

    println!(
        "{}",
        serde_json::to_string_pretty(&results).unwrap_or_default()
    );
}
