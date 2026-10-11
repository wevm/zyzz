//! Finite recipe alternatives: axes, defaults, and ordered match rules.

use std::sync::Arc;

use crate::js::Record;
use crate::style;

/// One rule that applies a value when every axis matches one of its choices.
#[derive(Clone, Debug)]
pub struct Rule<V> {
    /// Axis names with their accepted choices, in authored order.
    pub matches: Vec<(Arc<str>, Vec<Arc<str>>)>,
    /// The value applied when the rule matches.
    pub value: V,
}

/// A recipe over named axes.
#[derive(Clone, Debug)]
pub struct Definition<V = style::Definition> {
    /// Choices of each axis.
    pub axes: Record<Vec<Arc<str>>>,
    /// Default choice of each axis, or `None` for no default.
    pub defaults: Record<Option<Arc<str>>>,
    /// Rules in precedence order.
    pub rules: Vec<Rule<V>>,
}
