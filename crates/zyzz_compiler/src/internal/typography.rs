//! Expands named typography sets from a theme into declarations.

use crate::data::{Data, Object};
use crate::internal::theme::Definition;
use crate::internal::token::{self, Part};
use std::sync::Arc;

/// Properties a typography set may define.
pub const PROPERTIES: [&str; 5] = [
    "fontFamily",
    "fontSize",
    "fontWeight",
    "letterSpacing",
    "lineHeight",
];

/// Whether a key is a media or container query, matching `^@(media|container)\s+\S`.
pub fn condition(key: &str) -> bool {
    let rest = key
        .strip_prefix("@media")
        .or_else(|| key.strip_prefix("@container"));

    rest.is_some_and(|rest| {
        let trimmed = rest.trim_start_matches(crate::js::is_whitespace);

        trimmed.len() < rest.len() && !trimmed.is_empty()
    })
}

/// Lists the fields of a typography set, skipping explicit properties.
pub fn entries(
    theme: Option<&Definition>,
    name: &Data,
    explicit: &[&str],
    important: bool,
) -> Vec<(Arc<str>, Data)> {
    let (Some(theme), Some(name)) = (theme, name.as_str()) else {
        return Vec::new();
    };

    if name.split('.').any(|part| part.starts_with('@')) {
        return Vec::new();
    }

    let mut tree = Some(&theme.tokens);

    for part in std::iter::once("typography").chain(name.split('.')) {
        tree = tree
            .and_then(Data::as_object)
            .and_then(|object| object.get(part));
    }

    tree.map(|tree| expand(tree, explicit, important))
        .unwrap_or_default()
}

fn expand(value: &Data, explicit: &[&str], important: bool) -> Vec<(Arc<str>, Data)> {
    let Some(object) = value.as_object() else {
        return Vec::new();
    };

    object
        .iter()
        .filter_map(|(key, child)| {
            if PROPERTIES.contains(&&**key)
                && let Data::Token(reference) = child
                && !explicit.contains(&&**key)
            {
                let value = if important {
                    Data::Expression(token::compose(vec![
                        Part::Reference(Arc::clone(reference)),
                        Part::Text(" !important".into()),
                    ]))
                } else {
                    child.clone()
                };

                return Some((Arc::clone(key), value));
            }

            if condition(key) {
                let nested = expand(child, explicit, important);

                return (!nested.is_empty())
                    .then(|| (Arc::clone(key), Data::from(Object::from_entries(nested))));
            }

            None
        })
        .collect()
}

/// Lists the declaration and condition keys a typography set expands to.
pub fn keys(theme: Option<&Definition>, name: &Data, explicit: &[&str]) -> Vec<Arc<str>> {
    fn collect(values: &[(Arc<str>, Data)], output: &mut Vec<Arc<str>>) {
        for (key, value) in values {
            output.push(Arc::clone(key));

            if condition(key)
                && let Some(object) = value.as_object()
            {
                let nested: Vec<(Arc<str>, Data)> = object
                    .iter()
                    .map(|(key, value)| (Arc::clone(key), value.clone()))
                    .collect();
                collect(&nested, output);
            }
        }
    }

    let mut output = Vec::new();
    collect(&entries(theme, name, explicit, false), &mut output);
    output
}
