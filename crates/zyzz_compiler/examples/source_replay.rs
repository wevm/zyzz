//! Replays compiler fixture cases and prints results in the TypeScript oracle's JSON shape.
//!
//! Usage: `cargo run --example source_replay -- cases.json > actual.json`, then compare with the
//! oracle's output for the same cases.

use std::sync::Arc;

use oxc_allocator::Allocator;
use serde_json::{Map, Value, json};
use zyzz_compiler::compiler::internal::{applications, names, relative, syntax};
use zyzz_compiler::compiler::source::Call;

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
        kind => json!({ "error": format!("unknown kind {kind:?}") }),
    }
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
