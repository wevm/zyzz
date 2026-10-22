//! Folds trivial wrapper components into the host elements they render.
//!
//! A wrapper is a module-scope function component whose whole body is one JSX element. The
//! element forwards the caller's `children`, names a host element or another wrapper, and
//! carries one class list as its only attribute: a folded style application spread without
//! arguments or with the caller's `className` as its only override, a `cx` composition or
//! settled imported application spread to one constant class list, or a constant `className`.
//! An element that names another wrapper may instead pass it nothing or only the caller's
//! `className`. Chains whose levels become constant only once other folds apply still resolve,
//! as those folds supply their class lists here. Each wrapper resolves to the host element and class list its runtime chain
//! renders. Every level merges its own classes before the classes it receives, as `Props.merge`
//! does, so outer levels still follow inner ones in the class list and win the same conflicts.
//!
//! A use site that passes only `children`, `className`, and `key` then renders the host element
//! directly, and a wrapper whose element names a forwarding wrapper renders that wrapper's host
//! element itself. Definitions stay in place, so exports and other callers keep working.
//!
//! A use site without a `className` expression can render one combined class list in place of
//! its chain's classes, which [`Options::combined`] supplies by those classes.
//!
//! A folded element still reads what the unfolded chain would have read first, as
//! `Button&&"classes"`: the first imported wrapper, whose module bundlers then keep with the
//! stylesheet it imports, a style application that can run before its definition initializes,
//! and a local wrapper declared after the element. Each read throws where the unfolded chain
//! would.
//!
//! Selection components, whose props select a recipe's choices, and dynamic style components,
//! whose props fill a typed style callback's values, fold their use sites through [`selections`]
//! and [`dynamics`] with the same reads.

use std::sync::Arc;

use indexmap::IndexMap;
use oxc_ast::AstKind;
use oxc_ast::ast::{
    Argument, BindingPattern, CallExpression, Declaration, ExportDefaultDeclarationKind,
    Expression, FormalParameters, Function, FunctionBody, IdentifierReference,
    ImportDeclarationSpecifier, ImportOrExportKind, JSXAttribute, JSXAttributeItem,
    JSXAttributeName, JSXAttributeValue, JSXChild, JSXElement, JSXElementName, JSXExpression,
    ModuleExportName, ObjectPropertyKind, Program, PropertyKey, PropertyKind, Statement,
    VariableDeclarationKind,
};
use oxc_semantic::{ScopeId, Semantic, SymbolId};
use oxc_span::{GetSpan, Span};
use rustc_hash::{FxBuildHasher, FxHashMap, FxHashSet};

use crate::compiler::internal::dynamics::{self, Dynamic};
use crate::compiler::internal::expression::unwrap;
use crate::compiler::internal::selections::{self, Helpers, Recipe, Selection};
use crate::js;

/// The host element a wrapper renders and the classes it applies there.
#[derive(Clone, Debug, PartialEq)]
pub struct Fold {
    /// Classes the host element receives before a forwarded `className`. Never empty.
    pub classes: Arc<str>,
    /// Whether a caller's `className` reaches the host element, merged after [`Fold::classes`].
    pub forwards: bool,
    /// Host element name.
    pub tag: Arc<str>,
}

/// How an exported component folds.
#[derive(Clone, Debug, PartialEq)]
pub enum Export {
    /// A dynamic style component.
    Dynamic(Arc<Dynamic>),
    /// A selection component.
    Selection(Arc<Selection>),
    /// A wrapper.
    Wrapper(Fold),
}

/// Folds of a module's exported components, by export name.
pub type Exports = IndexMap<Arc<str>, Export, FxBuildHasher>;

/// Exported folds of imported source modules, by import specifier.
pub type Imports = FxHashMap<Arc<str>, Arc<Exports>>;

/// A folded application of a style definition.
#[derive(Clone, Copy, Debug)]
pub struct Applied<'o> {
    /// Class list.
    pub classes: &'o str,
    /// End of the call.
    pub end: u32,
    /// The callee the folded application reads before initialization, as `styles.card`, when an
    /// evaluation can precede the definition's initialization.
    pub guard: Option<&'o str>,
    /// Whether the application applies a local definition, whose arguments are overrides and
    /// whose rewrite reads [`Wrappers::prefixes`]. Other applications, such as a `cx` call or an
    /// imported application, fold their arguments into one constant class list.
    pub local: bool,
}

/// A read a folded element keeps: the binding its text starts with, and the text.
type Anchor = (SymbolId, Arc<str>);

/// Inputs of [`find`].
pub struct Options<'o> {
    /// Folded `className` applications, by call start.
    pub applications: &'o FxHashMap<u32, Applied<'o>>,
    /// Class lists that replace a use site's fold classes, by those classes.
    pub combined: Option<&'o FxHashMap<String, String>>,
    /// Dynamic applications spread alone onto host elements, by call start.
    pub dynamics: &'o FxHashMap<u32, dynamics::Application<'o>>,
    /// Whether another edit replaces a range whole, so no element inside it folds.
    pub excluded: &'o dyn Fn(Span) -> bool,
    /// Exported folds of imported modules.
    pub imports: Option<&'o Imports>,
    /// Recipe applications spread alone onto host elements, by call start.
    pub recipes: &'o FxHashMap<u32, Recipe<'o>>,
    /// Local name of the runtime `Props` namespace.
    pub runtime: &'o str,
    /// Local names of imports whose modules finish evaluating before this one, so folded
    /// elements need not read them.
    pub settled: Option<&'o FxHashSet<Arc<str>>>,
    /// Complete module text.
    pub source: &'o str,
    /// Whether `String` reads the global.
    pub strings: bool,
    /// Whether a name is already bound in the module.
    pub taken: &'o dyn Fn(&str) -> bool,
    /// Annotates generated parameters for TypeScript modules.
    pub typed: bool,
}

/// A module's wrappers and the edits that fold them.
#[derive(Debug, Default)]
pub struct Wrappers {
    /// Names that the anchors of planned edits read.
    pub anchored: FxHashSet<Arc<str>>,
    /// Replacements in source order, by original range.
    pub edits: Vec<(u32, u32, String)>,
    /// Folds of exported wrappers, by export name in source order.
    pub exports: Exports,
    /// Fold classes of use sites whose element receives no other generated class, in source
    /// order. A combination of their classes can replace them.
    pub lists: Vec<Arc<str>>,
    /// Whether an edit calls the runtime `merge`.
    pub merges: bool,
    /// Classes of the wrapper that a wrapper's element names, by the start of that element's
    /// application. The application's own classes follow them on the host element.
    pub prefixes: FxHashMap<u32, Prefix>,
    /// Element name ranges that renamed elements no longer read.
    pub renamed: Vec<(u32, u32)>,
    /// Module-scope selectors and tables that folded selection use sites read, in creation
    /// order.
    pub statements: Vec<String>,
}

/// Classes that precede a wrapper application's own classes on the host element.
#[derive(Debug)]
pub struct Prefix {
    /// Reads that precede the class list, each throwing or keeping a module as the unfolded
    /// chain would.
    pub anchors: Vec<Arc<str>>,
    /// Classes of the wrapper the element names.
    pub classes: Arc<str>,
}

/// A component whose use sites substitute their props into its host element's attributes.
#[derive(Clone, Copy)]
enum Component<'c> {
    Dynamic(&'c Dynamic),
    Selection(&'c Selection),
}

/// What a wrapper's element names.
#[derive(Clone, Copy)]
enum Target<'a> {
    Host(&'a str),
    Import(SymbolId),
    Local(SymbolId),
}

/// A function component whose body is one foldable element.
struct Candidate<'a> {
    /// The application's call start.
    application: u32,
    /// The application's initialization guard read.
    guard: Option<Anchor>,
    classes: &'a str,
    element: &'a JSXElement<'a>,
    forwards: bool,
    /// Whether the application's rewrite can lead with a named wrapper's classes.
    prefixes: bool,
    /// End of the declaration, after which module-scope use sites read an initialized binding.
    ready: u32,
    target: Target<'a>,
}

/// A module's foldable components by local symbol.
#[derive(Default)]
struct Candidates<'a> {
    /// Dynamic style components, with the end of each declaration and the application's
    /// initialization guard read.
    dynamics: FxHashMap<SymbolId, (Arc<Dynamic>, u32, Option<Anchor>)>,
    /// Selection components, with the end of each declaration and the application's
    /// initialization guard read.
    selections: FxHashMap<SymbolId, (Arc<Selection>, u32, Option<Anchor>)>,
    wrappers: FxHashMap<SymbolId, Candidate<'a>>,
}

/// How a component reads its props.
enum Props {
    /// `(props) => ...`, read as `props.className` and `props.children`.
    Object(SymbolId),
    /// `({ children, className }) => ...`, with each name's binding.
    Pattern {
        children: Option<SymbolId>,
        class_name: Option<SymbolId>,
    },
}

/// The deepest wrapper chain resolved, which bounds recursion through local targets.
const DEPTH: usize = 64;

/// Finds a module's wrappers, resolves their folds, and plans the edits of every foldable
/// element.
pub fn find<'a>(
    program: &'a Program<'a>,
    semantic: &Semantic<'a>,
    options: &Options<'a>,
) -> Wrappers {
    let mut found = Candidates::default();
    // Exported wrappers by local symbol, with each export name in source order.
    let mut exported: Vec<(SymbolId, &'a str)> = Vec::new();
    let mut imported: FxHashMap<SymbolId, (&'a str, &'a str)> = FxHashMap::default();

    for statement in &program.body {
        match statement {
            Statement::ImportDeclaration(import)
                if import.import_kind == ImportOrExportKind::Value =>
            {
                for specifier in import.specifiers.iter().flatten() {
                    let (local, name) = match specifier {
                        ImportDeclarationSpecifier::ImportSpecifier(specifier)
                            if specifier.import_kind == ImportOrExportKind::Value =>
                        {
                            (&specifier.local, specifier.imported.name().as_str())
                        }
                        ImportDeclarationSpecifier::ImportDefaultSpecifier(specifier) => {
                            (&specifier.local, "default")
                        }
                        _ => continue,
                    };

                    if let Some(symbol) = local.symbol_id.get() {
                        imported.insert(symbol, (import.source.value.as_str(), name));
                    }
                }
            }
            Statement::ExportDeclaration(export) => {
                for (symbol, name) in declare(&export.declaration, semantic, options, &mut found) {
                    exported.push((symbol, name));
                }
            }
            Statement::ExportNamedDeclaration(export)
                if export.export_kind == ImportOrExportKind::Value =>
            {
                for specifier in &export.specifiers {
                    if specifier.export_kind == ImportOrExportKind::Value
                        && let ModuleExportName::IdentifierReference(local) = &specifier.local
                        && let Some(symbol) = resolve(semantic, local)
                    {
                        exported.push((symbol, specifier.exported.name().as_str()));
                    }
                }
            }
            Statement::ExportDefaultDeclaration(export) => {
                let symbol = match &export.declaration {
                    ExportDefaultDeclarationKind::Identifier(local) => resolve(semantic, local),
                    ExportDefaultDeclarationKind::FunctionDeclaration(function) => {
                        declare_function(function, semantic, options, &mut found)
                            .map(|(symbol, _)| symbol)
                    }
                    _ => None,
                };

                if let Some(symbol) = symbol {
                    exported.push((symbol, "default"));
                }
            }
            other => {
                if let Some(declaration) = other.as_declaration() {
                    declare(declaration, semantic, options, &mut found);
                }
            }
        }
    }

    let mut wrappers = Wrappers::default();
    let Candidates {
        dynamics: local_dynamics,
        selections: local,
        wrappers: candidates,
    } = found;

    if candidates.is_empty() && local.is_empty() && local_dynamics.is_empty() && imported.is_empty()
    {
        return wrappers;
    }

    let mut folds: FxHashMap<SymbolId, Option<Fold>> = FxHashMap::default();
    let resolver = Resolver {
        candidates: &candidates,
        imported: &imported,
        imports: options.imports,
        semantic,
        settled: options.settled,
    };
    let mut symbols: Vec<SymbolId> = candidates.keys().copied().collect();

    // Source order keeps hash order out of planning. Edits are sorted again before they apply.
    symbols.sort_unstable_by_key(|symbol| {
        candidates
            .get(symbol)
            .map(|candidate| candidate.element.span.start)
    });

    for symbol in &symbols {
        resolver.fold(*symbol, &mut folds, 0);
    }

    for (symbol, name) in exported {
        if let Some(Some(fold)) = folds.get(&symbol) {
            wrappers
                .exports
                .insert(Arc::from(name), Export::Wrapper(fold.clone()));
        } else if let Some((selection, _, _)) = local.get(&symbol) {
            wrappers
                .exports
                .insert(Arc::from(name), Export::Selection(Arc::clone(selection)));
        } else if let Some((dynamic, _, _)) = local_dynamics.get(&symbol) {
            wrappers
                .exports
                .insert(Arc::from(name), Export::Dynamic(Arc::clone(dynamic)));
        }
    }

    let mut helpers = Helpers::new(options.runtime, options.taken, options.typed);

    let nodes = semantic.nodes();

    // A wrapper's element that names a forwarding wrapper renders that wrapper's host element.
    for symbol in &symbols {
        let Some(candidate) = candidates
            .get(symbol)
            .filter(|candidate| candidate.prefixes)
        else {
            continue;
        };
        let (target, mut anchors) = match candidate.target {
            Target::Host(_) => continue,
            Target::Import(target) | Target::Local(target) => {
                (resolver.target(target, &folds), resolver.anchors(target, 0))
            }
        };

        // A body placed before a declaration in its target's chain can run before it
        // initializes, so it keeps reading that wrapper and throws as the unfolded element would.
        if let Target::Local(target) = candidate.target {
            let (ready, latest) = resolver.latest(target, 0);

            if candidate.element.span.start < ready {
                anchors.push(resolver.named(latest));
            }
        }

        let scope = nodes.get_node(candidate.element.node_id.get()).scope_id();

        if let Some(target) = target.filter(|target| target.forwards)
            && let Some(anchors) = visible(semantic, scope, &anchors)
            && !(options.excluded)(candidate.element.span)
        {
            wrappers.anchored.extend(anchors.iter().cloned());
            wrappers.prefixes.insert(
                candidate.application,
                Prefix {
                    anchors,
                    classes: Arc::clone(&target.classes),
                },
            );
            rename(&mut wrappers, candidate.element, &target.tag);
        }
    }

    for node in nodes.iter() {
        let AstKind::JSXElement(element) = node.kind() else {
            continue;
        };
        let JSXElementName::IdentifierReference(name) = &element.opening_element.name else {
            continue;
        };
        let Some(symbol) = resolve(semantic, name) else {
            continue;
        };
        let component = if let Some((selection, ready, guard)) = local.get(&symbol) {
            Some((Component::Selection(selection), *ready, guard.as_ref()))
        } else if let Some((dynamic, ready, guard)) = local_dynamics.get(&symbol) {
            Some((Component::Dynamic(dynamic), *ready, guard.as_ref()))
        } else {
            None
        };
        let component = if let Some((component, ready, guard)) = component {
            let mut anchors: Vec<Anchor> = guard.into_iter().cloned().collect();

            // A module-scope element before the declaration would read it uninitialized, and
            // one inside a function keeps reading it, so it throws as the component would.
            if element.span.start < ready {
                if !nodes.ancestor_kinds(node.id()).any(|kind| defers(&kind)) {
                    continue;
                }

                anchors.push(resolver.named(symbol));
            }

            Some((component, anchors))
        } else {
            resolver
                .imported_component(symbol)
                .map(|component| (component, vec![resolver.named(symbol)]))
        };

        if let Some((component, anchors)) = component {
            if let Some(anchors) = visible(semantic, node.scope_id(), &anchors)
                && !(options.excluded)(element.span)
            {
                match component {
                    Component::Dynamic(dynamic) => {
                        dynamics::use_site(
                            element,
                            dynamic,
                            &anchors,
                            options.source,
                            semantic,
                            options.taken,
                            &mut wrappers.edits,
                        );
                    }
                    Component::Selection(selection) => {
                        selections::use_site(
                            element,
                            selection,
                            &anchors,
                            options.source,
                            &mut helpers,
                            &mut wrappers.edits,
                        );
                    }
                }
            }

            continue;
        }

        let (fold, anchors) = if candidates.contains_key(&symbol) {
            let mut anchors = resolver.anchors(symbol, 0);
            let (ready, latest) = resolver.latest(symbol, 0);

            if element.span.start < ready {
                // A function placed before a declaration in the chain can still run before it
                // initializes, so its element keeps reading that wrapper and throws as the
                // unfolded one would. A module-scope element would read it uninitialized.
                if !nodes.ancestor_kinds(node.id()).any(|kind| defers(&kind)) {
                    continue;
                }

                anchors.push(resolver.named(latest));
            }

            (folds.get(&symbol).and_then(Option::as_ref), anchors)
        } else if imported.contains_key(&symbol) {
            (
                resolver.imported(symbol),
                resolver.import_anchor(symbol).into_iter().collect(),
            )
        } else {
            continue;
        };

        if let Some(fold) = fold
            && let Some(anchors) = visible(semantic, node.scope_id(), &anchors)
            && !(options.excluded)(element.span)
        {
            wrappers.anchored.extend(anchors.iter().cloned());
            use_site(&mut wrappers, element, fold, &anchors, options);
        }
    }

    wrappers.edits.sort_unstable_by_key(|(start, _, _)| *start);
    wrappers.merges |= helpers.merges;
    wrappers.statements = helpers.statements;
    wrappers
}

/// Records the wrappers a declaration binds, returning each binding's symbol and name.
fn declare<'a>(
    declaration: &'a Declaration<'a>,
    semantic: &Semantic<'a>,
    options: &Options<'a>,
    candidates: &mut Candidates<'a>,
) -> Vec<(SymbolId, &'a str)> {
    let mut bindings = Vec::new();

    match declaration {
        Declaration::VariableDeclaration(variable) => {
            for declarator in &variable.declarations {
                let BindingPattern::BindingIdentifier(identifier) = &declarator.id else {
                    continue;
                };
                let Some(symbol) = identifier.symbol_id.get() else {
                    continue;
                };

                bindings.push((symbol, identifier.name.as_str()));

                // A `let` or `var` binding can be replaced before a use site runs.
                if variable.kind != VariableDeclarationKind::Const {
                    continue;
                }

                let body = match &declarator.init {
                    Some(Expression::ArrowFunctionExpression(arrow)) if !arrow.r#async => arrow
                        .get_expression()
                        .or_else(|| arrow.get_function_body().and_then(returned))
                        .map(|body| (&*arrow.params, body)),
                    Some(Expression::FunctionExpression(function))
                        if !function.r#async
                            && !function.generator
                            && function.this_param.is_none() =>
                    {
                        function
                            .body
                            .as_deref()
                            .and_then(returned)
                            .map(|body| (&*function.params, body))
                    }
                    _ => None,
                };

                if let Some((params, body)) = body {
                    record(
                        candidates,
                        symbol,
                        params,
                        body,
                        declarator.span.end,
                        semantic,
                        options,
                    );
                }
            }
        }
        Declaration::FunctionDeclaration(function) => {
            bindings.extend(declare_function(function, semantic, options, candidates));
        }
        _ => {}
    }

    bindings
}

/// Records the wrapper a function declaration forms, returning its symbol and name.
fn declare_function<'a>(
    function: &'a Function<'a>,
    semantic: &Semantic<'a>,
    options: &Options<'a>,
    candidates: &mut Candidates<'a>,
) -> Option<(SymbolId, &'a str)> {
    let identifier = function.id.as_ref()?;
    let symbol = identifier.symbol_id.get()?;

    // Declarations hoist, so every use site reads an initialized binding.
    if !function.r#async
        && !function.generator
        && function.this_param.is_none()
        && !semantic.scoping().symbol_is_mutated(symbol)
        && let Some(body) = function.body.as_deref().and_then(returned)
    {
        record(
            candidates,
            symbol,
            &function.params,
            body,
            0,
            semantic,
            options,
        );
    }

    Some((symbol, identifier.name.as_str()))
}

/// Records the wrapper or selection component a function forms.
fn record<'a>(
    candidates: &mut Candidates<'a>,
    symbol: SymbolId,
    params: &'a FormalParameters<'a>,
    body: &'a Expression<'a>,
    ready: u32,
    semantic: &Semantic<'a>,
    options: &Options<'a>,
) {
    if let Some(candidate) = candidate(params, body, ready, semantic, options) {
        candidates.wrappers.insert(symbol, candidate);
    } else if let Some((selection, call)) =
        selections::candidate(params, body, semantic, options.recipes, options.strings)
    {
        let guard = match options
            .recipes
            .get(&call.span.start)
            .and_then(|recipe| recipe.guard)
        {
            Some(text) => {
                let Some(guard) = guard_read(semantic, &call.callee, text) else {
                    return;
                };

                Some(guard)
            }
            None => None,
        };

        candidates
            .selections
            .insert(symbol, (Arc::new(selection), ready, guard));
    } else if let Some((dynamic, call)) =
        dynamics::candidate(params, body, semantic, options.dynamics, options.source)
    {
        let guard = match options
            .dynamics
            .get(&call.span.start)
            .and_then(|application| application.guard)
        {
            Some(text) => {
                let Some(guard) = guard_read(semantic, &call.callee, text) else {
                    return;
                };

                Some(guard)
            }
            None => None,
        };

        candidates
            .dynamics
            .insert(symbol, (Arc::new(dynamic), ready, guard));
    }
}

/// The expression a function body's only statement returns.
fn returned<'a>(body: &'a FunctionBody<'a>) -> Option<&'a Expression<'a>> {
    let [Statement::ReturnStatement(statement)] = body.statements.as_slice() else {
        return None;
    };

    body.directives
        .is_empty()
        .then_some(statement.argument.as_ref())
        .flatten()
}

/// The wrapper a function forms, when the expression it returns is one foldable element.
fn candidate<'a>(
    params: &'a FormalParameters<'a>,
    expression: &'a Expression<'a>,
    ready: u32,
    semantic: &Semantic<'a>,
    options: &Options<'a>,
) -> Option<Candidate<'a>> {
    let [param] = params.items.as_slice() else {
        return None;
    };

    if params.rest.is_some() || param.initializer.is_some() || !param.decorators.is_empty() {
        return None;
    }

    let props = match &param.pattern {
        BindingPattern::BindingIdentifier(identifier) => Props::Object(identifier.symbol_id.get()?),
        BindingPattern::ObjectPattern(pattern) => {
            if pattern.rest.is_some() {
                return None;
            }

            let mut children = None;
            let mut class_name = None;

            for property in &pattern.properties {
                let PropertyKey::StaticIdentifier(key) = &property.key else {
                    return None;
                };
                let BindingPattern::BindingIdentifier(value) = &property.value else {
                    return None;
                };
                let slot = match key.name.as_str() {
                    "children" => &mut children,
                    "className" => &mut class_name,
                    _ => return None,
                };

                if property.computed || slot.is_some() {
                    return None;
                }

                *slot = Some(value.symbol_id.get()?);
            }

            Props::Pattern {
                children,
                class_name,
            }
        }
        _ => return None,
    };

    let Expression::JSXElement(element) = expression else {
        return None;
    };
    let opening = &element.opening_element;

    if opening.type_arguments.is_some() {
        return None;
    }

    let (application, classes, guard, forwards, prefixes) = match opening.attributes.as_slice() {
        [JSXAttributeItem::SpreadAttribute(spread)] => {
            let Expression::CallExpression(call) = &spread.argument else {
                return None;
            };
            let Applied {
                classes,
                end,
                guard,
                local,
            } = *options.applications.get(&call.span.start)?;

            if end != call.span.end || classes.is_empty() {
                return None;
            }

            let guard = match guard {
                Some(text) => Some(guard_read(semantic, &call.callee, text)?),
                None => None,
            };
            let forwards = local && overrides(semantic, call, &props)?;

            (call.span.start, classes, guard, forwards, local)
        }
        // An element that names another wrapper may pass it nothing or only the caller's
        // `className`, and renders that wrapper's classes alone.
        [] => (element.span.start, "", None, false, false),
        [JSXAttributeItem::Attribute(attribute)]
            if matches!(&attribute.name, JSXAttributeName::Identifier(name) if name.name == "className")
                && let Some(JSXAttributeValue::ExpressionContainer(container)) =
                    &attribute.value
                && let Some(expression) = container.expression.as_expression()
                && reads(semantic, expression, &props, "className") =>
        {
            (attribute.span.start, "", None, true, false)
        }
        [JSXAttributeItem::Attribute(attribute)] => {
            let classes = constant(semantic, attribute, ready, options.source)?;

            (attribute.span.start, classes, None, false, false)
        }
        _ => return None,
    };
    let mut forwarded = false;

    for child in &element.children {
        match child {
            JSXChild::Text(text) if insignificant(text.value.as_str()) => {}
            JSXChild::ExpressionContainer(container) if !forwarded => {
                let expression = container.expression.as_expression()?;

                if !reads(semantic, expression, &props, "children") {
                    return None;
                }

                forwarded = true;
            }
            _ => return None,
        }
    }

    if !forwarded {
        return None;
    }

    let target = match &opening.name {
        JSXElementName::Identifier(identifier) => Target::Host(identifier.name.as_str()),
        JSXElementName::IdentifierReference(identifier) => {
            let symbol = resolve(semantic, identifier)?;

            if semantic.scoping().symbol_flags(symbol).is_import() {
                Target::Import(symbol)
            } else {
                Target::Local(symbol)
            }
        }
        _ => return None,
    };

    if classes.is_empty() && matches!(target, Target::Host(_)) {
        return None;
    }

    Some(Candidate {
        application,
        guard,
        classes,
        element,
        forwards,
        prefixes,
        ready,
        target,
    })
}

/// Whether a local application's arguments forward the caller's `className`, or `None` when
/// they pass anything else.
fn overrides(semantic: &Semantic<'_>, call: &CallExpression<'_>, props: &Props) -> Option<bool> {
    match call.arguments.as_slice() {
        [] => Some(false),
        [Argument::ObjectExpression(object)] => {
            let [ObjectPropertyKind::ObjectProperty(property)] = object.properties.as_slice()
            else {
                return None;
            };

            if property.computed || property.method || property.kind != PropertyKind::Init {
                return None;
            }

            reads(semantic, &property.value, props, "className").then_some(true)
        }
        _ => None,
    }
}

/// The class list of a constant `className` attribute: a string, a template without
/// substitutions, or a module-scope `const` string declared before the wrapper, whose use sites
/// then always read it initialized. A hoisted declaration has no such bound.
fn constant<'a>(
    semantic: &Semantic<'a>,
    attribute: &'a JSXAttribute<'a>,
    ready: u32,
    source: &'a str,
) -> Option<&'a str> {
    let JSXAttributeName::Identifier(name) = &attribute.name else {
        return None;
    };

    if name.name != "className" {
        return None;
    }

    let classes = match attribute.value.as_ref()? {
        JSXAttributeValue::StringLiteral(literal) => {
            // JSX strings decode character references and keep line breaks, which a JavaScript
            // string spells differently.
            let raw = source.get(
                literal.span.start as usize + 1..(literal.span.end as usize).saturating_sub(1),
            )?;

            if raw.contains(['&', '\n', '\r']) {
                return None;
            }

            raw
        }
        JSXAttributeValue::ExpressionContainer(container) => {
            match unwrap(container.expression.as_expression()?) {
                Expression::Identifier(identifier) if ready > 0 => {
                    let symbol = resolve(semantic, identifier)?;
                    let scoping = semantic.scoping();
                    let nodes = semantic.nodes();
                    let node = scoping.symbol_declaration(symbol);
                    let AstKind::VariableDeclarator(declarator) = nodes.kind(node) else {
                        return None;
                    };

                    if !scoping.symbol_flags(symbol).is_const_variable()
                        || scoping.symbol_scope_id(symbol) != scoping.root_scope_id()
                        || declarator.span.end > ready
                    {
                        return None;
                    }

                    string(declarator.init.as_ref()?)?
                }
                other => string(other)?,
            }
        }
        _ => return None,
    };

    (!classes.is_empty()).then_some(classes)
}

/// The value of a string literal or a template without substitutions.
fn string<'a>(expression: &'a Expression<'a>) -> Option<&'a str> {
    match unwrap(expression) {
        Expression::StringLiteral(literal) => Some(literal.value.as_str()),
        Expression::TemplateLiteral(template) if template.expressions.is_empty() => template
            .quasis
            .first()?
            .value
            .cooked
            .as_ref()
            .map(oxc_ast::ast::Str::as_str),
        _ => None,
    }
}

/// The initialization guard read of an application whose callee text is `text`. The text starts
/// with the binding that keeps it readable at a use site.
fn guard_read(semantic: &Semantic<'_>, callee: &Expression<'_>, text: &str) -> Option<Anchor> {
    let mut root = callee;

    while let Expression::StaticMemberExpression(member) = root {
        root = &member.object;
    }

    let Expression::Identifier(root) = root else {
        return None;
    };

    // An uninitialized member throws by being called, as the unfolded guard does.
    Some((
        resolve(semantic, root)?,
        Arc::from(format!("({text}||{text}())")),
    ))
}

/// Whether an expression reads the caller's prop `key`.
fn reads(semantic: &Semantic<'_>, expression: &Expression<'_>, props: &Props, key: &str) -> bool {
    match props {
        Props::Object(symbol) => {
            let Expression::StaticMemberExpression(member) = expression else {
                return false;
            };
            let Expression::Identifier(object) = &member.object else {
                return false;
            };

            !member.optional
                && member.property.name == key
                && resolve(semantic, object) == Some(*symbol)
        }
        Props::Pattern {
            children,
            class_name,
        } => {
            let binding = if key == "children" {
                children
            } else {
                class_name
            };
            let Expression::Identifier(identifier) = expression else {
                return false;
            };

            binding.is_some() && resolve(semantic, identifier) == *binding
        }
    }
}

/// Whether JSX drops a text child, as it drops whitespace that spans lines.
fn insignificant(text: &str) -> bool {
    text.bytes()
        .all(|byte| matches!(byte, b' ' | b'\t' | b'\n' | b'\r'))
        && text.contains(['\n', '\r'])
}

/// Matches nodes whose contents evaluate after a later call.
fn defers(kind: &AstKind<'_>) -> bool {
    matches!(
        kind,
        AstKind::ArrowFunctionExpression(_) | AstKind::Class(_) | AstKind::Function(_)
    )
}

fn resolve(semantic: &Semantic<'_>, reference: &IdentifierReference<'_>) -> Option<SymbolId> {
    semantic
        .scoping()
        .get_reference(reference.reference_id.get()?)
        .symbol_id()
}

/// The text of each anchor, when a scope reads each one's binding without a nearer binding of
/// the same name.
fn visible(semantic: &Semantic<'_>, scope: ScopeId, anchors: &[Anchor]) -> Option<Vec<Arc<str>>> {
    let scoping = semantic.scoping();
    let mut texts: Vec<Arc<str>> = Vec::with_capacity(anchors.len());

    for (symbol, text) in anchors {
        if scoping.find_binding(scope, scoping.symbol_name(*symbol).into()) != Some(*symbol) {
            return None;
        }

        if !texts.contains(text) {
            texts.push(Arc::clone(text));
        }
    }

    Some(texts)
}

/// Writes the reads a class list expression makes first.
pub fn write_anchors(text: &mut String, anchors: &[Arc<str>]) {
    for anchor in anchors {
        text.push_str(anchor);
        text.push_str("&&");
    }
}

/// Writes a class list expression, read after its anchors.
fn guarded(text: &mut String, anchors: &[Arc<str>], classes: &str) {
    write_anchors(text, anchors);
    js::write_string(text, classes);
}

/// Renames an element's opening and closing names to a host element.
fn rename(wrappers: &mut Wrappers, element: &JSXElement<'_>, tag: &str) {
    let name = element.opening_element.name.span();

    wrappers.edits.push((name.start, name.end, tag.to_owned()));
    wrappers.renamed.push((name.start, name.end));

    if let Some(closing) = &element.closing_element {
        let name = closing.name.span();

        wrappers.edits.push((name.start, name.end, tag.to_owned()));
        wrappers.renamed.push((name.start, name.end));
    }
}

/// Plans the edits of a use site that passes only `children`, `className`, and `key`.
fn use_site(
    wrappers: &mut Wrappers,
    element: &JSXElement<'_>,
    fold: &Fold,
    anchors: &[Arc<str>],
    options: &Options<'_>,
) {
    let opening = &element.opening_element;

    if opening.type_arguments.is_some() {
        return;
    }

    let mut class_name = None;
    let mut key = false;

    for attribute in &opening.attributes {
        let JSXAttributeItem::Attribute(attribute) = attribute else {
            return;
        };
        let JSXAttributeName::Identifier(name) = &attribute.name else {
            return;
        };

        match name.name.as_str() {
            // The anchor read in `className` must precede every other attribute, as the
            // element name's read does.
            "className" if class_name.is_none() && (!key || anchors.is_empty()) => {
                class_name = Some(attribute);
            }
            "key" if !key && attribute.value.is_some() => key = true,
            _ => return,
        }
    }

    let name = opening.name.span();
    let mut edits: Vec<(u32, u32, String)> = Vec::with_capacity(3);
    // An expression `className` can add a generated class whose rules fall between the chain's
    // rules, so only use sites without one, or with a literal one, render a combination.
    let combined = options
        .combined
        .and_then(|combined| combined.get(&*fold.classes))
        .map_or(&*fold.classes, String::as_str);

    match class_name.map(|attribute| &attribute.value) {
        None => {
            let mut text = String::with_capacity(fold.tag.len() + combined.len() + 14);

            text.push_str(&fold.tag);
            text.push_str(" className={");
            guarded(&mut text, anchors, combined);
            text.push('}');
            edits.push((name.start, name.end, text));
            wrappers.lists.push(Arc::clone(&fold.classes));
        }
        // A caller's `className` reaches the host element only through forwarding levels.
        Some(_) if !fold.forwards => return,
        Some(Some(JSXAttributeValue::StringLiteral(literal))) => {
            // JSX strings decode character references and keep line breaks, which a JavaScript
            // string spells differently.
            let raw = options
                .source
                .get(literal.span.start as usize + 1..(literal.span.end as usize).saturating_sub(1))
                .unwrap_or_default();

            if raw.contains(['&', '\n', '\r']) {
                return;
            }

            let mut classes = String::with_capacity(combined.len() + raw.len() + 1);

            classes.push_str(combined);

            if !raw.is_empty() {
                classes.push(' ');
                classes.push_str(raw);
            }

            let mut text = String::with_capacity(classes.len() + 4);

            text.push('{');
            guarded(&mut text, anchors, &classes);
            text.push('}');
            edits.push((name.start, name.end, fold.tag.to_string()));
            edits.push((literal.span.start, literal.span.end, text));
            wrappers.lists.push(Arc::clone(&fold.classes));
        }
        Some(Some(JSXAttributeValue::ExpressionContainer(container))) => {
            if matches!(container.expression, JSXExpression::EmptyExpression(_)) {
                return;
            }

            let value = container.expression.span();
            let mut open = String::with_capacity(options.runtime.len() + fold.classes.len() + 12);

            open.push('{');

            write_anchors(&mut open, anchors);

            open.push_str(options.runtime);
            open.push_str(".merge(");
            js::write_string(&mut open, &fold.classes);
            open.push(',');
            edits.push((name.start, name.end, fold.tag.to_string()));
            // The value keeps its authored text, so rewrites inside it still apply.
            edits.push((container.span.start, value.start, open));
            edits.push((value.end, container.span.end, ")}".to_owned()));
            wrappers.merges = true;
        }
        Some(_) => return,
    }

    wrappers.renamed.push((name.start, name.end));

    if let Some(closing) = &element.closing_element {
        let name = closing.name.span();

        edits.push((name.start, name.end, fold.tag.to_string()));
        wrappers.renamed.push((name.start, name.end));
    }

    wrappers.edits.append(&mut edits);
}

/// Resolves wrapper folds through local and imported targets.
struct Resolver<'r, 'a> {
    candidates: &'r FxHashMap<SymbolId, Candidate<'a>>,
    semantic: &'r Semantic<'a>,
    imported: &'r FxHashMap<SymbolId, (&'a str, &'a str)>,
    imports: Option<&'r Imports>,
    settled: Option<&'r FxHashSet<Arc<str>>>,
}

impl Resolver<'_, '_> {
    /// The fold of a local wrapper, memoized. A cycle or a chain past [`DEPTH`] does not fold.
    fn fold(
        &self,
        symbol: SymbolId,
        folds: &mut FxHashMap<SymbolId, Option<Fold>>,
        depth: usize,
    ) -> Option<Fold> {
        if let Some(fold) = folds.get(&symbol) {
            return fold.clone();
        }

        let candidate = self.candidates.get(&symbol)?;

        if depth > DEPTH {
            return None;
        }

        // A cycle reads the pending entry and stops.
        folds.insert(symbol, None);

        let fold = match candidate.target {
            Target::Host(tag) => Some(Fold {
                classes: Arc::from(candidate.classes),
                forwards: candidate.forwards,
                tag: Arc::from(tag),
            }),
            Target::Import(target) => self
                .imported(target)
                .map(|target| compose(target, candidate)),
            Target::Local(target) => self
                .fold(target, folds, depth + 1)
                .map(|target| compose(&target, candidate)),
        };

        folds.insert(symbol, fold.clone());
        fold
    }

    /// The reads a wrapper's unfolded chain makes before its host element: each local level's
    /// initialization guard and the first imported wrapper it renders.
    fn anchors(&self, symbol: SymbolId, depth: usize) -> Vec<Anchor> {
        if self.imported.contains_key(&symbol) {
            return self.import_anchor(symbol).into_iter().collect();
        }

        let Some(candidate) = self.candidates.get(&symbol) else {
            return Vec::new();
        };
        let mut anchors: Vec<Anchor> = candidate.guard.iter().cloned().collect();

        match candidate.target {
            Target::Import(target) => anchors.extend(self.import_anchor(target)),
            Target::Local(target) if depth < DEPTH => {
                anchors.extend(self.anchors(target, depth + 1));
            }
            Target::Host(_) | Target::Local(_) => {}
        }

        anchors
    }

    /// The read of an imported wrapper, which keeps its module and throws before it initializes.
    /// A settled import needs neither, as the transform keeps importing its module.
    fn import_anchor(&self, symbol: SymbolId) -> Option<Anchor> {
        let anchor = self.named(symbol);

        (!self
            .settled
            .is_some_and(|settled| settled.contains(&anchor.1)))
        .then_some(anchor)
    }

    /// A read of a binding by its own name.
    fn named(&self, symbol: SymbolId) -> Anchor {
        (
            symbol,
            Arc::from(self.semantic.scoping().symbol_name(symbol)),
        )
    }

    /// The latest declaration end along a local wrapper's chain of local targets, with the wrapper
    /// declared there. Elements before it may run before the whole chain initializes.
    fn latest(&self, symbol: SymbolId, depth: usize) -> (u32, SymbolId) {
        let Some(candidate) = self.candidates.get(&symbol) else {
            return (0, symbol);
        };
        let own = (candidate.ready, symbol);

        match candidate.target {
            Target::Local(target) if depth < DEPTH => {
                let next = self.latest(target, depth + 1);

                if next.0 > own.0 { next } else { own }
            }
            _ => own,
        }
    }

    /// The fold of an imported wrapper.
    fn imported(&self, symbol: SymbolId) -> Option<&Fold> {
        let (specifier, name) = self.imported.get(&symbol)?;

        match self.imports?.get(*specifier)?.get(*name)? {
            Export::Wrapper(fold) => Some(fold),
            Export::Dynamic(_) | Export::Selection(_) => None,
        }
    }

    /// The fold of an imported selection or dynamic style component.
    fn imported_component(&self, symbol: SymbolId) -> Option<Component<'_>> {
        let (specifier, name) = self.imported.get(&symbol)?;

        match self.imports?.get(*specifier)?.get(*name)? {
            Export::Dynamic(dynamic) => Some(Component::Dynamic(dynamic)),
            Export::Selection(selection) => Some(Component::Selection(selection)),
            Export::Wrapper(_) => None,
        }
    }

    /// The resolved fold of a wrapper's target binding.
    fn target(&self, symbol: SymbolId, folds: &FxHashMap<SymbolId, Option<Fold>>) -> Option<Fold> {
        if self.candidates.contains_key(&symbol) {
            return folds.get(&symbol).cloned().flatten();
        }

        self.imported(symbol).cloned()
    }
}

/// The fold of a wrapper whose element renders `target`. The target merges the wrapper's classes
/// after its own when it forwards `className`, and ignores them otherwise.
fn compose(target: &Fold, wrapper: &Candidate<'_>) -> Fold {
    if !target.forwards {
        return target.clone();
    }

    if wrapper.classes.is_empty() {
        return Fold {
            forwards: wrapper.forwards,
            ..target.clone()
        };
    }

    let mut classes = String::with_capacity(target.classes.len() + wrapper.classes.len() + 1);

    classes.push_str(&target.classes);
    classes.push(' ');
    classes.push_str(wrapper.classes);

    Fold {
        classes: Arc::from(classes),
        forwards: wrapper.forwards,
        tag: Arc::clone(&target.tag),
    }
}

/// The value imports of a module whose bindings name JSX elements, by specifier in source order,
/// with each declaration's span. Their modules may export wrappers the module folds.
pub fn imports<'a>(program: &'a Program<'a>, semantic: &Semantic<'a>) -> Vec<(&'a str, Span)> {
    let scoping = semantic.scoping();
    let nodes = semantic.nodes();
    let mut specifiers: Vec<(&'a str, Span)> = Vec::new();
    let mut seen: FxHashSet<&'a str> = FxHashSet::default();

    for statement in &program.body {
        let Statement::ImportDeclaration(import) = statement else {
            continue;
        };

        if import.import_kind != ImportOrExportKind::Value {
            continue;
        }

        let named = import.specifiers.iter().flatten().any(|specifier| {
            let local = match specifier {
                ImportDeclarationSpecifier::ImportSpecifier(specifier)
                    if specifier.import_kind == ImportOrExportKind::Value =>
                {
                    &specifier.local
                }
                ImportDeclarationSpecifier::ImportDefaultSpecifier(specifier) => &specifier.local,
                ImportDeclarationSpecifier::ImportNamespaceSpecifier(_)
                | ImportDeclarationSpecifier::ImportSpecifier(_) => return false,
            };

            local.symbol_id.get().is_some_and(|symbol| {
                scoping
                    .get_resolved_reference_ids(symbol)
                    .iter()
                    .any(|reference| {
                        let node = scoping.get_reference(*reference).node_id();

                        matches!(nodes.parent_kind(node), AstKind::JSXOpeningElement(_))
                    })
            })
        });

        if named && seen.insert(import.source.value.as_str()) {
            specifiers.push((import.source.value.as_str(), import.span));
        }
    }

    specifiers
}
