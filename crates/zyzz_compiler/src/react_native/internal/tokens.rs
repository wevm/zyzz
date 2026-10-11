//! Resolves portable references for native tables and callback expressions.
//!
//! Token aliases follow the selected profile's live values, light/dark pairs select the requested
//! scheme, and spacing compositions containing `calc()` evaluate to pixel lengths.

use std::sync::Arc;

use crate::internal::token::{Metadata, Part, Reference, Value as TokenValue};
use crate::js;
use crate::react_native::internal::calculation;
use crate::react_native::internal::scalar::{self, Value};
use crate::react_native::style_sheet::ColorScheme;
use crate::style;

const WEB: &str = "Web variables, expressions, and dynamic bindings are not native scalar tokens.";

/// A resolution failure.
#[derive(Clone, Debug, PartialEq)]
pub enum Error {
    /// A plain `Error`, such as an alias cycle or an invalid calculation.
    Message(String),
    /// `Tokens.UnsupportedError`: a value whose behavior requires a web target.
    Unsupported(&'static str),
}

impl Error {
    /// The caller-visible message.
    pub fn message(&self) -> &str {
        match self {
            Self::Message(message) => message,
            Self::Unsupported(message) => message,
        }
    }
}

/// Profile metadata and the selected scheme.
#[derive(Clone, Copy, Debug)]
pub struct Options<'a> {
    /// Selected scheme. `None` models a missing or unknown scheme, which no pair can select.
    pub color_scheme: Option<ColorScheme>,
    /// Selected profile, whose values replace token values of the same contract.
    pub metadata: Option<&'a Metadata>,
    /// Unit and font mappings.
    pub scalar: &'a scalar::Options,
}

/// Records whether every resolved pair had equal light and dark values.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Resolution {
    /// Cleared when a pair with distinct members is resolved.
    pub scheme_independent: bool,
}

impl Default for Resolution {
    fn default() -> Self {
        Self {
            scheme_independent: true,
        }
    }
}

/// Selects live token aliases and schemes without evaluating authored code.
///
/// # Errors
///
/// Returns [`Error::Unsupported`] for web-only values and [`Error::Message`] for alias cycles
/// and invalid calculations.
pub fn resolve(
    input: &style::Value,
    options: &Options<'_>,
    resolution: &mut Resolution,
) -> Result<Value, Error> {
    let mut resolver = Resolver {
        active: Vec::new(),
        options,
        resolution,
    };

    match input {
        style::Value::Number(number) => Ok(Value::Number(*number)),
        style::Value::String(text) => Ok(Value::String(Arc::clone(text))),
        style::Value::Token(reference) => resolver.reference(reference),
        style::Value::Expression(expression) => {
            resolver.expression(&expression.parts, expression.group.as_deref())
        }
        style::Value::Binding(_) => Err(Error::Unsupported(WEB)),
    }
}

struct Resolver<'a, 'b> {
    active: Vec<*const Reference>,
    options: &'a Options<'b>,
    resolution: &'a mut Resolution,
}

impl Resolver<'_, '_> {
    fn reference(&mut self, reference: &Arc<Reference>) -> Result<Value, Error> {
        if reference.web {
            return Err(Error::Unsupported(WEB));
        }

        let identity = Arc::as_ptr(reference);

        if self.active.contains(&identity) {
            return Err(Error::Message(
                "Native token aliases must not form a cycle.".to_owned(),
            ));
        }

        let metadata = self.options.metadata;
        let shared = metadata.is_some_and(|metadata| {
            Arc::ptr_eq(&metadata.contract, &reference.contract)
                || (metadata.contract.identity.is_some()
                    && metadata.contract.identity == reference.contract.identity)
        });
        // A set sharing its contract with an extension lacks the extension's added paths.
        let next = metadata
            .filter(|_| shared)
            .and_then(|metadata| metadata.values.get(&reference.path))
            .unwrap_or(&reference.value);

        self.active.push(identity);

        let result = self.value(next)?;

        self.active.pop();

        Ok(result)
    }

    fn value(&mut self, value: &TokenValue) -> Result<Value, Error> {
        match value {
            TokenValue::Number(number) => Ok(Value::Number(*number)),
            TokenValue::String(text) => Ok(Value::String(Arc::clone(text))),
            TokenValue::Reference(reference) => self.reference(reference),
            TokenValue::Composition(expression) => {
                self.expression(&expression.parts, expression.group.as_deref())
            }
            TokenValue::Record(_) => {
                let light = value.field("light");
                let dark = value.field("dark");

                if let (Some(light), Some(dark)) = (light, dark) {
                    if !same(light, dark) {
                        self.resolution.scheme_independent = false;
                    }

                    return match self.options.color_scheme {
                        Some(ColorScheme::Light) => self.value(light),
                        Some(ColorScheme::Dark) => self.value(dark),
                        None => Err(Error::Unsupported(WEB)),
                    };
                }

                if value.field("default").is_some() {
                    return Err(Error::Unsupported(
                        "Media-conditioned variables require a web target.",
                    ));
                }

                Err(Error::Unsupported(WEB))
            }
        }
    }

    fn expression(&mut self, parts: &[Part], group: Option<&str>) -> Result<Value, Error> {
        let mut text = String::new();

        for part in parts {
            match part {
                Part::Text(value) => text.push_str(value),
                Part::Reference(reference) => match self.reference(reference)? {
                    Value::Number(number) => js::write_number(&mut text, number),
                    Value::String(value) => text.push_str(&value),
                },
                Part::Binding(_) => return Err(Error::Unsupported(WEB)),
            }
        }

        if group != Some("spacing") || !scalar::is_calc(&text) {
            return Ok(Value::String(text.into()));
        }

        let length = calculation::length(&text, self.options.scalar)
            .map_err(|error| Error::Message(error.text()))?;
        let mut output = String::new();

        js::write_number(
            &mut output,
            length / self.options.scalar.units.px.unwrap_or(1.0),
        );
        output.push_str("px");

        Ok(Value::String(output.into()))
    }
}

/// Whether two pair members are the same JavaScript value: `===` for primitives, identity for
/// objects.
fn same(left: &TokenValue, right: &TokenValue) -> bool {
    match (left, right) {
        #[expect(
            clippy::float_cmp,
            reason = "JavaScript strict equality compares exact values."
        )]
        (TokenValue::Number(left), TokenValue::Number(right)) => left == right,
        (TokenValue::String(left), TokenValue::String(right)) => left == right,
        (TokenValue::Reference(left), TokenValue::Reference(right)) => Arc::ptr_eq(left, right),
        (TokenValue::Composition(left), TokenValue::Composition(right)) => Arc::ptr_eq(left, right),
        (TokenValue::Record(left), TokenValue::Record(right)) => Arc::ptr_eq(left, right),
        _ => false,
    }
}
