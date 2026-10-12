//! The finite native recipe program that `NativeStatic.create` applies without dynamic values.

use std::sync::Arc;

use crate::internal::recipe::{self, Axes, Defaults, Matches};
use crate::js;
use crate::react_native::style_sheet::{self, Table};

/// One ordered step: a static fragment name, or a line-height multiplier resolved against the
/// final font size.
#[derive(Clone, Debug, PartialEq)]
pub enum Step {
    /// A line-height multiplier.
    LineHeight(f64),
    /// A static fragment name in [`Options::styles`].
    Style(Arc<str>),
}

/// A rule whose steps apply when every match selects a listed choice.
#[derive(Clone, Debug, PartialEq)]
pub struct Rule {
    /// Axis names and allowed choices.
    pub matches: Matches,
    /// Steps in application order.
    pub steps: Vec<Step>,
}

/// Compiler-owned finite metadata, ordered rules, and converted native fragments.
#[derive(Clone, Debug)]
pub struct Options {
    /// Ordered finite choice names.
    pub axes: Axes,
    /// Default selections. `None` suppresses an axis.
    pub defaults: Defaults,
    /// Base, variant, and compound rules in authored order.
    pub rules: Vec<Rule>,
    /// Static fragments for one set and scheme.
    pub styles: Arc<Table>,
}

impl Options {
    /// Appends the options serialized like `JSON.stringify`, in the key order
    /// `NativeBindings.finite` constructs.
    pub fn write_json(&self, output: &mut String) {
        output.push_str("{\"axes\":");
        recipe::write_axes(output, &self.axes);
        output.push_str(",\"defaults\":");
        recipe::write_defaults(output, &self.defaults);
        output.push_str(",\"rules\":[");

        for (index, rule) in self.rules.iter().enumerate() {
            if index > 0 {
                output.push(',');
            }

            output.push_str("{\"matches\":");
            recipe::write_matches(output, &rule.matches);
            output.push_str(",\"steps\":[");

            for (index, step) in rule.steps.iter().enumerate() {
                if index > 0 {
                    output.push(',');
                }

                match step {
                    Step::LineHeight(value) if value.is_finite() => {
                        js::write_number(output, *value);
                    }
                    Step::LineHeight(_) => output.push_str("null"),
                    Step::Style(name) => js::write_string(output, name),
                }
            }

            output.push_str("]}");
        }

        output.push_str("],\"styles\":");
        style_sheet::write_table(output, &self.styles);
        output.push('}');
    }

    /// Serializes like `JSON.stringify`.
    pub fn to_json(&self) -> String {
        let mut output = String::new();

        self.write_json(&mut output);
        output
    }
}
