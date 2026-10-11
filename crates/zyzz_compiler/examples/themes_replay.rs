//! Replays theme, configuration, and variable collection over a corpus for differential checks.
//!
//! Reads cases as JSON on standard input and writes one JSON summary per case, in the format the
//! TypeScript oracle under `.fixture-oracle/` writes, so the two outputs compare line by line.

#[path = "../tests/support/walk.rs"]
mod walk;

use std::io::{Read as _, Write as _};
use std::sync::Arc;

use oxc_allocator::Allocator;
use oxc_ast::ast::{ImportDeclarationSpecifier, ModuleExportName, Statement};
use serde_json::{Map, Value, json};
use zyzz_compiler::compiler::internal::syntax::{self, Parsed};
use zyzz_compiler::compiler::internal::themes::{self, Alias, Call, Link, LinkKind, Output};
use zyzz_compiler::compiler::internal::{statics, vars};
use zyzz_compiler::data::Data;
use zyzz_compiler::error::Error;
use zyzz_compiler::internal::identity;
use zyzz_compiler::internal::theme::Definition;
use zyzz_compiler::internal::token::{self, Contract, Mappings};
use zyzz_compiler::js::{self, Record};

/// Assigns contract ids by first appearance, as the oracle does.
#[derive(Default)]
struct Contracts {
    seen: Vec<Arc<Contract>>,
    table: Vec<Value>,
}

impl Contracts {
    fn id(&mut self, contract: &Arc<Contract>) -> usize {
        if let Some(index) = self
            .seen
            .iter()
            .position(|seen| Arc::ptr_eq(seen, contract))
        {
            return index;
        }

        self.seen.push(Arc::clone(contract));
        self.table.push(Value::Null);

        let index = self.seen.len() - 1;
        let mappings = match &contract.mappings {
            None => Value::Null,
            Some(Mappings::Disabled) => Value::Bool(false),
            Some(Mappings::Categories(categories)) => Value::Object(
                categories
                    .iter()
                    .map(|(key, properties)| {
                        (
                            key.to_string(),
                            Value::Array(
                                properties
                                    .iter()
                                    .map(|property| json!(&**property))
                                    .collect(),
                            ),
                        )
                    })
                    .collect(),
            ),
        };
        let shorthands = contract.shorthands.as_ref().map_or(Value::Null, |map| {
            Value::Object(
                map.iter()
                    .map(|(key, targets)| {
                        (
                            key.to_string(),
                            Value::Array(targets.iter().map(|target| json!(&**target)).collect()),
                        )
                    })
                    .collect(),
            )
        });

        if let Some(slot) = self.table.get_mut(index) {
            *slot = json!({
                "complete": contract.complete,
                "composition": contract.composition.map(token::Composition::as_str),
                "cssOutput": contract.css_output.map(token::CssOutput::as_str),
                "defaultLayer": contract.default_layer.as_deref(),
                "identity": contract.identity.as_deref(),
                "mappings": mappings,
                "shorthands": shorthands,
                "variableSet": contract.variable_set,
            });
        }

        index
    }
}

struct Writer<'p, 'a> {
    contracts: &'p mut Contracts,
    parsed: &'p Parsed<'a>,
}

fn number(value: f64) -> Value {
    if !value.is_finite() {
        return Value::Null;
    }

    if value.fract() == 0.0 && value.abs() < 9_007_199_254_740_992.0 {
        #[expect(
            clippy::cast_possible_truncation,
            reason = "Checked integral and in range."
        )]
        return json!(value as i64);
    }

    json!(value)
}

fn pairs(entries: impl IntoIterator<Item = (String, Value)>) -> Value {
    Value::Array(
        entries
            .into_iter()
            .map(|(key, value)| Value::Array(vec![Value::String(key), value]))
            .collect(),
    )
}

impl Writer<'_, '_> {
    fn offset(&self, offset: u32) -> Value {
        json!(self.parsed.utf16(offset))
    }

    fn token_value(&mut self, value: &token::Value) -> Value {
        match value {
            token::Value::String(text) => json!(&**text),
            token::Value::Number(number) => self::number(*number),
            token::Value::Record(entries) => json!({
                "obj": pairs(entries.iter().map(|(key, value)| (key.to_string(), self.token_value(value)))),
            }),
            token::Value::Reference(reference) => json!({ "ref": self.reference(reference) }),
            token::Value::Composition(expression) => self.expression(expression),
        }
    }

    fn expression(&mut self, expression: &token::Expression) -> Value {
        let parts: Vec<Value> = expression
            .parts
            .iter()
            .map(|part| match part {
                token::Part::Text(text) => json!(&**text),
                token::Part::Binding(binding) => {
                    json!({ "binding": binding.name, "type": binding.domain.as_str() })
                }
                token::Part::Reference(reference) => json!({ "ref": self.reference(reference) }),
            })
            .collect();

        json!({ "expr": { "group": expression.group.as_deref(), "parts": parts } })
    }

    fn reference(&mut self, reference: &token::Reference) -> Value {
        let contract = self.contracts.id(&reference.contract);
        let value = self.token_value(&reference.value);

        json!({
            "c": contract,
            "g": reference.group.as_str(),
            "p": &*reference.path,
            "v": value,
            "w": reference.web,
        })
    }

    fn data(&mut self, data: &Data) -> Value {
        match data {
            Data::Token(reference) => json!({ "ref": self.reference(reference) }),
            Data::Expression(expression) => self.expression(expression),
            Data::Number(number) => self::number(*number),
            Data::String(text) => json!(&**text),
            Data::Bool(value) => json!(value),
            Data::Null => Value::Null,
            Data::Undefined => json!({ "$": "undefined" }),
            Data::Array(items) => Value::Array(items.iter().map(|item| self.data(item)).collect()),
            Data::Object(object) => json!({
                "obj": pairs(object.iter().map(|(key, value)| (key.to_string(), self.data(value)))),
            }),
            Data::Theme(definition) => json!({ "theme": self.definition(definition) }),
            Data::Binding(binding) => json!({ "binding": binding.name }),
        }
    }

    fn tree(&mut self, data: &Data) -> Value {
        match data {
            Data::Token(reference) => json!({ "ref": self.reference(reference) }),
            Data::Object(object) => json!({
                "obj": pairs(object.iter().map(|(key, value)| (key.to_string(), self.tree(value)))),
            }),
            data => self.data(data),
        }
    }

    fn definition(&mut self, definition: &Definition) -> Value {
        let metadata = &definition.metadata;
        let class_name = match definition.class_name() {
            Ok(name) => json!({ "ok": name }),
            Err(error) => json!({ "error": error.text() }),
        };
        let contract = self.contracts.id(&metadata.contract);
        let paths = metadata.paths.as_ref().map_or(Value::Null, |paths| {
            Value::Object(
                paths
                    .iter()
                    .map(|(key, parts)| {
                        (
                            key.to_string(),
                            Value::Array(parts.iter().map(|part| json!(&**part)).collect()),
                        )
                    })
                    .collect(),
            )
        });
        let queries = metadata.queries.as_ref().map_or(Value::Null, |queries| {
            json!({
                "breakpoint": queries.breakpoint.iter().map(|(key, value)| json!([key, value])).collect::<Vec<_>>(),
                "container": queries.container.iter().map(|(key, value)| json!([key, value])).collect::<Vec<_>>(),
                "containerNames": queries.container_names,
            })
        });
        let tokens = self.tree(&definition.tokens);
        let values = pairs(
            metadata
                .values
                .iter()
                .map(|(key, value)| (key.to_string(), self.token_value(value)))
                .collect::<Vec<_>>(),
        );
        let vars = self.tree(&definition.vars);

        json!({
            "className": class_name,
            "contract": contract,
            "cssName": metadata.css_name.as_deref(),
            "paths": paths,
            "queries": queries,
            "tokens": tokens,
            "values": values,
            "vars": vars,
        })
    }

    fn call(&mut self, call: &Call) -> Value {
        let mappings = match &call.variable_mappings {
            None => Value::Null,
            Some(Mappings::Disabled) => Value::Bool(false),
            Some(Mappings::Categories(categories)) => Value::Object(
                categories
                    .iter()
                    .map(|(key, properties)| {
                        (
                            key.to_string(),
                            Value::Array(
                                properties
                                    .iter()
                                    .map(|property| json!(&**property))
                                    .collect(),
                            ),
                        )
                    })
                    .collect(),
            ),
        };
        let options = match &call.options {
            Some(options) => self.data(&Data::from(options.clone())),
            None => Value::Null,
        };

        json!({
            "appearance": call.appearance,
            "catalogOnly": call.catalog_only,
            "directVariables": call.direct_variables,
            "end": self.offset(call.end),
            "initialization": call.initialization,
            "members": call.members.as_ref().map(|members| members.iter().map(|(key, name)| json!([&**key, &**name])).collect::<Vec<_>>()),
            "name": &*call.name,
            "nativeProvider": call.native_provider,
            "options": options,
            "output": call.output.map(|_| "html"),
            "recipe": call.recipe,
            "root": call.root,
            "script": call.script,
            "selection": call.selection,
            "start": self.offset(call.start),
            "tokenType": &*call.token_type,
            "type": call.type_text.as_deref(),
            "variableConfig": call.variable_config,
            "variableMappings": mappings,
            "variableOwner": call.variable_owner.as_deref(),
            "variableSet": call.variable_set,
            "variables": call.variables.as_ref().map(|variables| variables.iter().map(|(key, slot)| json!([&**key, { "name": slot.name, "type": slot.domain.as_str() }])).collect::<Vec<_>>()),
        })
    }

    fn link(&mut self, link: &Link) -> Value {
        let call = self.call(&link.call);
        let definition = self.definition(&link.definition);
        let members = link.members.as_ref().map(|members| {
            pairs(
                members
                    .iter()
                    .map(|(key, member)| (key.to_string(), self.link(member)))
                    .collect::<Vec<_>>(),
            )
        });

        json!({
            "binding": &*link.binding,
            "call": call,
            "definition": definition,
            "kind": kind(link.kind),
            "members": members,
        })
    }

    fn failure(&self, error: &Error) -> Value {
        match error {
            Error::Themes { message, span } => json!({
                "message": message,
                "start": self.parsed.utf16(span.start),
                "end": self.parsed.utf16(span.end),
            }),
            error => json!({ "plain": error.text() }),
        }
    }
}

fn kind(kind: LinkKind) -> &'static str {
    match kind {
        LinkKind::Animation => "animation",
        LinkKind::Config => "config",
        LinkKind::RuleReference => "rule-reference",
        LinkKind::Style => "style",
        LinkKind::StyleReference => "style-reference",
        LinkKind::Theme => "theme",
        LinkKind::Variables => "variables",
    }
}

/// The source adapter's namespace hash for variable bindings.
fn namespace(value: &str) -> String {
    let mut first: u32 = 2_166_136_261;
    let mut second: u32 = 2_246_822_507;

    for code in value.encode_utf16() {
        first = (first ^ u32::from(code)).wrapping_mul(16_777_619);
        second = (second ^ u32::from(code)).wrapping_mul(3_266_489_909);
    }

    format!(
        "{}{}",
        js::radix(u64::from(first), 36),
        js::radix(u64::from(second), 36)
    )
}

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

struct Case<'c> {
    linked: bool,
    modules: &'c Map<String, Value>,
    native: bool,
    ts: &'c Map<String, Value>,
}

fn module(
    case: &Case<'_>,
    module_id: &str,
    source: &str,
    links: &Record<Link>,
    contracts: &mut Contracts,
) -> (Value, Record<Link>) {
    let mut result = Map::new();

    result.insert("moduleId".into(), json!(module_id));

    let ts = case.ts.get(module_id).and_then(Value::as_object);

    if let Some(skip) = ts.and_then(|ts| ts.get("skip")) {
        result.insert("skip".into(), skip.clone());

        return (Value::Object(result), Record::new());
    }

    let allocator = Allocator::default();
    let parsed = syntax::parse(&allocator, source, module_id);

    if !parsed.errors.is_empty() {
        result.insert("skip".into(), json!("syntax"));

        return (Value::Object(result), Record::new());
    }

    let statics = statics::collect(
        &allocator,
        parsed.program,
        &parsed.semantic,
        rustc_hash::FxHashMap::default(),
    );
    let contribution_calls: Vec<u32> = ts
        .and_then(|ts| ts.get("contributionCalls"))
        .and_then(Value::as_array)
        .map(|calls| {
            calls
                .iter()
                .filter_map(Value::as_u64)
                .map(|start| parsed.offsets.utf8(u32::try_from(start).unwrap_or(0)))
                .collect()
        })
        .unwrap_or_default();

    result.insert(
        "contributionCalls".into(),
        json!(
            contribution_calls
                .iter()
                .map(|start| parsed.utf16(*start))
                .collect::<Vec<_>>()
        ),
    );
    result.insert(
        "staticBindings".into(),
        json!(
            statics
                .bindings()
                .map(|start| parsed.utf16(start))
                .collect::<Vec<_>>()
        ),
    );

    let writer_parsed = &parsed;
    let variables = match vars::collect(&parsed, &namespace(module_id), links, module_id) {
        Ok(variables) => variables,
        Err(error) => {
            let writer = Writer {
                contracts,
                parsed: writer_parsed,
            };

            result.insert("varsError".into(), writer.failure(&error));

            return (Value::Object(result), Record::new());
        }
    };
    let file = module_id.rsplit('/').next().unwrap_or(module_id);
    let options = themes::Options {
        contribution_calls: contribution_calls.iter().copied().collect(),
        linked: case.linked,
        links: links.clone(),
        namespace: format!(
            "src-{}-{}",
            identity::label(stem(file)),
            identity::compact(module_id)
        )
        .into(),
        native: case.native,
        static_bindings: statics.bindings().collect(),
    };
    let mut themes = match themes::collect(&parsed, options) {
        Ok(themes) => themes,
        Err(error) => {
            let writer = Writer {
                contracts,
                parsed: writer_parsed,
            };

            result.insert("themesError".into(), writer.failure(&error));

            return (Value::Object(result), Record::new());
        }
    };
    let outcome = walk::walk(&parsed, &variables, themes.as_mut());
    let mut writer = Writer {
        contracts,
        parsed: &parsed,
    };

    result.insert(
        "diagnostics".into(),
        Value::Array(
            outcome
                .diagnostics
                .iter()
                .map(|error| writer.failure(error))
                .collect(),
        ),
    );
    result.insert(
        "reads".into(),
        Value::Array(
            outcome
                .reads
                .iter()
                .map(|(start, owner)| {
                    json!([
                        parsed.utf16(*start),
                        match owner {
                            walk::Owner::Themes => "themes",
                            walk::Owner::Vars => "vars",
                        }
                    ])
                })
                .collect(),
        ),
    );

    let calls: Vec<Value> = variables
        .calls
        .iter()
        .map(|call| {
            json!({
                "end": parsed.utf16(call.end),
                "explicit": call.explicit,
                "slots": call.slots.iter().map(|(key, slot)| json!([&**key, { "name": slot.name, "type": slot.domain.as_str() }])).collect::<Vec<_>>(),
                "start": parsed.utf16(call.start),
            })
        })
        .collect();
    let exports = pairs(
        variables
            .exports
            .iter()
            .map(|(key, link)| (key.to_string(), writer.link(link)))
            .collect::<Vec<_>>(),
    );
    let references: Vec<Value> = variables
        .references
        .iter()
        .map(|(start, read)| {
            json!([
                parsed.utf16(*start),
                parsed.utf16(read.end),
                read.reference.name,
                read.reference.domain.as_str()
            ])
        })
        .collect();
    let registrations: Vec<Value> = variables
        .registrations
        .iter()
        .map(|registration| {
            let initial = writer.data(&registration.initial_value);

            json!({ "obj": [
                ["kind", "property"],
                ["name", registration.name],
                ["syntax", registration.syntax],
                ["inherits", registration.inherits],
                ["initialValue", initial],
            ] })
        })
        .collect();

    result.insert(
        "vars".into(),
        json!({
            "calls": calls,
            "exports": exports,
            "references": references,
            "registrationLocations": variables.registration_locations.iter().map(|span| json!([parsed.utf16(span.start), parsed.utf16(span.end)])).collect::<Vec<_>>(),
            "registrationStarts": variables.registration_starts.iter().map(|start| parsed.utf16(*start)).collect::<Vec<_>>(),
            "registrations": registrations,
        }),
    );

    let mut exported: Record<Link> = Record::new();

    if let Some(themes) = themes.as_mut() {
        let starts: Vec<(u32, u32)> = themes
            .styles
            .iter()
            .map(|(start, style)| (*start, style.call.span.end))
            .collect();
        let mut contexts = Vec::new();

        for (start, end) in starts {
            contexts.push(match themes.native_context(start, end) {
                Ok(Some(context)) => {
                    let vars = pairs(
                        context
                            .vars
                            .iter()
                            .map(|(key, definition)| {
                                (key.to_string(), writer.definition(definition))
                            })
                            .collect::<Vec<_>>(),
                    );

                    json!({ "defaultVars": &*context.default_vars, "vars": vars })
                }
                Ok(None) => Value::Null,
                Err(error) => json!({ "error": error.text() }),
            });
        }

        let aliases: Vec<Value> = themes
            .aliases
            .iter()
            .map(|alias: &Alias| {
                let call = writer.call(&alias.call);

                json!({
                    "bindings": alias.bindings.as_ref().map(|bindings| bindings.iter().map(|binding| match binding {
                        themes::AliasBinding::Style => "style",
                        themes::AliasBinding::Variants => "variants",
                    }).collect::<Vec<_>>()),
                    "call": call,
                    "destructured": alias.destructured,
                    "retained": alias.retained,
                })
            })
            .collect();
        let calls: Vec<Value> = themes.calls.iter().map(|call| writer.call(call)).collect();
        let exports = pairs(
            themes
                .exports
                .iter()
                .map(|(key, link)| (key.to_string(), writer.link(link)))
                .collect::<Vec<_>>(),
        );
        let styles: Vec<Value> = themes
            .styles
            .iter()
            .map(|(start, style)| {
                let definition = writer.definition(&style.theme);

                json!([
                    parsed.utf16(*start),
                    parsed.utf16(style.call.span.end),
                    style.recipe,
                    style.output.map(|_: Output| "html"),
                    definition
                ])
            })
            .collect();
        let definitions = pairs(
            themes
                .themes
                .iter()
                .map(|(key, definition)| (key.to_string(), writer.definition(definition)))
                .collect::<Vec<_>>(),
        );
        let tokens: Vec<Value> = themes
            .tokens
            .iter()
            .map(|(start, read)| {
                let reference = writer.reference(&read.reference);

                json!([parsed.utf16(*start), parsed.utf16(read.end), reference])
            })
            .collect();
        let reads: Vec<Value> = themes
            .vars_reads
            .iter()
            .map(|read| {
                let vars = pairs(
                    read.vars
                        .iter()
                        .map(|(key, definition)| (key.to_string(), writer.definition(definition)))
                        .collect::<Vec<_>>(),
                );

                json!({
                    "defaultVars": &*read.default_vars,
                    "end": parsed.utf16(read.end),
                    "owner": &*read.owner,
                    "start": parsed.utf16(read.start),
                    "unnamed": read.unnamed,
                    "vars": vars,
                })
            })
            .collect();

        result.insert(
            "themes".into(),
            json!({
                "aliases": aliases,
                "appearances": themes.appearances.iter().map(|name| &**name).collect::<Vec<_>>(),
                "calls": calls,
                "exports": exports,
                "nativeContexts": contexts,
                "references": themes.references.iter().map(|reference| json!([parsed.utf16(reference.start), parsed.utf16(reference.end), &*reference.name])).collect::<Vec<_>>(),
                "scopeApplications": themes.scope_applications.iter().map(|(start, application)| json!([parsed.utf16(*start), parsed.utf16(application.end), application.output.map(|_| "html")])).collect::<Vec<_>>(),
                "scripts": themes.scripts.iter().map(|name| &**name).collect::<Vec<_>>(),
                "selectionUses": themes.selection_uses.iter().map(|name| &**name).collect::<Vec<_>>(),
                "selections": themes.selections.iter().map(|name| &**name).collect::<Vec<_>>(),
                "staticTokens": themes.static_tokens.iter().map(|token| json!([parsed.utf16(token.start), parsed.utf16(token.end)])).collect::<Vec<_>>(),
                "styles": styles,
                "themes": definitions,
                "tokens": tokens,
                "varsReads": reads,
            }),
        );

        for (key, link) in themes.exports.iter() {
            exported.insert(Arc::clone(key), link.clone());
        }
    }

    for (key, link) in variables.exports.iter() {
        exported.insert(Arc::clone(key), link.clone());
    }

    (Value::Object(result), exported)
}

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
                ImportDeclarationSpecifier::ImportSpecifier(named) => match &named.imported {
                    ModuleExportName::IdentifierName(name) => name.name.to_string(),
                    ModuleExportName::IdentifierReference(name) => name.name.to_string(),
                    ModuleExportName::StringLiteral(name) => name.value.to_string(),
                },
                ImportDeclarationSpecifier::ImportDefaultSpecifier(_) => "default".to_owned(),
            };

            names.push((specifier.local().name.to_string(), imported));
        }

        result.push((import.source.value.to_string(), names));
    }

    result
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

        let (mut result, exports) =
            module(self.case, module_id, &source, &links, &mut self.contracts);

        if let Some(result) = result.as_object_mut() {
            result.insert(
                "links".into(),
                Value::Array(links.keys().map(|key| json!(&**key)).collect()),
            );
        }

        self.outputs.push(result);
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
        let ts = case.get("ts").and_then(Value::as_object).unwrap_or(&empty);
        let entry = Case {
            linked: case.get("linked").and_then(Value::as_bool).unwrap_or(false),
            modules,
            native: case.get("native").and_then(Value::as_bool).unwrap_or(false),
            ts,
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
            "contracts": graph.contracts.table,
        });

        writeln!(output, "{line}")?;
    }

    Ok(())
}
