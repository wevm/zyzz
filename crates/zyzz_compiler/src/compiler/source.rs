//! Extracts literal styles and local themes through lexical source analysis.
//!
//! This module currently defines the call contract later stages share. Extraction itself is
//! ported in stages.

use std::sync::Arc;

use oxc_ast::ast::ObjectExpression;
use rustc_hash::FxHashMap;

use crate::compiler::internal::dynamic::Slots;
use crate::compiler::internal::themes::Output;
use crate::internal::recipe;
use crate::internal::theme::Definition;
use crate::js::Record;
use crate::runtime::composition::Owner;
use crate::runtime::recipe as runtime;

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
