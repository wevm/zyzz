//! Drives theme and variable reads in source order, as source extraction's identifier walk does.

use compiler::compiler::internal::scope::{self, Declaration, Mode};
use compiler::compiler::internal::syntax::Parsed;
use compiler::compiler::internal::themes::Themes;
use compiler::compiler::internal::vars::Variables;
use compiler::error::Error;
use oxc_allocator::GetAddress;
use oxc_ast::AstKind;
use oxc_ast::ast::{BindingPattern, Expression};
use oxc_ast_visit::Visit;
use oxc_span::GetSpan;

/// Which collector claimed an identifier read.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum Owner {
    /// The theme collector.
    Themes,
    /// The variable collector.
    Vars,
}

/// Reads the walk resolved and the diagnostics it reported, in walk order.
#[derive(Debug, Default)]
pub(crate) struct Outcome {
    /// Located failures, reported without stopping the walk.
    pub(crate) diagnostics: Vec<Error>,
    /// Starts of claimed reads and their owners.
    pub(crate) reads: Vec<(u32, Owner)>,
}

/// Walks a module and passes each reference identifier to the collectors.
pub(crate) fn walk<'a>(
    parsed: &Parsed<'a>,
    variables: &Variables<'a>,
    themes: Option<&mut Themes<'a>>,
) -> Outcome {
    let mut walker = Walker {
        ancestors: Vec::new(),
        outcome: Outcome::default(),
        parsed,
        themes,
        types: Vec::new(),
        variables,
    };

    walker.visit_program(parsed.program);

    walker.outcome
}

struct Walker<'s, 'a> {
    ancestors: Vec<AstKind<'a>>,
    outcome: Outcome,
    parsed: &'s Parsed<'a>,
    themes: Option<&'s mut Themes<'a>>,
    types: Vec<bool>,
    variables: &'s Variables<'a>,
}

/// Whether a node is a type subtree the extraction walk skips.
fn type_node(kind: AstKind<'_>, parent: Option<AstKind<'_>>) -> bool {
    let annotation = match parent {
        Some(AstKind::TSAsExpression(parent)) => Some(&parent.expression),
        Some(AstKind::TSSatisfiesExpression(parent)) => Some(&parent.expression),
        Some(AstKind::TSTypeAssertion(parent)) => Some(&parent.expression),
        _ => None,
    }
    .is_some_and(|expression: &Expression<'_>| expression.address() != kind.address());

    annotation
        || matches!(
            kind,
            AstKind::TSInterfaceDeclaration(_)
                | AstKind::TSTypeAliasDeclaration(_)
                | AstKind::TSTypeAnnotation(_)
                | AstKind::TSTypeParameterDeclaration(_)
                | AstKind::TSTypeParameterInstantiation(_)
                | AstKind::TSTypeQuery(_)
                | AstKind::ExportFromDeclaration(_)
        )
        || matches!(kind, AstKind::ExportNamedDeclaration(export) if export.export_kind.is_type())
        || matches!(kind, AstKind::ExportSpecifier(specifier) if specifier.export_kind.is_type())
}

impl<'a> Visit<'a> for Walker<'_, 'a> {
    fn enter_node(&mut self, kind: AstKind<'a>) {
        let parent = self.ancestors.last().copied();
        let typed = type_node(kind, parent);

        self.ancestors.push(kind);
        self.types.push(typed);
        self.read(kind, parent);
    }

    fn leave_node(&mut self, _: AstKind<'a>) {
        self.ancestors.pop();
        self.types.pop();
    }
}

impl<'a> Walker<'_, 'a> {
    fn read(&mut self, kind: AstKind<'a>, parent: Option<AstKind<'a>>) {
        let semantic = &self.parsed.semantic;
        let binding: Option<Declaration<'a>> = match kind {
            AstKind::IdentifierReference(identifier) => {
                if matches!(
                    parent,
                    Some(
                        AstKind::TSTypeReference(_)
                            | AstKind::TSQualifiedName(_)
                            | AstKind::TSClassImplements(_)
                            | AstKind::TSInterfaceHeritage(_)
                    )
                ) {
                    return;
                }

                scope::resolve(semantic, identifier)
            }
            AstKind::BindingIdentifier(identifier) => {
                let nested = match parent {
                    Some(
                        AstKind::BindingProperty(_)
                        | AstKind::ArrayPattern(_)
                        | AstKind::AssignmentPattern(_)
                        | AstKind::BindingRestElement(_),
                    ) => true,
                    Some(AstKind::FormalParameter(parameter)) => {
                        parameter.initializer.is_some()
                            && matches!(parameter.pattern, BindingPattern::BindingIdentifier(_))
                    }
                    _ => false,
                };

                if !nested {
                    return;
                }

                scope::lookup(
                    semantic,
                    &identifier.name,
                    scope::scope_of(semantic, kind.node_id()),
                    Mode::Value,
                )
            }
            _ => return,
        };

        if self.types.iter().any(|typed| *typed) {
            return;
        }

        let start = kind.span().start;
        let node_scope = scope::scope_of(semantic, kind.node_id());
        let lookup = |name: &str| scope::lookup(semantic, name, node_scope, Mode::Value);

        match self
            .variables
            .reference(kind, &self.ancestors, binding.as_ref())
        {
            Ok(true) => {
                self.outcome.reads.push((start, Owner::Vars));
                return;
            }
            Ok(false) => {}
            Err(error) => {
                self.outcome.diagnostics.push(error);
                return;
            }
        }

        let Some(themes) = self.themes.as_deref_mut() else {
            return;
        };

        match themes.reference(kind, &self.ancestors, binding.as_ref(), &lookup) {
            Ok(true) => self.outcome.reads.push((start, Owner::Themes)),
            Ok(false) => {}
            Err(error) => self.outcome.diagnostics.push(error),
        }
    }
}
