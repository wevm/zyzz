//! Validates static native values against the pinned declaration domains.

use std::sync::Arc;

use crate::data::{Data, Object};
use crate::error::{Error, Result};
use crate::internal::targets;
use crate::js;
use crate::react_native::generated::native_schema::{Literal, NODES, Node, ROOT};
use crate::react_native::internal::scalar::{Decimal, Exponent, Fraction};

/// `[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?`, case-insensitively, the spelling of percentages.
const PERCENTAGE: Decimal = Decimal {
    exponent: Exponent::Any,
    fraction: Fraction::Optional,
    sign: true,
};

/// Copies static native declarations, rejecting the first property outside its pinned domain.
///
/// # Errors
///
/// Returns the TypeScript message naming the rejected property or copy failure.
pub fn parse(input: &Data) -> Result<Arc<Object>> {
    let value = targets::copy(input, &[], 0)?;
    let Data::Object(record) = value else {
        return Err(Error::message("Expected a native declaration record."));
    };

    for (key, property) in record.iter() {
        let Some(schema) = node(ROOT).and_then(|root| field(root, key)) else {
            return Err(Error::message(format!("Unknown native property: {key}.")));
        };

        if !matches(schema.value, property) {
            return Err(Error::message(format!(
                "Invalid static native value for {key}."
            )));
        }
    }

    if let Some(Data::Array(transforms)) = record.get("transform") {
        fn matrix(entry: &Data) -> Option<&Data> {
            entry.as_object().and_then(|entry| entry.get("matrix"))
        }

        if transforms.len() > 1 && transforms.iter().any(|entry| matrix(entry).is_some()) {
            return Err(Error::message(
                "A native matrix must be the only transform entry.",
            ));
        }

        for entry in transforms.iter() {
            let Some(matrix) = matrix(entry) else {
                continue;
            };
            let length = match matrix {
                Data::Array(items) => Some(items.len()),
                Data::String(text) => Some(js::utf16_len(text)),
                _ => None,
            };

            if !matches!(length, Some(9 | 16)) {
                return Err(Error::message(
                    "Native matrices require nine or sixteen numbers.",
                ));
            }
        }
    }

    Ok(record)
}

fn node(id: usize) -> Option<&'static Node> {
    NODES.get(id)
}

fn field(
    node: &Node,
    key: &str,
) -> Option<&'static crate::react_native::generated::native_schema::Property> {
    let Node::Object(properties) = node else {
        return None;
    };

    properties
        .binary_search_by(|(name, _)| (*name).cmp(key))
        .ok()
        .and_then(|index| properties.get(index))
        .map(|(_, property)| property)
}

fn matches(id: usize, value: &Data) -> bool {
    let Some(node) = node(id) else {
        return false;
    };

    match node {
        Node::Tuple(values) => match value {
            Data::Array(items) => {
                items.len() == values.len()
                    && values
                        .iter()
                        .zip(items.iter())
                        .all(|(entry, item)| matches(*entry, item))
            }
            _ => false,
        },
        Node::Array(entry) => match value {
            Data::Array(items) => items.iter().all(|item| matches(*entry, item)),
            _ => false,
        },
        Node::Literal(literal) => match (literal, value) {
            (Literal::Bool(expected), Data::Bool(actual)) => expected == actual,
            (Literal::Null, Data::Null) => true,
            #[expect(
                clippy::float_cmp,
                reason = "JavaScript strict equality compares exact values."
            )]
            (Literal::Number(expected), Data::Number(actual)) => expected == actual,
            (Literal::String(expected), Data::String(actual)) => *expected == &**actual,
            _ => false,
        },
        Node::Never => false,
        Node::Number => matches!(value, Data::Number(number) if number.is_finite()),
        Node::Object(properties) => {
            let Data::Object(record) = value else {
                return false;
            };

            record.keys().all(|key| field(node, key).is_some())
                && properties
                    .iter()
                    .all(|(key, property)| match record.get(key) {
                        None if !record.has(key) => property.optional,
                        None => matches(property.value, &Data::Undefined),
                        Some(entry) => matches(property.value, entry),
                    })
        }
        Node::Percentage => match value {
            Data::String(text) => text.strip_suffix('%').is_some_and(|number| {
                PERCENTAGE.matches(number) && js::to_number(number).is_finite()
            }),
            _ => false,
        },
        Node::String => matches!(value, Data::String(_)),
        Node::Undefined => value.is_undefined(),
        Node::Union(values) => values.iter().any(|entry| matches(*entry, value)),
    }
}
