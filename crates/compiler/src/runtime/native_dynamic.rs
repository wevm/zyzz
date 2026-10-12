//! The ordered native binding program that `NativeDynamic.create` applies with runtime payloads.

use std::sync::Arc;

use crate::data::Data;
use crate::internal::recipe::{self, Axes, Defaults, Matches};
use crate::js;
use crate::react_native::internal::scalar::Value;
use crate::react_native::style_sheet::{self, Table};

/// One part of a dynamic assignment: resolved text or numbers, or a runtime slot.
#[derive(Clone, Debug, PartialEq)]
pub enum Part {
    /// A resolved number.
    Number(f64),
    /// A runtime slot, optionally requiring a number.
    Slot {
        /// Whether the slot only accepts numbers.
        number: bool,
        /// Internal slot name.
        slot: Arc<str>,
    },
    /// Resolved text.
    String(Arc<str>),
}

/// One ordered step: a static fragment, or a scalar assignment from parts.
#[derive(Clone, Debug, PartialEq)]
pub enum Step {
    /// Assigns one portable property from joined parts.
    Assign {
        /// Parts joined in order.
        parts: Vec<Part>,
        /// Portable property name.
        property: Arc<str>,
    },
    /// Applies a static fragment name in [`Options::styles`].
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

/// Ordered static and dynamic assignments selected by finite recipe choices.
#[derive(Clone, Debug, PartialEq)]
pub struct Program {
    /// Base, variant, and compound rules in authored order.
    pub rules: Vec<Rule>,
    /// Required top-level input fields mapped to internal slot names.
    pub slots: Vec<(Arc<str>, Arc<str>)>,
}

/// Fixed input bindings for one dynamic choice.
#[derive(Clone, Debug, PartialEq)]
pub struct Payload {
    /// Owning selection axis.
    pub axis: Arc<str>,
    /// Choice name.
    pub choice: Arc<str>,
    /// Base slots followed by slots for each condition, as field to custom property records.
    pub slots: Vec<Vec<(Arc<str>, Arc<str>)>>,
}

/// Complete scalar defaults for selected dynamic choices, by axis and then field.
pub type PayloadDefaults = Vec<(Arc<str>, Vec<(Arc<str>, Value)>)>;

/// Dynamic choices and their complete scalar defaults.
#[derive(Clone, Debug, PartialEq)]
pub struct Payloads {
    /// Complete scalar defaults for selected dynamic choices.
    pub defaults: Option<PayloadDefaults>,
    /// Dynamic choices.
    pub payloads: Vec<Payload>,
}

/// Compiler-owned metadata consumed by native dynamic application.
#[derive(Clone, Debug)]
pub struct Options {
    /// Ordered finite choice names.
    pub axes: Axes,
    /// Default selections. `None` suppresses an axis.
    pub defaults: Defaults,
    /// Authored `fonts` option, `Data::Undefined` when omitted.
    pub fonts: Data,
    /// Dynamic choices, present when the recipe declares payloads.
    pub payloads: Option<Payloads>,
    /// Binding instructions containing no executable authoring code.
    pub program: Program,
    /// Static fragments for one set and scheme.
    pub styles: Arc<Table>,
    /// Authored `units` option, `Data::Undefined` when omitted.
    pub units: Data,
}

impl Options {
    /// Appends the options serialized like `JSON.stringify`, in the key order
    /// `NativeBindings.compile` constructs: `axes`, `defaults`, optional `payloads` and
    /// `defaultPayloads`, `fonts`, `units`, `program`, and `styles`.
    pub fn write_json(&self, output: &mut String) {
        output.push_str("{\"axes\":");
        recipe::write_axes(output, &self.axes);
        output.push_str(",\"defaults\":");
        recipe::write_defaults(output, &self.defaults);

        if let Some(payloads) = &self.payloads {
            output.push_str(",\"payloads\":[");

            for (index, payload) in payloads.payloads.iter().enumerate() {
                if index > 0 {
                    output.push(',');
                }

                output.push_str("{\"axis\":");
                js::write_string(output, &payload.axis);
                output.push_str(",\"choice\":");
                js::write_string(output, &payload.choice);
                output.push_str(",\"slots\":[");

                for (index, slots) in payload.slots.iter().enumerate() {
                    if index > 0 {
                        output.push(',');
                    }

                    write_slots(output, slots);
                }

                output.push_str("]}");
            }

            output.push(']');

            if let Some(defaults) = &payloads.defaults {
                output.push_str(",\"defaultPayloads\":");
                js::write_object(
                    output,
                    defaults.iter().map(|(axis, fields)| (&**axis, fields)),
                    |output, fields| {
                        js::write_object(
                            output,
                            fields.iter().map(|(field, value)| (&**field, value)),
                            |output, value| js::write_data(output, &value.to_data()),
                        );
                    },
                );
            }
        }

        for (name, value) in [("fonts", &self.fonts), ("units", &self.units)] {
            if value.is_undefined() {
                continue;
            }

            output.push(',');
            js::write_string(output, name);
            output.push(':');
            js::write_data(output, value);
        }

        output.push_str(",\"program\":{\"slots\":");
        write_slots(output, &self.program.slots);
        output.push_str(",\"rules\":[");

        for (index, rule) in self.program.rules.iter().enumerate() {
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

                write_step(output, step);
            }

            output.push_str("]}");
        }

        output.push_str("]},\"styles\":");
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

fn write_slots(output: &mut String, slots: &[(Arc<str>, Arc<str>)]) {
    js::write_object(
        output,
        slots.iter().map(|(field, slot)| (&**field, slot)),
        |output, slot| js::write_string(output, slot),
    );
}

fn write_step(output: &mut String, step: &Step) {
    match step {
        Step::Style(name) => {
            output.push_str("{\"style\":");
            js::write_string(output, name);
            output.push('}');
        }
        Step::Assign { parts, property } => {
            output.push_str("{\"property\":");
            js::write_string(output, property);
            output.push_str(",\"parts\":[");

            for (index, part) in parts.iter().enumerate() {
                if index > 0 {
                    output.push(',');
                }

                match part {
                    Part::Number(value) => js::write_data(output, &Data::Number(*value)),
                    Part::String(value) => js::write_string(output, value),
                    Part::Slot { number, slot } => {
                        output.push_str("{\"slot\":");
                        js::write_string(output, slot);

                        if *number {
                            output.push_str(",\"number\":true");
                        }

                        output.push('}');
                    }
                }
            }

            output.push_str("]}");
        }
    }
}
