//! Reproduces `transform` from the lightningcss npm binding for the options the compiler passes.
//!
//! The binding parses with the given filename and error recovery, runs a visitor when one is
//! present, minifies for the browser targets, and prints, optionally with a source map. Its errors
//! carry only the error kind's text, so [`crate::error::Error::Message`] holds that text and the
//! location the binding attaches as separate fields is dropped. A visitor error propagates
//! unchanged, as a thrown JavaScript visitor error does.
//!
//! The binding's input source maps, CSS modules, drafts, unused symbols, and dependency analysis
//! are not reproduced. Without them, minification and printing cannot fail: their only error
//! kinds come from custom media, CSS modules, and dependency analysis. [`parse`] therefore
//! observes every error a validating transform can raise without minifying or printing.

use lightningcss::stylesheet::{
    MinifyOptions, ParserFlags, ParserOptions, PrinterOptions, StyleSheet,
};
use lightningcss::targets::{Browsers, Targets};
use lightningcss::visitor::{Visit, Visitor};
use parcel_sourcemap::SourceMap;

use crate::error::{Error, Result};

/// Transform options, mirroring the binding's `TransformOptions` fields the compiler uses.
#[derive(Clone, Copy, Debug, Default)]
pub struct Options<'a> {
    /// Stylesheet source.
    pub code: &'a str,
    /// Whether invalid rules and declarations are skipped instead of failing (`errorRecovery`).
    pub error_recovery: bool,
    /// Source filename, named by error locations and as the source map's only source.
    pub filename: &'a str,
    /// Whether output omits whitespace.
    pub minify: bool,
    /// Whether a source map of the output is produced (`sourceMap`).
    pub source_map: bool,
    /// Browser targets for lowering and prefixing.
    pub targets: Option<Browsers>,
}

/// Transformed CSS, as the binding's `code` and `map` fields hold it.
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct Output {
    /// Printed stylesheet.
    pub code: String,
    /// Source Map v3 JSON of the output, present when [`Options::source_map`] is set.
    pub map: Option<String>,
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
/// Returns the binding's message for parse, minification, printer, and source map errors.
pub fn transform(options: &Options<'_>) -> Result<Output> {
    finish(parse(options)?, options)
}

/// Parses a stylesheet, runs a visitor over it, then minifies and prints it.
///
/// # Errors
///
/// Returns the binding's message for parse, minification, printer, and source map errors, and a
/// visitor's error unchanged.
pub fn transform_with<V>(options: &Options<'_>, visitor: &mut V) -> Result<Output>
where
    V: for<'i> Visitor<'i, Error = Error>,
{
    let mut sheet = parse(options)?;

    sheet.visit(visitor)?;
    finish(sheet, options)
}

fn finish(mut sheet: StyleSheet<'_>, options: &Options<'_>) -> Result<Output> {
    let targets = Targets {
        browsers: options.targets,
        ..Targets::default()
    };

    // The binding's map resolves sources against `/` and embeds the input as their content.
    let mut source_map = if options.source_map {
        let mut map = SourceMap::new("/");

        map.add_source(options.filename);
        map.set_source_content(0, options.code)
            .map_err(|error| failure(&error))?;

        Some(map)
    } else {
        None
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
            source_map: source_map.as_mut(),
            targets,
            ..PrinterOptions::default()
        })
        .map_err(|error| failure(&error.kind))?;

    Ok(Output {
        code: output.code,
        map: source_map.and_then(|mut map| map.to_json(None).ok()),
    })
}

#[cold]
fn failure(kind: &impl std::fmt::Display) -> Error {
    Error::Message(kind.to_string())
}
