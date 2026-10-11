//! Defines source-owned namespace bindings and their CSS statement encoding.

use std::fmt::Write as _;
use std::sync::Arc;

/// One authored namespace and its compiler-owned output prefix.
#[derive(Clone, Debug)]
pub struct Definition {
    /// Unique emitted namespace prefix.
    pub name: Arc<str>,
    /// Authored selector prefix, or `None` for the default namespace.
    pub prefix: Option<Arc<str>>,
    /// Namespace URI; this is an identity, not an asset URL.
    pub uri: Arc<str>,
}

/// Encodes a namespace URI as a CSS string, including control characters and quotes.
pub fn statement(value: &Definition) -> String {
    let mut output = String::with_capacity(value.uri.len() + value.name.len() + 16);

    output.push_str("@namespace ");
    output.push_str(&value.name);
    output.push_str(" \"");

    for character in value.uri.chars() {
        match character {
            '\0' => output.push('\u{fffd}'),
            '"' | '\\' => {
                output.push('\\');
                output.push(character);
            }
            '\u{1}'..='\u{1f}' | '\u{7f}' => {
                let _ = write!(output, "\\{:x} ", u32::from(character));
            }
            _ => output.push(character),
        }
    }

    output.push_str("\";");
    output
}
