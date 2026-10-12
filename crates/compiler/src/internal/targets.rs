//! Copies static native target data and flattens web target branches into rules.

use std::sync::Arc;

use crate::data::{Data, Object, Property};
use crate::error::{Error, Result};
use crate::style::{NamedStyle, Rule};

/// Copies static native branch data, rejecting accessors, references, and non-plain objects.
///
/// # Errors
///
/// Returns the TypeScript message naming the dotted path of the first unsupported value.
pub fn copy(value: &Data, path: &[String], depth: usize) -> Result<Data> {
    let at = path.join(".");

    if depth > 64 {
        return Err(Error::message(format!(
            "Target nesting exceeds 64 levels at {at}."
        )));
    }

    match value {
        Data::Undefined | Data::Null | Data::String(_) | Data::Bool(_) => Ok(value.clone()),
        Data::Number(number) if number.is_finite() => Ok(value.clone()),
        Data::Number(_) => Err(Error::message(format!(
            "Expected static native data at {at}."
        ))),
        Data::Token(_) | Data::Binding(_) | Data::Expression(_) | Data::Theme(_) => {
            Err(Error::message(format!(
                "Target data must not contain accessors or symbols at {at}."
            )))
        }
        Data::Array(items) => {
            let mut output = Vec::with_capacity(items.len());

            for (index, item) in items.iter().enumerate() {
                let mut next = path.to_vec();
                next.push(index.to_string());
                output.push(copy(item, &next, depth + 1)?);
            }

            Ok(Data::Array(Arc::new(output)))
        }
        Data::Object(object) => {
            if object.exotic {
                return Err(Error::message(format!(
                    "Host-owned objects are not static target data at {at}."
                )));
            }

            let mut output = Object::new();

            for (key, property) in object.properties() {
                let Property::Value(value) = property else {
                    return Err(Error::message(format!(
                        "Target data must not contain accessors or symbols at {at}."
                    )));
                };

                if value.is_undefined() {
                    continue;
                }

                let mut next = path.to_vec();
                next.push(key.to_string());
                output.insert(Arc::clone(key), copy(value, &next, depth + 1)?);
            }

            Ok(Data::from(output))
        }
    }
}

/// Lowers a style's web branch into an ordered rule after its shared declarations.
pub fn web(style: &Arc<NamedStyle>) -> Arc<NamedStyle> {
    if style.rules.is_none() && style.targets.is_none() {
        return Arc::clone(style);
    }

    let rules: Option<Vec<Rule>> = style.rules.as_ref().map(|rules| {
        rules
            .iter()
            .map(|rule| Rule {
                condition: rule.condition.clone(),
                style: web(&rule.style),
            })
            .collect()
    });
    let shared = Arc::new(NamedStyle {
        rules: rules.or_else(|| style.rules.clone()),
        targets: None,
        ..(**style).clone()
    });
    let Some(branch) = style
        .targets
        .as_ref()
        .and_then(|targets| targets.web.as_ref())
    else {
        return shared;
    };

    Arc::new(NamedStyle {
        declarations: Vec::new(),
        rules: Some(vec![
            Rule {
                condition: None,
                style: Arc::clone(&shared),
            },
            Rule {
                condition: None,
                style: web(branch),
            },
        ]),
        ..(*shared).clone()
    })
}
