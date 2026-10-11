//! Derives deterministic names from source identities and style content.

use std::sync::Arc;

use crate::data::Data;
use crate::error::{Error, Result};
use crate::internal::token::{self, Contract, ContractKey, Expression, Mappings, Part, Reference};
use crate::js;
use crate::style::{self, NamedStyle};

const ALPHABET: &[u8; 64] = b"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-";

/// Runs the paired FNV-1a and DJB2 hashes over UTF-16 code units.
fn pair(value: &str) -> (u32, u32) {
    let mut first: u32 = 2_166_136_261;
    let mut second: u32 = 5381;

    for code in js::code_units(value) {
        let code = u32::from(code);
        first = (first ^ code).wrapping_mul(16_777_619);
        second = second.wrapping_mul(33) ^ code;
    }

    (first, second)
}

/// Encodes a 64-bit hash of a string as 11 identifier-safe characters.
pub fn compact(value: &str) -> String {
    let (first, second) = pair(value);
    let mut bits = (u64::from(first) << 32) | u64::from(second);
    let mut output = [0_u8; 11];

    for slot in output.iter_mut().rev() {
        let index = usize::try_from(bits & 63).unwrap_or_default();
        *slot = ALPHABET.get(index).copied().unwrap_or(b'0');
        bits >>= 6;
    }

    String::from_utf8_lossy(&output).into_owned()
}

/// Converts arbitrary text into a readable class segment of at most 64 characters.
pub fn label(value: &str) -> String {
    let mut output = String::with_capacity(value.len());
    let mut separator = false;

    for character in value.chars() {
        if character.is_ascii_alphanumeric() || character == '-' {
            if separator {
                output.push('-');
                separator = false;
            }

            output.push(character);
        } else {
            separator = true;
        }
    }

    if separator {
        output.push('-');
    }

    let trimmed = output.trim_matches('-');
    let label = trimmed.get(..trimmed.len().min(64)).unwrap_or(trimmed);

    if label.is_empty() {
        "value".to_owned()
    } else {
        label.to_owned()
    }
}

/// Escapes every code point other than ASCII letters and digits as `_<hex>_`.
pub fn name(value: &str) -> String {
    let mut output = String::with_capacity(value.len());

    for character in value.chars() {
        if character.is_ascii_alphanumeric() {
            output.push(character);
        } else {
            output.push('_');
            output.push_str(&js::radix(u64::from(u32::from(character)), 16));
            output.push('_');
        }
    }

    output
}

/// Converts an explicit id into a contract identity.
///
/// # Errors
///
/// Returns the TypeScript message when the id is absent or empty.
pub fn require_id(id: Option<&str>, kind: &str) -> Result<String> {
    match id {
        Some(id) if !id.is_empty() => Ok(format!("id-{}", name(id))),
        _ => Err(Error::message(format!(
            "{kind} requires an explicit id without the compiler plugin."
        ))),
    }
}

/// Names the custom property that holds one field of an identity.
pub fn slot(id: &str, field: &str) -> String {
    format!(
        "--z-{}-{}",
        id.strip_prefix("id-").unwrap_or(id),
        name(field)
    )
}

/// A short hash of a string in base 36.
pub fn hash(value: &str) -> String {
    let (first, second) = pair(value);

    format!(
        "{}{}",
        js::radix(u64::from(first), 36),
        js::radix(u64::from(second), 36)
    )
}

/// Names ordered style data consistently in runtime and extraction.
pub fn style(input: &NamedStyle, namespace: Option<&str>) -> String {
    let mut json = String::with_capacity(64);

    write_shape(&mut json, input);

    let mut output = String::with_capacity(json.len() * 2 + 16);

    output.push_str("z-");

    if let Some(namespace) = namespace.filter(|namespace| !namespace.is_empty()) {
        output.push_str(namespace);
        output.push('-');
    }

    output.push_str("content-");
    output.push_str(&name(&json));
    output
}

/// Writes the canonical shape of a style: target branches, conditional rules, or declarations.
fn write_shape(output: &mut String, style: &NamedStyle) {
    if let Some(targets) = &style.targets {
        output.push('[');
        write_shape(
            output,
            &NamedStyle {
                targets: None,
                ..style.clone()
            },
        );

        for branch in [&targets.native, &targets.ios, &targets.android] {
            output.push(',');

            match branch {
                Some(data) if !data.is_undefined() => write_data(output, data),
                _ => output.push_str("null"),
            }
        }

        output.push(',');

        match &targets.web {
            Some(web) => write_shape(output, web),
            None => output.push_str("null"),
        }

        output.push(']');
        return;
    }

    output.push('[');

    if let Some(rules) = &style.rules {
        for (index, rule) in rules.iter().enumerate() {
            if index > 0 {
                output.push(',');
            }

            output.push('[');
            js::write_string(output, rule.condition.as_deref().unwrap_or_default());
            output.push(',');
            write_shape(output, &rule.style);
            output.push(']');
        }
    } else {
        for (index, declaration) in style.declarations.iter().enumerate() {
            if index > 0 {
                output.push(',');
            }

            output.push('[');
            js::write_string(output, &declaration.property);
            output.push(',');
            write_declaration_value(output, &declaration.value);
            output.push(',');
            output.push_str(if declaration.important {
                "true"
            } else {
                "false"
            });
            output.push(']');
        }
    }

    output.push(']');
}

fn write_declaration_value(output: &mut String, value: &style::Value) {
    match value {
        style::Value::Binding(binding) => {
            output.push_str("[\"variable\",");
            js::write_string(output, &binding.name);
            output.push(']');
        }
        style::Value::Token(reference) => write_token_tuple(output, reference),
        style::Value::Expression(expression) => {
            output.push_str("[\"expression\",[");

            for (index, part) in expression.parts.iter().enumerate() {
                if index > 0 {
                    output.push(',');
                }

                match part {
                    Part::Text(text) => js::write_string(output, text),
                    Part::Reference(reference) => write_token_tuple(output, reference),
                    Part::Binding(binding) => {
                        output.push_str("[\"variable\",");
                        js::write_string(output, &binding.name);
                        output.push(']');
                    }
                }
            }

            output.push_str("]]");
        }
        style::Value::Number(number) => write_json_number(output, *number),
        style::Value::String(text) => js::write_string(output, text),
    }
}

fn write_token_tuple(output: &mut String, reference: &Reference) {
    output.push_str("[\"token\",");

    match &reference.contract.identity {
        Some(identity) => js::write_string(output, identity),
        None => output.push_str("null"),
    }

    output.push(',');
    js::write_string(output, &reference.path);
    output.push(',');
    write_token_value(output, &reference.value);
    output.push(']');
}

fn write_json_number(output: &mut String, number: f64) {
    if number.is_finite() {
        js::write_number(output, number);
    } else {
        output.push_str("null");
    }
}

/// Serializes a token value like `JSON.stringify`, including nested reference objects.
pub(crate) fn token_json(value: &token::Value) -> String {
    let mut output = String::new();

    write_token_value(&mut output, value);

    output
}

fn write_token_value(output: &mut String, value: &token::Value) {
    match value {
        token::Value::Number(number) => write_json_number(output, *number),
        token::Value::String(text) => js::write_string(output, text),
        token::Value::Reference(reference) => write_reference_object(output, reference),
        token::Value::Composition(expression) => write_expression_object(output, expression),
        token::Value::Record(entries) => {
            output.push('{');

            for (index, (key, entry)) in entries.iter().enumerate() {
                if index > 0 {
                    output.push(',');
                }

                js::write_string(output, key);
                output.push(':');
                write_token_value(output, entry);
            }

            output.push('}');
        }
    }
}

/// Writes a frozen reference object: `contract`, `group`, `path`, and `value`, the order every
/// `Token.create` call site uses.
fn write_reference_object(output: &mut String, reference: &Reference) {
    output.push_str("{\"contract\":");
    write_contract(output, &reference.contract);
    output.push_str(",\"group\":");
    js::write_string(output, &reference.group);
    output.push_str(",\"path\":");
    js::write_string(output, &reference.path);
    output.push_str(",\"value\":");
    write_token_value(output, &reference.value);
    output.push('}');
}

fn write_expression_object(output: &mut String, expression: &Expression) {
    output.push('{');

    if let Some(group) = &expression.group {
        output.push_str("\"group\":");
        js::write_string(output, group);
        output.push(',');
    }

    output.push_str("\"parts\":[");

    for (index, part) in expression.parts.iter().enumerate() {
        if index > 0 {
            output.push(',');
        }

        match part {
            Part::Text(text) => js::write_string(output, text),
            Part::Reference(reference) => write_reference_object(output, reference),
            Part::Binding(binding) => {
                output.push_str("{\"name\":");
                js::write_string(output, &binding.name);
                output.push_str(",\"type\":");
                js::write_string(output, binding.domain.as_str());
                output.push_str(",\"variable\":true}");
            }
        }
    }

    output.push_str("]}");
}

fn write_contract(output: &mut String, contract: &Contract) {
    let mut keys: Vec<ContractKey> = contract
        .keys
        .as_deref()
        .map_or_else(|| ContractKey::ORDER.to_vec(), <[ContractKey]>::to_vec);

    // Properties added after creation, such as mappings on a wrapped set, follow recorded ones.
    for key in ContractKey::ORDER {
        if !keys.contains(&key) {
            keys.push(key);
        }
    }

    output.push('{');

    let mut first = true;

    for key in keys {
        let start = output.len();

        if !first {
            output.push(',');
        }

        js::write_string(output, key.as_str());
        output.push(':');

        let written = match key {
            ContractKey::Composition => contract
                .composition
                .map(|composition| js::write_string(output, composition.as_str()))
                .is_some(),
            ContractKey::CssOutput => contract
                .css_output
                .map(|css_output| js::write_string(output, css_output.as_str()))
                .is_some(),
            ContractKey::DefaultLayer => contract
                .default_layer
                .as_ref()
                .map(|layer| js::write_string(output, layer))
                .is_some(),
            ContractKey::Mappings => match &contract.mappings {
                Some(Mappings::Disabled) => {
                    output.push_str("false");
                    true
                }
                Some(Mappings::Categories(categories)) => {
                    write_lists(output, categories);
                    true
                }
                None => false,
            },
            ContractKey::Shorthands => contract
                .shorthands
                .as_ref()
                .map(|shorthands| write_lists(output, shorthands))
                .is_some(),
            ContractKey::VariableSet => {
                if contract.variable_set {
                    output.push_str("true");
                }

                contract.variable_set
            }
        };

        if written {
            first = false;
        } else {
            output.truncate(start);
        }
    }

    output.push('}');
}

fn write_lists(output: &mut String, lists: &token::Map<Arc<[Arc<str>]>>) {
    output.push('{');

    for (index, (key, values)) in lists.iter().enumerate() {
        if index > 0 {
            output.push(',');
        }

        js::write_string(output, key);
        output.push_str(":[");

        for (position, value) in values.iter().enumerate() {
            if position > 0 {
                output.push(',');
            }

            js::write_string(output, value);
        }

        output.push(']');
    }

    output.push('}');
}

/// Serializes static target data like `JSON.stringify`.
fn write_data(output: &mut String, data: &Data) {
    match data {
        Data::Array(items) => {
            output.push('[');

            for (index, item) in items.iter().enumerate() {
                if index > 0 {
                    output.push(',');
                }

                if item.is_undefined() {
                    output.push_str("null");
                } else {
                    write_data(output, item);
                }
            }

            output.push(']');
        }
        Data::Bool(value) => output.push_str(if *value { "true" } else { "false" }),
        Data::Number(number) => write_json_number(output, *number),
        Data::Object(object) => {
            output.push('{');

            let mut first = true;

            for (key, value) in object.iter() {
                if value.is_undefined() {
                    continue;
                }

                if !first {
                    output.push(',');
                }

                first = false;
                js::write_string(output, key);
                output.push(':');
                write_data(output, value);
            }

            output.push('}');
        }
        Data::String(text) => js::write_string(output, text),
        Data::Token(reference) => write_reference_object(output, reference),
        Data::Expression(expression) => write_expression_object(output, expression),
        Data::Null | Data::Undefined | Data::Binding(_) | Data::Theme(_) => {
            output.push_str("null");
        }
    }
}

/// Names a composition class from its ordered input names.
pub fn composition(names: &[&str]) -> String {
    let list = js::Value::Array(names.iter().map(|name| js::Value::from(*name)).collect());

    format!("z-compose-{}", name(&js::stringify(&list)))
}

/// Names a stylesheet contribution from its kind and explicit id.
///
/// # Errors
///
/// Returns the TypeScript message when the id is absent.
pub fn contribution(kind: &str, id: Option<&str>) -> Result<String> {
    let identity = require_id(id, kind)?;

    if kind == "keyframes" {
        return Ok(format!("z-k{identity}"));
    }

    Ok(format!(
        "{}z-{}{identity}",
        if kind == "counterStyle" { "" } else { "--" },
        kind.to_lowercase()
    ))
}
