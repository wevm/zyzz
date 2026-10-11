//! Compiles finite shared recipes into bounded native selection tables.
//!
//! Every selection, including omitted axes, compiles to one table entry named by its mixed-radix
//! index: each axis contributes its choice index, with the choice count standing for no choice.

use std::sync::Arc;

use rustc_hash::FxHashSet;

use crate::error::{Error, Result};
use crate::internal::recipe::{self, Axes, Defaults};
use crate::react_native::style_sheet::{self, Tables};
use crate::style::{self, NamedStyle, Rule};

/// Native recipe tables with the same finite choice metadata as web recipes.
#[derive(Clone, Debug)]
pub struct Definition {
    /// Ordered axes and their finite choice names.
    pub axes: Axes,
    /// Default choices, with `None` suppressing an axis.
    pub defaults: Defaults,
    /// Set and scheme tables indexed by the mixed-radix selection index.
    pub styles: Tables,
}

impl Definition {
    /// Appends the definition serialized like `JSON.stringify`.
    pub fn write_json(&self, output: &mut String) {
        output.push_str("{\"axes\":");
        recipe::write_axes(output, &self.axes);
        output.push_str(",\"defaults\":");
        recipe::write_defaults(output, &self.defaults);
        output.push_str(",\"styles\":");
        self.styles.write_json(output);
        output.push('}');
    }
}

/// The largest number of selections, including omitted choices, per set and scheme.
const SELECTIONS: usize = 256;

/// Compiles every finite selection, including omitted axes, before application.
///
/// # Errors
///
/// Returns [`Error::Variants`] when recipe data is invalid or exceeds 256 selections, and
/// [`Error::StyleSheet`] when selected declarations cannot compile for native.
pub fn compile(recipe: &recipe::Definition, options: &style_sheet::Options) -> Result<Definition> {
    let mut count: usize = 1;

    for (axis, choices) in &recipe.axes {
        let unique = choices
            .iter()
            .map(|choice| &**choice)
            .collect::<FxHashSet<_>>();

        if axis.is_empty() || choices.is_empty() || unique.len() != choices.len() {
            return Err(invalid("Recipe axes require unique string choices."));
        }

        count = count.saturating_mul(choices.len() + 1);

        if count > SELECTIONS {
            return Err(invalid(
                "Native recipes support at most 256 selections, including null choices.",
            ));
        }
    }

    for (axis, choice) in &recipe.defaults {
        let declared = choices(&recipe.axes, axis);
        let valid = declared.is_some_and(|choices| {
            choice
                .as_ref()
                .is_none_or(|choice| choices.contains(choice))
        });

        if !valid {
            return Err(invalid("Defaults must select a declared axis and choice."));
        }
    }

    for rule in &recipe.rules {
        for (axis, selected) in &rule.matches {
            let valid = choices(&recipe.axes, axis).is_some_and(|choices| {
                !selected.is_empty() && selected.iter().all(|choice| choices.contains(choice))
            });

            if !valid {
                return Err(invalid("Compound matches must select declared choices."));
            }
        }
    }

    let mut styles: Vec<Arc<NamedStyle>> = Vec::with_capacity(count);

    for index in 0..count {
        let mut remaining = index;
        let mut selected: Vec<(&str, Option<&Arc<str>>)> = Vec::with_capacity(recipe.axes.len());

        for (axis, choices) in &recipe.axes {
            selected.push((axis, choices.get(remaining % (choices.len() + 1))));
            remaining /= choices.len() + 1;
        }

        let rules = recipe
            .rules
            .iter()
            .filter(|rule| {
                rule.matches.iter().all(|(axis, choices)| {
                    selected
                        .iter()
                        .find(|(name, _)| *name == &**axis)
                        .and_then(|(_, choice)| *choice)
                        .is_some_and(|choice| choices.contains(choice))
                })
            })
            .flat_map(|rule| rule.value.styles.iter())
            .map(|style| Rule {
                condition: None,
                style: Arc::clone(style),
            })
            .collect();

        styles.push(Arc::new(NamedStyle {
            name: index.to_string().into(),
            rules: Some(rules),
            ..NamedStyle::default()
        }));
    }

    let tables = style_sheet::compile(
        &style::Definition {
            labels: None,
            styles,
        },
        options,
    )?;

    Ok(Definition {
        axes: recipe.axes.clone(),
        defaults: recipe.defaults.clone(),
        styles: tables,
    })
}

fn choices<'a>(axes: &'a Axes, axis: &str) -> Option<&'a [Arc<str>]> {
    axes.iter()
        .find(|(name, _)| &**name == axis)
        .map(|(_, choices)| choices.as_slice())
}

#[cold]
fn invalid(message: &str) -> Error {
    Error::Variants(message.to_owned())
}
