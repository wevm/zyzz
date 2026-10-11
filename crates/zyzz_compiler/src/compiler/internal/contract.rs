//! Reads and writes the versioned theme and style metadata independently compiled libraries
//! publish beside their entrypoints.
//!
//! Reading validates the JSON as data and never evaluates package code.

use std::sync::Arc;

use rustc_hash::FxHashMap;

use crate::compiler::internal::configurations;
use crate::compiler::internal::identifiers;
use crate::compiler::internal::packed_styles;
use crate::compiler::internal::stylesheets::{self, Section};
use crate::compiler::internal::themes::{
    Call, FunctionParameter, FunctionSignature, Link, LinkKind, Output,
};
use crate::compiler::source::NativeContext;
use crate::data::{Data, Object};
use crate::error::{Error, Result};
use crate::internal::binding::{self, Domain};
use crate::internal::token::{self, Composition, Contract, ContractKey, CssOutput, Map, Mappings};
use crate::internal::{
    configuration, function_syntax, rule_reference, shorthands, theme, variable_sets,
};
use crate::js::{self, Record};
use crate::runtime::recipe::Scalar;

/// A library contract's validated metadata.
pub struct Library {
    /// Exact emitted rules by class name, for collision checks.
    pub class_rules: Record<Arc<str>>,
    /// Exported authoring values by export name.
    pub links: Record<Link>,
    /// Packed stylesheet sections.
    pub stylesheets: Vec<Section>,
    /// Theme and variable-set definitions by scope key.
    pub themes: Record<Arc<theme::Definition>>,
}

/// Contract hooks for CSS parsing, which belongs to the at-rule adapter.
pub struct Hooks<'h> {
    /// Decodes a CSS identifier, or `None` when it is invalid.
    pub identifier: &'h dyn Fn(&str) -> Option<String>,
    /// Parses a stylesheet section's CSS without error recovery.
    pub validate: &'h dyn Fn(&str, &str) -> Result<()>,
}

fn message(text: &str) -> Error {
    Error::Message(text.to_owned())
}

fn record(value: &Data) -> Result<&Object> {
    match value {
        Data::Object(object) => Ok(object),
        _ => Err(message("Expected a Zyzz contract record.")),
    }
}

fn string(value: &Data) -> Result<Arc<str>> {
    match value {
        Data::String(text) if !text.is_empty() => Ok(Arc::clone(text)),
        _ => Err(message("Expected a nonempty Zyzz contract identity.")),
    }
}

fn get<'d>(object: &'d Object, key: &str) -> &'d Data {
    object.get(key).unwrap_or(&Data::Undefined)
}

fn is_true(value: &Data) -> bool {
    matches!(value, Data::Bool(true))
}

/// JavaScript truthiness of a data value.
fn truthy(value: &Data) -> bool {
    match value {
        Data::Undefined | Data::Null | Data::Bool(false) => false,
        Data::Number(number) => *number != 0.0 && !number.is_nan(),
        Data::String(text) => !text.is_empty(),
        _ => true,
    }
}

/// Matches `^prefix[a-zA-Z0-9_-]+$`.
fn identity_like(value: &str, prefix: &str) -> bool {
    value.strip_prefix(prefix).is_some_and(|rest| {
        !rest.is_empty()
            && rest
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-')
    })
}

/// Serializes mappings as `JSON.stringify(mappings ?? {})`.
pub fn mappings_json(mappings: Option<&Mappings>) -> String {
    match mappings {
        None => "{}".to_owned(),
        Some(Mappings::Disabled) => "false".to_owned(),
        Some(Mappings::Categories(categories)) => {
            let mut output = String::new();

            js::write_object(
                &mut output,
                categories
                    .iter()
                    .map(|(name, properties)| (&**name, properties)),
                |output, properties| {
                    output.push('[');

                    for (index, property) in properties.iter().enumerate() {
                        if index > 0 {
                            output.push(',');
                        }

                        js::write_string(output, property);
                    }

                    output.push(']');
                },
            );

            output
        }
    }
}

/// The shorthand signature of a parsed mapping, as `Shorthands.signature` computes it.
pub fn shorthand_signature(map: Option<&Map<Arc<[Arc<str>]>>>) -> String {
    let mut entries: Vec<_> = map.map(|map| map.iter().collect()).unwrap_or_default();

    entries.sort_by(|left, right| js::code_units(left.0).cmp(js::code_units(right.0)));

    let mut output = String::from("[");

    for (index, (name, targets)) in entries.into_iter().enumerate() {
        if index > 0 {
            output.push(',');
        }

        output.push('[');
        js::write_string(&mut output, name);
        output.push_str(",[");

        for (index, target) in targets.iter().enumerate() {
            if index > 0 {
                output.push(',');
            }

            js::write_string(&mut output, target);
        }

        output.push_str("]]");
    }

    output.push(']');
    output
}

/// Converts decoded contract data into a token value.
fn token_value(value: &Data) -> token::Value {
    match value {
        Data::Number(number) => token::Value::Number(*number),
        Data::Token(reference) => token::Value::Reference(Arc::clone(reference)),
        Data::Expression(expression) => token::Value::Composition(Arc::clone(expression)),
        Data::Object(object) => token::Value::Record(
            object
                .iter()
                .map(|(key, value)| (Arc::clone(key), token_value(value)))
                .collect(),
        ),
        Data::String(text) => token::Value::String(Arc::clone(text)),
        other => token::Value::String(other.to_js_string().into()),
    }
}

struct Reader<'r> {
    identities: &'r mut FxHashMap<Arc<str>, Arc<Contract>>,
    module_id: &'r str,
    themes: Record<Arc<theme::Definition>>,
    types: FxHashMap<Arc<str>, String>,
    version: u32,
}

impl Reader<'_> {
    fn validate_variables(&self, entry: &Object) -> Result<()> {
        if self.version < 31 || !get(entry, "variableNaming").is_undefined() {
            return Err(message(
                "Legacy packed variable names are unsupported. Rebuild the library with the current version of Zyzz.",
            ));
        }

        Ok(())
    }

    fn decode(&mut self, value: &Data) -> Result<Data> {
        match value {
            Data::Array(items) => Ok(Data::Array(Arc::new(
                items
                    .iter()
                    .map(|item| self.decode(item))
                    .collect::<Result<_>>()?,
            ))),
            Data::Object(fields) => {
                if fields.has("$object") {
                    let inner = record(get(fields, "$object"))?;
                    let mut object = Object::new();

                    for (key, value) in inner.iter() {
                        object.insert(Arc::clone(key), self.decode(value)?);
                    }

                    return Ok(Data::from(object));
                }

                if fields.has("$composition") {
                    if self.version < 29 {
                        return Err(message(
                            "Composed variables require contract version 29 or later.",
                        ));
                    }

                    let composition = record(get(fields, "$composition"))?;
                    let group = get(composition, "group")
                        .as_str()
                        .filter(|group| matches!(*group, "color" | "spacing"));
                    let (Some(group), Data::Array(parts)) = (group, get(composition, "parts"))
                    else {
                        return Err(message("Invalid packed variable composition."));
                    };
                    let parts: Vec<Data> = parts
                        .iter()
                        .map(|part| self.decode(part))
                        .collect::<Result<_>>()?;

                    return Ok(Data::Expression(crate::vars::compose(group, &parts)?));
                }

                if fields.has("$variable") {
                    let reference = record(get(fields, "$variable"))?;
                    let identity = string(get(reference, "identity"))?;

                    self.validate_variables(reference)?;

                    let contract = match self.identities.get(&identity) {
                        Some(contract) if !contract.variable_set => {
                            return Err(message(
                                "Conflicting packed variable-set modes for one identity.",
                            ));
                        }
                        Some(contract) => Arc::clone(contract),
                        None => {
                            let contract = Arc::new(Contract {
                                identity: Some(Arc::clone(&identity)),
                                keys: Some(Arc::from([ContractKey::VariableSet])),
                                variable_set: true,
                                ..Contract::default()
                            });

                            self.identities.insert(identity, Arc::clone(&contract));
                            contract
                        }
                    };
                    let resolved = token_value(&self.decode(get(reference, "value"))?);
                    let path = string(get(reference, "path"))?;

                    return Ok(Data::Token(token::create(
                        &contract,
                        variable_sets::domain(&resolved),
                        path,
                        resolved,
                    )));
                }

                let mut object = Object::new();

                for (key, value) in fields.iter() {
                    object.insert(Arc::clone(key), self.decode(value)?);
                }

                Ok(Data::from(object))
            }
            value => Ok(value.clone()),
        }
    }
}

/// Collects per-identity CSS output modes that contracts before version 17 record on options.
fn legacy_modes(data: &Object) -> Result<FxHashMap<Arc<str>, CssOutput>> {
    fn visit(
        value: &Data,
        themes: &Data,
        modes: &mut FxHashMap<Arc<str>, CssOutput>,
    ) -> Result<()> {
        let entry = record(value)?;

        if !get(entry, "options").is_undefined() && !get(entry, "theme").is_undefined() {
            let options = record(get(entry, "options"))?;

            if !get(options, "cssOutput").is_undefined() {
                let Some(mode) = get(options, "cssOutput")
                    .as_str()
                    .and_then(CssOutput::parse)
                else {
                    return Err(message("Invalid packed CSS output mode."));
                };
                let theme = record(get(record(themes)?, &string(get(entry, "theme"))?))?;
                let identity = string(get(theme, "identity"))?;

                if modes
                    .get(&identity)
                    .is_some_and(|previous| *previous != mode)
                {
                    return Err(message(
                        "Conflicting packed CSS output modes for one theme identity.",
                    ));
                }

                modes.insert(identity, mode);
            }
        }

        let members = get(entry, "members");

        if !members.is_undefined() {
            for (_, member) in record(members)?.iter() {
                visit(member, themes, modes)?;
            }
        }

        Ok(())
    }

    let mut modes = FxHashMap::default();

    for (_, entry) in record(get(data, "exports"))?.iter() {
        visit(entry, get(data, "themes"), &mut modes)?;
    }

    Ok(modes)
}

/// Raw token values and query thresholds of a theme, for its type text.
fn input(theme: &theme::Definition) -> Data {
    fn tokens(tree: &Data) -> Data {
        match tree {
            Data::Object(object) => {
                Data::from(Object::from_entries(object.iter().map(|(key, value)| {
                    let value = match value {
                        Data::Token(reference) => variable_sets::value_data(&reference.value),
                        value => tokens(value),
                    };

                    (Arc::clone(key), value)
                })))
            }
            value => value.clone(),
        }
    }

    let mut object = match tokens(&theme.tokens) {
        Data::Object(object) => (*object).clone(),
        _ => Object::new(),
    };

    for (key, value) in configurations::queries(&theme.metadata) {
        object.insert(key, value);
    }

    Data::from(object)
}

/// The type text of contract data, as `Contract.ts` writes it.
fn type_text(value: &Data) -> String {
    match value {
        Data::Token(_) | Data::Expression(_) => configurations::type_text(value),
        Data::Array(items) => format!(
            "readonly [{}]",
            items.iter().map(type_text).collect::<Vec<_>>().join(",")
        ),
        Data::Object(object) => {
            let entries: Vec<String> = object
                .iter()
                .map(|(key, value)| format!("readonly {}:{}", js::quote(key), type_text(value)))
                .collect();

            format!("{{{}}}", entries.join(";"))
        }
        Data::Undefined => "undefined".to_owned(),
        value => {
            let mut output = String::new();

            js::write_data(&mut output, value);
            output
        }
    }
}

fn reference_kind(value: &str) -> Option<rule_reference::Kind> {
    Some(match value {
        "colorProfile" => rule_reference::Kind::ColorProfile,
        "counterStyle" => rule_reference::Kind::CounterStyle,
        "cssFunction" => rule_reference::Kind::CssFunction,
        "customMedia" => rule_reference::Kind::CustomMedia,
        "fontPaletteValues" => rule_reference::Kind::FontPaletteValues,
        "positionTry" => rule_reference::Kind::PositionTry,
        _ => return None,
    })
}

/// Whether a string contains a backslash or a character outside ASCII, as
/// `/[\\\u0080-￿]/` tests.
fn extended(value: &str) -> bool {
    value
        .chars()
        .any(|character| character == '\\' || u32::from(character) >= 0x80)
}

fn signature(input: &Data, version: u32) -> Result<FunctionSignature> {
    let invalid = || message("Invalid packed CSS function signature.");
    let value = record(input)?;
    let returns = string(get(value, "returns"))?;
    let Data::Array(parameters) = get(value, "parameters") else {
        return Err(invalid());
    };

    if !function_syntax::accepts(&returns) {
        return Err(invalid());
    }

    if version < 12 {
        let mut old = extended(&returns);

        for parameter in parameters.iter() {
            let parameter = record(parameter)?;
            let syntax = match get(parameter, "syntax") {
                Data::Undefined => Arc::from("*"),
                syntax => string(syntax)?,
            };

            old |= extended(&format!("{}{syntax}", string(get(parameter, "name"))?));
        }

        if old {
            return Err(message(
                "Extended CSS function signatures require contract version 12.",
            ));
        }
    }

    let mut names: Vec<String> = Vec::new();
    let mut result = Vec::with_capacity(parameters.len());

    for parameter in parameters.iter() {
        let parameter = record(parameter)?;
        let name = string(get(parameter, "name"))?;
        let decoded = identifiers::read(&name);
        let syntax = get(parameter, "syntax");
        let default = get(parameter, "default");
        let valid = decoded.as_deref().is_some_and(|decoded| {
            decoded.starts_with("--")
                && decoded != "--"
                && !names.iter().any(|seen| seen == decoded)
        }) && match syntax {
            Data::Undefined => true,
            syntax => function_syntax::accepts(&string(syntax)?),
        } && matches!(default, Data::Undefined | Data::Number(_) | Data::String(_));

        if !valid {
            return Err(message("Invalid packed CSS function parameter."));
        }

        names.extend(decoded);
        result.push(FunctionParameter {
            default: match default {
                Data::Number(number) => Some(Scalar::Number(*number)),
                Data::String(text) => Some(Scalar::String(Arc::clone(text))),
                _ => None,
            },
            name,
            syntax: syntax.as_str().map(Arc::from),
        });
    }

    Ok(FunctionSignature {
        parameters: result,
        returns,
    })
}

/// Configuration options as `Config.create` receives a variable configuration.
fn variable_options(options: &Object, mappings: &Data) -> Data {
    let mut result = Object::new();

    for (key, value) in options.iter() {
        if !matches!(&**key, "theme" | "themes" | "defaultTheme") {
            result.insert(Arc::clone(key), value.clone());
        }
    }

    let themes = get(options, "themes");

    result.insert(
        "vars",
        if themes.is_undefined() {
            get(options, "theme").clone()
        } else {
            themes.clone()
        },
    );

    if !themes.is_undefined() {
        result.insert(
            "defaultVars",
            Data::string(get(options, "defaultTheme").to_js_string()),
        );
    }

    if !mappings.is_undefined() {
        result.insert("mappings", mappings.clone());
    }

    Data::from(result)
}

/// The contract version, when it is one this compiler reads.
#[expect(clippy::float_cmp, reason = "Versions are exact JSON integers.")]
fn supported(value: &Data) -> Option<u32> {
    let Data::Number(version) = value else {
        return None;
    };

    (1..=34).find(|candidate| *version == f64::from(*candidate))
}

fn empty_theme() -> Result<Arc<theme::Definition>> {
    Ok(Arc::new(theme::define(&Data::from(Object::new()), None)?))
}

/// Reads a library contract.
///
/// `identities` shares contracts by identity across every contract of one graph, so references
/// from different libraries to one theme compare equal.
///
/// # Errors
///
/// Returns the TypeScript messages for malformed JSON, unsupported versions, and invalid or
/// conflicting metadata.
pub fn read(
    source: &str,
    identities: &mut FxHashMap<Arc<str>, Arc<Contract>>,
    module_id: &str,
    hooks: &Hooks<'_>,
) -> Result<Library> {
    let parsed: serde_json::Value =
        serde_json::from_str(source).map_err(|error| Error::Message(error.to_string()))?;
    let parsed = Data::from_json(&parsed);
    let data = record(&parsed)?;
    let Some(version) = supported(get(data, "version")) else {
        return Err(message("Unsupported Zyzz contract version."));
    };
    // Root controls arrived with version 18, so older readers treat them as absent.
    let root_controls = version >= 18;
    let legacy = if version < 17 {
        legacy_modes(data)?
    } else {
        FxHashMap::default()
    };
    let mut reader = Reader {
        identities,
        module_id,
        themes: Record::new(),
        types: FxHashMap::default(),
        version,
    };

    for (name, value) in record(get(data, "themes"))?.iter() {
        let entry = record(value)?;
        let identity = string(get(entry, "identity"))?;

        if !record(get(entry, "tokens"))?.is_empty() || !get(entry, "variableNaming").is_undefined()
        {
            reader.validate_variables(entry)?;
        }

        let variable_set = is_true(get(entry, "variableSet"));

        if variable_set && version < 28 {
            return Err(message(
                "Vars contracts require contract version 28 or later.",
            ));
        }

        let mappings = variable_sets::mappings(get(entry, "mappings"))?;
        let css_output = match get(entry, "cssOutput") {
            Data::Undefined => legacy.get(&identity).copied(),
            value => Some(
                value
                    .as_str()
                    .and_then(CssOutput::parse)
                    .ok_or_else(|| message("Invalid packed CSS output mode."))?,
            ),
        };
        let composition = match get(entry, "composition") {
            Data::Undefined => None,
            _ if version < 34 => {
                return Err(message(
                    "Composition modes require contract version 34 or later.",
                ));
            }
            value => Some(
                value
                    .as_str()
                    .and_then(Composition::parse)
                    .ok_or_else(|| message("Invalid packed composition mode."))?,
            ),
        };
        let default_layer = match get(entry, "defaultLayer") {
            Data::Undefined => None,
            _ if version < 27 => {
                return Err(message(
                    "Default layers require contract version 27 or later.",
                ));
            }
            value => {
                let mut options = Object::new();

                options.insert("defaultLayer", value.clone());
                configuration::create(&Data::from(options))?;
                value.as_str().map(Arc::from)
            }
        };
        let shorthands = match get(entry, "shorthands") {
            Data::Undefined => None,
            value => Some(shorthands::read(value)?),
        };
        let contract = if let Some(contract) = reader.identities.get(&identity) {
            if contract.variable_set != variable_set {
                return Err(message(
                    "Conflicting packed variable-set modes for one identity.",
                ));
            }

            if mappings_json(contract.mappings.as_ref()) != mappings_json(mappings.as_ref()) {
                return Err(message(
                    "Conflicting packed variable mappings for one identity.",
                ));
            }

            if shorthand_signature(contract.shorthands.as_ref())
                != shorthand_signature(shorthands.as_ref())
            {
                return Err(message(
                    "Conflicting packed shorthand mappings for one theme identity.",
                ));
            }

            if contract.composition.unwrap_or(Composition::Ordered)
                != composition.unwrap_or(Composition::Ordered)
            {
                return Err(message(
                    "Conflicting packed composition modes for one theme identity.",
                ));
            }

            if contract.css_output.unwrap_or(CssOutput::Atomic)
                != css_output.unwrap_or(CssOutput::Atomic)
            {
                return Err(message(
                    "Conflicting packed CSS output modes for one theme identity.",
                ));
            }

            if contract.default_layer != default_layer {
                return Err(message(
                    "Conflicting packed default layers for one theme identity.",
                ));
            }

            Arc::clone(contract)
        } else {
            let contract = Arc::new(Contract {
                complete: true,
                composition,
                css_output,
                default_layer: default_layer.clone(),
                identity: Some(Arc::clone(&identity)),
                // Contract.ts spreads variable metadata, shorthands, then modes.
                keys: Some(Arc::from([
                    ContractKey::VariableSet,
                    ContractKey::Mappings,
                    ContractKey::Shorthands,
                    ContractKey::Composition,
                    ContractKey::CssOutput,
                    ContractKey::DefaultLayer,
                ])),
                mappings: if variable_set { mappings.clone() } else { None },
                shorthands: shorthands.clone(),
                variable_set,
            });

            reader
                .identities
                .insert(Arc::clone(&identity), Arc::clone(&contract));
            contract
        };
        let definition = if variable_set {
            let tokens = reader.decode(get(entry, "tokens"))?;

            variable_sets::theme(&crate::vars::define(&tokens, None, None)?, mappings)?
        } else {
            theme::define(&Data::from(record(get(entry, "tokens"))?.clone()), None)?
        };
        let has = |key: &str| {
            definition
                .tokens
                .as_object()
                .is_some_and(|tokens| tokens.has(key))
        };

        if version < 24 && has("typography") {
            return Err(message(
                "Packed typography sets require contract version 24 or later.",
            ));
        }

        if version < 25 && (definition.metadata.paths.is_some() || has("borderWidth")) {
            return Err(message(
                "Packed responsive typography and border widths require contract version 25 or later.",
            ));
        }

        let css_name = match get(entry, "cssName") {
            Data::Undefined => None,
            value => Some(string(value)?),
        };
        let bound = token::bind(&definition, &contract, css_name.as_deref())?;

        reader
            .types
            .insert(Arc::clone(name), type_text(&input(&definition)));
        reader.themes.insert(Arc::clone(name), Arc::new(bound));
    }

    let mut links = Record::new();

    for (name, value) in record(get(data, "exports"))?.iter() {
        links.insert(Arc::clone(name), reader.link(value, root_controls)?);
    }

    let mut class_rules = Record::new();
    let rules = get(data, "classRules");

    if !rules.is_undefined() {
        for (name, body) in record(rules)?.iter() {
            if name.is_empty() || name.chars().any(js::is_whitespace) {
                return Err(message("Invalid packed class name."));
            }

            class_rules.insert(Arc::clone(name), string(body)?);
        }
    }

    let stylesheets =
        stylesheets::read(get(data, "stylesheets"), hooks.validate, hooks.identifier)?;

    Ok(Library {
        class_rules,
        links,
        stylesheets,
        themes: reader.themes,
    })
}

impl Reader<'_> {
    fn link(&mut self, value: &Data, root_controls: bool) -> Result<Link> {
        let raw = record(value)?;
        let version = self.version;

        if !get(raw, "nativeProvider").is_undefined() && version < 32 {
            return Err(message(
                "Native providers require contract version 32 or later.",
            ));
        }

        // Contracts before version 19 record style authoring exports as `css`.
        let kind = match get(raw, "kind").as_str() {
            Some("css") if version < 19 => Some("style"),
            kind => kind,
        };
        let entry = raw;

        match kind {
            Some("variables") => self.variables(entry),
            Some("rule-reference") => {
                let name = string(get(entry, "name"))?;
                let reference = string(get(entry, "reference"))?;
                let kind = reference_kind(&reference);
                let prefix = format!(
                    "{}z-{}",
                    if &*reference == "counterStyle" {
                        ""
                    } else {
                        "--"
                    },
                    reference.to_lowercase()
                );
                let valid = (9..=34).contains(&version)
                    && kind.is_some()
                    && (identity_like(&name, "z-") || identity_like(&name, "--z-"))
                    && name.starts_with(&prefix)
                    && get(entry, "binding").as_str() == Some(&*name);

                if !valid {
                    return Err(message("Invalid named stylesheet identity."));
                }

                let function = match kind {
                    Some(rule_reference::Kind::CssFunction) => {
                        Some(signature(get(entry, "function"), version)?)
                    }
                    _ => None,
                };

                Ok(Link {
                    binding: string(get(entry, "binding"))?,
                    call: Call {
                        function,
                        name,
                        reference: kind,
                        token_type: Arc::from("{}"),
                        ..Call::default()
                    },
                    definition: empty_theme()?,
                    kind: LinkKind::RuleReference,
                    members: None,
                    style: None,
                })
            }
            Some("animation") => {
                let name = string(get(entry, "name"))?;

                if !identity_like(&name, "z-k") {
                    return Err(message("Invalid animation identity."));
                }

                Ok(Link {
                    binding: string(get(entry, "binding"))?,
                    call: Call {
                        name,
                        token_type: Arc::from("{}"),
                        ..Call::default()
                    },
                    definition: empty_theme()?,
                    kind: LinkKind::Animation,
                    members: None,
                    style: None,
                })
            }
            Some("style-reference") => self.style_reference(entry, root_controls),
            _ => self.configured(entry, kind, root_controls),
        }
    }

    fn variables(&mut self, entry: &Object) -> Result<Link> {
        if self.version < 14 {
            return Err(message(
                "Legacy variable contracts require recompilation with variable().",
            ));
        }

        let mut names: Vec<String> = Vec::new();
        let mut slots = Record::new();

        for (key, value) in record(get(entry, "variables"))?.iter() {
            let invalid = || message("Invalid packed variable contract.");
            let slot = record(value)?;

            if matches!(&**key, "set" | "__proto__") {
                return Err(invalid());
            }

            let name = string(get(slot, "name"))?;

            if names.iter().any(|seen| **seen == *name) || !identity_like(&name, "--z-") {
                return Err(invalid());
            }

            let Some(domain) = get(slot, "type").as_str().and_then(Domain::parse) else {
                return Err(invalid());
            };

            names.push(name.to_string());
            slots.insert(
                Arc::clone(key),
                Arc::new(binding::Reference {
                    domain,
                    dynamic: false,
                    name: name.to_string(),
                    zero: false,
                }),
            );
        }

        let binding = string(get(entry, "binding"))?;
        let members = match get(entry, "members") {
            members if !truthy(members) => None,
            members => Some(self.members(members, false)?),
        };
        let variable_owner = match get(entry, "source") {
            Data::Undefined => None,
            source => Some(Arc::from(stylesheets::resolve(
                self.module_id,
                &string(source)?,
            )?)),
        };

        Ok(Link {
            binding: Arc::clone(&binding),
            call: Call {
                name: binding,
                token_type: Arc::from("{}"),
                variable_owner,
                variables: Some(slots),
                ..Call::default()
            },
            definition: empty_theme()?,
            kind: LinkKind::Variables,
            members,
            style: None,
        })
    }

    fn members(&mut self, value: &Data, root_controls: bool) -> Result<Record<Link>> {
        let mut members = Record::new();

        for (key, value) in record(value)?.iter() {
            members.insert(Arc::clone(key), self.link(value, root_controls)?);
        }

        Ok(members)
    }

    fn style_reference(&mut self, entry: &Object, root_controls: bool) -> Result<Link> {
        let version = self.version;

        if !get(entry, "style").is_undefined() && version < 16 {
            return Err(message(
                "Packed callable styles require contract version 16 or later.",
            ));
        }

        let binding = string(get(entry, "binding"))?;

        if !identity_like(&binding, "z-style-") {
            return Err(message("Invalid style reference identity."));
        }

        let members = match get(entry, "members") {
            Data::Undefined => None,
            value => {
                let mut members = Record::new();

                for (key, value) in record(value)?.iter() {
                    let member = self.link(value, root_controls)?;

                    if member.kind != LinkKind::StyleReference
                        || (member.members.is_some() && version < 22)
                    {
                        return Err(message("Invalid style reference member."));
                    }

                    members.insert(Arc::clone(key), member);
                }

                Some(members)
            }
        };
        let native_context = match get(entry, "nativeContext") {
            Data::Undefined => None,
            _ if version < 33 => {
                return Err(message(
                    "Native style catalogs require contract version 33 or later.",
                ));
            }
            _ if get(entry, "style").is_undefined() => {
                return Err(message("Native style catalogs require a packed style."));
            }
            value => {
                let context = record(value)?;
                let mut vars = Record::new();

                for (name, value) in record(get(context, "vars"))?.iter() {
                    let theme = self.themes.get(&string(value)?).cloned();
                    let (false, Some(theme)) = (name.is_empty(), theme) else {
                        return Err(message("Unknown packed native style catalog."));
                    };

                    vars.insert(Arc::clone(name), theme);
                }

                let default_vars = string(get(context, "defaultVars"))?;

                if !vars.contains_key(&default_vars) {
                    return Err(message("Invalid packed native style default."));
                }

                let first = vars
                    .values()
                    .next()
                    .map(|theme| Arc::clone(&theme.metadata.contract));
                let shared = vars.values().all(|theme| {
                    first
                        .as_ref()
                        .is_some_and(|first| Arc::ptr_eq(first, &theme.metadata.contract))
                });

                if !shared {
                    return Err(message("Incompatible packed native style catalog."));
                }

                Some(NativeContext { default_vars, vars })
            }
        };
        let style = match get(entry, "style") {
            Data::Undefined => None,
            value => {
                let mut style = packed_styles::read(value, &self.themes, version)?;

                style.native_context = native_context;
                Some(Arc::new(style))
            }
        };

        Ok(Link {
            call: Call {
                name: if members.is_some() {
                    Arc::from("")
                } else {
                    Arc::clone(&binding)
                },
                token_type: Arc::from("{}"),
                ..Call::default()
            },
            binding,
            definition: empty_theme()?,
            kind: LinkKind::StyleReference,
            members,
            style,
        })
    }

    fn configured(
        &mut self,
        entry: &Object,
        kind: Option<&str>,
        root_controls: bool,
    ) -> Result<Link> {
        let version = self.version;
        let output = get(entry, "output");

        if !output.is_undefined() && output.as_str() != Some("html") {
            return Err(message("Invalid theme output."));
        }

        let recipe = get(entry, "recipe");

        if !recipe.is_undefined() && (!is_true(recipe) || version < 15 || kind != Some("style")) {
            return Err(message("Invalid bound recipe contract."));
        }

        let theme_name = string(get(entry, "theme"))?;
        let definition = self.themes.get(&theme_name).cloned();
        let (Some(definition), Some(kind @ ("config" | "style" | "theme"))) = (definition, kind)
        else {
            return Err(message("Invalid Zyzz contract export."));
        };
        let members = if kind == "config" {
            Some(self.members(get(entry, "members"), root_controls)?)
        } else {
            None
        };
        let options = match get(entry, "options") {
            Data::Undefined => None,
            value => Some(record(&self.decode(value)?)?.clone()),
        };
        let variable_config = is_true(get(entry, "variableConfig"));
        let variable_mappings = get(entry, "variableMappings");
        let contract = &definition.metadata.contract;

        if let Some(options) = &options {
            if variable_config
                && mappings_json(variable_sets::mappings(variable_mappings)?.as_ref())
                    != mappings_json(contract.mappings.as_ref())
            {
                return Err(message(
                    "Configuration mappings disagree with linked variable metadata.",
                ));
            }

            if variable_config {
                configuration::create(&variable_options(options, variable_mappings))?;
            } else {
                configuration::create(&Data::from(options.clone()))?;
            }

            let css_output = get(options, "cssOutput")
                .as_str()
                .unwrap_or("atomic")
                .to_owned();

            if version >= 17
                && css_output != contract.css_output.unwrap_or(CssOutput::Atomic).as_str()
            {
                return Err(message(
                    "Configuration CSS output disagrees with linked theme metadata.",
                ));
            }

            let composition = get(options, "composition")
                .as_str()
                .unwrap_or("ordered")
                .to_owned();

            if composition
                != contract
                    .composition
                    .unwrap_or(Composition::Ordered)
                    .as_str()
            {
                return Err(message(
                    "Configuration composition disagrees with linked theme metadata.",
                ));
            }

            if get(options, "defaultLayer").as_str() != contract.default_layer.as_deref() {
                return Err(message(
                    "Configuration default layer disagrees with linked theme metadata.",
                ));
            }

            if shorthands::signature(get(options, "shorthands"))?
                != shorthand_signature(contract.shorthands.as_ref())
            {
                return Err(message(
                    "Configuration mappings disagree with linked theme metadata.",
                ));
            }
        }

        let themes = options
            .as_ref()
            .map_or(Data::Undefined, |options| get(options, "themes").clone());
        let catalog_only = truthy(&themes) && (version < 4 || is_true(get(entry, "catalogOnly")));
        let native_provider = is_true(get(entry, "nativeProvider"));
        let typed = |options: &Object| -> String {
            if variable_config {
                configurations::type_text(&variable_options(options, variable_mappings))
            } else {
                configurations::type_text(&Data::from(options.clone()))
            }
        };
        let full_type = options.as_ref().map_or_else(String::new, |options| {
            if native_provider {
                format!(
                    "import('zyzz/react-native/react').defineConfig.ReturnType<{}>",
                    typed(options)
                )
            } else if variable_config {
                format!("import('zyzz').Config.VariableConfig<{}>", typed(options))
            } else {
                format!(
                    "import('zyzz').Config.create.ReturnType<{}>",
                    typed(options)
                )
            }
        });
        let appearance = root_controls && is_true(get(entry, "appearance"));
        let script = is_true(get(entry, "script"));
        // Helpers a legacy library did not compile are hidden from its consumers' types.
        let hidden: Vec<&str> = [
            (!appearance).then_some("'appearance'"),
            (!script).then_some("'script'"),
        ]
        .into_iter()
        .flatten()
        .collect();
        let config_type = if hidden.is_empty() {
            full_type
        } else {
            format!(
                "{{readonly [key in keyof {full_type} as key extends {} ? never : key]:{full_type}[key]}}",
                hidden.join(" | ")
            )
        };
        let output_type = if catalog_only {
            format!(
                "({{readonly [key in keyof {config_type} as key extends 'themes' ? never : key]:{config_type}[key]}} & {{readonly themes:{{readonly [key in keyof {config_type}['themes']]:{config_type}['themes'][key]}}}})"
            )
        } else {
            config_type
        };

        if kind == "config" && options.is_none() {
            return Err(message("Missing configuration options."));
        }

        let token_type: Arc<str> =
            Arc::from(self.types.get(&theme_name).cloned().unwrap_or_default());
        let variable_set = is_true(get(entry, "variableSet"));
        let direct_variables = is_true(get(entry, "directVariables"));
        let html = output.as_str() == Some("html");
        let initialization = is_true(get(entry, "initialization"));
        let root = root_controls && is_true(get(entry, "root"));
        let selection = is_true(get(entry, "selection"));
        let mut type_text_value: Option<String> = None;

        if variable_set {
            type_text_value = Some(format!("import('zyzz').Vars.Definition<{token_type}>"));
        }

        if direct_variables {
            type_text_value = Some(format!(
                "import('zyzz').Vars.{}<{token_type}>",
                if variable_set {
                    "Definition"
                } else {
                    "References"
                }
            ));
        }

        if contract.shorthands.is_some() || html {
            let shorthands =
                configurations::type_text(&shorthand_data(contract.shorthands.as_ref()));

            type_text_value = Some(format!(
                "import('zyzz').Config.create.ReturnType<{{theme:{token_type};{}shorthands:{shorthands}}}>['theme']",
                if html { "output:'html';" } else { "" }
            ));
        }

        if options.is_some() {
            let suffix = if initialization {
                "['script']"
            } else if root {
                "['appearance']"
            } else if selection {
                if variable_config {
                    "['vars']"
                } else {
                    "['themes']"
                }
            } else {
                ""
            };

            type_text_value = Some(format!("{output_type}{suffix}"));
        }

        let member_names = members.as_ref().map(|members| {
            let mut names = Record::new();

            for (key, member) in members.iter() {
                names.insert(Arc::clone(key), Arc::clone(&member.call.name));
            }

            names
        });

        Ok(Link {
            binding: string(get(entry, "binding"))?,
            call: Call {
                appearance,
                catalog_only,
                direct_variables,
                initialization,
                members: member_names,
                name: theme_name,
                native_provider,
                options,
                output: html.then_some(Output::Html),
                recipe: is_true(recipe),
                root,
                script,
                selection,
                token_type,
                type_text: type_text_value.map(Arc::from),
                variable_config,
                variable_mappings: if variable_config {
                    variable_sets::mappings(variable_mappings).ok().flatten()
                } else {
                    None
                },
                variable_set,
                ..Call::default()
            },
            definition,
            kind: match kind {
                "config" => LinkKind::Config,
                "style" => LinkKind::Style,
                _ => LinkKind::Theme,
            },
            members,
            style: None,
        })
    }
}

/// Shorthand mappings as data, for type text.
fn shorthand_data(map: Option<&Map<Arc<[Arc<str>]>>>) -> Data {
    Data::from(Object::from_entries(map.into_iter().flat_map(|map| {
        map.iter().map(|(name, targets)| {
            (
                Arc::clone(name),
                Data::Array(Arc::new(
                    targets
                        .iter()
                        .map(|target| Data::String(Arc::clone(target)))
                        .collect(),
                )),
            )
        })
    })))
}
