//! Derives emitted names from authored bindings rather than source locations.

use oxc_ast::AstKind;
use oxc_ast::ast::{
    BindingPattern, FunctionType, Program, PropertyKey, TSNamespaceDeclarationBody,
};
use oxc_ast_visit::Visit;
use rustc_hash::FxHashMap;

use crate::compiler::internal::statics;
use crate::internal::identity;

/// Collects readable declaration paths for calls in constants and namespaces.
///
/// Keys are call start offsets. A call outside any named declaration is named `style`.
pub fn collect(program: &Program<'_>) -> FxHashMap<u32, String> {
    let mut collector = Collector {
        ancestors: Vec::new(),
        names: FxHashMap::default(),
    };

    collector.visit_program(program);

    collector.names
}

struct Collector<'a> {
    ancestors: Vec<AstKind<'a>>,
    names: FxHashMap<u32, String>,
}

impl<'a> Visit<'a> for Collector<'a> {
    fn enter_node(&mut self, kind: AstKind<'a>) {
        if let AstKind::CallExpression(call) = kind {
            let mut parts: Vec<String> = Vec::new();

            for (index, ancestor) in self.ancestors.iter().enumerate() {
                if let Some(part) = part(
                    *ancestor,
                    index
                        .checked_sub(1)
                        .and_then(|index| self.ancestors.get(index))
                        .copied(),
                ) {
                    parts.push(identity::name(&part));
                }
            }

            self.names.insert(
                call.span.start,
                if parts.is_empty() {
                    "style".to_owned()
                } else {
                    parts.join("-")
                },
            );
        }

        self.ancestors.push(kind);
    }

    fn leave_node(&mut self, _: AstKind<'a>) {
        self.ancestors.pop();
    }
}

/// The name segment an ancestor contributes, as ESTree reports its declaration.
fn part(ancestor: AstKind<'_>, parent: Option<AstKind<'_>>) -> Option<String> {
    match ancestor {
        // A dotted namespace is one ESTree declaration with a qualified name.
        AstKind::TSNamespaceDeclaration(namespace) => {
            let dotted = matches!(
                namespace.body,
                TSNamespaceDeclarationBody::TSNamespaceDeclaration(_)
            ) || matches!(parent, Some(AstKind::TSNamespaceDeclaration(_)));

            (!dotted).then(|| namespace.id.name.to_string())
        }
        AstKind::TSGlobalDeclaration(_) => Some("global".to_owned()),
        AstKind::VariableDeclarator(declarator) => match &declarator.id {
            BindingPattern::BindingIdentifier(id) => Some(id.name.to_string()),
            _ => None,
        },
        AstKind::ObjectProperty(property) if !property.computed => key(&property.key),
        AstKind::BindingProperty(property) if !property.computed => key(&property.key),
        AstKind::AssignmentTargetPropertyProperty(property) if !property.computed => {
            key(&property.name)
        }
        AstKind::AssignmentTargetPropertyIdentifier(property) => {
            Some(property.binding.name.to_string())
        }
        AstKind::Function(function) if function.r#type == FunctionType::FunctionDeclaration => {
            function.id.as_ref().map(|id| id.name.to_string())
        }
        _ => None,
    }
}

/// An identifier key's name or a literal key's `String(value)` spelling.
fn key(key: &PropertyKey<'_>) -> Option<String> {
    match key {
        PropertyKey::StaticIdentifier(identifier) => Some(identifier.name.to_string()),
        key => statics::key_literal(key),
    }
}
