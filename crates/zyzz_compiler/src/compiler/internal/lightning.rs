//! Reproduces `transform` from the lightningcss npm binding for the options the compiler passes.
//!
//! The binding parses with the given filename and error recovery, runs a visitor when one is
//! present, minifies for the browser targets, and prints. Its errors carry only the error kind's
//! text, so [`crate::error::Error::Message`] holds that text and the location the binding
//! attaches as separate fields is dropped. A visitor error propagates unchanged, as a thrown
//! JavaScript visitor error does.
//!
//! The binding's source maps, CSS modules, drafts, unused symbols, and dependency analysis are
//! not reproduced. Without them, minification and printing cannot fail: their only error kinds
//! come from custom media, CSS modules, and dependency analysis. [`parse`] therefore observes
//! every error a validating transform can raise without minifying or printing.

use lightningcss::stylesheet::{
    MinifyOptions, ParserFlags, ParserOptions, PrinterOptions, StyleSheet,
};
use lightningcss::targets::{Browsers, Targets};
use lightningcss::visitor::{Visit, Visitor};

use crate::error::{Error, Result};

/// Transform options, mirroring the binding's `TransformOptions` fields the compiler uses.
#[derive(Clone, Copy, Debug, Default)]
pub struct Options<'a> {
    /// Stylesheet source.
    pub code: &'a str,
    /// Whether invalid rules and declarations are skipped instead of failing (`errorRecovery`).
    pub error_recovery: bool,
    /// Source filename, used only in error locations the message omits.
    pub filename: &'a str,
    /// Whether output omits whitespace.
    pub minify: bool,
    /// Browser targets for lowering and prefixing.
    pub targets: Option<Browsers>,
}

/// Parses a stylesheet as the binding does before visiting.
///
/// # Errors
///
/// Returns the parse error kind's message, such as `Unexpected token Delim('?')`.
pub fn parse<'i>(options: &Options<'i>) -> Result<StyleSheet<'i>> {
    StyleSheet::parse(
        options.code,
        ParserOptions {
            css_modules: None,
            error_recovery: options.error_recovery,
            filename: options.filename.to_owned(),
            flags: ParserFlags::empty(),
            source_index: 0,
            warnings: None,
        },
    )
    .map_err(|error| failure(&error.kind))
}

/// Parses, minifies, and prints a stylesheet.
///
/// # Errors
///
/// Returns the binding's message for parse, minification, and printer errors.
pub fn transform(options: &Options<'_>) -> Result<String> {
    finish(parse(options)?, options)
}

/// Parses a stylesheet, runs a visitor over it, then minifies and prints it.
///
/// # Errors
///
/// Returns the binding's message for parse, minification, and printer errors, and a visitor's
/// error unchanged.
pub fn transform_with<V>(options: &Options<'_>, visitor: &mut V) -> Result<String>
where
    V: for<'i> Visitor<'i, Error = Error>,
{
    let mut sheet = parse(options)?;

    sheet.visit(visitor)?;
    finish(sheet, options)
}

fn finish(mut sheet: StyleSheet<'_>, options: &Options<'_>) -> Result<String> {
    let targets = Targets {
        browsers: options.targets,
        ..Targets::default()
    };

    sheet
        .minify(MinifyOptions {
            targets,
            ..MinifyOptions::default()
        })
        .map_err(|error| failure(&error.kind))?;

    let output = sheet
        .to_css(PrinterOptions {
            minify: options.minify,
            targets,
            ..PrinterOptions::default()
        })
        .map_err(|error| failure(&error.kind))?;

    Ok(output.code)
}

#[cold]
fn failure(kind: &impl std::fmt::Display) -> Error {
    Error::Message(kind.to_string())
}
