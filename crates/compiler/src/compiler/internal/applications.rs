//! Finds direct applications of local style definitions so the transform can fold or erase them.
//!
//! A candidate is a top-level `const` bound to a definition call, a top-level object of such
//! calls, or a non-exported namespace of exported `const` calls. Applications are no-argument
//! calls of a candidate or one of its members. Reads that escape keep the runtime callable.

use std::sync::Arc;

use indexmap::IndexMap;
use oxc_ast::AstKind;
use oxc_ast::ast::{
    Declaration, Expression, JSXAttributeItem, JSXAttributeName, JSXElementName,
    ObjectPropertyKind, Program, PropertyKey, PropertyKind, Statement, TSNamespaceDeclarationBody,
    VariableDeclarationKind,
};
use oxc_semantic::Semantic;
use oxc_span::{GetSpan, Span};
use rustc_hash::{FxBuildHasher, FxHashMap, FxHashSet};

use crate::compiler::internal::scope::{self, Mode};
use crate::compiler::source::Call;

/// One no-argument application of a definition.
#[derive(Clone, Debug, PartialEq)]
pub struct Application {
    /// End of the callee expression.
    pub callee_end: u32,
    /// End of the call.
    pub end: u32,
    /// Whether every evaluation follows the definition's initialization.
    pub initialized: bool,
    /// Definition name.
    pub name: Arc<str>,
    /// Start of the call.
    pub start: u32,
    /// Whether the application is the only class source of a DOM element.
    pub terminal: bool,
}

/// A namespace whose members can be erased.
#[derive(Clone, Debug, PartialEq)]
pub struct Namespace {
    /// End of each member's binding, by definition name.
    pub ends: crate::js::Record<u32>,
    /// Start of the namespace statement.
    pub start: u32,
}

/// Definitions the transform may fold, and namespaces it may erase.
#[derive(Clone, Debug, Default)]
pub struct Definitions {
    /// Erasable namespaces.
    pub namespaces: Vec<Namespace>,
    /// Foldable definitions, with whether every application follows initialization.
    pub values: crate::js::Record<bool>,
}

/// Options for [`create`].
#[derive(Clone, Copy, Debug, Default)]
pub struct Options {
    /// Whether recipes, dynamic styles, and applications with arguments count as applications.
    pub dynamic: bool,
}

/// Definition calls by member name, in authored order.
type Members<'c, 'a> = IndexMap<Arc<str>, &'c Call<'a>, FxBuildHasher>;

struct Candidate<'c, 'a> {
    /// Span of the binding identifier.
    binding: Span,
    direct: Option<&'c Call<'a>>,
    /// Object or namespace members in authored order, by member name.
    members: Members<'c, 'a>,
    name: Arc<str>,
    namespace: Option<Namespace>,
    ready: u32,
}

/// What a lexical read is nested in.
#[derive(Clone, Copy)]
struct Read<'a> {
    deferred: bool,
    /// Parent of the identifier.
    parent: Option<AstKind<'a>>,
    /// Parent of the identifier's member expression, when the parent is one.
    grandparent: Option<AstKind<'a>>,
    span: Span,
    terminal: bool,
}

/// The applications of one module's local definitions.
pub struct Applications<'c, 'a> {
    candidates: Vec<Candidate<'c, 'a>>,
    evaluation: bool,
    namespace_counts: FxHashMap<Arc<str>, usize>,
    referenced_definitions: FxHashSet<Arc<str>>,
    references: FxHashMap<Arc<str>, Vec<Read<'a>>>,
    options: Options,
}

fn is_call_of<'c, 'a>(
    definitions: &FxHashMap<u32, &'c Call<'a>>,
    node: &Expression<'a>,
) -> Option<&'c Call<'a>> {
    let Expression::CallExpression(call) = node else {
        return None;
    };
    let candidate = definitions.get(&call.span.start)?;

    (call.span.end == candidate.end).then_some(*candidate)
}

/// Collects candidates and their reads, or `None` when the module has no candidate.
pub fn create<'c, 'a>(
    program: &'a Program<'a>,
    semantic: &Semantic<'a>,
    calls: &'c [Call<'a>],
    options: Options,
) -> Option<Applications<'c, 'a>> {
    let definitions: FxHashMap<u32, &'c Call<'a>> =
        calls.iter().map(|call| (call.start, call)).collect();
    let mut member_bindings: FxHashMap<u32, Arc<str>> = FxHashMap::default();
    let mut namespace_counts: FxHashMap<Arc<str>, usize> = FxHashMap::default();

    for statement in &program.body {
        let declaration = match statement {
            Statement::ExportDeclaration(export) => Some(&export.declaration),
            other => other.as_declaration(),
        };
        let name = match declaration {
            Some(Declaration::TSNamespaceDeclaration(namespace)) => {
                Some(namespace.id.name.as_str())
            }
            Some(Declaration::TSGlobalDeclaration(_)) => Some("global"),
            _ => None,
        };

        if let Some(name) = name {
            *namespace_counts.entry(Arc::from(name)).or_default() += 1;
        }
    }

    let mut candidates: Vec<Candidate<'c, 'a>> = Vec::new();

    for statement in &program.body {
        if let Statement::TSNamespaceDeclaration(namespace) = statement
            && let TSNamespaceDeclarationBody::TSModuleBlock(block) = &namespace.body
        {
            let mut members = Members::default();
            let mut ends = crate::js::Record::new();
            let mut bindings = Vec::new();
            let mut valid = true;

            'members: for member in &block.body {
                let Statement::ExportDeclaration(export) = member else {
                    valid = false;
                    break;
                };
                let Declaration::VariableDeclaration(variable) = &export.declaration else {
                    valid = false;
                    break;
                };

                if variable.kind != VariableDeclarationKind::Const {
                    valid = false;
                    break;
                }

                for declarator in &variable.declarations {
                    let oxc_ast::ast::BindingPattern::BindingIdentifier(identifier) =
                        &declarator.id
                    else {
                        valid = false;
                        break 'members;
                    };
                    let call = declarator
                        .init
                        .as_ref()
                        .and_then(|init| is_call_of(&definitions, init));
                    let Some(call) =
                        call.filter(|_| !members.contains_key(identifier.name.as_str()))
                    else {
                        valid = false;
                        break 'members;
                    };
                    // ESTree identifier ranges include their type annotation.
                    let end = declarator
                        .type_annotation
                        .as_ref()
                        .map_or(identifier.span.end, |annotation| annotation.span.end);

                    members.insert(Arc::from(identifier.name.as_str()), call);
                    ends.insert(Arc::clone(&call.name), end);
                    bindings.push((identifier.span.start, Arc::clone(&call.name)));
                }
            }

            for (start, name) in bindings {
                member_bindings.insert(start, name);
            }

            if valid && !members.is_empty() {
                candidates.push(Candidate {
                    binding: namespace.id.span,
                    direct: None,
                    members,
                    name: Arc::from(namespace.id.name.as_str()),
                    namespace: Some(Namespace {
                        ends,
                        start: namespace.span.start,
                    }),
                    ready: namespace.span.end,
                });
            }

            continue;
        }

        // Exported values can escape and object members can subsequently be replaced.
        let Statement::VariableDeclaration(variable) = statement else {
            continue;
        };

        if variable.kind != VariableDeclarationKind::Const {
            continue;
        }

        for declarator in &variable.declarations {
            let (oxc_ast::ast::BindingPattern::BindingIdentifier(identifier), Some(init)) =
                (&declarator.id, &declarator.init)
            else {
                continue;
            };
            let direct = is_call_of(&definitions, init);
            let mut members = Members::default();

            if direct.is_none() {
                let Expression::ObjectExpression(object) = init else {
                    continue;
                };
                let mut valid = true;

                for property in &object.properties {
                    let ObjectPropertyKind::ObjectProperty(property) = property else {
                        valid = false;
                        break;
                    };

                    if property.computed || property.method || property.kind != PropertyKind::Init {
                        valid = false;
                        break;
                    }

                    let key = match &property.key {
                        PropertyKey::StaticIdentifier(key) => Some(key.name.as_str()),
                        _ => None,
                    };
                    let call = is_call_of(&definitions, &property.value);
                    let (Some(key), Some(call)) = (key, call) else {
                        valid = false;
                        break;
                    };

                    if key == "__proto__" || members.contains_key(key) {
                        valid = false;
                        break;
                    }

                    members.insert(Arc::from(key), call);
                }

                if !valid || members.is_empty() {
                    continue;
                }
            }

            candidates.push(Candidate {
                binding: identifier.span,
                direct,
                members,
                name: Arc::from(identifier.name.as_str()),
                namespace: None,
                ready: declarator.span.end,
            });
        }
    }

    if candidates.is_empty() {
        return None;
    }

    let mut walker = Walker {
        ancestors: Vec::new(),
        candidates: candidates
            .iter()
            .map(|candidate| (candidate.binding.start, Arc::clone(&candidate.name)))
            .collect(),
        evaluation: false,
        member_bindings: &member_bindings,
        referenced_definitions: FxHashSet::default(),
        references: candidates
            .iter()
            .map(|candidate| (Arc::clone(&candidate.name), Vec::new()))
            .collect(),
        semantic,
    };

    walker.scan();

    Some(Applications {
        candidates,
        evaluation: walker.evaluation,
        namespace_counts,
        referenced_definitions: walker.referenced_definitions,
        references: walker.references,
        options,
    })
}

struct Walker<'s, 'a> {
    ancestors: Vec<AstKind<'a>>,
    candidates: FxHashMap<u32, Arc<str>>,
    evaluation: bool,
    member_bindings: &'s FxHashMap<u32, Arc<str>>,
    referenced_definitions: FxHashSet<Arc<str>>,
    references: FxHashMap<Arc<str>, Vec<Read<'a>>>,
    semantic: &'s Semantic<'a>,
}

/// Whether evaluation of a node's contents waits for a later call or declaration.
fn defers(kind: &AstKind<'_>) -> bool {
    matches!(
        kind,
        AstKind::ArrowFunctionExpression(_)
            | AstKind::Class(_)
            | AstKind::Function(_)
            | AstKind::TSNamespaceDeclaration(_)
            | AstKind::TSGlobalDeclaration(_)
            | AstKind::TSExternalModuleDeclaration(_)
    )
}

const TYPE_CONTEXTS: [fn(&AstKind<'_>) -> bool; 6] = [
    |kind| matches!(kind, AstKind::TSTypeQuery(_)),
    |kind| matches!(kind, AstKind::TSTypeAnnotation(_)),
    |kind| matches!(kind, AstKind::TSTypeAliasDeclaration(_)),
    |kind| matches!(kind, AstKind::TSInterfaceDeclaration(_)),
    |kind| matches!(kind, AstKind::TSTypeParameterInstantiation(_)),
    |kind| matches!(kind, AstKind::TSTypeParameterDeclaration(_)),
];

impl Walker<'_, '_> {
    /// Reads identifiers in entry order from the semantic node list. Parents come from its links,
    /// and a candidate read alone rebuilds its full ancestor path.
    fn scan(&mut self) {
        let semantic = self.semantic;
        let nodes = semantic.nodes();

        for node in nodes.iter() {
            let kind = node.kind();
            let name = match kind {
                AstKind::IdentifierReference(identifier) => Some(identifier.name.as_str()),
                AstKind::BindingIdentifier(identifier) => Some(identifier.name.as_str()),
                AstKind::IdentifierName(identifier) => Some(identifier.name.as_str()),
                AstKind::LabelIdentifier(identifier) => Some(identifier.name.as_str()),
                _ => None,
            };

            if name == Some("eval") {
                self.evaluation = true;
            }

            let AstKind::IdentifierReference(identifier) = kind else {
                continue;
            };
            let id = node.id();
            let parent = (nodes.parent_id(id) != id).then(|| nodes.parent_kind(id));

            if parent.is_some_and(|parent| !scope::is_value_reference(parent))
                || nodes
                    .ancestor_kinds(id)
                    .any(|ancestor| TYPE_CONTEXTS.iter().any(|test| test(&ancestor)))
            {
                continue;
            }

            let scope = scope::scope_of(semantic, kind.node_id());
            let Some(binding) = scope::lookup(semantic, &identifier.name, scope, Mode::Value)
            else {
                continue;
            };
            // ScopeTracker reports the binding identifier for variables and namespaces.
            let declared = semantic.scoping().symbol_span(binding.symbol);

            if let Some(member) = self.member_bindings.get(&declared.start) {
                self.referenced_definitions.insert(Arc::clone(member));
            }

            let Some(name) = self.candidates.get(&declared.start) else {
                continue;
            };

            // Only reads whose name still names the candidate bind its applications.
            if *identifier.name != **name {
                continue;
            }

            self.ancestors.clear();
            self.ancestors.extend(nodes.ancestor_kinds(id));
            self.ancestors.reverse();
            self.ancestors.push(kind);

            let count = self.ancestors.len();
            let read = Read {
                deferred: self.ancestors.iter().any(defers),
                grandparent: count
                    .checked_sub(3)
                    .and_then(|index| self.ancestors.get(index))
                    .copied(),
                parent,
                span: identifier.span,
                terminal: terminal(&self.ancestors),
            };

            if let Some(reads) = self.references.get_mut(name) {
                reads.push(read);
            }
        }
    }
}

/// A static member read `object.name` of a reference.
fn member_name(kind: Option<AstKind<'_>>, object: Span) -> Option<(&str, Span)> {
    match kind? {
        AstKind::StaticMemberExpression(member)
            if !member.optional && member.object.span() == object =>
        {
            Some((member.property.name.as_str(), member.span))
        }
        _ => None,
    }
}

/// Whether a parent is a non-optional call of a callee.
fn call_of(kind: Option<AstKind<'_>>, callee: Span) -> Option<(Span, usize)> {
    match kind? {
        AstKind::CallExpression(call) if !call.optional && call.callee.span() == callee => {
            Some((call.span, call.arguments.len()))
        }
        _ => None,
    }
}

impl<'c, 'a> Applications<'c, 'a> {
    fn collect(
        &self,
        candidate: &Candidate<'c, 'a>,
    ) -> Option<(Vec<Application>, FxHashSet<Arc<str>>)> {
        let mut applications = Vec::new();
        let mut called = FxHashSet::default();

        for reference in self
            .references
            .get(&candidate.name)
            .map(Vec::as_slice)
            .unwrap_or_default()
        {
            if reference.span == candidate.binding {
                continue;
            }

            let (call, callee, application) = if let Some(direct) = candidate.direct {
                (Some(direct), reference.span, reference.parent)
            } else {
                let (name, member) = member_name(reference.parent, reference.span)?;

                (
                    candidate.members.get(name).copied(),
                    member,
                    reference.grandparent,
                )
            };

            if call.is_some_and(|call| {
                call.composition.is_some()
                    || call.runtime_composition.is_some()
                    || (!self.options.dynamic && (call.slots.is_some() || call.recipe.is_some()))
            }) {
                continue;
            }

            let call = call?;
            let (span, arguments) = call_of(application, callee)?;

            // An override needs the runtime callable, but exposes no other definition.
            if !self.options.dynamic && arguments > 0 {
                called.insert(Arc::clone(&call.name));
                continue;
            }

            applications.push(Application {
                callee_end: callee.end,
                end: span.end,
                initialized: !reference.deferred
                    && reference.span.start >= candidate.ready
                    && (candidate.namespace.is_none()
                        || self.namespace_counts.get(&candidate.name) == Some(&1)),
                name: Arc::clone(&call.name),
                start: span.start,
                terminal: reference.terminal,
            });
        }

        Some((applications, called))
    }

    fn unique(&self) -> FxHashMap<&Arc<str>, usize> {
        let mut counts: FxHashMap<&Arc<str>, usize> = FxHashMap::default();

        for candidate in &self.candidates {
            *counts.entry(&candidate.name).or_default() += 1;
        }

        counts
    }

    /// Definitions that no read can apply, whose rules can be dropped.
    pub fn dead(&self) -> FxHashSet<Arc<str>> {
        let mut result = FxHashSet::default();

        if self.evaluation {
            return result;
        }

        let counts = self.unique();

        for candidate in &self.candidates {
            if counts.get(&candidate.name).copied().unwrap_or_default() > 1
                || self
                    .namespace_counts
                    .get(&candidate.name)
                    .copied()
                    .unwrap_or_default()
                    > 1
            {
                continue;
            }

            let reads = self
                .references
                .get(&candidate.name)
                .map(Vec::as_slice)
                .unwrap_or_default();

            if let Some(direct) = candidate.direct {
                if reads.is_empty() {
                    result.insert(Arc::clone(&direct.name));
                }
                continue;
            }

            let mut used: FxHashSet<&str> = FxHashSet::default();
            let mut escapes = false;

            for reference in reads {
                if let Some((name, _)) = member_name(reference.parent, reference.span) {
                    used.insert(name);
                } else {
                    escapes = true;
                    break;
                }
            }

            if !escapes {
                for (name, call) in &candidate.members {
                    if !used.contains(&**name) && !self.referenced_definitions.contains(&call.name)
                    {
                        result.insert(Arc::clone(&call.name));
                    }
                }
            }
        }

        result
    }

    /// Definitions whose every read is a foldable application.
    pub fn definitions(&self) -> Definitions {
        let mut output = Definitions::default();

        if self.evaluation {
            return output;
        }

        let counts = self.unique();

        for candidate in &self.candidates {
            if counts.get(&candidate.name).copied().unwrap_or_default() > 1
                || self
                    .namespace_counts
                    .get(&candidate.name)
                    .copied()
                    .unwrap_or_default()
                    > 1
            {
                continue;
            }

            let Some((applications, called)) = self.collect(candidate) else {
                continue;
            };
            let mut erased = candidate.namespace.is_some();
            let uninitialized: FxHashSet<&str> = applications
                .iter()
                .filter(|application| !application.initialized)
                .map(|application| &*application.name)
                .collect();
            let calls: Vec<&Call<'a>> = match candidate.direct {
                Some(direct) => vec![direct],
                None => candidate.members.iter().map(|(_, call)| *call).collect(),
            };

            for call in calls {
                if call.composition.is_some()
                    || call.runtime_composition.is_some()
                    || call.slots.is_some()
                    || call.recipe.is_some()
                    || called.contains(&call.name)
                {
                    erased = false;
                    continue;
                }

                let initialized = !uninitialized.contains(&*call.name);

                output.values.insert(Arc::clone(&call.name), initialized);
                erased &= initialized;
            }

            if erased && let Some(namespace) = &candidate.namespace {
                output.namespaces.push(namespace.clone());
            }
        }

        output
    }

    /// Every foldable application, in candidate order.
    pub fn find(&self) -> Vec<Application> {
        if self.evaluation {
            return Vec::new();
        }

        self.candidates
            .iter()
            .flat_map(|candidate| {
                self.collect(candidate)
                    .map(|(applications, _)| applications)
                    .unwrap_or_default()
            })
            .collect()
    }
}

/// Matches a no-argument application spread onto, or read as the class of, a DOM element.
fn terminal(path: &[AstKind<'_>]) -> bool {
    let Some(mut index) = path.len().checked_sub(1) else {
        return false;
    };
    let mut node = path.get(index).map(GetSpan::span);

    if let (Some(AstKind::StaticMemberExpression(member)), Some(span)) =
        (index.checked_sub(1).and_then(|at| path.get(at)), node)
        && member.object.span() == span
    {
        index -= 1;
        node = Some(member.span);
    }

    let Some(call_index) = index.checked_sub(1) else {
        return false;
    };
    let Some(AstKind::CallExpression(call)) = path.get(call_index) else {
        return false;
    };

    if Some(call.callee.span()) != node || !call.arguments.is_empty() {
        return false;
    }

    let parent_index = call_index.wrapping_sub(1);

    match path.get(parent_index) {
        Some(AstKind::JSXSpreadAttribute(spread)) => {
            spread.argument.span() == call.span
                && alone(
                    parent_index.checked_sub(1).and_then(|at| path.get(at)),
                    spread.span,
                )
        }
        Some(AstKind::StaticMemberExpression(member))
            if member.object.span() == call.span
                && is_class_name(member.property.name.as_str()) =>
        {
            let container_index = parent_index.wrapping_sub(1);
            let Some(AstKind::JSXExpressionContainer(container)) = path.get(container_index) else {
                return false;
            };

            if container.expression.span() != member.span {
                return false;
            }

            let attribute_index = container_index.wrapping_sub(1);
            let Some(AstKind::JSXAttribute(attribute)) = path.get(attribute_index) else {
                return false;
            };
            let JSXAttributeName::Identifier(name) = &attribute.name else {
                return false;
            };

            attribute
                .value
                .as_ref()
                .is_some_and(|value| value.span() == container.span)
                && is_class_name(name.name.as_str())
                && alone(
                    attribute_index.checked_sub(1).and_then(|at| path.get(at)),
                    attribute.span,
                )
        }
        _ => false,
    }
}

/// Matches `^class(?:Name)?$`.
fn is_class_name(name: &str) -> bool {
    name == "class" || name == "className"
}

// Other spreads or class attributes could add another style's classes.
fn alone(element: Option<&AstKind<'_>>, own: Span) -> bool {
    let Some(AstKind::JSXOpeningElement(element)) = element else {
        return false;
    };
    let name = match &element.name {
        JSXElementName::Identifier(identifier) => identifier.name.as_str(),
        JSXElementName::IdentifierReference(identifier) => identifier.name.as_str(),
        _ => return false,
    };

    name.starts_with(|character: char| character.is_ascii_lowercase())
        && element.attributes.iter().all(|attribute| {
            attribute.span() == own
                || matches!(attribute, JSXAttributeItem::Attribute(attribute) if !match &attribute.name {
                    JSXAttributeName::Identifier(identifier) => identifier.name.as_str(),
                    JSXAttributeName::NamespacedName(name) => name.namespace.name.as_str(),
                }.starts_with("class"))
        })
}
