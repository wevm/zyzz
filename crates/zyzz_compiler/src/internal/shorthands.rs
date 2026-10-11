//! Validates ordered configuration property aliases without interpreting CSS values.

use std::sync::Arc;

use crate::data::{Data, Property};
use crate::error::{Error, Result};
use crate::internal::literal;
use crate::internal::token::Map;
use crate::js;

const RESERVED: [&str; 7] = [
    "style",
    "theme",
    "themes",
    "typography",
    "script",
    "variants",
    "__proto__",
];

/// Copies validated configuration data, each alias expanding in its declared target order.
///
/// # Errors
///
/// Returns the TypeScript message for non-records, invalid alias names, and invalid targets.
pub fn read(value: &Data) -> Result<Map<Arc<[Arc<str>]>>> {
    let Data::Object(object) = value else {
        return Err(Error::message(
            "shorthands must be a property mapping record.",
        ));
    };

    if object.exotic {
        return Err(Error::message(
            "shorthands must be a property mapping record.",
        ));
    }

    let mut output = Map::default();

    for (name, property) in object.properties() {
        if name.is_empty()
            || name.starts_with(':')
            || name.starts_with('@')
            || name.starts_with("--")
            || name.contains('&')
            || literal::rule(name).is_some()
            || RESERVED.contains(&&**name)
        {
            return Err(Error::message(format!("Invalid shorthand name: {name}")));
        }

        let targets = match property {
            Property::Value(Data::Array(targets)) if !targets.is_empty() => targets,
            _ => {
                return Err(Error::message(format!(
                    "Shorthand {name} requires a nonempty property tuple."
                )));
            }
        };
        let mut result: Vec<Arc<str>> = Vec::with_capacity(targets.len());

        for target in targets.iter() {
            match target {
                Data::String(target)
                    if literal::rule(target).is_some()
                        && !result.iter().any(|existing| existing == target) =>
                {
                    result.push(Arc::clone(target));
                }
                _ => {
                    return Err(Error::message(format!(
                        "Shorthand {name} requires unique standard properties."
                    )));
                }
            }
        }

        output.insert(Arc::clone(name), result.into());
    }

    Ok(output)
}

/// Canonicalizes alias names while preserving each ordered target tuple.
///
/// # Errors
///
/// Returns the [`read`] errors.
pub fn signature(value: &Data) -> Result<String> {
    let map = if value.is_undefined() {
        Map::default()
    } else {
        read(value)?
    };
    let mut entries: Vec<_> = map.iter().collect();

    // `<` compares UTF-16 code units.
    entries.sort_by(|(left, _), (right, _)| left.encode_utf16().cmp(right.encode_utf16()));

    let mut output = String::from("[");

    for (index, (name, targets)) in entries.iter().enumerate() {
        if index > 0 {
            output.push(',');
        }

        output.push('[');
        js::write_string(&mut output, name);
        output.push_str(",[");

        for (position, target) in targets.iter().enumerate() {
            if position > 0 {
                output.push(',');
            }

            js::write_string(&mut output, target);
        }

        output.push_str("]]");
    }

    output.push(']');

    Ok(output)
}
