//! Extracts literal styles and local themes through lexical source analysis.
//!
//! [`Extracted`] is the contract later stages share: the direct definition calls a rewriter
//! replaces, validated style definitions, and the theme, variable, and stylesheet data of one
//! module. Offsets in extraction results are UTF-8 byte offsets into the module source, and hosts
//! convert them to UTF-16 at the JSON boundary. Diagnostics report UTF-16 offsets, as the public
//! error does.

use std::sync::Arc;

use oxc_ast::ast::ObjectExpression;
use rustc_hash::FxHashMap;

use crate::compiler::internal::contributions;
use crate::compiler::internal::dynamic::Slots;
use crate::compiler::internal::syntax::Parsed;
use crate::compiler::internal::themes::{self, Alias, Context, Link, Output, VarsRead};
use crate::compiler::internal::vars;
use crate::internal::recipe;
use crate::internal::theme::Definition;
use crate::js::Record;
use crate::runtime::composition::Owner;
use crate::runtime::recipe as runtime;
use crate::style;
use crate::web::internal::{contributions as web, namespace};

/// Native alternatives of an authoring contract.
#[derive(Clone, Debug)]
pub struct NativeContext {
    /// Default label selected when the provider omits its theme.
    pub default_vars: Arc<str>,
    /// Compatible alternatives from the owning configuration.
    pub vars: Record<Arc<Definition>>,
}

/// One input of a runtime composition.
#[derive(Clone, Debug)]
pub struct RuntimeInput {
    /// Start of the original resolved application, for selective HTML preparation.
    pub application_start: Option<u32>,
    /// Presence bit of a conditional argument.
    pub condition: Option<u32>,
    /// Exclusive offset of the application argument.
    pub end: u32,
    /// Replaced generated class owner.
    pub name: Arc<str>,
    /// Attribute and private variable ownership.
    pub owners: Vec<Owner>,
    /// Inclusive offset of the application argument.
    pub start: u32,
}

/// A definition call available for a later source rewriter.
///
/// Offsets are UTF-8 byte offsets into the module source. Public results convert them to UTF-16.
#[derive(Clone, Debug, Default)]
pub struct Call<'a> {
    /// Expanded literal body retained for declaration mapping.
    pub body: Option<&'a ObjectExpression<'a>>,
    /// Binding reads preserved by compile-time composition.
    pub composition: Option<Vec<Arc<str>>>,
    /// Whether the call is a CSS-only presence alternative of a runtime composition.
    pub composition_case: bool,
    /// Names of precompiled presence alternatives in bitmask order.
    pub composition_cases: Option<Vec<Arc<str>>>,
    /// Readable authored binding for contextual CSS names.
    pub css_name: Option<Arc<str>>,
    /// Configuration namespace for emitted CSS.
    pub css_namespace: Option<Arc<str>>,
    /// Ordered dynamic alternatives with scalar binding references.
    pub dynamic_recipe: Option<recipe::Definition>,
    /// Exclusive offset of the complete call.
    pub end: u32,
    /// Stable selector identity.
    pub identity: Option<Arc<str>>,
    /// Name of the definition in the extracted styles.
    pub name: Arc<str>,
    /// Native alternatives of the authoring contract.
    pub native_context: Option<NativeContext>,
    /// HTML attribute output.
    pub output: Option<Output>,
    /// Ownership retained by a separately compiled callable.
    pub ownership: Option<Owner>,
    /// Class identity available without source rewriting.
    pub portable: Option<Arc<str>>,
    /// Flattened definition identities of nested compositions.
    pub portable_inputs: Option<Vec<Arc<str>>>,
    /// Finite recipe selection metadata.
    pub recipe: Option<runtime::Definition>,
    /// Typed payload signatures by axis and choice.
    pub recipe_types: Option<Record<Record<Arc<str>>>>,
    /// Fixed runtime applications over a resolved CSS sequence.
    pub runtime_composition: Option<Vec<RuntimeInput>>,
    /// Alias targets for declaration source locations.
    pub shorthands: Option<crate::internal::token::Map<Arc<[Arc<str>]>>>,
    /// Typed runtime slots of a callback definition.
    pub slots: Option<Slots>,
    /// Inclusive offset of the complete call.
    pub start: u32,
    /// Ordered static alternatives without selector lowering.
    pub static_recipe: Option<recipe::Definition>,
    /// Emitted typography field counts by authored property offset.
    pub typography: Option<FxHashMap<u32, u32>>,
    /// Emitted typography query counts by authored property offset.
    pub typography_queries: Option<FxHashMap<u32, u32>>,
    /// Authored scalar input type text.
    pub values_type: Option<Arc<str>>,
}

/// The stable category of a source diagnostic.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Code {
    /// A literal failed style validation.
    InvalidLiteral,
    /// The module identity is not portable.
    InvalidModule,
    /// The module does not parse.
    SyntaxError,
    /// Source syntax outside the supported static boundary.
    UnsupportedSyntax,
}

impl Code {
    /// The TypeScript spelling.
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::InvalidLiteral => "invalid_literal",
            Self::InvalidModule => "invalid_module",
            Self::SyntaxError => "syntax_error",
            Self::UnsupportedSyntax => "unsupported_syntax",
        }
    }
}

/// A source-owned extraction failure.
#[derive(Clone, Debug, PartialEq)]
pub struct Diagnostic {
    /// Stable failure category.
    pub code: Code,
    /// Exclusive UTF-16 source offset.
    pub end: u32,
    /// Explanation of the supported input boundary.
    pub message: String,
    /// Portable module identity supplied by the host.
    pub source: Arc<str>,
    /// Inclusive UTF-16 source offset.
    pub start: u32,
}

/// `Source.ExtractError`: every source diagnostic of a failed extraction, in source order.
#[derive(Clone, Debug, PartialEq)]
pub struct ExtractError {
    /// Diagnostics, stably sorted by start offset.
    pub diagnostics: Vec<Diagnostic>,
}

impl ExtractError {
    /// Orders diagnostics by start offset, keeping report order for equal starts.
    pub fn new(mut diagnostics: Vec<Diagnostic>) -> Self {
        diagnostics.sort_by_key(|diagnostic| diagnostic.start);

        Self { diagnostics }
    }

    /// The error message: one `source:start: message` line per diagnostic.
    pub fn message(&self) -> String {
        let mut output = String::new();

        for (index, diagnostic) in self.diagnostics.iter().enumerate() {
            if index > 0 {
                output.push('\n');
            }

            output.push_str(&diagnostic.source);
            output.push(':');
            output.push_str(&diagnostic.start.to_string());
            output.push_str(": ");
            output.push_str(&diagnostic.message);
        }

        output
    }
}

/// A scope read in a static binding, replaced by its serialized class constant.
#[derive(Clone, Debug, PartialEq)]
pub struct StaticThemeReference {
    /// Exclusive offset of the read.
    pub end: u32,
    /// Inclusive offset of the read.
    pub start: u32,
    /// Serialized CSS value.
    pub value: String,
}

/// The target whose authoring semantics extraction applies.
#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum Target {
    /// React Native: applications keep native props composition.
    Native,
    /// The web.
    #[default]
    Web,
}

/// Source text and identity supplied by an adapter.
#[derive(Clone, Copy)]
pub struct Options<'s, 'a> {
    /// `Some(false)` collects portable runtime identities when source rewriting is disabled.
    pub compiler: Option<bool>,
    /// Compiler-owned graph context.
    pub context: Option<&'s Context<'a>>,
    /// Portable identity including package and module path; no filesystem access occurs.
    pub module_id: &'s str,
    /// Syntax owned by the current graph compilation, parsed from `source`.
    pub parsed: Option<&'s Parsed<'a>>,
    /// Complete module text, parsed as TypeScript with JSX.
    pub source: &'a str,
    /// Target semantics.
    pub target: Target,
}

/// Ordered compiler input and rewrite spans of one module.
///
/// Empty lists stand for the optional TypeScript fields, which are absent when empty.
pub struct Extracted<'a> {
    /// Direct calls in source order.
    pub calls: Vec<Call<'a>>,
    /// Stylesheet factory calls and their source replacements.
    pub contribution_calls: Vec<contributions::Call<'a>>,
    /// Call starts of each contribution, in contribution order.
    pub contribution_starts: Vec<u32>,
    /// Static stylesheet effects.
    pub contributions: Vec<web::Definition>,
    /// Module-owned namespace bindings retained when contributions are shared.
    pub namespaces: Vec<namespace::Definition>,
    /// Readonly native variable arguments and their complete catalogs.
    pub native_vars: Vec<VarsRead>,
    /// Scope reads replaced by class constants.
    pub static_theme_references: Vec<StaticThemeReference>,
    /// Validated definitions accepted by `Css.compile`, with readable class labels.
    pub styles: style::Definition,
    /// Local bound-authoring initializers and their retained token types.
    pub theme_aliases: Vec<Alias>,
    /// Configuration identities retaining their root controls.
    pub theme_appearances: Vec<Arc<str>>,
    /// Local factory spans replaced by compiled scope data.
    pub theme_calls: Vec<themes::Call>,
    /// Resolved authoring exports, present when extracted as part of a source graph.
    pub theme_exports: Option<Record<Link>>,
    /// Theme `className` reads replaced with compiled constants.
    pub theme_references: Vec<themes::Reference>,
    /// Configuration identities retaining their initialization helper.
    pub theme_scripts: Vec<Arc<str>>,
    /// Configuration identities whose theme selector is called, passed, or bound.
    pub theme_selections: Vec<Arc<str>>,
    /// Explicit variable contracts replaced by fixed slot data.
    pub variable_calls: Vec<vars::Call>,
    /// Stable scope keys and validated local theme definitions.
    pub vars: Record<Arc<Definition>>,
}
