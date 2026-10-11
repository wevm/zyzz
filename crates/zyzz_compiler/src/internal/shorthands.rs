//! Validates ordered configuration property aliases without interpreting CSS values.

use std::sync::Arc;

use crate::data::{Data, Property};
use crate::error::{Error, Result};
use crate::internal::literal;
use crate::internal::token::Map;
use crate::js;

/// Names the authoring surface reserves, so they cannot alias properties.
const RESERVED: [&str; 7] = [
    "style",
    "theme",
    "themes",
    "typography",
    "script",
    "variants",
    "__proto__",
];

/// Copies validated aliases, each expanding to its declared target order.
///
/// # Errors
///
/// Returns a plain error for non-records, reserved or property names, and targets that are not
/// unique standard properties.
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

    let mut result = Map::default();

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

        let Property::Value(Data::Array(targets)) = property else {
            return Err(tuple(name));
        };

        if targets.is_empty() {
            return Err(tuple(name));
        }

        let mut properties: Vec<Arc<str>> = Vec::with_capacity(targets.len());

        for target in targets.iter() {
            let Some(target) = target.as_str() else {
                return Err(unique(name));
            };

            if literal::rule(target).is_none() || properties.iter().any(|seen| &**seen == target) {
                return Err(unique(name));
            }

            properties.push(Arc::from(target));
        }

        result.insert(Arc::clone(name), properties.into());
    }

    Ok(result)
}

#[cold]
fn tuple(name: &str) -> Error {
    Error::message(format!(
        "Shorthand {name} requires a nonempty property tuple."
    ))
}

#[cold]
fn unique(name: &str) -> Error {
    Error::message(format!(
        "Shorthand {name} requires unique standard properties."
    ))
}

/// Canonicalizes alias names while preserving each ordered target tuple.
///
/// # Errors
///
/// Returns the [`read`] error for invalid aliases.
pub fn signature(value: &Data) -> Result<String> {
    let empty = Data::from(crate::data::Object::new());
    let map = read(if value.is_undefined() { &empty } else { value })?;
    let mut entries: Vec<_> = map.iter().collect();

    entries.sort_by(|left, right| js::code_units(left.0).cmp(js::code_units(right.0)));

    Ok(js::stringify(&js::Value::Array(
        entries
            .into_iter()
            .map(|(name, targets)| {
                js::Value::Array(vec![
                    js::Value::from(&**name),
                    js::Value::Array(
                        targets
                            .iter()
                            .map(|target| js::Value::from(&**target))
                            .collect(),
                    ),
                ])
            })
            .collect(),
    )))
}
