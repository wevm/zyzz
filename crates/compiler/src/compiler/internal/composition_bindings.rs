//! Resolves immutable applied-props aliases without reevaluating their initializers.
//!
//! Composition resolves names as a single forward walk sees them, so a read that precedes its
//! declaration resolves outward, as it does in the TypeScript compiler.

use oxc_ast::AstKind;
use oxc_ast::ast::{
    BindingPattern, CallExpression, Expression, LogicalOperator, VariableDeclarationKind,
    VariableDeclarator,
};
use oxc_semantic::Semantic;
use oxc_span::{GetSpan, Span};
use oxc_syntax::node::NodeId;
use oxc_syntax::symbol::SymbolId;
use rustc_hash::{FxHashMap, FxHashSet};

use crate::compiler::internal::expression::unwrap;
use crate::compiler::internal::scope::{self, Mode};
use crate::error::{Error, Result};

/// Immutable bindings and their reads in one module.
pub struct Bindings<'s, 'a> {
    declarations: FxHashMap<SymbolId, &'a VariableDeclarator<'a>>,
    evaluation: bool,
    exported: FxHashSet<SymbolId>,
    reads: FxHashMap<SymbolId, Vec<NodeId>>,
    /// Positional resolution of value reads, by identifier start.
    references: FxHashMap<u32, SymbolId>,
    semantic: &'s Semantic<'a>,
}

fn invalid(message: &str, span: Span) -> Error {
    Error::Themes {
        message: message.to_owned(),
        span,
    }
}

/// Collects `const` bindings with initializers, and the value reads each one has.
pub fn create<'s, 'a>(semantic: &'s Semantic<'a>) -> Bindings<'s, 'a> {
    let nodes = semantic.nodes();
    let mut bindings = Bindings {
        declarations: FxHashMap::default(),
        evaluation: false,
        exported: FxHashSet::default(),
        reads: FxHashMap::default(),
        references: FxHashMap::default(),
        semantic,
    };

    for node in nodes.iter() {
        match node.kind() {
            AstKind::CallExpression(call) => {
                if let Expression::Identifier(callee) = &call.callee
                    && callee.name == "eval"
                    && scope::lookup_before(
                        semantic,
                        "eval",
                        node.scope_id(),
                        call.span.start,
                        Mode::Value,
                    )
                    .is_none()
                {
                    bindings.evaluation = true;
                }
            }
            AstKind::VariableDeclarator(declarator) => {
                let parent = nodes.parent_id(node.id());
                let AstKind::VariableDeclaration(variable) = nodes.kind(parent) else {
                    continue;
                };

                if let (
                    VariableDeclarationKind::Const,
                    BindingPattern::BindingIdentifier(identifier),
                    Some(_),
                ) = (variable.kind, &declarator.id, &declarator.init)
                    && let Some(symbol) = identifier.symbol_id.get()
                {
                    bindings.declarations.insert(symbol, declarator);

                    if matches!(nodes.parent_kind(parent), AstKind::ExportDeclaration(_)) {
                        bindings.exported.insert(symbol);
                    }
                }
            }
            AstKind::IdentifierReference(identifier) => {
                if !scope::is_value_reference(nodes.parent_kind(node.id())) {
                    continue;
                }

                let Some(binding) = scope::lookup_before(
                    semantic,
                    &identifier.name,
                    node.scope_id(),
                    identifier.span.start,
                    Mode::Value,
                ) else {
                    continue;
                };

                bindings
                    .references
                    .insert(identifier.span.start, binding.symbol);
                bindings
                    .reads
                    .entry(binding.symbol)
                    .or_default()
                    .push(node.id());
            }
            _ => {}
        }
    }

    bindings
}

impl<'a> Bindings<'_, 'a> {
    /// Whether every read of a binding passes it to one of `ranges`, spreads it, reads its type, or
    /// initializes another safe binding.
    fn safe(
        &self,
        binding: SymbolId,
        ranges: &[&CallExpression<'a>],
        seen: &mut FxHashSet<SymbolId>,
    ) -> bool {
        if self.evaluation || self.exported.contains(&binding) {
            return false;
        }

        if !seen.insert(binding) {
            return true;
        }

        let nodes = self.semantic.nodes();

        self.reads
            .get(&binding)
            .map(Vec::as_slice)
            .unwrap_or_default()
            .iter()
            .all(|read| {
                let mut current = *read;
                let mut container = nodes.parent_id(current);

                loop {
                    let span = nodes.kind(current).span();
                    let transparent = match nodes.kind(container) {
                        AstKind::TSAsExpression(_)
                        | AstKind::TSNonNullExpression(_)
                        | AstKind::TSSatisfiesExpression(_)
                        | AstKind::TSTypeAssertion(_) => true,
                        AstKind::LogicalExpression(logical) => {
                            logical.operator == LogicalOperator::And && logical.right.span() == span
                        }
                        _ => false,
                    };

                    if !transparent {
                        break;
                    }

                    current = container;
                    container = nodes.parent_id(current);
                }

                let span = nodes.kind(current).span();

                match nodes.kind(container) {
                    AstKind::CallExpression(call) => {
                        ranges.iter().any(|range| range.span == call.span)
                            && call
                                .arguments
                                .iter()
                                .any(|argument| !argument.is_spread() && argument.span() == span)
                    }
                    AstKind::JSXSpreadAttribute(_) | AstKind::TSTypeQuery(_) => true,
                    AstKind::VariableDeclarator(declarator) => {
                        let symbol = declarator
                            .id
                            .get_binding_identifier()
                            .and_then(|identifier| identifier.symbol_id.get());

                        symbol.is_some_and(|symbol| {
                            self.declarations.contains_key(&symbol)
                                && self.safe(symbol, ranges, seen)
                        })
                    }
                    _ => false,
                }
            })
    }

    /// Follows identifiers through immutable `const` initializers to the applied value.
    ///
    /// `ranges` are the composition calls whose arguments may read a binding.
    ///
    /// # Errors
    ///
    /// Returns `Themes.InvalidError` for cyclic bindings, reads before initialization, and bindings
    /// with escaping reads.
    pub fn resolve(
        &self,
        input: &'a Expression<'a>,
        ranges: &[&CallExpression<'a>],
    ) -> Result<&'a Expression<'a>> {
        let mut node = unwrap(input);
        let mut seen = FxHashSet::default();

        while let Expression::Identifier(identifier) = node {
            let Some(binding) = self.references.get(&identifier.span.start).copied() else {
                break;
            };
            let Some(init) = self
                .declarations
                .get(&binding)
                .and_then(|declarator| declarator.init.as_ref())
            else {
                break;
            };

            if seen.contains(&binding) || identifier.span.start < init.span().end {
                return Err(invalid(
                    "Applied props bindings must be acyclic and follow initialization.",
                    identifier.span,
                ));
            }

            if !self.safe(binding, ranges, &mut FxHashSet::default()) {
                return Err(invalid(
                    "Applied props bindings must not escape before composition.",
                    identifier.span,
                ));
            }

            seen.insert(binding);
            node = unwrap(init);
        }

        Ok(node)
    }
}
