//! Normalizes literal configuration syntax into linked theme members.

use std::sync::Arc;

use oxc_ast::ast::{
    Argument, ArrayExpressionElement, CallExpression, Expression, ObjectPropertyKind, PropertyKey,
    PropertyKind,
};
use oxc_span::{GetSpan, Span};

use crate::compiler::internal::themes::{Call, Link, LinkKind, Output};
use crate::config;
use crate::data::{Data, Object};
use crate::error::{Error, Result};
use crate::internal::configuration::{self, Catalog};
use crate::internal::theme::{self, Definition};
use crate::internal::token::{self, Contract, ContractKey, CssOutput, Metadata};
use crate::internal::{identity, shorthands, variable_sets};
use crate::js::{self, Record};
use crate::vars;

/// A literal argument: an expression, or a spread the readers reject.
#[derive(Clone, Copy, Debug)]
pub enum Input<'a> {
    /// An expression.
    Expression(&'a Expression<'a>),
    /// A spread argument or element.
    Spread(Span),
}

impl<'a> Input<'a> {
    /// Reads a call argument.
    pub fn argument(argument: &'a Argument<'a>) -> Self {
        match argument {
            Argument::SpreadElement(spread) => Self::Spread(spread.span),
            argument => argument
                .as_expression()
                .map_or(Self::Spread(argument.span()), Self::Expression),
        }
    }

    /// The source span.
    pub fn span(&self) -> Span {
        match self {
            Self::Expression(expression) => expression.span(),
            Self::Spread(span) => *span,
        }
    }
}

/// Literal readers the lexical theme collector supplies.
pub trait Reader<'a> {
    /// Reads scalar theme data, failing for expressions it does not evaluate.
    ///
    /// # Errors
    ///
    /// Returns `Source.ThemeInvalidError` for unsupported syntax.
    fn data(&mut self, node: Input<'a>) -> Result<Data>;

    /// Looks up a preceding immutable theme or configuration definition.
    ///
    /// # Errors
    ///
    /// Returns `Source.ThemeInvalidError` for configuration helpers a packed contract lacks.
    fn resolve(&mut self, node: Input<'a>) -> Result<Option<Link>>;
}

/// A catalog entry: its key and bound handle.
type Entry = (Arc<str>, Arc<Definition>);

#[cold]
fn invalid(message: &str) -> Error {
    Error::Config(message.to_owned())
}

fn data<'a>(reader: &mut dyn Reader<'a>, node: Input<'a>) -> Result<Data> {
    if let Some(linked) = reader.resolve(node)?
        && (linked.kind == LinkKind::Theme
            || (linked.call.variable_config && linked.call.selection))
    {
        if linked.definition.metadata.contract.variable_set {
            return Ok(Data::Theme(Arc::new(variable_sets::from(
                &linked.definition.metadata,
            )?)));
        }

        return Ok(Data::Theme(Arc::clone(&linked.definition)));
    }

    let Input::Expression(expression) = node else {
        return reader.data(node);
    };

    match expression {
        Expression::TSAsExpression(inner) => data(reader, Input::Expression(&inner.expression)),
        Expression::TSSatisfiesExpression(inner) => {
            data(reader, Input::Expression(&inner.expression))
        }
        Expression::BooleanLiteral(literal) if !literal.value => Ok(Data::Bool(false)),
        Expression::ArrayExpression(array) => {
            let mut items = Vec::with_capacity(array.elements.len());

            for element in &array.elements {
                let element = match element {
                    ArrayExpressionElement::SpreadElement(_)
                    | ArrayExpressionElement::Elision(_) => None,
                    element => element.as_expression(),
                };
                let Some(element) = element else {
                    return Err(invalid("Configuration arrays require literal entries."));
                };

                items.push(data(reader, Input::Expression(element))?);
            }

            Ok(Data::Array(Arc::new(items)))
        }
        Expression::ObjectExpression(object) => {
            let mut entries = Object::new();

            for property in &object.properties {
                let ObjectPropertyKind::ObjectProperty(property) = property else {
                    return Err(invalid(
                        "Configuration requires static properties without spreads or methods.",
                    ));
                };

                if property.computed || property.method || property.kind != PropertyKind::Init {
                    return Err(invalid(
                        "Configuration requires static properties without spreads or methods.",
                    ));
                }

                let key = match &property.key {
                    PropertyKey::StaticIdentifier(identifier) => Some(identifier.name.to_string()),
                    PropertyKey::StringLiteral(literal) => Some(literal.value.to_string()),
                    PropertyKey::NumericLiteral(literal) => Some(js::number(literal.value)),
                    _ => None,
                };
                let Some(key) = key.filter(|key| !entries.has(key)) else {
                    return Err(invalid("Configuration requires unique literal keys."));
                };
                let value = data(reader, Input::Expression(&property.value))?;

                entries.insert(key, value);
            }

            Ok(Data::from(entries))
        }
        _ => reader.data(node),
    }
}

/// Reads a direct configuration factory without executing authored expressions.
///
/// `name` is the stable module and binding identity of the configuration.
///
/// # Errors
///
/// Returns `Config.InvalidError` and `Vars.InvalidError` for invalid options, which the theme
/// collector locates at the call, and `Source.ThemeInvalidError` from the literal readers.
pub fn collect<'a>(
    reader: &mut dyn Reader<'a>,
    expression: &'a CallExpression<'a>,
    name: &str,
    native_provider: bool,
) -> Result<Link> {
    if expression.arguments.len() > 1 {
        return Err(invalid("Config.create accepts one literal options object."));
    }

    let mut input = match expression.arguments.first() {
        Some(argument) => data(reader, Input::argument(argument))?,
        None => Data::from(Object::new()),
    };

    config::create(&input)?;

    let authored = input.as_object().cloned().unwrap_or_default();
    let field = |key: &str| authored.get(key).cloned().unwrap_or(Data::Undefined);
    let variable_mode = !field("vars").is_undefined();

    if variable_mode {
        let mappings = variable_sets::mappings(&field("mappings"))?;
        let wrap = |value: &Data| -> Result<Data> {
            let variables = match value {
                Data::Theme(definition) => Arc::clone(definition),
                _ => Arc::new(vars::define(value, None, None)?),
            };

            Ok(Data::Theme(Arc::new(variable_sets::theme(
                &variables,
                mappings.clone(),
            )?)))
        };
        let mut rest = Object::new();

        for (key, value) in authored.iter() {
            if !matches!(&**key, "vars" | "defaultVars" | "mappings") {
                rest.insert(Arc::clone(key), value.clone());
            }
        }

        let default_vars = field("defaultVars");

        if default_vars.is_undefined() {
            rest.insert("theme", wrap(&field("vars"))?);
        } else {
            let mut themes = Object::new();

            for (key, value) in entries(&field("vars")) {
                themes.insert(key, wrap(&value)?);
            }

            rest.insert("defaultTheme", default_vars);
            rest.insert("themes", Data::from(themes));
        }

        input = Data::from(rest);
    }

    let config = configuration::create(&input)?;
    let input = config.input.clone();
    let field = |key: &str| input.get(key).cloned().unwrap_or(Data::Undefined);
    let (themed, catalog): (bool, Vec<Entry>) = match &config.catalog {
        Catalog::Themes { themes, .. } => (
            true,
            themes
                .iter()
                .map(|(key, value)| (Arc::clone(key), Arc::clone(value)))
                .collect(),
        ),
        Catalog::Theme(theme) => (false, vec![(Arc::from("theme"), Arc::clone(theme))]),
        Catalog::None(_) => (false, Vec::new()),
    };
    let id = field("id");
    let identity: Arc<str> = match id.as_str() {
        Some(id) => identity::require_id(Some(id), "Config.create")?.into(),
        None if id.is_undefined() => Arc::from(name),
        None => identity::require_id(None, "Config.create")?.into(),
    };
    let shorthands_input = field("shorthands");
    let html = field("output").as_str() == Some("html");
    // Configurations.ts creates these own properties in this order, and variable mode always
    // creates `mappings`, even when it is undefined.
    let mut keys = Vec::with_capacity(6);

    if variable_mode {
        keys.extend([ContractKey::VariableSet, ContractKey::Mappings]);
    }

    if !field("composition").is_undefined() {
        keys.push(ContractKey::Composition);
    }

    keys.push(ContractKey::CssOutput);

    if !field("defaultLayer").is_undefined() {
        keys.push(ContractKey::DefaultLayer);
    }

    if !shorthands_input.is_undefined() {
        keys.push(ContractKey::Shorthands);
    }

    let contract = Arc::new(Contract {
        keys: Some(Arc::from(keys)),
        complete: !id.is_undefined(),
        composition: field("composition")
            .as_str()
            .and_then(token::Composition::parse),
        css_output: Some(
            field("cssOutput")
                .as_str()
                .and_then(CssOutput::parse)
                .unwrap_or(CssOutput::Atomic),
        ),
        default_layer: field("defaultLayer").as_str().map(Arc::from),
        identity: Some(Arc::clone(&identity)),
        mappings: if variable_mode {
            variable_sets::mappings(&authored.get("mappings").cloned().unwrap_or(Data::Undefined))?
        } else {
            None
        },
        shorthands: if shorthands_input.is_undefined() {
            None
        } else {
            Some(shorthands::read(&shorthands_input)?)
        },
        variable_set: variable_mode,
    });
    let shorthands_type = if shorthands_input.is_undefined() {
        type_text(&Data::from(Object::new()))
    } else {
        type_text(&shorthands_input)
    };
    let mut members: Record<Link> = Record::new();

    for (key, original) in &catalog {
        let member_name: Arc<str> = format!("{identity}-{key}").into();
        let definition = Arc::new(token::bind(original, &contract, Some(key))?);
        let token_type: Arc<str> = type_text(&leaf_data(original)).into();
        let call = Call {
            end: expression.span.end,
            name: Arc::clone(&member_name),
            output: html.then_some(Output::Html),
            start: expression.span.start,
            token_type: Arc::clone(&token_type),
            type_text: (html || !shorthands_input.is_undefined()).then(|| {
                Arc::from(format!(
                    "import('zyzz').Config.create.ReturnType<{{theme:{token_type};{}shorthands:{shorthands_type}}}>['theme']",
                    if html { "output:'html';" } else { "" }
                ))
            }),
            ..Call::default()
        };
        let path = if themed {
            js::stringify(&js::Value::Array(vec![
                js::Value::from("themes"),
                js::Value::from(&**key),
            ]))
        } else {
            "[\"theme\"]".to_owned()
        };

        members.insert(
            path,
            Link {
                binding: member_name,
                call,
                definition,
                kind: LinkKind::Theme,
                members: None,
                style: None,
            },
        );
    }

    let default_theme = field("defaultTheme");
    let selected_key = if themed {
        js::stringify(&js::Value::Array(vec![
            js::Value::from("themes"),
            js::Value::from(default_theme.to_js_string()),
        ]))
    } else {
        "[\"theme\"]".to_owned()
    };
    let selected = members.get(&selected_key).cloned();

    if themed && let Some(selected) = &selected {
        members.insert("[\"theme\"]", selected.clone());
    }

    if variable_mode && let Some(selected) = &selected {
        members.insert(
            "[\"vars\"]",
            Link {
                call: Call {
                    direct_variables: true,
                    type_text: Some(
                        format!(
                            "import('zyzz').Vars.References<{}>",
                            selected.call.token_type
                        )
                        .into(),
                    ),
                    ..selected.call.clone()
                },
                ..selected.clone()
            },
        );
    }

    let definition = match &selected {
        Some(selected) => Arc::clone(&selected.definition),
        None => Arc::new(token::bind(
            &theme::define(&Data::from(Object::new()), None)?,
            &contract,
            None,
        )?),
    };
    let mut normalized = Object::new();

    if themed {
        let mut themes = Object::new();

        for (key, _) in &catalog {
            let path = js::stringify(&js::Value::Array(vec![
                js::Value::from("themes"),
                js::Value::from(&**key),
            ]));

            if let Some(member) = members.get(&path) {
                themes.insert(Arc::clone(key), leaf_data(&member.definition));
            }
        }

        normalized.insert("defaultTheme", default_theme.clone());
        normalized.insert("themes", Data::from(themes));
    } else if matches!(config.catalog, Catalog::Theme(_)) {
        normalized.insert("theme", leaf_data(&definition));
    }

    if !id.is_undefined() {
        normalized.insert("id", id.clone());
    }

    for key in ["composition", "cssOutput"] {
        let value = field(key);

        if truthy(&value) {
            normalized.insert(key, value);
        }
    }

    if !field("defaultLayer").is_undefined() {
        normalized.insert("defaultLayer", field("defaultLayer"));
    }

    for key in ["shorthands", "output", "layers", "storageKey"] {
        let value = field(key);

        if truthy(&value) {
            normalized.insert(key, value);
        }
    }

    let authored_type = if variable_mode {
        let mut options = normalized.clone();

        for key in ["theme", "themes", "defaultTheme"] {
            options.insert(key, Data::Undefined);
        }

        let vars = normalized
            .get(if themed { "themes" } else { "theme" })
            .cloned()
            .unwrap_or(Data::Undefined);

        options.insert("vars", vars);

        if themed {
            options.insert("defaultVars", default_theme.clone());
        }

        if let Some(mappings) = authored
            .get("mappings")
            .filter(|value| !value.is_undefined())
        {
            options.insert("mappings", mappings_data(mappings)?);
        }

        type_text(&Data::from(options))
    } else {
        type_text(&Data::from(normalized.clone()))
    };
    let type_text = if native_provider {
        format!("import('zyzz/react-native').defineConfig.ReturnType<{authored_type}>")
    } else if variable_mode {
        format!("import('zyzz').Config.VariableConfig<{authored_type}>")
    } else {
        format!("import('zyzz').Config.create.ReturnType<{authored_type}>")
    };
    let call_members: Record<Arc<str>> = members
        .iter()
        .map(|(key, link)| (Arc::clone(key), Arc::clone(&link.call.name)))
        .collect();

    Ok(Link {
        binding: Arc::from(name),
        call: Call {
            appearance: true,
            end: expression.span.end,
            members: Some(call_members),
            name: selected.as_ref().map_or_else(
                || Arc::from(name),
                |selected| Arc::clone(&selected.call.name),
            ),
            native_provider,
            options: Some(normalized),
            script: true,
            start: expression.span.start,
            token_type: selected.as_ref().map_or_else(
                || Arc::from("{}"),
                |selected| Arc::clone(&selected.call.token_type),
            ),
            type_text: Some(type_text.into()),
            variable_config: variable_mode,
            variable_mappings: if variable_mode {
                authored_mappings(&authored.get("mappings").cloned().unwrap_or(Data::Undefined))
            } else {
                None
            },
            ..Call::default()
        },
        definition,
        kind: LinkKind::Config,
        members: Some(members),
        style: None,
    })
}

/// Lists the entries `Object.entries` reports for a record or raw variable set.
fn entries(value: &Data) -> Vec<(Arc<str>, Data)> {
    let tree = match value {
        Data::Theme(definition) => &definition.tokens,
        value => value,
    };

    tree.as_object()
        .map(|object| {
            object
                .iter()
                .map(|(key, value)| (Arc::clone(key), value.clone()))
                .collect()
        })
        .unwrap_or_default()
}

/// Whether a value is truthy in JavaScript.
fn truthy(value: &Data) -> bool {
    match value {
        Data::Undefined | Data::Null => false,
        Data::Bool(value) => *value,
        Data::Number(number) => *number != 0.0 && !number.is_nan(),
        Data::String(text) => !text.is_empty(),
        _ => true,
    }
}

/// Validated mappings as the data `VariableSets.mappings` returns.
fn mappings_data(input: &Data) -> Result<Data> {
    Ok(match variable_sets::mappings(input)? {
        None => Data::Undefined,
        Some(token::Mappings::Disabled) => Data::Bool(false),
        Some(token::Mappings::Categories(categories)) => Data::from(Object::from_entries(
            categories.iter().map(|(category, properties)| {
                (
                    Arc::clone(category),
                    Data::Array(Arc::new(
                        properties
                            .iter()
                            .map(|property| Data::String(Arc::clone(property)))
                            .collect(),
                    )),
                )
            }),
        )),
    })
}

/// Authored mappings in their authored key order, as configuration calls retain them.
fn authored_mappings(input: &Data) -> Option<token::Mappings> {
    match input {
        Data::Bool(false) => Some(token::Mappings::Disabled),
        Data::Object(object) => Some(token::Mappings::Categories(
            object
                .iter()
                .map(|(category, properties)| {
                    let properties: Vec<Arc<str>> = match properties {
                        Data::Array(items) => items
                            .iter()
                            .filter_map(|item| item.as_str().map(Arc::from))
                            .collect(),
                        _ => Vec::new(),
                    };

                    (Arc::clone(category), properties.into())
                })
                .collect(),
        )),
        _ => None,
    }
}

/// Authored leaf values and query thresholds of a definition.
fn leaf_data(definition: &Definition) -> Data {
    let mut object = values(&definition.tokens)
        .as_object()
        .cloned()
        .unwrap_or_default();

    for (key, value) in queries(&definition.metadata) {
        object.insert(key, value);
    }

    Data::from(object)
}

/// The query thresholds of a definition as the data object metadata spreads.
pub fn queries(metadata: &Metadata) -> Vec<(&'static str, Data)> {
    let Some(queries) = metadata.queries.as_deref() else {
        return Vec::new();
    };
    let thresholds = |entries: &indexmap::IndexMap<String, String, rustc_hash::FxBuildHasher>| {
        Data::from(Object::from_entries(entries.iter().map(|(name, value)| {
            (Arc::from(name.as_str()), Data::from(value.as_str()))
        })))
    };

    vec![
        ("breakpoint", thresholds(&queries.breakpoint)),
        (
            "containerNames",
            Data::Array(Arc::new(
                queries
                    .container_names
                    .iter()
                    .map(|name| Data::from(name.as_str()))
                    .collect(),
            )),
        ),
        ("container", thresholds(&queries.container)),
    ]
}

/// Encodes validated literal options as a declaration type, never executable text.
pub fn type_text(value: &Data) -> String {
    let mut output = String::new();

    write_type(&mut output, value);

    output
}

fn write_type(output: &mut String, value: &Data) {
    match value {
        Data::Expression(expression) if expression.group.is_some() => {
            output.push_str("import('zyzz').Vars.Composition<'");
            output.push_str(expression.group.as_deref().unwrap_or_default());
            output.push_str("'>");
        }
        Data::Token(reference) => {
            output.push_str("import('zyzz').Vars.Reference<'");
            output.push_str(&reference.group);
            output.push_str("'>");
        }
        Data::Array(items) => {
            output.push_str("readonly [");

            for (index, item) in items.iter().enumerate() {
                if index > 0 {
                    output.push(',');
                }

                // `Array.prototype.join` prints `undefined` as an empty string.
                if !item.is_undefined() {
                    write_type(output, item);
                }
            }

            output.push(']');
        }
        Data::Undefined => output.push_str("undefined"),
        Data::Null => output.push_str("null"),
        Data::Bool(value) => output.push_str(if *value { "true" } else { "false" }),
        Data::Number(number) => js::write_value(output, &js::Value::Number(*number)),
        Data::String(text) => js::write_string(output, text),
        Data::Object(object) => {
            output.push('{');

            let mut first = true;

            for (key, value) in object.iter() {
                if value.is_undefined() {
                    continue;
                }

                if !first {
                    output.push(';');
                }

                first = false;
                output.push_str("readonly ");
                js::write_string(output, key);
                output.push(':');
                write_type(output, value);
            }

            output.push('}');
        }
        Data::Expression(expression) => {
            output.push_str("{readonly \"parts\":");
            write_type(
                output,
                &Data::Array(Arc::new(
                    expression
                        .parts
                        .iter()
                        .map(|part| match part {
                            token::Part::Text(text) => Data::String(Arc::clone(text)),
                            token::Part::Reference(reference) => Data::Token(Arc::clone(reference)),
                            token::Part::Binding(binding) => Data::Binding(Arc::clone(binding)),
                        })
                        .collect(),
                )),
            );
            output.push('}');
        }
        Data::Binding(binding) => {
            output.push_str("{readonly \"name\":");
            js::write_string(output, &binding.name);
            output.push_str(";readonly \"type\":");
            js::write_string(output, binding.domain.as_str());
            output.push_str(";readonly \"variable\":true}");
        }
        Data::Theme(definition) => write_type(output, &definition.tokens),
    }
}

/// Reads the authored leaf values of a reference tree.
pub fn values(tree: &Data) -> Data {
    match tree {
        Data::Object(object) => {
            Data::from(Object::from_entries(object.iter().map(|(key, value)| {
                let value = match value {
                    Data::Token(reference) => variable_sets::value_data(&reference.value),
                    value => values(value),
                };

                (Arc::clone(key), value)
            })))
        }
        other => other.clone(),
    }
}
