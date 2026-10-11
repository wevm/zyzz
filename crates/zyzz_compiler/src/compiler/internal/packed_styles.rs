//! Packed style definitions that library contracts carry for consumers.

use std::sync::Arc;

use crate::compiler::internal::dynamic::Slots;
use crate::compiler::source::NativeContext;
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
    pub output: Option<crate::compiler::internal::themes::Output>,
    /// Variable slots.
    pub slots: Vec<Arc<str>>,
    /// Static recipe alternatives.
    pub static_recipe: Option<recipe::Definition>,
    /// The style.
    pub style: Arc<NamedStyle>,
}
