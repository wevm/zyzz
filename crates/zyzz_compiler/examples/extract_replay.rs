//! Replays `Source.extract` over a corpus for differential checks against the TypeScript oracle.
//!
//! Reads cases as JSON on standard input and writes one JSON line per case: every module's
//! encoded result or error, and the contract table they share. Linked cases pass each module the
//! `themeExports` of the modules it imports, as a source graph does.

use std::io::{Read as _, Write as _};

use oxc_allocator::Allocator;
use oxc_ast::ast::{ImportDeclarationSpecifier, Statement};
use serde_json::{Map, Value, json};
use zyzz_compiler::compiler::internal::syntax;
use zyzz_compiler::compiler::internal::themes::{Context, Link};
use zyzz_compiler::compiler::internal::wire::{self, Contracts, Encoder};
use zyzz_compiler::compiler::source::{self, Options, Target};
use zyzz_compiler::js::{Record, Utf16Index};

/// Strips `/\.[cm]?[jt]sx?$/`.
fn stem(value: &str) -> &str {
    for extension in [
        ".js", ".ts", ".jsx", ".tsx", ".cjs", ".cts", ".cjsx", ".ctsx", ".mjs", ".mts", ".mjsx",
        ".mtsx",
    ] {
        if let Some(stem) = value.strip_suffix(extension) {
            return stem;
        }
    }

    value
}

fn relative(from: &str, specifier: &str, modules: &Map<String, Value>) -> Option<String> {
    if !specifier.starts_with('.') {
        return None;
    }

    let mut parts: Vec<&str> = from.split('/').collect();

    parts.pop();

    for part in specifier.split('/') {
        match part {
            "." | "" => {}
            ".." => {
                parts.pop();
            }
            part => parts.push(part),
        }
    }

    let base = parts.join("/");
    let stem = stem(&base);
    let mut candidates = vec![base.clone()];

    for extension in [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"] {
        candidates.push(format!("{stem}{extension}"));
    }

    for extension in [".ts", ".tsx", ".js", ".jsx"] {
        candidates.push(format!("{base}/index{extension}"));
    }

    candidates
        .into_iter()
        .find(|candidate| modules.contains_key(candidate))
}

/// Value imports by source specifier: local and imported names, with `default` for defaults.
fn imports(module_id: &str, source: &str) -> Vec<(String, Vec<(String, String)>)> {
    let allocator = Allocator::default();
    let parsed = syntax::parse(&allocator, source, module_id);
    let mut result = Vec::new();

    for statement in &parsed.program.body {
        let Statement::ImportDeclaration(import) = statement else {
            continue;
        };

        if import.import_kind.is_type() {
            continue;
        }

        let mut names = Vec::new();

        for specifier in import.specifiers.iter().flatten() {
            let imported = match specifier {
                ImportDeclarationSpecifier::ImportNamespaceSpecifier(_) => continue,
                ImportDeclarationSpecifier::ImportSpecifier(named)
                    if named.import_kind.is_type() =>
                {
                    continue;
                }
                ImportDeclarationSpecifier::ImportSpecifier(named) => {
                    named.imported.name().to_string()
                }
                ImportDeclarationSpecifier::ImportDefaultSpecifier(_) => "default".to_owned(),
            };

            names.push((specifier.local().name.to_string(), imported));
        }

        result.push((import.source.value.to_string(), names));
    }

    result
}

struct Case<'c> {
    compiler: Option<bool>,
    linked: bool,
    modules: &'c Map<String, Value>,
    native: bool,
}

struct Graph<'c, 'g> {
    case: &'g Case<'c>,
    contracts: Contracts,
    done: Vec<(String, Record<Link>)>,
    outputs: Vec<Value>,
    visiting: Vec<String>,
}

impl Graph<'_, '_> {
    fn visit(&mut self, module_id: &str) -> Record<Link> {
        if let Some((_, exports)) = self.done.iter().find(|(id, _)| id == module_id) {
            return exports.clone();
        }

        if self.visiting.iter().any(|id| id == module_id) {
            return Record::new();
        }

        self.visiting.push(module_id.to_owned());

        let source = self
            .case
            .modules
            .get(module_id)
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_owned();
        let mut links: Record<Link> = Record::new();

        if self.case.linked {
            for (specifier, names) in imports(module_id, &source) {
                let Some(target) = relative(module_id, &specifier, self.case.modules) else {
                    continue;
                };
                let exports = self.visit(&target);

                for (local, imported) in names {
                    if let Some(link) = exports.get(&imported) {
                        links.insert(local.as_str(), link.clone());
                    }
                }
            }
        }

        let allocator = Allocator::default();
        let text: &str = allocator.alloc_str(&source);
        let context = Context {
            links: links.clone(),
            ..Context::default()
        };
        let options = Options {
            compiler: self.case.compiler,
            context: self.case.linked.then_some(&context),
            module_id,
            parsed: None,
            source: text,
            target: if self.case.native {
                Target::Native
            } else {
                Target::Web
            },
        };
        let mut output = Map::new();

        output.insert("moduleId".into(), json!(module_id));
        output.insert(
            "links".into(),
            Value::Array(links.keys().map(|key| json!(&**key)).collect()),
        );

        let exports = match source::extract(&allocator, &options) {
            Ok(extracted) => {
                let offsets = Utf16Index::new(text);
                let result = Encoder::new(&mut self.contracts, &offsets).extracted(&extracted);

                output.insert("result".into(), result);
                extracted.theme_exports.unwrap_or_default()
            }
            Err(error) => {
                if let Some(error) = wire::error(&error).get("error") {
                    output.insert("error".into(), error.clone());
                }

                Record::new()
            }
        };

        self.outputs.push(Value::Object(output));
        self.done.push((module_id.to_owned(), exports.clone()));

        exports
    }
}

fn main() -> std::io::Result<()> {
    let mut input = String::new();

    std::io::stdin().read_to_string(&mut input)?;

    let cases: Value = serde_json::from_str(&input).map_err(std::io::Error::other)?;
    let empty = Map::new();
    let mut output = std::io::stdout().lock();

    for case in cases.as_array().into_iter().flatten() {
        let modules = case
            .get("modules")
            .and_then(Value::as_object)
            .unwrap_or(&empty);
        let entry = Case {
            compiler: case.get("compiler").and_then(Value::as_bool),
            linked: case.get("linked").and_then(Value::as_bool).unwrap_or(false),
            modules,
            native: case.get("native").and_then(Value::as_bool).unwrap_or(false),
        };
        let order: Vec<String> = match case.get("order").and_then(Value::as_array) {
            Some(order) => order
                .iter()
                .filter_map(Value::as_str)
                .map(str::to_owned)
                .collect(),
            None => modules.keys().cloned().collect(),
        };
        let mut graph = Graph {
            case: &entry,
            contracts: Contracts::default(),
            done: Vec::new(),
            outputs: Vec::new(),
            visiting: Vec::new(),
        };

        for module_id in &order {
            graph.visit(module_id);
        }

        let line = json!({
            "id": case.get("id"),
            "modules": graph.outputs,
            "contracts": graph.contracts.table(),
        });

        writeln!(output, "{line}")?;
    }

    Ok(())
}
