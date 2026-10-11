//! Replays captured TypeScript native compiler calls through the Rust port and reports every
//! mismatch.
//!
//! The capture format is a temporary harness encoding, not the shared TypeScript to Rust wire
//! format: each JSON line holds a `kind`, an identity-preserving `input` graph, and the observed
//! `output`. Objects carry ids (`$o`, `$a`, `$token`, `$expr`, `$binding`, `$theme`) and later
//! occurrences refer back with `$ref`, so shared JavaScript objects decode into shared [`Arc`]s.
//! Numbers are `{"$n": String(value)}` with `-0` preserved, and `undefined` is `{"$u": 1}`.
//!
//! Captures come from temporarily instrumented TypeScript sources that wrap `StyleSheet.compile`,
//! `Variants.compile`, the scalar, color, calculation, token, and value helpers, and the
//! `JSON.stringify` calls of `Native.compile`. The instrumentation is scratch tooling and is not part
//! of the repository. Replace the decoder with the shared wire format once it exists.
//!
//! Usage: `cargo run -p zyzz_compiler --example native_replay -- <capture directory> [--verbose]`.

use std::collections::BTreeMap;
use std::sync::Arc;

use capture::{Decoder, Outcome, field, is_undefined, string, truncate};
use rustc_hash::FxHashMap;
use serde_json::Value as Json;
use zyzz_compiler::data::{Data, Object};
use zyzz_compiler::error::Error;
use zyzz_compiler::js;
use zyzz_compiler::react_native::internal::scalar::{self, Value as Scalar};
use zyzz_compiler::react_native::internal::{calculation, color, tokens, values};
use zyzz_compiler::react_native::style_sheet::{self, ColorScheme, Tables};
use zyzz_compiler::react_native::variants;
use zyzz_compiler::runtime::internal::native_media;
use zyzz_compiler::runtime::native;

#[path = "support/capture.rs"]
mod capture;

#[expect(
    clippy::disallowed_methods,
    clippy::print_stdout,
    reason = "The replay harness reads capture files and prints a report."
)]
fn main() {
    let Some(directory) = std::env::args().nth(1) else {
        println!("usage: native_replay <capture directory>");
        return;
    };
    let mut entries: Vec<_> = std::fs::read_dir(&directory)
        .map(|entries| {
            entries
                .filter_map(Result::ok)
                .map(|entry| entry.path())
                .collect()
        })
        .unwrap_or_default();

    entries.sort();

    let mut report: BTreeMap<String, Counts> = BTreeMap::new();
    let mut seen = rustc_hash::FxHashSet::default();
    let verbose = std::env::args().any(|argument| argument == "--verbose");

    for path in entries {
        let Ok(text) = std::fs::read_to_string(&path) else {
            continue;
        };

        for line in text.lines() {
            if !seen.insert(line.to_owned()) {
                continue;
            }

            let Ok(entry) = serde_json::from_str::<Json>(line) else {
                report.entry("unparsable".into()).or_default().skipped += 1;
                continue;
            };
            let kind = entry
                .get("kind")
                .and_then(Json::as_str)
                .unwrap_or("unknown")
                .to_owned();
            let counts = report.entry(kind.clone()).or_default();

            if entry.get("unencodable").is_some() || entry.get("input").is_none() {
                counts.skipped += 1;
                *counts.reasons.entry("unencodable".into()).or_default() += 1;
                continue;
            }

            match replay(&kind, &entry) {
                Ok(None) => counts.matched += 1,
                Ok(Some(mismatch)) => {
                    counts.mismatched += 1;

                    if counts.examples.len() < if verbose { 50 } else { 3 } {
                        counts.examples.push(format!(
                            "{mismatch}\n    input: {}",
                            truncate(&entry["input"].to_string(), 1500)
                        ));
                    }
                }
                Err(reason) => {
                    counts.skipped += 1;
                    *counts.reasons.entry(reason).or_default() += 1;
                }
            }
        }
    }

    let mut total = Counts::default();

    for (kind, counts) in &report {
        println!(
            "{kind}: {} matched, {} mismatched, {} skipped",
            counts.matched, counts.mismatched, counts.skipped
        );

        for (reason, count) in &counts.reasons {
            println!("    skipped {count}: {reason}");
        }

        for example in &counts.examples {
            println!("  MISMATCH {example}");
        }

        total.matched += counts.matched;
        total.mismatched += counts.mismatched;
        total.skipped += counts.skipped;
    }

    println!(
        "total: {} matched, {} mismatched, {} skipped",
        total.matched, total.mismatched, total.skipped
    );
}

#[derive(Default)]
struct Counts {
    examples: Vec<String>,
    matched: usize,
    mismatched: usize,
    reasons: BTreeMap<String, usize>,
    skipped: usize,
}

/// Replays one entry, returning a mismatch description.
fn replay(kind: &str, entry: &Json) -> Outcome<Option<String>> {
    let input = &entry["input"];
    let output = &entry["output"];
    let mut decoder = Decoder::new(input);
    let root = decoder.node(input);

    match kind {
        "StyleSheet.compile" => {
            let (definition, options) = decoder.stylesheet_options(root)?;
            let result = style_sheet::compile(&definition, &options);

            Ok(compare_tables(
                output,
                result.as_ref().map(|tables| (tables, None)),
            ))
        }
        "Variants.compile" => {
            let (recipe, options) = decoder.variants_options(root)?;
            let result = variants::compile(&recipe, &options);

            Ok(compare_tables(
                output,
                result.as_ref().map(|definition| {
                    let mut json = String::new();

                    definition.write_json(&mut json);
                    (&definition.styles, Some(json))
                }),
            ))
        }
        "Scalar.convert" => {
            let kind = decoder.kind(field(root, "kind")?)?;
            let value = decoder.scalar(field(root, "value")?)?;
            let options = decoder.scalar_options(field(root, "options")?)?;

            Ok(compare_scalar(
                output,
                scalar::convert(kind, &value, &options).map(Some),
            ))
        }
        "Scalar.length" => {
            let value = decoder.scalar(field(root, "value")?)?;
            let options = decoder.scalar_options(field(root, "options")?)?;
            let signed = field(root, "signed")?.as_bool().ok_or("signed")?;

            Ok(compare_scalar(
                output,
                scalar::length(&value, &options, signed).map(|value| Some(Scalar::Number(value))),
            ))
        }
        "Scalar.flex" => {
            let value = decoder.scalar(field(root, "value")?)?;
            let options = decoder.scalar_options(field(root, "options")?)?;
            let result = scalar::flex(&value, &options).map(|flex| {
                Data::from(Object::from_entries([
                    ("flexBasis".into(), flex.basis.to_data()),
                    ("flexGrow".into(), Data::Number(flex.grow)),
                    ("flexShrink".into(), Data::Number(flex.shrink)),
                ]))
            });

            Ok(compare_data(output, result))
        }
        "Calculation.length" => {
            let text = string(field(root, "input")?)?;
            let options = decoder.scalar_options(field(root, "options")?)?;

            Ok(compare_scalar(
                output,
                calculation::length(&text, &options).map(|value| Some(Scalar::Number(value))),
            ))
        }
        "Calculation.parts" => {
            let text = string(field(root, "input")?)?;
            let result = calculation::parts(&text)
                .map(|parts| Data::Array(Arc::new(parts.into_iter().map(Data::from).collect())));

            Ok(compare_data(output, result))
        }
        "Color.parse" => {
            let text = string(field(root, "input")?)?;
            let result = color::parse(&text).map(|color| Scalar::String(color.into()));

            Ok(compare_scalar(output, Ok(result)))
        }
        "Tokens.resolve" => {
            let value = decoder.style_value(field(root, "value")?)?;
            let options = decoder.scalar_options(field(root, "options")?)?;
            let scheme = field(root, "colorScheme")?
                .as_str()
                .and_then(ColorScheme::parse);
            let metadata = match decoder.node(field(root, "metadata")?) {
                node if is_undefined(node) => None,
                node => Some(decoder.metadata(node)?),
            };
            let before = field(root, "before")?.as_bool().ok_or("before")?;
            let mut resolution = tokens::Resolution {
                scheme_independent: before,
            };
            let result = tokens::resolve(
                &value,
                &tokens::Options {
                    color_scheme: scheme,
                    metadata: metadata.as_ref(),
                    scalar: &options,
                },
                &mut resolution,
            );

            Ok(compare_tokens(output, result, resolution))
        }
        "Values.parse" => {
            let data = decoder.data(field(root, "input")?)?;
            let result = values::parse(&data).map(Data::Object);

            Ok(compare_data(output, result))
        }
        "serialize.native" => {
            let options = native::Options {
                axes: decoder.axes(field(root, "axes")?)?,
                defaults: decoder.defaults(field(root, "defaults")?)?,
                styles: decoder.table(field(root, "styles")?)?,
            };

            Ok(compare_literal(output, &options.to_json()))
        }
        "serialize.static" => {
            let options = decoder.static_options(root)?;

            Ok(compare_literal(output, &options.to_json()))
        }
        "serialize.dynamic" => {
            let options = decoder.dynamic_options(root)?;

            Ok(compare_literal(output, &options.to_json()))
        }
        "serialize.vars" => {
            let options = decoder.vars_options(root)?;

            Ok(compare_literal(output, &options.to_json()))
        }
        "serialize.queries" => {
            let queries = decoder.queries(root)?;
            let mut json = String::new();

            native_media::write_queries(&mut json, &queries);
            Ok(compare_literal(output, &json))
        }
        _ => Err(format!("unknown kind {kind}")),
    }
}

fn compare_literal(output: &Json, actual: &str) -> Option<String> {
    let expected = output.as_str().unwrap_or_default();

    (expected != actual).then(|| format!("\n    expected: {expected}\n    actual:   {actual}"))
}

/// The error class name TypeScript reports for a Rust error.
fn error_name(error: &Error) -> &'static str {
    match error {
        Error::StyleSheet(_) => "StyleSheet.CompileError",
        Error::StyleSheetSelection(_) => "StyleSheet.SelectionError",
        Error::Variants(_) => "Variants.CompileError",
        Error::Message(_) => "Error",
        Error::Style(_) => "Style.InvalidError",
        _ => "Other",
    }
}

fn diagnostics_json(error: &Error) -> Json {
    match error {
        Error::StyleSheet(diagnostics) => Json::Array(
            diagnostics
                .iter()
                .map(|diagnostic| {
                    serde_json::json!({
                        "code": diagnostic.code.as_str(),
                        "message": diagnostic.message,
                        "path": diagnostic.path.iter().map(ToString::to_string).collect::<Vec<_>>(),
                    })
                })
                .collect(),
        ),
        _ => Json::Null,
    }
}

fn compare_error(output: &Json, error: &Error) -> Option<String> {
    let Some(expected) = output.get("error") else {
        return Some(format!(
            "\n    expected ok: {}\n    actual error: {} {}",
            truncate(&output.to_string(), 2000),
            error_name(error),
            error.text()
        ));
    };
    let name = expected["name"].as_str().unwrap_or_default();
    let message = expected["message"].as_str().unwrap_or_default();
    let diagnostics = &expected["diagnostics"];
    let actual_diagnostics = diagnostics_json(error);
    // Serialized text compares key order too.
    let expected_text = diagnostics.to_string();
    let actual_text = actual_diagnostics.to_string();
    let same_name =
        name == error_name(error) || (name == "TypeError" && error_name(error) == "Error");

    (!same_name
        || message != error.text()
        || (!diagnostics.is_null() && expected_text != actual_text))
    .then(|| {
        format!(
            "\n    expected: {name}: {message} {diagnostics}\n    actual:   {}: {} {actual_diagnostics}",
            error_name(error),
            error.text()
        )
    })
}

fn compare_tables(
    output: &Json,
    result: Result<(&Tables, Option<String>), &Error>,
) -> Option<String> {
    match result {
        Err(error) => compare_error(output, error),
        Ok((tables, definition)) => {
            let Some(expected) = output.get("ok") else {
                return Some(format!(
                    "\n    expected error: {}\n    actual ok",
                    output["error"]
                ));
            };
            let mut json = String::new();

            tables.write_json(&mut json);

            let shape = shape(tables);
            let mut problems = Vec::new();

            if expected["json"].as_str() != Some(json.as_str()) {
                problems.push(format!(
                    "json\n    expected: {}\n    actual:   {json}",
                    expected["json"].as_str().unwrap_or_default()
                ));
            }

            if expected["shape"].as_str() != Some(shape.as_str()) {
                problems.push(format!(
                    "shape\n    expected: {}\n    actual:   {shape}",
                    expected["shape"].as_str().unwrap_or_default()
                ));
            }

            if let Some(definition) = definition
                && expected["definition"].as_str() != Some(definition.as_str())
            {
                problems.push(format!(
                    "definition\n    expected: {}\n    actual:   {definition}",
                    expected["definition"].as_str().unwrap_or_default()
                ));
            }

            (!problems.is_empty()).then(|| problems.join("\n  "))
        }
    }
}

/// Encodes table and style identities in first-seen order, as the capture does.
fn shape(tables: &Tables) -> String {
    let mut ids: FxHashMap<usize, usize> = FxHashMap::default();
    let mut id = |pointer: usize| {
        let next = ids.len();

        *ids.entry(pointer).or_insert(next)
    };
    let mut sets = Vec::new();

    for (label, schemes) in &tables.sets {
        let light = id(Arc::as_ptr(&schemes.light) as usize);
        let dark = id(Arc::as_ptr(&schemes.dark) as usize);
        let mut styles = |table: &Object| {
            table
                .iter()
                .map(|(_, style)| match style {
                    Data::Object(style) => id(Arc::as_ptr(style) as usize),
                    _ => usize::MAX,
                })
                .collect::<Vec<_>>()
        };
        let light_styles = styles(&schemes.light);
        let dark_styles = styles(&schemes.dark);

        sets.push(serde_json::json!([
            &**label,
            light,
            dark,
            light_styles,
            dark_styles
        ]));
    }

    Json::Array(sets).to_string()
}

fn compare_scalar(output: &Json, result: Result<Option<Scalar>, Error>) -> Option<String> {
    compare_data(
        output,
        result.map(|value| value.map_or(Data::Undefined, |value| value.to_data())),
    )
}

fn compare_data(output: &Json, result: Result<Data, Error>) -> Option<String> {
    match result {
        Err(error) => compare_error(output, &error),
        Ok(actual) => {
            let Some(expected) = output.get("ok") else {
                return Some(format!(
                    "\n    expected error: {}\n    actual: {}",
                    output["error"],
                    describe(&actual)
                ));
            };
            let expected = match Decoder::new(expected).output_data(expected) {
                Ok(expected) => expected,
                Err(reason) => return Some(format!("undecodable output {reason}")),
            };

            (!same(&expected, &actual)).then(|| {
                format!(
                    "\n    expected: {}\n    actual:   {}",
                    describe(&expected),
                    describe(&actual)
                )
            })
        }
    }
}

fn compare_tokens(
    output: &Json,
    result: Result<Scalar, tokens::Error>,
    resolution: tokens::Resolution,
) -> Option<String> {
    match result {
        Err(error) => {
            let Some(expected) = output.get("error") else {
                return Some(format!(
                    "\n    expected ok: {}\n    actual error: {error:?}",
                    output["ok"]
                ));
            };
            let name = match error {
                tokens::Error::Unsupported(_) => "Tokens.UnsupportedError",
                tokens::Error::Message(_) => "Error",
            };

            (expected["name"].as_str() != Some(name)
                || expected["message"].as_str() != Some(error.message()))
            .then(|| {
                format!(
                    "\n    expected: {expected}\n    actual:   {name}: {}",
                    error.message()
                )
            })
        }
        Ok(value) => {
            let Some(expected) = output.get("ok") else {
                return Some(format!(
                    "\n    expected error: {}\n    actual: {value:?}",
                    output["error"]
                ));
            };
            let expected = match Decoder::new(expected).output_data(expected) {
                Ok(expected) => expected,
                Err(reason) => return Some(format!("undecodable output {reason}")),
            };
            let actual = Data::from(Object::from_entries([
                ("after".into(), Data::Bool(resolution.scheme_independent)),
                ("value".into(), value.to_data()),
            ]));

            (!same(&expected, &actual)).then(|| {
                format!(
                    "\n    expected: {}\n    actual:   {}",
                    describe(&expected),
                    describe(&actual)
                )
            })
        }
    }
}

/// Compares static data exactly: numbers by bits (with every `NaN` equal), objects in order.
fn same(left: &Data, right: &Data) -> bool {
    match (left, right) {
        (Data::Number(left), Data::Number(right)) => {
            left.to_bits() == right.to_bits() || (left.is_nan() && right.is_nan())
        }
        (Data::String(left), Data::String(right)) => left == right,
        (Data::Bool(left), Data::Bool(right)) => left == right,
        (Data::Null, Data::Null) | (Data::Undefined, Data::Undefined) => true,
        (Data::Array(left), Data::Array(right)) => {
            left.len() == right.len() && left.iter().zip(right.iter()).all(|(l, r)| same(l, r))
        }
        (Data::Object(left), Data::Object(right)) => {
            left.len() == right.len()
                && left
                    .iter()
                    .zip(right.iter())
                    .all(|((lk, lv), (rk, rv))| lk == rk && same(lv, rv))
        }
        _ => false,
    }
}

fn describe(value: &Data) -> String {
    match value {
        Data::Number(number) if *number == 0.0 && number.is_sign_negative() => "-0".to_owned(),
        Data::Number(number) => js::number(*number),
        Data::String(text) => js::quote(text),
        Data::Undefined => "undefined".to_owned(),
        Data::Array(items) => format!(
            "[{}]",
            items.iter().map(describe).collect::<Vec<_>>().join(",")
        ),
        Data::Object(object) => format!(
            "{{{}}}",
            object
                .iter()
                .map(|(key, value)| format!("{key}:{}", describe(value)))
                .collect::<Vec<_>>()
                .join(",")
        ),
        other => format!("{other:?}"),
    }
}
