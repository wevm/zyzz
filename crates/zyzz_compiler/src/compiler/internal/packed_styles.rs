//! Packed style definitions that library contracts carry for consumers.

use std::sync::Arc;

use crate::compiler::internal::dynamic::Slots;
use crate::compiler::internal::recipes;
use crate::compiler::internal::themes::Output;
use crate::compiler::source::{Call, NativeContext};
use crate::internal::recipe;
use crate::runtime::recipe as runtime;
use crate::style::NamedStyle;

/// Dynamic recipe data of a packed style.
#[derive(Clone, Debug)]
pub struct Dynamic {
    /// Default payload values by axis and field.
    pub default_payloads: Option<crate::js::Record<crate::js::Record<runtime::Scalar>>>,
    /// Payload slot bindings.
    pub payloads: Option<Vec<runtime::Payload>>,
    /// Ordered dynamic alternatives.
    pub recipe: recipe::Definition,
    /// Typed runtime slots.
    pub slots: Slots,
}

/// A style as a packed library exports it.
#[derive(Clone, Debug)]
pub struct Definition {
    /// Recipe attributes.
    pub attributes: Vec<Arc<str>>,
    /// Compiled class name.
    pub class_name: Option<Arc<str>>,
    /// Dynamic alternatives and slots.
    pub dynamic: Option<Dynamic>,
    /// Native alternatives of the authoring contract.
    pub native_context: Option<NativeContext>,
    /// `html` when the style emits HTML attributes.
    pub output: Option<Output>,
    /// Variable slots.
    pub slots: Vec<Arc<str>>,
    /// Static recipe alternatives.
    pub static_recipe: Option<recipe::Definition>,
    /// The style.
    pub style: Arc<NamedStyle>,
}

fn single(style: &Arc<NamedStyle>) -> recipe::Definition {
    recipe::Definition {
        axes: Vec::new(),
        defaults: Vec::new(),
        rules: vec![recipe::Rule {
            matches: Vec::new(),
            value: crate::style::Definition {
                labels: None,
                styles: vec![Arc::clone(style)],
            },
        }],
    }
}

/// Captures a style's ownership without retaining source ASTs or executable expressions.
pub fn create(call: &Call<'_>, style: Arc<NamedStyle>) -> Definition {
    let dynamic = (call.slots.is_some() || call.dynamic_recipe.is_some()).then(|| Dynamic {
        default_payloads: call
            .recipe
            .as_ref()
            .and_then(|recipe| recipe.default_payloads.clone()),
        payloads: call
            .recipe
            .as_ref()
            .and_then(|recipe| recipe.payloads.clone()),
        recipe: call
            .dynamic_recipe
            .clone()
            .unwrap_or_else(|| single(&style)),
        slots: call.slots.clone().unwrap_or_default(),
    });
    let attributes = call.recipe.as_ref().map_or_else(Vec::new, |recipe| {
        let conditions = recipe.conditions.as_ref().map_or(0, Vec::len);

        recipe
            .axes
            .keys()
            .flat_map(|axis| {
                std::iter::once(Arc::from(format!("data-{axis}"))).chain(
                    (0..conditions).map(|condition| Arc::from(recipes::attribute(axis, condition))),
                )
            })
            .collect()
    });
    let slots = call
        .slots
        .iter()
        .flat_map(|slots| slots.values().map(|slot| Arc::from(slot.name.as_str())))
        .chain(call.recipe.iter().flat_map(|recipe| {
            recipe.payloads.iter().flatten().flat_map(|payload| {
                payload
                    .slots
                    .iter()
                    .flat_map(|slots| slots.values().cloned())
            })
        }))
        .collect();
    let html = matches!(call.output, Some(Output::Html));
    let static_recipe = call.static_recipe.clone().or_else(|| {
        (call.slots.is_none() && call.recipe.is_none() && !html).then(|| single(&style))
    });

    Definition {
        attributes,
        class_name: None,
        dynamic,
        native_context: call.native_context.clone(),
        output: call.output,
        slots,
        static_recipe,
        style,
    }
}
