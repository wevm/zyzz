//! Ownership data that runtime composition helpers read.

use std::sync::Arc;

/// The attributes, identity, and variable slots one composed style owns.
#[derive(Clone, Debug, PartialEq)]
pub struct Owner {
    /// Recipe attributes the style sets.
    pub attributes: Vec<Arc<str>>,
    /// Class identity of the style.
    pub identity: Arc<str>,
    /// Whether `identity` precedes `attributes` in the serialized object, as for local calls.
    pub identity_first: bool,
    /// Custom properties the style binds.
    pub slots: Vec<Arc<str>>,
}

impl Owner {
    /// Appends the owner as `JSON.stringify` writes the TypeScript object.
    pub fn write_json(&self, output: &mut String) {
        let strings = |output: &mut String, values: &[Arc<str>]| {
            output.push('[');

            for (index, value) in values.iter().enumerate() {
                if index > 0 {
                    output.push(',');
                }

                crate::js::write_string(output, value);
            }

            output.push(']');
        };

        output.push('{');

        if self.identity_first {
            output.push_str("\"identity\":");
            crate::js::write_string(output, &self.identity);
            output.push_str(",\"attributes\":");
            strings(output, &self.attributes);
        } else {
            output.push_str("\"attributes\":");
            strings(output, &self.attributes);
            output.push_str(",\"identity\":");
            crate::js::write_string(output, &self.identity);
        }

        output.push_str(",\"slots\":");
        strings(output, &self.slots);
        output.push('}');
    }
}
