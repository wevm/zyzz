//! Configuration, theme, and variable-set analysis shared across a module graph.
//!
//! This module currently defines the link and call contracts other stages share. The collector
//! that produces them is ported alongside source extraction.

use std::sync::Arc;

use oxc_ast::ast::Expression;

use crate::compiler::internal::packed_styles;
use crate::data::Object;
use crate::internal::binding;
use crate::internal::rule_reference;
use crate::internal::theme::Definition;
use crate::internal::token::Mappings;
use crate::js::Record;

/// A `@function` signature: ordered parameters and the result syntax.
#[derive(Clone, Debug, PartialEq)]
pub struct FunctionSignature {
    /// Parameters in authored order.
    pub parameters: Vec<FunctionParameter>,
    /// Result syntax.
    pub returns: Arc<str>,
}

/// One `@function` parameter.
#[derive(Clone, Debug, PartialEq)]
pub struct FunctionParameter {
    /// Default value.
    pub default: Option<crate::runtime::recipe::Scalar>,
    /// Custom property name, including `--`.
    pub name: Arc<str>,
    /// Accepted syntax.
    pub syntax: Option<Arc<str>>,
}

/// A configuration, theme, or variable-set authoring call.
#[derive(Clone, Debug, Default)]
pub struct Call {
    /// Whether the configuration only names a catalog of sets.
    pub catalog_only: bool,
    /// Whether the call reads variables directly.
    pub direct_variables: bool,
    /// `@function` signature of a CSS function factory.
    pub function: Option<FunctionSignature>,
    /// Whether the call initializes the scheme script.
    pub initialization: bool,
    /// Exclusive offset of the call.
    pub end: u32,
    /// Member scope keys by member path.
    pub members: Option<Record<Arc<str>>>,
    /// Scope key.
    pub name: Arc<str>,
    /// Whether the configuration targets a native provider.
    pub native_provider: bool,
    /// Evaluated configuration options.
    pub options: Option<Object>,
    /// `html` when the configuration emits HTML attributes.
    pub output: Option<Output>,
    /// Whether the call defines a recipe factory.
    pub recipe: bool,
    /// Named rule kind a reference call refers to.
    pub reference: Option<rule_reference::Kind>,
    /// Whether the call renders a root appearance helper.
    pub root: bool,
    /// Whether the call renders an appearance script.
    pub script: bool,
    /// Whether the call renders an appearance helper.
    pub appearance: bool,
    /// Whether the configuration selects named sets.
    pub selection: bool,
    /// Inclusive offset of the call.
    pub start: u32,
    /// Token type text for generated declarations.
    pub token_type: Arc<str>,
    /// Declared type text.
    pub type_text: Option<Arc<str>>,
    /// Whether the call configures variables.
    pub variable_config: bool,
    /// Category mappings for a variable configuration.
    pub variable_mappings: Option<Mappings>,
    /// Owning scope of variable reads.
    pub variable_owner: Option<Arc<str>>,
    /// Whether the call defines a variable set.
    pub variable_set: bool,
    /// Binding slots the call declares.
    pub variables: Option<Record<Arc<binding::Reference>>>,
}

/// Output mode for configured applications.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Output {
    /// HTML attribute props.
    Html,
}

/// A local alias of configured helpers, such as `const { style } = config`.
#[derive(Clone, Debug, Default)]
pub struct Alias {
    /// Helpers destructured from the configuration.
    pub bindings: Option<Vec<AliasBinding>>,
    /// The aliased call.
    pub call: Call,
    /// Whether helpers are destructured.
    pub destructured: bool,
    /// Whether the alias stays in the rewritten module.
    pub retained: bool,
}

/// A configured helper an alias destructures.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AliasBinding {
    /// `style`
    Style,
    /// `variants`
    Variants,
}

/// What an exported binding links to.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum LinkKind {
    /// A keyframes animation.
    Animation,
    /// A configuration.
    Config,
    /// A named rule reference.
    RuleReference,
    /// A style definition.
    Style,
    /// A style reference.
    StyleReference,
    /// A theme.
    Theme,
    /// A variable set.
    Variables,
}

/// An exported authoring value that other modules of the graph can import.
#[derive(Clone, Debug)]
pub struct Link {
    /// Exported binding identity.
    pub binding: Arc<str>,
    /// The defining call.
    pub call: Call,
    /// The linked theme or configuration definition.
    pub definition: Arc<Definition>,
    /// What the link refers to.
    pub kind: LinkKind,
    /// Member links by member path.
    pub members: Option<Record<Link>>,
    /// Packed style data of a linked style.
    pub style: Option<Arc<packed_styles::Definition>>,
}

/// A configured `vars()` selection read for native output.
#[derive(Clone, Debug)]
pub struct VarsRead {
    /// Default set name.
    pub default_vars: Arc<str>,
    /// Exclusive offset.
    pub end: u32,
    /// Owning configuration scope key.
    pub owner: Arc<str>,
    /// Inclusive offset.
    pub start: u32,
    /// Whether the configuration has a single unnamed set.
    pub unnamed: bool,
    /// Selectable sets by name.
    pub vars: Record<Arc<Definition>>,
}

/// A read of a configured theme by scope key.
#[derive(Clone, Debug, PartialEq)]
pub struct Reference {
    /// Exclusive offset.
    pub end: u32,
    /// Scope key.
    pub name: Arc<str>,
    /// Inclusive offset.
    pub start: u32,
}

/// Graph context that links one module to the exports of others.
#[derive(Clone, Debug, Default)]
pub struct Context<'a> {
    /// Constants imported from other modules, by local name.
    pub constants: Option<Record<&'a Expression<'a>>>,
    /// Factory names imported from other modules, by local name.
    pub factories: Option<Record<Arc<str>>>,
    /// Identifiers declared across the graph.
    pub identifiers: Option<rustc_hash::FxHashSet<Arc<str>>>,
    /// Library exports by module identity.
    pub libraries: Option<Record<Record<Link>>>,
    /// Links imported into this module, by local name.
    pub links: Record<Link>,
    /// Owners of linked calls.
    pub owners: Option<Record<Owner>>,
    /// Class names of imported styles, by style name.
    pub style_classes: Option<Record<Arc<str>>>,
}

/// The module that defines a linked call.
#[derive(Clone, Debug)]
pub struct Owner {
    /// The defining call.
    pub call: Call,
    /// Module identity.
    pub module_id: Arc<str>,
    /// Module source.
    pub source: Arc<str>,
}
