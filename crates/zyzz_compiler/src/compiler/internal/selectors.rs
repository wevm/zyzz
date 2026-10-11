//! Resolves selector objects and the portable identities of the style definitions they name.
//!
//! [`scan`] runs after extraction has collected its definition calls. It validates authored
//! `selectors` keys, gives interpolated definitions a stable class identity, resolves exported
//! style definitions for the source graph, and resolves composition entries to their
//! definitions.

use std::borrow::Cow;
use std::sync::Arc;

use indexmap::IndexMap;
use lightningcss::rules::CssRule;
use lightningcss::selector::{Combinator, Component};
use oxc_allocator::{Address, GetAddress};
use oxc_ast::AstKind;
use oxc_ast::ast::{
    BindingPattern, CallExpression, Declaration, Expression, ImportDeclarationSpecifier,
    ObjectProperty, PropertyKind, Statement, TSNamespaceDeclaration, TSNamespaceDeclarationBody,
    VariableDeclarationKind, VariableDeclarator,
};
use oxc_ast_visit::Visit;
use oxc_span::{GetSpan, Span};
use rustc_hash::{FxBuildHasher, FxHashMap, FxHashSet};

use crate::compiler::internal::expression::unwrap;
use crate::compiler::internal::scope::{self, Mode};
use crate::compiler::internal::syntax::Parsed;
use crate::compiler::internal::themes::{self, Link, LinkKind};
use crate::compiler::internal::{identifiers, lightning, names};
use crate::data::{Data, Object};
use crate::error::{Error, Result};
use crate::internal::{condition, identity, theme};
use crate::js::{self, Record};

/// What a composition entry or selector interpolation resolves to.
#[derive(Clone, Copy, Debug)]
pub enum Target<'s, 'a> {
    /// A definition call of this module.
    Call(&'a CallExpression<'a>),
    /// A style definition the source graph links into this module.
    Link(&'s Link),
}

/// Inputs from source extraction.
#[derive(Clone, Copy)]
pub struct Options<'s, 'a> {
    /// Definition calls of this module, in source order.
    pub calls: &'s [&'a CallExpression<'a>],
    /// Identifier and member entries of composition arrays.
    pub composed: &'s [&'a Expression<'a>],
    /// Configuration namespaces of bound definitions, by call start.
    pub css_namespaces: &'s FxHashMap<u32, Arc<str>>,
    /// Links imported into this module, by local name.
    pub links: &'s Record<Link>,
    /// Portable module identity.
    pub module_id: &'s str,
    /// Stable module namespace.
    pub namespace: &'s str,
    /// Key starts of properties inside `selectors` objects.
    pub selector_keys: &'s FxHashSet<u32>,
}

/// Validated selectors, local identities, exported definitions, and composed definitions.
pub struct Selectors<'s, 'a> {
    /// Composition entry targets, by entry start.
    pub compositions: FxHashMap<u32, Target<'s, 'a>>,
    /// Normalized selectors, by key start.
    pub conditions: FxHashMap<u32, Arc<str>>,
    /// Exported style definitions, by exported name.
    pub exports: Record<Link>,
    /// Stable class identities of interpolated or exported definitions, by call start.
    pub identities: FxHashMap<u32, Arc<str>>,
    /// Selectors that still select the styled element itself.
    pub local_conditions: FxHashSet<Arc<str>>,
}

#[cold]
fn invalid(message: &str, span: Span) -> Error {
    Error::Themes {
        message: message.to_owned(),
        span,
    }
}

/// An exported name of a definition, and its member name when a namespace exports it.
type Exposure<'a> = (Arc<str>, Option<&'a str>);

/// Exported constant members of a namespace block, by name.
type Members<'a> = IndexMap<&'a str, &'a Expression<'a>, FxBuildHasher>;

/// Whether a namespace declaration is part of a dotted name, which ESTree represents as one
/// declaration with a qualified name.
fn dotted(namespace: &TSNamespaceDeclaration<'_>, parent: Option<AstKind<'_>>) -> bool {
    matches!(
        namespace.body,
        TSNamespaceDeclarationBody::TSNamespaceDeclaration(_)
    ) || matches!(parent, Some(AstKind::TSNamespaceDeclaration(_)))
}

fn members<'a>(namespace: &'a TSNamespaceDeclaration<'a>) -> Members<'a> {
    let mut result = Members::default();
    let TSNamespaceDeclarationBody::TSModuleBlock(block) = &namespace.body else {
        return result;
    };

    for statement in &block.body {
        let Statement::ExportDeclaration(export) = statement else {
            continue;
        };
        let Declaration::VariableDeclaration(variable) = &export.declaration else {
            continue;
        };

        if variable.kind != VariableDeclarationKind::Const {
            continue;
        }

        for declarator in &variable.declarations {
            if let (BindingPattern::BindingIdentifier(id), Some(init)) =
                (&declarator.id, &declarator.init)
            {
                result.insert(id.name.as_str(), init);
            }
        }
    }

    result
}

/// A node the walk records for ordered processing.
enum Node<'a> {
    Declarator(&'a VariableDeclarator<'a>),
    Property(&'a ObjectProperty<'a>),
}

struct Collector<'s, 'a> {
    ancestors: Vec<AstKind<'a>>,
    bindings: FxHashMap<u32, &'a Expression<'a>>,
    namespaces: FxHashMap<u32, Members<'a>>,
    nodes: Vec<Node<'a>>,
    selector_keys: &'s FxHashSet<u32>,
}

impl<'a> Visit<'a> for Collector<'_, 'a> {
    fn enter_node(&mut self, kind: AstKind<'a>) {
        let parent = self.ancestors.last().copied();

        self.ancestors.push(kind);

        match kind {
            AstKind::ObjectProperty(property)
                if self.selector_keys.contains(&property.key.span().start) =>
            {
                self.nodes.push(Node::Property(property));
            }
            AstKind::VariableDeclarator(declarator) => {
                self.nodes.push(Node::Declarator(declarator));
            }
            AstKind::VariableDeclaration(variable)
                if variable.kind == VariableDeclarationKind::Const =>
            {
                for declarator in &variable.declarations {
                    if let (BindingPattern::BindingIdentifier(id), Some(init)) =
                        (&declarator.id, &declarator.init)
                    {
                        self.bindings.insert(id.span.start, init);
                    }
                }
            }
            AstKind::TSNamespaceDeclaration(namespace) if !dotted(namespace, parent) => {
                self.namespaces
                    .insert(namespace.id.span.start, members(namespace));
            }
            _ => {}
        }
    }

    fn leave_node(&mut self, _: AstKind<'a>) {
        self.ancestors.pop();
    }
}

/// An empty theme definition, as `Theme.define({})` creates for each style reference.
fn empty_definition() -> Result<Arc<theme::Definition>> {
    theme::define(&Data::from(Object::new()), None).map(Arc::new)
}

/// A style reference link with a compiler-owned binding.
fn reference(binding: Arc<str>, start: u32, end: u32) -> Result<Link> {
    Ok(Link {
        binding: Arc::clone(&binding),
        call: themes::Call {
            end,
            name: binding,
            start,
            token_type: Arc::from("{}"),
            ..themes::Call::default()
        },
        definition: empty_definition()?,
        kind: LinkKind::StyleReference,
        members: None,
        style: None,
    })
}

struct Resolver<'s, 'a> {
    authored: FxHashMap<u32, String>,
    bindings: FxHashMap<u32, &'a Expression<'a>>,
    definitions: FxHashMap<u32, u32>,
    identities: FxHashMap<u32, Arc<str>>,
    imported: FxHashMap<u32, &'s Link>,
    namespaces: FxHashMap<u32, Members<'a>>,
    options: Options<'s, 'a>,
    parsed: &'s Parsed<'a>,
}

impl<'s, 'a> Resolver<'s, 'a> {
    /// The start of the declaration an identifier names, as a frozen scope tracker reports it.
    fn declaration(&self, identifier: &oxc_ast::ast::IdentifierReference<'a>) -> Option<u32> {
        let semantic = &self.parsed.semantic;

        scope::lookup(
            semantic,
            &identifier.name,
            scope::scope_of(semantic, identifier.node_id()),
            Mode::Value,
        )
        .map(|declaration| declaration.start())
    }

    // Composition reads the definition itself, so only selector references claim an identity.
    fn target(
        &self,
        node: &'a Expression<'a>,
        seen: &mut FxHashSet<Address>,
    ) -> Option<Target<'s, 'a>> {
        let node = unwrap(node);

        if !seen.insert(node.address()) {
            return None;
        }

        match node {
            Expression::CallExpression(call)
                if self.definitions.get(&call.span.start) == Some(&call.span.end) =>
            {
                Some(Target::Call(call))
            }
            Expression::Identifier(identifier) => {
                let declaration = self.declaration(identifier)?;

                if let Some(external) = self.imported.get(&declaration) {
                    return Some(Target::Link(external));
                }

                let value = self.bindings.get(&declaration)?;

                self.target(value, seen)
            }
            Expression::StaticMemberExpression(member) if !member.optional => {
                self.member(&member.object, member.property.name.as_str(), seen)
            }
            Expression::ComputedMemberExpression(member) if !member.optional => {
                let Expression::StringLiteral(literal) = &member.expression else {
                    return None;
                };

                self.member(&member.object, literal.value.as_str(), seen)
            }
            _ => None,
        }
    }

    fn member(
        &self,
        object: &'a Expression<'a>,
        name: &str,
        seen: &mut FxHashSet<Address>,
    ) -> Option<Target<'s, 'a>> {
        if let Expression::Identifier(identifier) = object
            && let Some(value) = self
                .declaration(identifier)
                .and_then(|declaration| self.namespaces.get(&declaration))
                .and_then(|members| members.get(name))
        {
            return self.target(value, seen);
        }

        match self.target(object, seen)? {
            Target::Link(link) => link
                .members
                .as_ref()
                .and_then(|members| members.get(name))
                .map(Target::Link),
            Target::Call(_) => None,
        }
    }

    /// Names a local definition by its authored binding or explicit id, and claims that name.
    fn link(&mut self, call: &CallExpression<'a>) -> Result<Link> {
        let id = identifiers::explicit(call, 1)?;
        let prefix = self
            .options
            .css_namespaces
            .get(&call.span.start)
            .map_or_else(String::new, |prefix| format!("{prefix}-"));
        let name = if let Some(id) = id {
            format!(
                "z-style-id-{prefix}{}",
                identity::require_id(Some(&id), "style")?
                    .get(3..)
                    .unwrap_or_default()
            )
        } else {
            let compact = identity::compact(self.options.module_id);
            let suffix = compact.get(compact.len().saturating_sub(6)..).unwrap_or("");

            format!(
                "z-style-{prefix}{suffix}-{}",
                self.authored
                    .get(&call.span.start)
                    .map_or("", String::as_str)
            )
        };
        let name: Arc<str> = Arc::from(name);

        self.identities.insert(call.span.start, Arc::clone(&name));

        reference(name, call.span.start, call.span.end)
    }

    fn resolve(&mut self, node: &'a Expression<'a>) -> Result<Option<Cow<'s, Link>>> {
        match self.target(node, &mut FxHashSet::default()) {
            Some(Target::Call(call)) => self.link(call).map(|link| Some(Cow::Owned(link))),
            Some(Target::Link(link)) => Ok(Some(Cow::Borrowed(link))),
            None => Ok(None),
        }
    }

    /// Whether a link is, or is a member of, a style definition the graph links into this module.
    fn imported_has(&self, reference: &Link) -> bool {
        fn contains(value: &Link, reference: &Link) -> bool {
            std::ptr::eq(value, reference)
                || value
                    .members
                    .iter()
                    .flat_map(Record::values)
                    .any(|member| contains(member, reference))
        }

        self.imported
            .values()
            .any(|value| contains(value, reference))
    }
}

/// Whether the rightmost compound of a selector contains `&`, ignoring the pseudo-element,
/// part, and slot combinators that `lightningcss` omits from its JavaScript selectors.
fn local(selector: &lightningcss::selector::Selector<'_>) -> bool {
    for component in selector.iter_raw_match_order() {
        match component {
            Component::Nesting => return true,
            Component::Combinator(
                Combinator::PseudoElement | Combinator::Part | Combinator::SlotAssignment,
            ) => {}
            Component::Combinator(_) => return false,
            _ => {}
        }
    }

    false
}

/// Validates a normalized selector and reports whether every selector of its list selects the
/// styled element itself.
fn locality(selector: &str) -> std::result::Result<bool, String> {
    let mut result = false;
    let code = format!(".z{{{selector}{{color:red}}}}");

    let mut visit = |rule: &CssRule<'_>| {
        let CssRule::Style(rule) = rule else {
            return Ok(());
        };
        let selectors = &rule.selectors.0;

        if selectors.iter().any(|selector| {
            selector
                .iter_raw_match_order()
                .any(|component| matches!(component, Component::Nesting))
        }) {
            result = selectors.iter().all(local);
        }

        Ok(())
    };

    lightning::transform(
        &code,
        lightning::Hooks {
            rule: Some(&mut visit),
            url: None,
        },
    )?;

    Ok(result)
}

/// Builds a selector from an authored key, interpolating referenced definitions.
fn selector<'a>(
    resolver: &mut Resolver<'_, 'a>,
    property: &'a ObjectProperty<'a>,
) -> Result<String> {
    let key = property.key.as_expression().map(unwrap);

    match key {
        Some(Expression::StringLiteral(literal)) => Ok(literal.value.to_string()),
        Some(Expression::TemplateLiteral(template)) if property.computed => {
            let cooked = |index: usize| {
                template
                    .quasis
                    .get(index)
                    .and_then(|quasi| quasi.value.cooked)
                    .map_or("", |cooked| cooked.as_str())
            };
            let mut selector = cooked(0).to_owned();

            for (index, expression) in template.expressions.iter().enumerate() {
                let value = unwrap(expression);

                if !matches!(
                    value,
                    Expression::Identifier(_)
                        | Expression::StaticMemberExpression(_)
                        | Expression::ComputedMemberExpression(_)
                        | Expression::PrivateFieldExpression(_)
                ) {
                    return Err(invalid(
                        "Selector interpolations require style definitions without calling them.",
                        expression.span(),
                    ));
                }

                let reference = resolver.resolve(value)?;
                let Some(reference) = reference.filter(|reference| {
                    reference.members.is_none()
                        && (reference.call.end <= property.span.start
                            || resolver.imported_has(reference))
                }) else {
                    return Err(invalid(
                        "Selector interpolations require previously declared style definitions.",
                        expression.span(),
                    ));
                };

                selector.push('.');
                selector.push_str(&reference.call.name);
                selector.push_str(cooked(index + 1));
            }

            Ok(selector)
        }
        _ => Err(invalid(
            "Selectors require literal strings or templates referencing style definitions.",
            key.map_or(property.key.span(), GetSpan::span),
        )),
    }
}

/// Collects scoped selectors, local identities, exported style references, and composed
/// definitions.
///
/// # Errors
///
/// Returns `Themes.InvalidError` for selector keys that are not literal strings or templates of
/// previously declared definitions, and for selectors without an explicit `&` target or that
/// `lightningcss` rejects.
pub fn scan<'s, 'a>(parsed: &'s Parsed<'a>, options: Options<'s, 'a>) -> Result<Selectors<'s, 'a>> {
    let program = parsed.program;
    let mut conditions = FxHashMap::default();
    let mut local_conditions = FxHashSet::default();
    let mut exports: Record<Link> = Record::new();
    let mut imported: FxHashMap<u32, &'s Link> = FxHashMap::default();
    let mut imported_names: FxHashMap<&'a str, &'s Link> = FxHashMap::default();
    let mut compositions = FxHashMap::default();
    let mut names: FxHashMap<&'a str, &'a Expression<'a>> = FxHashMap::default();
    let mut public_names: IndexMap<Arc<str>, &'a str, FxBuildHasher> = IndexMap::default();
    let mut namespace_names: FxHashMap<&'a str, Members<'a>> = FxHashMap::default();
    let mut public_namespaces: IndexMap<Arc<str>, Members<'a>, FxBuildHasher> = IndexMap::default();

    for statement in &program.body {
        if let Statement::ImportDeclaration(import) = statement
            && !import.import_kind.is_type()
        {
            for specifier in import.specifiers.iter().flatten() {
                if let ImportDeclarationSpecifier::ImportSpecifier(specifier) = specifier
                    && specifier.import_kind.is_type()
                {
                    continue;
                }

                let local = specifier.local().name.as_str();

                if let Some(link) = options.links.get(local)
                    && link.kind == LinkKind::StyleReference
                {
                    imported.insert(specifier.span().start, link);
                    imported_names.insert(local, link);
                }
            }
        }

        let (declaration, exported) = match statement {
            Statement::ExportDeclaration(export) => (Some(&export.declaration), true),
            statement => (statement.as_declaration(), false),
        };

        match declaration {
            Some(Declaration::VariableDeclaration(variable))
                if variable.kind == VariableDeclarationKind::Const =>
            {
                for declarator in &variable.declarations {
                    if let (BindingPattern::BindingIdentifier(id), Some(init)) =
                        (&declarator.id, &declarator.init)
                    {
                        names.insert(id.name.as_str(), init);

                        if exported {
                            public_names.insert(Arc::from(id.name.as_str()), id.name.as_str());
                        }
                    }
                }
            }
            Some(Declaration::TSNamespaceDeclaration(namespace)) if !dotted(namespace, None) => {
                namespace_names.insert(namespace.id.name.as_str(), members(namespace));

                if exported {
                    public_namespaces
                        .insert(Arc::from(namespace.id.name.as_str()), members(namespace));
                }
            }
            _ => {}
        }

        if let Statement::ExportNamedDeclaration(export) = statement
            && !export.export_kind.is_type()
        {
            for specifier in &export.specifiers {
                if specifier.export_kind.is_type() {
                    continue;
                }

                public_names.insert(
                    Arc::from(specifier.exported.name().as_str()),
                    specifier.local.name().as_str(),
                );
            }
        }
    }

    let empty = |exports, compositions| Selectors {
        compositions,
        conditions: FxHashMap::default(),
        exports,
        identities: FxHashMap::default(),
        local_conditions: FxHashSet::default(),
    };

    if options.calls.is_empty() && imported.is_empty() {
        return Ok(empty(exports, compositions));
    }

    let mut exposed: FxHashMap<Address, Vec<Exposure<'a>>> = FxHashMap::default();

    for (name, local) in &public_names {
        if let Some(link) = imported_names.get(local) {
            exports.insert(Arc::clone(name), (*link).clone());
        }

        if let Some(value) = names.get(local) {
            exposed
                .entry(value.address())
                .or_default()
                .push((Arc::clone(name), None));
        }

        if let Some(namespace) = namespace_names.get(local) {
            public_namespaces.insert(Arc::clone(name), namespace.clone());
        }
    }

    for (name, values) in &public_namespaces {
        for (member, value) in values {
            exposed
                .entry(value.address())
                .or_default()
                .push((Arc::clone(name), Some(member)));
        }
    }

    if options.selector_keys.is_empty() && exposed.is_empty() && options.composed.is_empty() {
        return Ok(empty(exports, compositions));
    }

    let mut collector = Collector {
        ancestors: Vec::new(),
        bindings: FxHashMap::default(),
        namespaces: FxHashMap::default(),
        nodes: Vec::new(),
        selector_keys: options.selector_keys,
    };

    collector.visit_program(program);

    let Collector {
        bindings,
        namespaces,
        nodes,
        ..
    } = collector;
    let mut resolver = Resolver {
        authored: names::collect(program),
        bindings,
        definitions: options
            .calls
            .iter()
            .map(|call| (call.span.start, call.span.end))
            .collect(),
        identities: FxHashMap::default(),
        imported,
        namespaces,
        options,
        parsed,
    };

    for node in options.composed {
        if let Some(target) = resolver.target(node, &mut FxHashSet::default()) {
            compositions.insert(node.span().start, target);
        }
    }

    for node in nodes {
        let property = match node {
            Node::Declarator(declarator) => {
                let Some(init) = &declarator.init else {
                    continue;
                };

                for (key, member) in exposed.get(&init.address()).into_iter().flatten() {
                    let Some(resolved) = resolver.resolve(init)? else {
                        continue;
                    };

                    match member {
                        None => exports.insert(Arc::clone(key), resolved.into_owned()),
                        Some(member) => {
                            let mut members = exports
                                .get(key)
                                .and_then(|previous| previous.members.clone())
                                .unwrap_or_default();
                            let name = key
                                .chars()
                                .map(|character| js::radix(u64::from(u32::from(character)), 16))
                                .collect::<Vec<_>>()
                                .join("-");
                            let binding: Arc<str> = Arc::from(format!(
                                "z-style-{}-namespace-{name}",
                                options.namespace
                            ));
                            let mut link = reference(binding, 0, 0)?;

                            link.call.name = Arc::from("");
                            members.insert(*member, resolved.into_owned());
                            link.members = Some(members);
                            exports.insert(Arc::clone(key), link);
                        }
                    }
                }

                continue;
            }
            Node::Property(property) => property,
        };

        if property.method || property.kind != PropertyKind::Init || property.shorthand {
            return Err(invalid(
                "Selectors require explicit string keys and style objects.",
                property.span,
            ));
        }

        let authored = selector(&mut resolver, property)?;
        let checked = (|| {
            if !condition::nested(&authored)
                || authored
                    .trim_start_matches(js::is_whitespace)
                    .starts_with('@')
            {
                return Err("Selectors require an explicit & target.".to_owned());
            }

            let normalized = condition::normalize(&authored).map_err(|error| error.text())?;
            let local = locality(&normalized)?;

            Ok((normalized, local))
        })();
        let (normalized, local) = checked.map_err(|message| invalid(&message, property.span))?;
        let normalized: Arc<str> = Arc::from(normalized);

        if local {
            local_conditions.insert(Arc::clone(&normalized));
        }

        conditions.insert(property.key.span().start, normalized);
    }

    Ok(Selectors {
        compositions,
        conditions,
        exports,
        identities: resolver.identities,
        local_conditions,
    })
}
