//! Replays captured TypeScript `Native.compile` calls through the Rust port and reports every
//! mismatch in rewritten code, source maps, edits, recipe tables, and errors.
//!
//! Each JSON line holds an identity-preserving `input` graph and the observed `output`, encoded as
//! the shared capture decoder reads them. The input object has these properties:
//!
//! - `moduleId`, `source`, `colorScheme`, `contextual`, `set`, `platform`, `fonts`, `units`,
//!   `vars`, and `runtime`: the compile options.
//! - `identifiers`: graph identifiers with the generated `__zyzzNative` prefix, or `null`.
//! - `libraries`: packed library links by specifier and export, keeping `kind`, `members`, and
//!   the packed `style`, or `null`.
//! - `shared`: `definitions` as `[profile, name]` pairs and `reads` as `[start, name, source]`
//!   triples, or `null`.
//! - `extracted`: `calls`, `styles`, `nativeVars`, and `counts` of the web-only extraction lists.
//!
//! The output holds `code`, `map`, `edits`, and `recipes` as `JSON.stringify` text, or `error`
//! with its `name` and `message`. Offsets in the capture are UTF-16 and decode to UTF-8. The
//! replay decodes the TypeScript extraction rather than extracting the source, so a mismatch
//! isolates `Native.compile` from extraction.
//!
//! Captures come from a temporarily instrumented `src/compiler/Native.ts` that wraps `compile`.
//! The instrumentation is scratch tooling and is not part of the repository.
//!
//! Usage: `cargo run -p compiler --example native_compile_replay -- <capture directory>
//! [--verbose]`.

use std::collections::BTreeMap;
use std::sync::Arc;

use capture::{Decoder, Outcome, field, is_undefined, number, properties, property, string};
use compiler::compiler::internal::native_vars::{Import, Shared};
use compiler::compiler::internal::packed_styles;
use compiler::compiler::internal::syntax::{self, Parsed};
use compiler::compiler::internal::themes::{
    self, Context, Link, LinkKind, Output as ThemeOutput, VarsRead,
};
use compiler::compiler::native;
use compiler::compiler::source::{Call, Extracted, NativeContext};
use compiler::data::Data;
use compiler::error::Error;
use compiler::internal::binding;
use compiler::internal::theme::{ClassName, Definition};
use compiler::internal::token::{Contract, Metadata};
use compiler::js::{self, Record};
use compiler::runtime::recipe as runtime;
use compiler::style::{self, NamedStyle};
use indexmap::IndexMap;
use oxc_allocator::Allocator;
use rustc_hash::{FxHashMap, FxHashSet};
use serde_json::{Value as Json, json};

#[path = "support/capture.rs"]
#[expect(
    dead_code,
    reason = "Compile replays decode a subset of the shared capture kinds."
)]
mod capture;

#[expect(
    clippy::disallowed_methods,
    clippy::print_stdout,
    reason = "The replay harness reads capture files and prints a report."
)]
fn main() {
    let Some(directory) = std::env::args().nth(1) else {
        println!("usage: native_compile_replay <capture directory> [--verbose]");
        return;
    };
    let verbose = std::env::args().any(|argument| argument == "--verbose");
    let mut entries: Vec<_> = std::fs::read_dir(&directory)
        .map(|entries| {
            entries
                .filter_map(Result::ok)
                .map(|entry| entry.path())
                .collect()
        })
        .unwrap_or_default();

    entries.sort();

    let mut matched = 0;
    let mut mismatched = 0;
    let mut skipped: BTreeMap<String, usize> = BTreeMap::new();
    let mut seen = FxHashSet::default();

    for path in entries {
        let Ok(text) = std::fs::read_to_string(&path) else {
            continue;
        };

        for line in text.lines() {
            if !seen.insert(line.to_owned()) {
                continue;
            }

            let entry = match serde_json::from_str::<Json>(line) {
                Ok(entry) if entry.get("input").is_some() => entry,
                _ => {
                    *skipped.entry("unencodable".to_owned()).or_default() += 1;
                    continue;
                }
            };

            match replay(&entry) {
                Ok(None) => matched += 1,
                Ok(Some(mismatch)) => {
                    mismatched += 1;

                    if verbose || mismatched <= 5 {
                        println!("MISMATCH {}: {mismatch}", module_id(&entry["input"]));
                    }
                }
                Err(reason) => *skipped.entry(reason).or_default() += 1,
            }
        }
    }

    for (reason, count) in &skipped {
        println!("skipped {count}: {reason}");
    }

    println!(
        "total: {matched} matched, {mismatched} mismatched, {} skipped",
        skipped.values().sum::<usize>()
    );
}

fn module_id(input: &Json) -> &str {
    property(input, "moduleId")
        .and_then(Json::as_str)
        .unwrap_or("?")
}

/// Replays one capture, returning a mismatch description.
fn replay(entry: &Json) -> Outcome<Option<String>> {
    let input = &entry["input"];
    let output = &entry["output"];
    let mut decoder = Decoder::new(input);
    let root = decoder.node(input);
    let source = field(root, "source")?.as_str().ok_or("source")?;
    let module_id = string(field(root, "moduleId")?)?;
    let allocator = Allocator::default();
    let parsed = syntax::parse(&allocator, source, &module_id);
    let extracted = extracted(&mut decoder, &parsed, field(root, "extracted")?)?;
    let vars = match decoder.data(field(root, "vars")?)? {
        Data::Undefined => None,
        Data::Object(object) => Some(
            object
                .iter()
                .map(|(name, value)| match value {
                    Data::Theme(theme) => Ok((Arc::clone(name), Arc::clone(theme))),
                    _ => Err("non-theme vars".to_owned()),
                })
                .collect::<Outcome<Record<_>>>()?,
        ),
        _ => return Err("vars shape".to_owned()),
    };
    let context = context(&mut decoder, root)?;
    let shared = shared(&decoder, &parsed, field(root, "shared")?)?;
    let color_scheme = optional_string(&decoder, field(root, "colorScheme")?)?;
    let set = optional_string(&decoder, field(root, "set")?)?;
    let options = native::Options {
        color_scheme: color_scheme.as_deref(),
        context: context.as_ref(),
        contextual: field(root, "contextual")?.as_bool() == Some(true),
        fonts: decoder.data(field(root, "fonts")?)?,
        module_id: &module_id,
        platform: decoder.data(field(root, "platform")?)?,
        runtime: field(root, "runtime")?.as_bool() == Some(true),
        set: set.as_deref(),
        shared: shared.as_ref(),
        source,
        units: decoder.data(field(root, "units")?)?,
        vars: vars.as_ref(),
    };

    Ok(compare(
        output,
        native::compile(&options, &extracted, &parsed),
    ))
}

fn optional_string<'j>(decoder: &Decoder<'j>, node: &'j Json) -> Outcome<Option<String>> {
    let node = decoder.node(node);

    if is_undefined(node) {
        return Ok(None);
    }

    string(node).map(Some)
}

fn compare(output: &Json, result: Result<native::Output, Error>) -> Option<String> {
    let result = match (output.get("error"), result) {
        (Some(expected), Err(error)) => {
            let actual = json!({ "message": error.text(), "name": error_name(&error) });

            return (*expected != actual)
                .then(|| format!("error\n  expected {expected}\n  actual   {actual}"));
        }
        (Some(expected), Ok(_)) => return Some(format!("expected error {expected}")),
        (None, Err(error)) => {
            return Some(format!(
                "unexpected error {}: {}",
                error_name(&error),
                error.text()
            ));
        }
        (None, Ok(result)) => result,
    };
    let mut recipes = String::new();

    js::write_object(&mut recipes, result.recipes.iter(), |output, definition| {
        definition.write_json(output);
    });

    let checks = [
        ("code", &output["code"], result.code),
        ("map", &output["map"], result.map),
        ("recipes", &output["recipes"], recipes),
    ];

    for (name, expected, actual) in checks {
        let expected = expected.as_str().unwrap_or_default();

        if expected != actual {
            return Some(format!("{name}\n{}", difference(expected, &actual)));
        }
    }

    let actual: Vec<Json> = result
        .edits
        .iter()
        .map(|edit| {
            json!({
                "code": edit.code,
                "end": edit.end,
                "expression": edit.expression,
                "start": edit.start,
            })
        })
        .collect();
    let expected: Vec<Json> = output["edits"]
        .as_array()
        .map(|edits| {
            edits
                .iter()
                .map(|edit| {
                    json!({
                        "code": edit["code"],
                        "end": edit["end"],
                        "expression": edit["expression"],
                        "start": edit["start"],
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    (expected != actual).then(|| {
        format!(
            "edits\n  expected {}\n  actual   {}",
            Json::Array(expected),
            Json::Array(actual)
        )
    })
}

/// The first differing region of two texts, with surrounding context.
fn difference(expected: &str, actual: &str) -> String {
    let prefix = expected
        .char_indices()
        .zip(actual.chars())
        .find(|((_, left), right)| left != right)
        .map_or(expected.len().min(actual.len()), |((index, _), _)| index);
    let window = |text: &str| {
        let start = (0..=prefix.saturating_sub(120).min(text.len()))
            .rev()
            .find(|index| text.is_char_boundary(*index))
            .unwrap_or(0);
        let end = ((prefix + 240).min(text.len())..=text.len())
            .find(|index| text.is_char_boundary(*index))
            .unwrap_or(text.len());

        text.get(start..end).unwrap_or_default().to_owned()
    };

    format!(
        "  at byte {prefix} (lengths {} vs {})\n  expected …{}…\n  actual   …{}…",
        expected.len(),
        actual.len(),
        window(expected),
        window(actual)
    )
}

/// The error class name TypeScript reports for a Rust error.
fn error_name(error: &Error) -> &'static str {
    match error {
        Error::Message(_) => "Error",
        Error::Native(_) => "Native.CompileError",
        Error::StyleSheet(_) => "StyleSheet.CompileError",
        Error::StyleSheetSelection(_) => "StyleSheet.SelectionError",
        Error::Style(_) => "Style.InvalidError",
        Error::Variants(_) => "Variants.CompileError",
        _ => "Other",
    }
}

fn utf8(parsed: &Parsed<'_>, node: &Json) -> Outcome<u32> {
    let offset = number(node).ok_or("offset")?;

    if !(0.0..=f64::from(u32::MAX)).contains(&offset) || offset.fract() != 0.0 {
        return Err("offset range".to_owned());
    }

    #[expect(
        clippy::cast_possible_truncation,
        clippy::cast_sign_loss,
        reason = "The offset is a checked nonnegative integer within u32."
    )]
    Ok(parsed.offsets.utf8(offset as u32))
}

fn items<'j>(decoder: &Decoder<'j>, node: &'j Json) -> Outcome<&'j Vec<Json>> {
    decoder.node(node)["items"]
        .as_array()
        .ok_or_else(|| "expected array".to_owned())
}

/// A property that is present and not `undefined`.
fn present<'j>(decoder: &Decoder<'j>, node: &'j Json, key: &str) -> Option<&'j Json> {
    property(node, key)
        .map(|value| decoder.node(value))
        .filter(|value| !is_undefined(value))
}

fn extracted<'a, 'j>(
    decoder: &mut Decoder<'j>,
    parsed: &Parsed<'a>,
    node: &'j Json,
) -> Outcome<Extracted<'a>> {
    let node = decoder.node(node);
    let mut calls = Vec::new();

    for call in items(decoder, field(node, "calls")?)? {
        calls.push(self::call(decoder, parsed, call)?);
    }

    let mut styles = Vec::new();

    for style in items(decoder, field(node, "styles")?)? {
        styles.push(decoder.named_style(style)?);
    }

    let mut native_vars = Vec::new();

    for read in items(decoder, field(node, "nativeVars")?)? {
        let read = decoder.node(read);

        native_vars.push(VarsRead {
            default_vars: string(field(read, "defaultVars")?)?.into(),
            end: utf8(parsed, field(read, "end")?)?,
            owner: string(field(read, "owner")?)?.into(),
            start: utf8(parsed, field(read, "start")?)?,
            unnamed: field(read, "unnamed")?.as_bool() == Some(true),
            vars: themes_record(decoder, field(read, "vars")?)?,
        });
    }

    let counts = decoder.node(field(node, "counts")?);
    let count = |name: &str| -> Outcome<usize> {
        let count = number(field(counts, name)?).ok_or("count")?;

        #[expect(
            clippy::cast_possible_truncation,
            clippy::cast_sign_loss,
            reason = "Counts are small nonnegative integers."
        )]
        Ok(count as usize)
    };
    let names = |count: usize| vec![Arc::<str>::from("capture"); count];
    // Contributions and variable calls fail with the same message as theme references, so
    // placeholder references stand for them.
    let references = count("themeReferences")? + count("contributions")? + count("variableCalls")?;

    Ok(Extracted {
        calls,
        collected_themes: false,
        contribution_calls: Vec::new(),
        contribution_starts: Vec::new(),
        contributions: Vec::new(),
        namespaces: Vec::new(),
        native_vars,
        static_theme_references: Vec::new(),
        styles: style::Definition {
            labels: None,
            styles,
        },
        theme_aliases: Vec::new(),
        theme_appearances: names(count("themeAppearances")?),
        theme_calls: Vec::new(),
        theme_exports: None,
        theme_references: (0..references)
            .map(|_| themes::Reference {
                end: 0,
                name: "capture".into(),
                start: 0,
            })
            .collect(),
        theme_scripts: names(count("themeScripts")?),
        theme_selections: names(count("themeSelections")?),
        variable_calls: Vec::new(),
        vars: Record::new(),
    })
}

fn call<'a, 'j>(
    decoder: &mut Decoder<'j>,
    parsed: &Parsed<'a>,
    node: &'j Json,
) -> Outcome<Call<'a>> {
    let node = decoder.node(node);
    let static_recipe = present(decoder, node, "staticRecipe")
        .map(|recipe| decoder.recipe(recipe))
        .transpose()?;
    let dynamic_recipe = present(decoder, node, "dynamicRecipe")
        .map(|recipe| decoder.recipe(recipe))
        .transpose()?;
    let recipe = present(decoder, node, "recipe")
        .map(|recipe| runtime_recipe(decoder, recipe))
        .transpose()?;
    let slots = present(decoder, node, "slots")
        .map(|slots| bindings(decoder, slots))
        .transpose()?;
    let native_context = present(decoder, node, "nativeContext")
        .map(|context| native_context(decoder, context))
        .transpose()?;
    let recipe_types = match present(decoder, node, "recipeTypes") {
        Some(types) => {
            let mut record = Record::new();

            for (axis, choices) in properties(types) {
                let mut inner = Record::new();

                for (choice, kind) in properties(decoder.node(choices)) {
                    inner.insert(choice, Arc::from(string(decoder.node(kind))?));
                }

                record.insert(axis, inner);
            }

            Some(record)
        }
        None => None,
    };

    Ok(Call {
        dynamic_recipe,
        end: utf8(parsed, field(node, "end")?)?,
        name: string(field(node, "name")?)?.into(),
        native_context,
        output: output(present(decoder, node, "output"))?,
        recipe,
        recipe_types,
        slots,
        start: utf8(parsed, field(node, "start")?)?,
        static_recipe,
        values_type: present(decoder, node, "valuesType")
            .map(|kind| string(kind).map(Arc::from))
            .transpose()?,
        ..Call::default()
    })
}

fn output(node: Option<&Json>) -> Outcome<Option<ThemeOutput>> {
    match node {
        None => Ok(None),
        Some(node) if node.as_str() == Some("html") => Ok(Some(ThemeOutput::Html)),
        Some(_) => Err("output".to_owned()),
    }
}

fn bindings<'j>(
    decoder: &mut Decoder<'j>,
    node: &'j Json,
) -> Outcome<Record<Arc<binding::Reference>>> {
    let mut record = Record::new();

    for (name, binding) in properties(decoder.node(node)) {
        record.insert(name, decoder.binding(binding)?);
    }

    Ok(record)
}

fn themes_record<'j>(
    decoder: &mut Decoder<'j>,
    node: &'j Json,
) -> Outcome<Record<Arc<Definition>>> {
    let mut record = Record::new();

    for (name, theme) in properties(decoder.node(node)) {
        record.insert(name, decoder.theme(theme)?);
    }

    Ok(record)
}

fn native_context<'j>(decoder: &mut Decoder<'j>, node: &'j Json) -> Outcome<NativeContext> {
    Ok(NativeContext {
        default_vars: string(decoder.node(field(node, "defaultVars")?))?.into(),
        vars: themes_record(decoder, field(node, "vars")?)?,
    })
}

fn runtime_recipe<'j>(decoder: &mut Decoder<'j>, node: &'j Json) -> Outcome<runtime::Definition> {
    let mut axes = Record::new();

    for (axis, choices) in properties(decoder.node(field(node, "axes")?)) {
        axes.insert(axis, decoder.strings(choices)?);
    }

    let mut defaults = Record::new();

    for (axis, choice) in properties(decoder.node(field(node, "defaults")?)) {
        defaults.insert(
            axis,
            match decoder.node(choice) {
                Json::Null => None,
                choice => Some(string(choice)?.into()),
            },
        );
    }

    Ok(runtime::Definition {
        axes,
        conditions: present(decoder, node, "conditions")
            .map(|conditions| decoder.strings(conditions))
            .transpose()?,
        default_payloads: present(decoder, node, "defaultPayloads")
            .map(|node| default_payloads(decoder, node))
            .transpose()?,
        defaults,
        payloads: present(decoder, node, "payloads")
            .map(|node| payloads(decoder, node))
            .transpose()?,
    })
}

fn payloads<'j>(decoder: &Decoder<'j>, node: &'j Json) -> Outcome<Vec<runtime::Payload>> {
    let mut output = Vec::new();

    for payload in items(decoder, node)? {
        let payload = decoder.node(payload);
        let mut slots = Vec::new();

        for record in items(decoder, field(payload, "slots")?)? {
            let mut fields = Record::new();

            for (name, slot) in properties(decoder.node(record)) {
                fields.insert(name, Arc::from(string(decoder.node(slot))?));
            }

            slots.push(fields);
        }

        output.push(runtime::Payload {
            axis: string(field(payload, "axis")?)?.into(),
            choice: string(field(payload, "choice")?)?.into(),
            slots,
        });
    }

    Ok(output)
}

fn default_payloads<'j>(
    decoder: &Decoder<'j>,
    node: &'j Json,
) -> Outcome<Record<Record<runtime::Scalar>>> {
    let mut record = Record::new();

    for (axis, fields) in properties(node) {
        let mut values = Record::new();

        for (name, value) in properties(decoder.node(fields)) {
            let value = decoder.node(value);

            values.insert(
                name,
                match (value.as_str(), number(value)) {
                    (Some(text), _) => runtime::Scalar::String(text.into()),
                    (None, Some(number)) => runtime::Scalar::Number(number),
                    (None, None) => return Err("payload default".to_owned()),
                },
            );
        }

        record.insert(axis, values);
    }

    Ok(record)
}

fn context<'a, 'j>(decoder: &mut Decoder<'j>, root: &'j Json) -> Outcome<Option<Context<'a>>> {
    let identifiers = match decoder.node(field(root, "identifiers")?) {
        Json::Null => None,
        node => Some(
            items(decoder, node)?
                .iter()
                .map(|name| {
                    name.as_str()
                        .map(Arc::from)
                        .ok_or_else(|| "identifier".to_owned())
                })
                .collect::<Outcome<FxHashSet<Arc<str>>>>()?,
        ),
    };
    let libraries = match decoder.node(field(root, "libraries")?) {
        Json::Null => None,
        node => {
            let mut libraries = Record::new();

            for (specifier, exports) in properties(node) {
                let mut record = Record::new();

                for (name, value) in properties(decoder.node(exports)) {
                    record.insert(name, link(decoder, value)?);
                }

                libraries.insert(specifier, record);
            }

            Some(libraries)
        }
    };

    if identifiers.is_none() && libraries.is_none() {
        return Ok(None);
    }

    Ok(Some(Context {
        constants: None,
        factories: None,
        identifiers,
        libraries,
        links: Record::new(),
        owners: None,
        style_classes: None,
    }))
}

fn link<'j>(decoder: &mut Decoder<'j>, node: &'j Json) -> Outcome<Link> {
    let node = decoder.node(node);
    let kind = match string(field(node, "kind")?)?.as_str() {
        "animation" => LinkKind::Animation,
        "config" => LinkKind::Config,
        "rule-reference" => LinkKind::RuleReference,
        "style" => LinkKind::Style,
        "style-reference" => LinkKind::StyleReference,
        "theme" => LinkKind::Theme,
        "variables" => LinkKind::Variables,
        _ => return Err("link kind".to_owned()),
    };
    let members = match present(decoder, node, "members") {
        Some(members) => {
            let mut record = Record::new();

            for (name, member) in properties(members) {
                record.insert(name, link(decoder, member)?);
            }

            Some(record)
        }
        None => None,
    };
    let style = present(decoder, node, "style")
        .map(|style| packed_style(decoder, style).map(Arc::new))
        .transpose()?;

    // The native compiler reads only the kind, members, and packed style of a link.
    Ok(Link {
        binding: "capture".into(),
        call: themes::Call::default(),
        definition: Arc::new(Definition {
            class_name: ClassName::Contract,
            metadata: Metadata {
                contract: Arc::new(Contract::default()),
                css_name: None,
                paths: None,
                queries: None,
                values: Arc::default(),
            },
            tokens: Data::Undefined,
            vars: Data::Undefined,
        }),
        kind,
        members,
        style,
    })
}

fn packed_style<'j>(
    decoder: &mut Decoder<'j>,
    node: &'j Json,
) -> Outcome<packed_styles::Definition> {
    let dynamic = match present(decoder, node, "dynamic") {
        Some(dynamic) => Some(packed_styles::Dynamic {
            default_payloads: present(decoder, dynamic, "defaultPayloads")
                .map(|node| default_payloads(decoder, node))
                .transpose()?,
            payloads: present(decoder, dynamic, "payloads")
                .map(|node| payloads(decoder, node))
                .transpose()?,
            recipe: decoder.recipe(field(dynamic, "recipe")?)?,
            slots: bindings(decoder, field(dynamic, "slots")?)?,
        }),
        None => None,
    };
    let static_recipe = present(decoder, node, "staticRecipe")
        .map(|recipe| decoder.recipe(recipe))
        .transpose()?;
    let native_context = present(decoder, node, "nativeContext")
        .map(|context| native_context(decoder, context))
        .transpose()?;
    let slots = items(decoder, field(node, "slots")?)?
        .iter()
        .map(|slot| {
            slot.as_str()
                .map(Arc::from)
                .ok_or_else(|| "slot".to_owned())
        })
        .collect::<Outcome<Vec<_>>>()?;

    Ok(packed_styles::Definition {
        attributes: Vec::new(),
        class_name: None,
        dynamic,
        native_context,
        output: output(present(decoder, node, "output"))?,
        packed: true,
        slots,
        static_recipe,
        style: Arc::new(NamedStyle::default()),
    })
}

fn shared<'j>(
    decoder: &Decoder<'j>,
    parsed: &Parsed<'_>,
    node: &'j Json,
) -> Outcome<Option<Shared>> {
    let node = decoder.node(node);

    if node.is_null() {
        return Ok(None);
    }

    let mut definitions = IndexMap::default();

    for pair in items(decoder, field(node, "definitions")?)? {
        let pair = items(decoder, pair)?;
        let value = pair.first().and_then(Json::as_str).ok_or("definition")?;
        let name = pair.get(1).and_then(Json::as_str).ok_or("definition")?;

        definitions.insert(value.to_owned(), name.to_owned());
    }

    let mut reads = FxHashMap::default();

    for read in items(decoder, field(node, "reads")?)? {
        let read = items(decoder, read)?;
        let start = utf8(parsed, read.first().ok_or("read start")?)?;
        let name = read.get(1).and_then(Json::as_str).ok_or("read name")?;

        reads.insert(
            start,
            Import {
                name: name.to_owned(),
                source: read.get(2).and_then(Json::as_str).map(str::to_owned),
            },
        );
    }

    Ok(Some(Shared { definitions, reads }))
}
