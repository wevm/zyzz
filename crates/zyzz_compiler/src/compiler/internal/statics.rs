//! Resolves immutable `const` data through bindings, member reads, and spreads.
//!
//! Side tables are keyed by node start offsets, as in the TypeScript compiler, so synthesized
//! copies share identity with the source nodes they replace. Synthesized nodes are allocated in
//! the module's arena with their source spans and semantic ids.

use std::borrow::Cow;
use std::cell::{OnceCell, RefCell};

use oxc_allocator::{Allocator, Box as ArenaBox, CloneIn, Vec as ArenaVec};
use oxc_ast::AstKind;
use oxc_ast::ast::{
    ArrayExpression, ArrayExpressionElement, Expression, IdentifierReference, ObjectExpression,
    ObjectProperty, ObjectPropertyKind, Program, PropertyKey, PropertyKind, Statement,
    TSIntersectionType, TSSignature, TSType, TemplateLiteral, UnaryOperator,
    VariableDeclarationKind,
};
use oxc_ast::builder::AstBuilder;
use oxc_ast_visit::Visit;
use oxc_semantic::Semantic;
use oxc_span::{GetSpan, Span};
use rustc_hash::{FxHashMap, FxHashSet};

use crate::compiler::internal::expression::unwrap;
use crate::compiler::internal::scope::{self, Mode};
use crate::error::{Error, Result};
use crate::js;

/// Static data collected from one module.
pub struct Static<'a> {
    absent: FxHashSet<u32>,
    aliases: OnceCell<FxHashMap<u32, Vec<u32>>>,
    allocator: &'a Allocator,
    builder: AstBuilder<'a>,
    imported: FxHashSet<u32>,
    imports: FxHashMap<String, &'a Expression<'a>>,
    order: Vec<u32>,
    program: &'a Program<'a>,
    references: FxHashMap<u32, u32>,
    synthetic: RefCell<FxHashMap<u32, u32>>,
    type_references: FxHashMap<u32, u32>,
    types: FxHashMap<u32, &'a TSType<'a>>,
    usages: FxHashMap<u32, Vec<Vec<AstKind<'a>>>>,
    used: RefCell<FxHashSet<u32>>,
    values: FxHashMap<u32, &'a Expression<'a>>,
}

/// A resolved object property: the original node or a synthesized copy.
pub type Property<'a> = &'a ObjectProperty<'a>;

fn invalid(message: &str, span: Span) -> Error {
    Error::Themes {
        message: message.to_owned(),
        span,
    }
}

/// Collects static bindings for a parsed module.
///
/// `imports` maps local import names to constant values resolved from other modules.
#[expect(
    clippy::implicit_hasher,
    reason = "Static data uses the crate's one internal hasher."
)]
pub fn collect<'a>(
    allocator: &'a Allocator,
    program: &'a Program<'a>,
    semantic: &Semantic<'a>,
    imports: FxHashMap<String, &'a Expression<'a>>,
) -> Static<'a> {
    fn collect_values<'a>(
        statements: &'a [Statement<'a>],
        values: &mut FxHashMap<u32, &'a Expression<'a>>,
        order: &mut Vec<u32>,
    ) {
        for statement in statements {
            let declaration = match statement {
                Statement::ExportDeclaration(export) => Some(&export.declaration),
                other => other.as_declaration(),
            };

            match declaration {
                Some(oxc_ast::ast::Declaration::TSNamespaceDeclaration(namespace)) => {
                    if let oxc_ast::ast::TSNamespaceDeclarationBody::TSModuleBlock(block) =
                        &namespace.body
                    {
                        collect_values(&block.body, values, order);
                    }
                }
                Some(oxc_ast::ast::Declaration::VariableDeclaration(variable))
                    if variable.kind == VariableDeclarationKind::Const =>
                {
                    for declarator in &variable.declarations {
                        if declarator.id.get_binding_identifier().is_some()
                            && matches!(
                                declarator.id,
                                oxc_ast::ast::BindingPattern::BindingIdentifier(_)
                            )
                            && let Some(init) = &declarator.init
                        {
                            values.insert(declarator.span.start, init);
                            order.push(declarator.span.start);
                        }
                    }
                }
                _ => {}
            }
        }
    }

    let mut values: FxHashMap<u32, &'a Expression<'a>> = FxHashMap::default();
    let mut order = Vec::new();

    collect_values(&program.body, &mut values, &mut order);

    let mut imported = FxHashSet::default();

    for statement in &program.body {
        let Statement::ImportDeclaration(import) = statement else {
            continue;
        };

        if import.import_kind.is_type() {
            continue;
        }

        for specifier in import.specifiers.iter().flatten() {
            let Some(value) = imports.get(specifier.local().name.as_str()) else {
                continue;
            };

            values.insert(specifier.span().start, value);
            order.push(specifier.span().start);
            imported.insert(specifier.span().start);
        }
    }

    let mut collector = Collector {
        absent: FxHashSet::default(),
        ancestors: Vec::new(),
        references: FxHashMap::default(),
        semantic,
        type_references: FxHashMap::default(),
        types: FxHashMap::default(),
        usages: FxHashMap::default(),
        values: &values,
        allocator,
    };

    collector.visit_program(program);

    let Collector {
        absent,
        references,
        type_references,
        types,
        usages,
        ..
    } = collector;

    Static {
        absent,
        aliases: OnceCell::new(),
        allocator,
        builder: AstBuilder::new(allocator),
        imported,
        imports,
        order,
        program,
        references,
        synthetic: RefCell::default(),
        type_references,
        types,
        usages,
        used: RefCell::default(),
        values,
    }
}

struct Collector<'s, 'a> {
    absent: FxHashSet<u32>,
    allocator: &'a Allocator,
    ancestors: Vec<AstKind<'a>>,
    references: FxHashMap<u32, u32>,
    semantic: &'s Semantic<'a>,
    type_references: FxHashMap<u32, u32>,
    types: FxHashMap<u32, &'a TSType<'a>>,
    usages: FxHashMap<u32, Vec<Vec<AstKind<'a>>>>,
    values: &'s FxHashMap<u32, &'a Expression<'a>>,
}

impl<'a> Visit<'a> for Collector<'_, 'a> {
    fn enter_node(&mut self, kind: AstKind<'a>) {
        self.ancestors.push(kind);

        match kind {
            AstKind::TSTypeAliasDeclaration(alias) if alias.type_parameters.is_none() => {
                self.types
                    .insert(alias.id.span.start, &alias.type_annotation);
            }
            AstKind::TSInterfaceDeclaration(interface)
                if interface.extends.is_empty() && interface.type_parameters.is_none() =>
            {
                let scope = scope::scope_of(self.semantic, kind.node_id());
                let key = scope::lookup(self.semantic, &interface.id.name, scope, Mode::Type)
                    .map_or(interface.id.span.start, |declaration| declaration.start());
                let previous = match self.types.get(&key) {
                    Some(TSType::TSTypeLiteral(literal)) => Some(literal),
                    _ => None,
                };
                let mut members = ArenaVec::new_in(&self.allocator);

                if let Some(previous) = previous {
                    for member in &previous.members {
                        members.push(member.clone_in_with_semantic_ids(self.allocator));
                    }
                }

                for member in &interface.body.body {
                    members.push(member.clone_in_with_semantic_ids(self.allocator));
                }

                let builder = AstBuilder::new(self.allocator);
                let merged: &'a TSType<'a> = self.allocator.alloc(TSType::new_ts_type_literal(
                    interface.body.span,
                    members,
                    &builder,
                ));

                self.types.insert(key, merged);
            }
            AstKind::TSTypeReference(reference) if reference.type_arguments.is_none() => {
                if let oxc_ast::ast::TSTypeName::IdentifierReference(name) = &reference.type_name {
                    let scope = scope::scope_of(self.semantic, kind.node_id());

                    if let Some(declaration) =
                        scope::lookup(self.semantic, &name.name, scope, Mode::Type)
                    {
                        self.type_references
                            .insert(reference.span.start, declaration.start());
                    }
                }
            }
            AstKind::IdentifierReference(identifier) => self.reference(identifier),
            _ => {}
        }
    }

    fn leave_node(&mut self, _: AstKind<'a>) {
        self.ancestors.pop();
    }
}

impl<'a> Collector<'_, 'a> {
    fn reference(&mut self, identifier: &'a IdentifierReference<'a>) {
        let binding = scope::resolve(self.semantic, identifier);

        // Distinguish unbound references from nodes that are not references.
        if binding.is_none() && identifier.name == "undefined" {
            self.absent.insert(identifier.span.start);
        }

        let Some(binding) = binding else {
            return;
        };
        let Some(value) = self.values.get(&binding.start()) else {
            return;
        };

        if self
            .ancestors
            .iter()
            .any(|ancestor| matches!(ancestor, AstKind::TSTypeQuery(_)))
        {
            return;
        }

        self.references
            .insert(identifier.span.start, binding.start());

        // Escape paths are only consulted for object and array resolutions.
        if matches!(
            unwrap(value),
            Expression::ArrowFunctionExpression(_)
                | Expression::CallExpression(_)
                | Expression::FunctionExpression(_)
                | Expression::NewExpression(_)
        ) || is_literal(unwrap(value))
        {
            return;
        }

        self.usages
            .entry(binding.start())
            .or_default()
            .push(self.ancestors.clone());
    }
}

/// Whether a node is an ESTree `Literal`.
pub fn is_literal(node: &Expression<'_>) -> bool {
    matches!(
        node,
        Expression::StringLiteral(_)
            | Expression::NumericLiteral(_)
            | Expression::BooleanLiteral(_)
            | Expression::NullLiteral(_)
            | Expression::BigIntLiteral(_)
            | Expression::RegExpLiteral(_)
    )
}

/// The `String(value)` spelling of a literal property key, or `None` for other keys.
pub fn key_literal<'a>(key: &PropertyKey<'a>) -> Option<Cow<'a, str>> {
    match key {
        PropertyKey::StringLiteral(literal) => Some(Cow::Borrowed(literal.value.as_str())),
        PropertyKey::NumericLiteral(literal) => Some(Cow::Owned(js::number(literal.value))),
        PropertyKey::BooleanLiteral(literal) => {
            Some(Cow::Borrowed(if literal.value { "true" } else { "false" }))
        }
        PropertyKey::NullLiteral(_) => Some(Cow::Borrowed("null")),
        PropertyKey::BigIntLiteral(literal) => Some(Cow::Borrowed(literal.value.as_str())),
        PropertyKey::RegExpLiteral(literal) => Some(Cow::Borrowed(
            literal.raw.as_ref().map_or("", |raw| raw.as_str()),
        )),
        _ => None,
    }
}

/// Whether a property key is an ESTree `Literal`.
pub fn key_is_literal(key: &PropertyKey<'_>) -> bool {
    matches!(
        key,
        PropertyKey::StringLiteral(_)
            | PropertyKey::NumericLiteral(_)
            | PropertyKey::BooleanLiteral(_)
            | PropertyKey::NullLiteral(_)
            | PropertyKey::BigIntLiteral(_)
            | PropertyKey::RegExpLiteral(_)
    )
}

/// The name of a non-computed identifier key or the spelling of a literal key.
pub fn key_name<'a>(property: &ObjectProperty<'a>) -> Option<Cow<'a, str>> {
    match &property.key {
        PropertyKey::StaticIdentifier(identifier) if !property.computed => {
            Some(Cow::Borrowed(identifier.name.as_str()))
        }
        key => key_literal(key),
    }
}

/// The member key of a non-optional member read: a static name or literal index.
fn member_key<'a>(node: &'a Expression<'a>) -> Option<(&'a Expression<'a>, Option<String>)> {
    match node {
        Expression::StaticMemberExpression(member) if !member.optional => {
            Some((&member.object, Some(member.property.name.to_string())))
        }
        Expression::ComputedMemberExpression(member) if !member.optional => Some((
            &member.object,
            crate::compiler::internal::expression::literal_text(&member.expression)
                .filter(|_| is_literal(&member.expression)),
        )),
        Expression::PrivateFieldExpression(member) if !member.optional => {
            Some((&member.object, None))
        }
        _ => None,
    }
}

/// Matches `^(?:0|[1-9]\d*)$`.
fn array_index(key: &str) -> Option<usize> {
    let valid = !key.is_empty()
        && key.bytes().all(|byte| byte.is_ascii_digit())
        && (key == "0" || !key.starts_with('0'));

    if valid { key.parse().ok() } else { None }
}

const PATH_TYPES: [&str; 18] = [
    "Program",
    "TSModuleDeclaration",
    "TSModuleBlock",
    "VariableDeclaration",
    "VariableDeclarator",
    "Identifier",
    "MemberExpression",
    "ObjectExpression",
    "Property",
    "ArrayExpression",
    "SpreadElement",
    "TSAsExpression",
    "TSSatisfiesExpression",
    "TSNonNullExpression",
    "TSTypeAssertion",
    "ExportNamedDeclaration",
    "ExportDefaultDeclaration",
    "ExportSpecifier",
];

/// The ESTree type name an oxc node kind corresponds to, for path checks.
pub fn estree_type(kind: &AstKind<'_>) -> &'static str {
    match kind {
        AstKind::Program(_) => "Program",
        AstKind::TSNamespaceDeclaration(_)
        | AstKind::TSGlobalDeclaration(_)
        | AstKind::TSExternalModuleDeclaration(_) => "TSModuleDeclaration",
        AstKind::TSModuleBlock(_) => "TSModuleBlock",
        AstKind::VariableDeclaration(_) => "VariableDeclaration",
        AstKind::VariableDeclarator(_) => "VariableDeclarator",
        AstKind::IdentifierReference(_)
        | AstKind::BindingIdentifier(_)
        | AstKind::IdentifierName(_) => "Identifier",
        AstKind::StaticMemberExpression(_)
        | AstKind::ComputedMemberExpression(_)
        | AstKind::PrivateFieldExpression(_) => "MemberExpression",
        AstKind::ObjectExpression(_) => "ObjectExpression",
        AstKind::ObjectProperty(_) => "Property",
        AstKind::ArrayExpression(_) => "ArrayExpression",
        AstKind::SpreadElement(_) => "SpreadElement",
        AstKind::TSAsExpression(_) => "TSAsExpression",
        AstKind::TSSatisfiesExpression(_) => "TSSatisfiesExpression",
        AstKind::TSNonNullExpression(_) => "TSNonNullExpression",
        AstKind::TSTypeAssertion(_) => "TSTypeAssertion",
        AstKind::ExportNamedDeclaration(_)
        | AstKind::ExportDeclaration(_)
        | AstKind::ExportFromDeclaration(_) => "ExportNamedDeclaration",
        AstKind::ExportDefaultDeclaration(_) => "ExportDefaultDeclaration",
        AstKind::ExportSpecifier(_) => "ExportSpecifier",
        AstKind::AssignmentExpression(_) => "AssignmentExpression",
        AstKind::UpdateExpression(_) => "UpdateExpression",
        AstKind::ForInStatement(_) => "ForInStatement",
        AstKind::ForOfStatement(_) => "ForOfStatement",
        AstKind::UnaryExpression(_) => "UnaryExpression",
        AstKind::CallExpression(_) => "CallExpression",
        AstKind::NewExpression(_) => "NewExpression",
        _ => "Other",
    }
}

impl<'a> Static<'a> {
    /// Whether a node is an unbound `undefined` identifier.
    pub fn absent(&self, input: &Expression<'_>) -> bool {
        matches!(unwrap(input), Expression::Identifier(identifier) if identifier.name == "undefined" && self.absent.contains(&identifier.span.start))
    }

    /// Start offsets of every collected binding.
    pub fn bindings(&self) -> impl Iterator<Item = u32> + '_ {
        self.order.iter().copied()
    }

    /// Whether a binding start has a static value.
    pub fn has_binding(&self, start: u32) -> bool {
        self.values.contains_key(&start)
    }

    /// The binding start an identifier resolves to, when it names static data.
    pub fn reference(&self, start: u32) -> Option<u32> {
        self.references
            .get(&start)
            .copied()
            .or_else(|| self.synthetic.borrow().get(&start).copied())
    }

    /// Start offsets of nodes that resolutions consumed.
    pub fn used(&self) -> FxHashSet<u32> {
        self.used.borrow().clone()
    }

    /// Whether resolution consumed a node.
    pub fn is_used(&self, start: u32) -> bool {
        self.used.borrow().contains(&start)
    }

    fn root(&self, node: &'a Expression<'a>) -> Option<u32> {
        let mut node = unwrap(node);

        while let Some((object, _)) = member_key(node).or_else(|| match node {
            Expression::StaticMemberExpression(member) => Some((&member.object, None)),
            Expression::ComputedMemberExpression(member) => Some((&member.object, None)),
            Expression::PrivateFieldExpression(member) => Some((&member.object, None)),
            _ => None,
        }) {
            node = object;
        }

        match node {
            Expression::Identifier(identifier) => self.reference(identifier.span.start),
            _ => None,
        }
    }

    fn initial(
        &self,
        input: &'a Expression<'a>,
        seen: &mut FxHashSet<u32>,
    ) -> Option<&'a Expression<'a>> {
        let node = unwrap(input);

        if let Expression::Identifier(identifier) = node {
            let binding = self.reference(identifier.span.start)?;

            if seen.contains(&binding) {
                return None;
            }

            let value = self.values.get(&binding)?;

            seen.insert(binding);

            return self.initial(value, seen);
        }

        if let Some((object, key)) = member_key(node) {
            return self.initial_member(object, key, seen);
        }

        Some(node)
    }

    fn initial_member(
        &self,
        object: &'a Expression<'a>,
        key: Option<String>,
        seen: &mut FxHashSet<u32>,
    ) -> Option<&'a Expression<'a>> {
        let object = self.initial(object, seen)?;
        let key = key?;

        match object {
            Expression::ObjectExpression(object) => {
                for property in object.properties.iter().rev() {
                    let ObjectPropertyKind::ObjectProperty(property) = property else {
                        return None;
                    };

                    if key_name(property).as_deref() == Some(key.as_str()) {
                        return if property.method || property.kind != PropertyKind::Init {
                            None
                        } else {
                            self.initial(&property.value, seen)
                        };
                    }
                }

                None
            }
            Expression::ArrayExpression(array) => {
                let index = array_index(&key)?;

                if array
                    .elements
                    .iter()
                    .take(index + 1)
                    .any(|element| matches!(element, ArrayExpressionElement::SpreadElement(_)))
                {
                    return None;
                }

                match array.elements.get(index)? {
                    ArrayExpressionElement::SpreadElement(_)
                    | ArrayExpressionElement::Elision(_) => None,
                    element => self.initial(element.as_expression()?, seen),
                }
            }
            _ => None,
        }
    }

    fn scalar(&self, node: &'a Expression<'a>) -> bool {
        let value = self.initial(node, &mut FxHashSet::default());

        value.is_some_and(|value| {
            is_literal(value)
                || matches!(value, Expression::TemplateLiteral(_))
                || matches!(value, Expression::UnaryExpression(unary) if unary.operator != UnaryOperator::Delete)
        })
    }

    fn scalar_member(&self, kind: &AstKind<'a>) -> bool {
        let (object, key) = match kind {
            AstKind::StaticMemberExpression(member) if !member.optional => {
                (&member.object, Some(member.property.name.to_string()))
            }
            AstKind::ComputedMemberExpression(member) if !member.optional => (
                &member.object,
                crate::compiler::internal::expression::literal_text(&member.expression)
                    .filter(|_| is_literal(&member.expression)),
            ),
            _ => return false,
        };
        let value = self.initial_member(object, key, &mut FxHashSet::default());

        value.is_some_and(|value| {
            is_literal(value)
                || matches!(value, Expression::TemplateLiteral(_))
                || matches!(value, Expression::UnaryExpression(unary) if unary.operator != UnaryOperator::Delete)
        })
    }

    fn owners(&self, input: &'a Expression<'a>) -> Vec<u32> {
        let node = unwrap(input);

        if self.scalar(node) {
            return Vec::new();
        }

        if let Some(owner) = self.root(node) {
            return vec![owner];
        }

        match node {
            Expression::ObjectExpression(object) => object
                .properties
                .iter()
                .flat_map(|property| match property {
                    ObjectPropertyKind::SpreadProperty(spread) => self.owners(&spread.argument),
                    ObjectPropertyKind::ObjectProperty(property) => self.owners(&property.value),
                })
                .collect(),
            Expression::ArrayExpression(array) => array
                .elements
                .iter()
                .flat_map(|element| match element {
                    ArrayExpressionElement::SpreadElement(spread) => self.owners(&spread.argument),
                    ArrayExpressionElement::Elision(_) => Vec::new(),
                    element => element
                        .as_expression()
                        .map(|element| self.owners(element))
                        .unwrap_or_default(),
                })
                .collect(),
            _ => Vec::new(),
        }
    }

    fn paths(&self, binding: u32, seen: &mut FxHashSet<u32>) -> Vec<Vec<AstKind<'a>>> {
        let aliases = self.aliases.get_or_init(|| {
            let mut aliases: FxHashMap<u32, Vec<u32>> = FxHashMap::default();

            for id in &self.order {
                if let Some(input) = self.values.get(id) {
                    for owner in self.owners(input) {
                        aliases.entry(owner).or_default().push(*id);
                    }
                }
            }

            aliases
        });

        if !seen.insert(binding) {
            return Vec::new();
        }

        let mut paths = self.usages.get(&binding).cloned().unwrap_or_default();

        for alias in aliases.get(&binding).cloned().unwrap_or_default() {
            paths.extend(self.paths(alias, seen));
        }

        paths
    }

    /// Resolves an expression through static bindings, member reads, and array indexes.
    ///
    /// Reads under nodes whose starts are in `allowed` skip escape analysis.
    ///
    /// # Errors
    ///
    /// Returns `Themes.InvalidError` for cyclic or forward bindings, mutated or escaping data,
    /// and member reads that cross unresolved computed keys or spreads.
    pub fn resolve(
        &self,
        node: &'a Expression<'a>,
        allowed: &FxHashSet<u32>,
        active: &mut Vec<u32>,
    ) -> Result<&'a Expression<'a>> {
        let node = unwrap(node);

        if let Expression::Identifier(identifier) = node {
            let Some(binding) = self.reference(identifier.span.start) else {
                return Ok(node);
            };
            let Some(value) = self.values.get(&binding).copied() else {
                return Ok(node);
            };

            if active.contains(&binding)
                || (!self.imported.contains(&binding) && identifier.span.start < value.span().end)
            {
                return Err(invalid(
                    "Static bindings must be acyclic and follow their declaration.",
                    identifier.span,
                ));
            }

            active.push(binding);
            let resolved = self.resolve(value, allowed, active);
            active.pop();
            let resolved = resolved?;

            if matches!(
                resolved,
                Expression::CallExpression(_)
                    | Expression::NewExpression(_)
                    | Expression::Identifier(_)
            ) {
                return Ok(node);
            }

            if matches!(
                resolved,
                Expression::ObjectExpression(_) | Expression::ArrayExpression(_)
            ) {
                self.escapes(binding, allowed)?;
            }

            self.used.borrow_mut().insert(resolved.span().start);

            return Ok(resolved);
        }

        if let Some((object_node, key)) = member_key(node) {
            let object = self.resolve(object_node, allowed, active)?;

            if let (Some(key), Expression::ObjectExpression(object)) = (&key, object) {
                let entries = self.properties(object, allowed)?;

                if entries
                    .iter()
                    .any(|property| property.computed && !key_is_literal(&property.key))
                {
                    return Err(invalid(
                        "Static member reads cannot cross unresolved computed keys.",
                        node.span(),
                    ));
                }

                if let Some(property) = entries
                    .iter()
                    .find(|property| key_name(property).as_deref() == Some(key.as_str()))
                {
                    return self.resolve(&property.value, allowed, active);
                }
            }

            if let (Some(key), Expression::ArrayExpression(array)) = (&key, object)
                && let Some(index) = array_index(key)
            {
                if array
                    .elements
                    .iter()
                    .take(index + 1)
                    .any(|element| matches!(element, ArrayExpressionElement::SpreadElement(_)))
                {
                    return Err(invalid(
                        "Static array indexes cannot cross spread elements.",
                        node.span(),
                    ));
                }

                if let Some(element) = array.elements.get(index)
                    && let Some(element) = element.as_expression()
                {
                    return self.resolve(element, allowed, active);
                }
            }
        }

        self.used.borrow_mut().insert(node.span().start);

        Ok(node)
    }

    fn escapes(&self, binding: u32, allowed: &FxHashSet<u32>) -> Result<()> {
        for path in self.paths(binding, &mut FxHashSet::default()) {
            if path.iter().any(|node| allowed.contains(&node.span().start)) {
                continue;
            }

            let left_in_path = |index: usize, node: &AstKind<'a>| {
                let left = match node {
                    AstKind::ForInStatement(statement) => statement.left.span(),
                    AstKind::ForOfStatement(statement) => statement.left.span(),
                    _ => return false,
                };

                path.get(index + 1..)
                    .unwrap_or_default()
                    .iter()
                    .any(|next| next.span() == left)
            };
            let mutation = path.iter().enumerate().any(|(index, node)| {
                matches!(node, AstKind::AssignmentExpression(_) | AstKind::UpdateExpression(_))
                    || left_in_path(index, node)
                    || matches!(node, AstKind::UnaryExpression(unary) if unary.operator == UnaryOperator::Delete)
            });

            if !mutation && path.iter().any(|node| self.scalar_member(node)) {
                continue;
            }

            if let Some(unsupported) = path
                .iter()
                .find(|node| !PATH_TYPES.contains(&estree_type(node)))
            {
                return Err(invalid(
                    "Static data cannot be mutated or escape through unsupported expressions.",
                    unsupported.span(),
                ));
            }

            let write = path.iter().enumerate().find(|(index, node)| {
                matches!(node, AstKind::VariableDeclarator(declarator)
                    if !matches!(declarator.id, oxc_ast::ast::BindingPattern::BindingIdentifier(_)) || !self.values.contains_key(&declarator.span.start))
                    || matches!(node, AstKind::AssignmentExpression(_) | AstKind::UpdateExpression(_))
                    || matches!(node, AstKind::UnaryExpression(unary) if unary.operator == UnaryOperator::Delete)
                    || left_in_path(*index, node)
            });
            let call = path.iter().find(|node| {
                matches!(node, AstKind::CallExpression(_) | AstKind::NewExpression(_))
            });

            if let Some(node) = write.map(|(_, node)| node).or(call) {
                return Err(invalid(
                    "Static data cannot be mutated or escape to runtime calls.",
                    node.span(),
                ));
            }
        }

        Ok(())
    }

    /// Lists an object's properties after expanding spreads, keyed like a `Map` by property name.
    ///
    /// # Errors
    ///
    /// Returns `Themes.InvalidError` for non-literal spreads, prototype keys, methods, and accessors.
    pub fn properties(
        &self,
        node: &'a ObjectExpression<'a>,
        allowed: &FxHashSet<u32>,
    ) -> Result<Vec<Property<'a>>> {
        let mut result: indexmap::IndexMap<Cow<'a, str>, Property<'a>, rustc_hash::FxBuildHasher> =
            indexmap::IndexMap::default();
        let mut insert = |entry: Property<'a>| -> Result<()> {
            let prototype = !entry.computed
                && (matches!(&entry.key, PropertyKey::StaticIdentifier(identifier) if identifier.name == "__proto__")
                    || matches!(&entry.key, PropertyKey::StringLiteral(literal) if literal.value == "__proto__"));

            if prototype {
                return Err(invalid(
                    "Static object prototypes are unsupported.",
                    entry.span,
                ));
            }

            if entry.computed && !key_is_literal(&entry.key) {
                result.insert(Cow::Owned(format!("computed:{}", entry.span.start)), entry);
                return Ok(());
            }

            let key = key_name(entry);

            let Some(key) = key.filter(|_| !entry.method && entry.kind == PropertyKind::Init)
            else {
                return Err(invalid(
                    "Static data requires literal property keys without methods.",
                    entry.span,
                ));
            };

            let entry = if entry.shorthand {
                let mut copy = entry.clone_in_with_semantic_ids(self.allocator);
                copy.shorthand = false;
                &*self.allocator.alloc(copy)
            } else {
                entry
            };

            result.insert(key, entry);

            Ok(())
        };

        for property in &node.properties {
            match property {
                ObjectPropertyKind::SpreadProperty(spread) => {
                    let value = self.resolve(&spread.argument, allowed, &mut Vec::new())?;
                    let Expression::ObjectExpression(value) = value else {
                        return Err(invalid(
                            "Static spreads require an immutable object literal.",
                            spread.span,
                        ));
                    };

                    for entry in self.properties(value, allowed)? {
                        insert(entry)?;
                    }
                }
                ObjectPropertyKind::ObjectProperty(property) => insert(property)?,
            }
        }

        Ok(result.into_values().collect())
    }

    /// Resolves type aliases, merged interfaces, and intersections of object types.
    ///
    /// # Errors
    ///
    /// Returns `Themes.InvalidError` for cyclic aliases.
    pub fn type_of(&self, node: &'a TSType<'a>, active: &mut Vec<u32>) -> Result<&'a TSType<'a>> {
        match node {
            TSType::TSTypeReference(reference)
                if matches!(
                    reference.type_name,
                    oxc_ast::ast::TSTypeName::IdentifierReference(_)
                ) =>
            {
                let Some(name) = self.type_references.get(&reference.span.start).copied() else {
                    return Ok(node);
                };
                let Some(value) = self.types.get(&name).copied() else {
                    return Ok(node);
                };

                if active.contains(&name) {
                    return Err(invalid(
                        "Dynamic type aliases must be acyclic.",
                        reference.span,
                    ));
                }

                active.push(name);
                let result = self.type_of(value, active);
                active.pop();

                result
            }
            TSType::TSParenthesizedType(parenthesized) => {
                self.type_of(&parenthesized.type_annotation, active)
            }
            TSType::TSIntersectionType(intersection) => self.intersection(intersection, active),
            TSType::TSUnionType(union) => {
                let mut types = ArenaVec::new_in(&self.allocator);

                for value in &union.types {
                    types.push(
                        self.type_of(value, active)?
                            .clone_in_with_semantic_ids(self.allocator),
                    );
                }

                Ok(self.allocator.alloc(TSType::new_ts_union_type(
                    union.span,
                    types,
                    &self.builder,
                )))
            }
            TSType::TSTemplateLiteralType(template) => {
                let mut types = ArenaVec::new_in(&self.allocator);

                for value in &template.types {
                    types.push(
                        self.type_of(value, active)?
                            .clone_in_with_semantic_ids(self.allocator),
                    );
                }

                let quasis = template.quasis.clone_in_with_semantic_ids(self.allocator);

                Ok(self.allocator.alloc(TSType::new_ts_template_literal_type(
                    template.span,
                    quasis,
                    types,
                    &self.builder,
                )))
            }
            _ => Ok(node),
        }
    }

    fn intersection(
        &self,
        node: &'a TSIntersectionType<'a>,
        active: &mut Vec<u32>,
    ) -> Result<&'a TSType<'a>> {
        let mut parts = Vec::with_capacity(node.types.len());

        for value in &node.types {
            parts.push(self.type_of(value, active)?);
        }

        if !parts
            .iter()
            .all(|part| matches!(part, TSType::TSTypeLiteral(_)))
        {
            let types = ArenaVec::from_iter_in(
                parts
                    .iter()
                    .map(|part| part.clone_in_with_semantic_ids(self.allocator)),
                &self.allocator,
            );

            return Ok(self.allocator.alloc(TSType::new_ts_intersection_type(
                node.span,
                types,
                &self.builder,
            )));
        }

        let mut members: Vec<TSSignature<'a>> = Vec::new();

        for part in &parts {
            let TSType::TSTypeLiteral(literal) = part else {
                continue;
            };

            for member in &literal.members {
                let signature_key = |member: &TSSignature<'a>| match member {
                    TSSignature::TSPropertySignature(signature)
                        if !signature.computed && signature.type_annotation.is_some() =>
                    {
                        match &signature.key {
                            PropertyKey::StaticIdentifier(identifier) => {
                                Some(Cow::Borrowed(identifier.name.as_str()))
                            }
                            key => key_literal(key),
                        }
                    }
                    _ => None,
                };
                let key = signature_key(member);
                let index = key.as_ref().and_then(|key| {
                    members
                        .iter()
                        .position(|value| signature_key(value).as_deref() == Some(&**key))
                });

                let (Some(index), TSSignature::TSPropertySignature(signature)) = (index, member)
                else {
                    members.push(member.clone_in_with_semantic_ids(self.allocator));
                    continue;
                };
                let Some(TSSignature::TSPropertySignature(previous)) = members.get_mut(index)
                else {
                    continue;
                };
                let (Some(previous_type), Some(member_type)) =
                    (&previous.type_annotation, &signature.type_annotation)
                else {
                    continue;
                };
                let span = Span::new(previous.span.start, signature.span.end);
                let types = ArenaVec::from_array_in(
                    [
                        previous_type
                            .type_annotation
                            .clone_in_with_semantic_ids(self.allocator),
                        member_type
                            .type_annotation
                            .clone_in_with_semantic_ids(self.allocator),
                    ],
                    &self.allocator,
                );
                let merged = TSType::new_ts_intersection_type(span, types, &self.builder);
                let mut annotation = previous_type.clone_in_with_semantic_ids(self.allocator);
                annotation.type_annotation = merged;

                previous.optional = previous.optional && signature.optional;
                previous.type_annotation = Some(annotation);
            }
        }

        let members = ArenaVec::from_iter_in(members, &self.allocator);

        Ok(self.allocator.alloc(TSType::new_ts_type_literal(
            node.span,
            members,
            &self.builder,
        )))
    }

    /// Resolves an expression and recursively expands object, array, and template contents.
    ///
    /// Nodes whose starts are in `opaque` stay unresolved. With `omit_undefined`, properties whose
    /// value is the unbound `undefined` identifier are dropped. Unchanged subtrees keep their
    /// original nodes, so pointer identity reports whether normalization changed anything.
    ///
    /// # Errors
    ///
    /// Returns `Themes.InvalidError` from resolution.
    pub fn normalize(
        &self,
        node: &'a Expression<'a>,
        allowed: &FxHashSet<u32>,
        opaque: &FxHashSet<u32>,
        omit_undefined: bool,
    ) -> Result<&'a Expression<'a>> {
        if opaque.contains(&node.span().start) {
            return Ok(node);
        }

        let node = self.resolve(node, allowed, &mut Vec::new())?;

        match node {
            Expression::ObjectExpression(object) => {
                self.normalize_object(object, node, allowed, opaque, omit_undefined)
            }
            Expression::ArrayExpression(array) => {
                self.normalize_array(array, node, allowed, opaque, omit_undefined)
            }
            Expression::TemplateLiteral(template) => {
                self.normalize_template(template, node, allowed, opaque, omit_undefined)
            }
            _ => Ok(node),
        }
    }

    fn normalize_object(
        &self,
        object: &'a ObjectExpression<'a>,
        node: &'a Expression<'a>,
        allowed: &FxHashSet<u32>,
        opaque: &FxHashSet<u32>,
        omit_undefined: bool,
    ) -> Result<&'a Expression<'a>> {
        let expanded: Vec<Property<'a>> = self
            .properties(object, allowed)?
            .into_iter()
            .filter(|property| {
                !omit_undefined
                    || !matches!(unwrap(&property.value), Expression::Identifier(identifier)
                        if identifier.name == "undefined" && self.absent.contains(&identifier.span.start))
            })
            .collect();
        let mut normalized: Vec<Property<'a>> = Vec::with_capacity(expanded.len());

        for property in expanded {
            let value = self.normalize(&property.value, allowed, opaque, omit_undefined)?;

            if std::ptr::eq(value, &raw const property.value) {
                normalized.push(property);
            } else {
                let mut copy = property.clone_in_with_semantic_ids(self.allocator);
                copy.value = value.clone_in_with_semantic_ids(self.allocator);
                normalized.push(self.allocator.alloc(copy));
            }
        }

        let unchanged = normalized.len() == object.properties.len()
            && normalized.iter().zip(&object.properties).all(|(property, original)| {
                matches!(original, ObjectPropertyKind::ObjectProperty(original) if std::ptr::eq(*property, &raw const **original))
            });

        if unchanged {
            return Ok(node);
        }

        let properties = ArenaVec::from_iter_in(
            normalized.into_iter().map(|property| {
                ObjectPropertyKind::ObjectProperty(ArenaBox::new_in(
                    property.clone_in_with_semantic_ids(self.allocator),
                    &self.allocator,
                ))
            }),
            &self.allocator,
        );

        Ok(self.allocator.alloc(Expression::new_object_expression(
            object.span,
            properties,
            &self.builder,
        )))
    }

    fn normalize_array(
        &self,
        array: &'a ArrayExpression<'a>,
        node: &'a Expression<'a>,
        allowed: &FxHashSet<u32>,
        opaque: &FxHashSet<u32>,
        omit_undefined: bool,
    ) -> Result<&'a Expression<'a>> {
        let mut changed = false;
        let mut elements = ArenaVec::with_capacity_in(array.elements.len(), &self.allocator);

        for element in &array.elements {
            match element.as_expression() {
                Some(expression)
                    if !matches!(element, ArrayExpressionElement::SpreadElement(_)) =>
                {
                    let value = self.normalize(expression, allowed, opaque, omit_undefined)?;

                    changed |= !std::ptr::eq(value, expression);
                    elements.push(ArrayExpressionElement::from(
                        value.clone_in_with_semantic_ids(self.allocator),
                    ));
                }
                _ => elements.push(element.clone_in_with_semantic_ids(self.allocator)),
            }
        }

        if !changed {
            return Ok(node);
        }

        Ok(self.allocator.alloc(Expression::new_array_expression(
            array.span,
            elements,
            &self.builder,
        )))
    }

    fn normalize_template(
        &self,
        template: &'a TemplateLiteral<'a>,
        node: &'a Expression<'a>,
        allowed: &FxHashSet<u32>,
        opaque: &FxHashSet<u32>,
        omit_undefined: bool,
    ) -> Result<&'a Expression<'a>> {
        let mut changed = false;
        let mut expressions =
            ArenaVec::with_capacity_in(template.expressions.len(), &self.allocator);

        for expression in &template.expressions {
            let value = self.normalize(expression, allowed, opaque, omit_undefined)?;

            changed |= !std::ptr::eq(value, expression);
            expressions.push(value.clone_in_with_semantic_ids(self.allocator));
        }

        if !changed {
            return Ok(node);
        }

        let quasis = template.quasis.clone_in_with_semantic_ids(self.allocator);

        Ok(self.allocator.alloc(Expression::new_template_literal(
            template.span,
            quasis,
            expressions,
            &self.builder,
        )))
    }

    /// Normalizes the value of an exported or imported constant by name.
    ///
    /// # Errors
    ///
    /// Returns `Themes.InvalidError` from resolution.
    pub fn exported(&self, name: &str) -> Result<Option<&'a Expression<'a>>> {
        let start = self.program.span.end + 1;
        let mut binding = None;

        'statements: for statement in &self.program.body {
            let declaration = match statement {
                Statement::ExportDeclaration(export) => Some(&export.declaration),
                other => other.as_declaration(),
            };
            let Some(oxc_ast::ast::Declaration::VariableDeclaration(variable)) = declaration else {
                continue;
            };

            if variable.kind != VariableDeclarationKind::Const {
                continue;
            }

            for declarator in &variable.declarations {
                if declarator
                    .id
                    .get_binding_identifier()
                    .is_some_and(|identifier| identifier.name == name)
                    && matches!(
                        declarator.id,
                        oxc_ast::ast::BindingPattern::BindingIdentifier(_)
                    )
                    && declarator.init.is_some()
                {
                    binding = Some((declarator.span.start, declarator.id.span()));
                    break 'statements;
                }
            }
        }

        if binding.is_none() {
            for statement in &self.program.body {
                let Statement::ImportDeclaration(import) = statement else {
                    continue;
                };

                if let Some(specifier) = import
                    .specifiers
                    .iter()
                    .flatten()
                    .find(|specifier| specifier.local().name == name)
                    && self.imports.contains_key(name)
                {
                    binding = Some((specifier.span().start, specifier.local().span));
                    break;
                }
            }
        }

        let Some((binding, span)) = binding else {
            return Ok(None);
        };

        // A synthetic reference after the program end resolves through the binding.
        let name: &'a str = self.allocator.alloc_str(name);
        let reference: &'a Expression<'a> = self.allocator.alloc(Expression::new_identifier(
            Span::new(start, start),
            name,
            &self.builder,
        ));
        let _ = span;

        self.synthetic.borrow_mut().insert(start, binding);
        let result = self.normalize(
            reference,
            &FxHashSet::default(),
            &FxHashSet::default(),
            true,
        );
        self.synthetic.borrow_mut().remove(&start);

        result.map(Some)
    }
}
