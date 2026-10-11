//! The finite native table that `Native.create` binds to defaults and styling overrides.

use std::sync::Arc;

use crate::internal::recipe::{self, Axes, Defaults};
use crate::react_native::style_sheet::{self, Table};

/// Compiler-owned finite metadata and one selected set and scheme table.
#[derive(Clone, Debug)]
pub struct Options {
    /// Ordered finite choice names.
    pub axes: Axes,
    /// Default selections. `None` suppresses an axis.
    pub defaults: Defaults,
    /// Native styles indexed by mixed-radix selection.
    pub styles: Arc<Table>,
}

impl Options {
    /// Appends the options serialized like `JSON.stringify({axes, defaults, styles})`.
    pub fn write_json(&self, output: &mut String) {
        output.push_str("{\"axes\":");
        recipe::write_axes(output, &self.axes);
        output.push_str(",\"defaults\":");
        recipe::write_defaults(output, &self.defaults);
        output.push_str(",\"styles\":");
        style_sheet::write_table(output, &self.styles);
        output.push('}');
    }

    /// Serializes like `JSON.stringify({axes, defaults, styles})`.
    pub fn to_json(&self) -> String {
        let mut output = String::new();

        self.write_json(&mut output);
        output
    }
}
