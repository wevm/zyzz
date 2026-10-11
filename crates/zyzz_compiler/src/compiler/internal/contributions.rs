//! Extracts module-level stylesheet effects without evaluating application code.
//!
//! Stylesheet factories imported from `zyzz/web` are compile-time macros: each call becomes
//! ordered contribution data, and named definitions such as `keyframes` become references that
//! declarations and other contributions read by name.

use std::sync::Arc;

use oxc_ast::ast::Argument;

use crate::compiler::internal::themes::FunctionSignature;
use crate::internal::rule_reference;

/// A stylesheet factory exported by `zyzz/web`.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Factory {
    /// `colorProfile`
    ColorProfile,
    /// `counterStyle`
    CounterStyle,
    /// `cssFunction`
    CssFunction,
    /// `customMedia`
    CustomMedia,
    /// `fontFace`
    FontFace,
    /// `fontFeatureValues`
    FontFeatureValues,
    /// `fontPaletteValues`
    FontPaletteValues,
    /// `global`
    Global,
    /// `importCss`
    ImportCss,
    /// `keyframes`
    Keyframes,
    /// `layers`
    Layers,
    /// `namespace`
    Namespace,
    /// `page`
    Page,
    /// `positionTry`
    PositionTry,
    /// `property`
    Property,
    /// `viewTransition`
    ViewTransition,
}

/// Factory export names in the order `Contributions.factories` lists them.
pub const FACTORIES: [&str; 16] = [
    "importCss",
    "namespace",
    "fontFace",
    "fontFeatureValues",
    "global",
    "layers",
    "page",
    "property",
    "viewTransition",
    "cssFunction",
    "customMedia",
    "colorProfile",
    "counterStyle",
    "fontPaletteValues",
    "keyframes",
    "positionTry",
];

impl Factory {
    /// Reads a factory export name.
    pub fn parse(name: &str) -> Option<Self> {
        Some(match name {
            "colorProfile" => Self::ColorProfile,
            "counterStyle" => Self::CounterStyle,
            "cssFunction" => Self::CssFunction,
            "customMedia" => Self::CustomMedia,
            "fontFace" => Self::FontFace,
            "fontFeatureValues" => Self::FontFeatureValues,
            "fontPaletteValues" => Self::FontPaletteValues,
            "global" => Self::Global,
            "importCss" => Self::ImportCss,
            "keyframes" => Self::Keyframes,
            "layers" => Self::Layers,
            "namespace" => Self::Namespace,
            "page" => Self::Page,
            "positionTry" => Self::PositionTry,
            "property" => Self::Property,
            "viewTransition" => Self::ViewTransition,
            _ => return None,
        })
    }

    /// The export name.
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::ColorProfile => "colorProfile",
            Self::CounterStyle => "counterStyle",
            Self::CssFunction => "cssFunction",
            Self::CustomMedia => "customMedia",
            Self::FontFace => "fontFace",
            Self::FontFeatureValues => "fontFeatureValues",
            Self::FontPaletteValues => "fontPaletteValues",
            Self::Global => "global",
            Self::ImportCss => "importCss",
            Self::Keyframes => "keyframes",
            Self::Layers => "layers",
            Self::Namespace => "namespace",
            Self::Page => "page",
            Self::PositionTry => "positionTry",
            Self::Property => "property",
            Self::ViewTransition => "viewTransition",
        }
    }

    /// Whether the factory defines a named rule that a module-level constant must bind.
    pub const fn named(self) -> bool {
        matches!(
            self,
            Self::ColorProfile
                | Self::CounterStyle
                | Self::CssFunction
                | Self::CustomMedia
                | Self::FontPaletteValues
                | Self::Keyframes
                | Self::PositionTry
        )
    }

    /// The rule kind declarations reference, for named factories other than `keyframes`.
    pub const fn reference(self) -> Option<rule_reference::Kind> {
        Some(match self {
            Self::ColorProfile => rule_reference::Kind::ColorProfile,
            Self::CounterStyle => rule_reference::Kind::CounterStyle,
            Self::CssFunction => rule_reference::Kind::CssFunction,
            Self::CustomMedia => rule_reference::Kind::CustomMedia,
            Self::FontPaletteValues => rule_reference::Kind::FontPaletteValues,
            Self::PositionTry => rule_reference::Kind::PositionTry,
            _ => return None,
        })
    }
}

/// A factory call that a rewriter replaces, with its rule name when it defines one.
///
/// Offsets are UTF-8 byte offsets into the module source.
#[derive(Clone, Debug)]
pub struct Call<'a> {
    /// The definition argument.
    pub argument: &'a Argument<'a>,
    /// Start of the constant that binds a named definition.
    pub binding: Option<u32>,
    /// The optional context argument.
    pub context: Option<&'a Argument<'a>>,
    /// Exclusive offset of the call.
    pub end: u32,
    /// Whether a named definition is exported.
    pub exported: bool,
    /// `@function` signature of a `cssFunction` definition, filled by literal extraction.
    pub function: Option<FunctionSignature>,
    /// The factory.
    pub kind: Factory,
    /// Compiler-owned rule name of a named definition.
    pub name: Option<Arc<str>>,
    /// Inclusive offset of the call.
    pub start: u32,
}
