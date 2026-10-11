//! Native source replacements that syntax-tree adapters apply instead of the rewritten code.

/// A compiler-owned expression, statement replacement, or insertion.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Edit {
    /// Replacement code.
    pub code: String,
    /// Exclusive UTF-16 offset of the replaced range.
    pub end: u32,
    /// Whether the replacement is an expression rather than statements.
    pub expression: bool,
    /// Inclusive UTF-16 offset of the replaced range.
    pub start: u32,
}
