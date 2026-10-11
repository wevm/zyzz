//! Validates generated CSS with the parser that `lightningcss` `transform` runs.
//!
//! [`transform`] parses without error recovery, visits rules and URLs in document order,
//! minifies, and prints, so a stylesheet fails here exactly where `Lightning.transform` throws.
//! Messages are the error kinds `lightningcss` reports to JavaScript, and a visitor failure
//! surfaces as the message the visitor throws. Stylesheets that need at-keyword transport for
//! newer descriptor rules take the same plain path until the descriptor adapters are ported.

use lightningcss::rules::CssRule;
use lightningcss::stylesheet::{MinifyOptions, ParserOptions, PrinterOptions, StyleSheet};
use lightningcss::values::url::Url;
use lightningcss::visit_types;
use lightningcss::visitor::{Visit, VisitTypes, Visitor};

/// A rule visitor; a returned message fails the transform.
pub type RuleHook<'v> = &'v mut dyn FnMut(&CssRule<'_>) -> Result<(), String>;

/// A `url()` visitor; a returned message fails the transform.
pub type UrlHook<'v> = &'v mut dyn FnMut(&str) -> Result<(), String>;

/// Visitor callbacks.
#[derive(Default)]
pub struct Hooks<'v> {
    /// Receives every rule, before its children.
    pub rule: Option<RuleHook<'v>>,
    /// Receives every `url()` value.
    pub url: Option<UrlHook<'v>>,
}

impl<'i> Visitor<'i> for Hooks<'_> {
    type Error = String;

    fn visit_types(&self) -> VisitTypes {
        visit_types!(RULES | URLS)
    }

    fn visit_rule(&mut self, rule: &mut CssRule<'i>) -> Result<(), Self::Error> {
        if let Some(visit) = self.rule.as_deref_mut() {
            visit(rule)?;
        }

        rule.visit_children(self)
    }

    fn visit_url(&mut self, url: &mut Url<'i>) -> Result<(), Self::Error> {
        match self.url.as_deref_mut() {
            Some(visit) => visit(&url.url),
            None => Ok(()),
        }
    }
}

/// Parses, visits, minifies, and prints a stylesheet, as `Lightning.transform` does without
/// error recovery.
///
/// # Errors
///
/// Returns the message `Lightning.transform` throws for parse, visitor, minify, and print
/// failures.
pub fn transform(code: &str, mut hooks: Hooks<'_>) -> Result<(), String> {
    let mut sheet = StyleSheet::parse(
        code,
        ParserOptions {
            error_recovery: false,
            ..ParserOptions::default()
        },
    )
    .map_err(|error| error.kind.to_string())?;

    sheet.visit(&mut hooks)?;
    sheet
        .minify(MinifyOptions::default())
        .map_err(|error| error.kind.to_string())?;
    sheet
        .to_css(PrinterOptions::default())
        .map_err(|error| error.kind.to_string())?;

    Ok(())
}
