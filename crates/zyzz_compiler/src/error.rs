//! Compiler failures, mirroring the error classes the TypeScript compiler throws.

use std::fmt;

/// A compiler failure. Each variant corresponds to an error class callers distinguish.
#[derive(Clone, Debug, PartialEq)]
pub enum Error {
    /// `Config.InvalidError` for invalid configuration options or incompatible named sets.
    Config(String),
    /// `Css.CompileError` with every compilation diagnostic.
    Css(Vec<crate::web::css::Diagnostic>),
    /// `Source.ExtractError` with every source diagnostic, in source order.
    Extract(crate::compiler::source::ExtractError),
    /// A plain `Error` with a caller-visible message.
    Message(String),
    /// `MissingTransformError`: authoring that only the compiler can evaluate.
    MissingTransform,
    /// `Native.CompileError`: a native source feature outside the static source boundary.
    Native(String),
    /// `Style.InvalidError` with every validation diagnostic.
    Style(Vec<crate::style::Diagnostic>),
    /// `StyleSheet.CompileError` with every native capability diagnostic.
    StyleSheet(Vec<crate::react_native::style_sheet::Diagnostic>),
    /// `StyleSheet.SelectionError`: a lookup of a missing precompiled table.
    StyleSheetSelection(String),
    /// `Source.ThemeInvalidError`: unsupported source syntax with its UTF-8 source span.
    Themes {
        /// Explanation of the unsupported syntax.
        message: String,
        /// UTF-8 span of the offending node.
        span: oxc_span::Span,
    },
    /// `Theme.InvalidError` with the failing token path.
    Theme {
        /// Explanation of the failure.
        message: String,
        /// Token path components.
        path: Vec<String>,
    },
    /// `Variants.CompileError`: invalid or unbounded native recipe data.
    Variants(String),
    /// `Vars.InvalidError` with the failing variable path.
    Vars {
        /// Explanation of the failure.
        message: String,
        /// Variable path components.
        path: Vec<String>,
    },
}

impl Error {
    /// Creates a plain message error.
    #[cold]
    pub fn message(message: impl Into<String>) -> Self {
        Self::Message(message.into())
    }

    /// The caller-visible message, as `error.message` reads in TypeScript.
    pub fn text(&self) -> String {
        match self {
            Self::Config(message)
            | Self::Message(message)
            | Self::Native(message)
            | Self::StyleSheetSelection(message)
            | Self::Themes { message, .. }
            | Self::Variants(message) => message.clone(),
            Self::Css(diagnostics) => crate::web::css::error_message(diagnostics),
            Self::Extract(error) => error.message(),
            Self::MissingTransform => MISSING_TRANSFORM.to_owned(),
            Self::Style(diagnostics) => crate::style::error_message(diagnostics),
            Self::StyleSheet(diagnostics) => {
                crate::react_native::style_sheet::error_message(diagnostics)
            }
            Self::Theme { message, path } | Self::Vars { message, path } => {
                format!("{}: {message}", crate::internal::theme::path_json(path))
            }
        }
    }
}

/// The message of `MissingTransformError`.
pub const MISSING_TRANSFORM: &str = "style requires a compile-time transform. Source extraction alone does not rewrite calls; do not execute untransformed authoring source.";

impl fmt::Display for Error {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.text())
    }
}

impl std::error::Error for Error {}

/// A compiler result.
pub type Result<T> = std::result::Result<T, Error>;
