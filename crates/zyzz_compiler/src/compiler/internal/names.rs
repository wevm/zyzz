//! Derives emitted names from authored bindings rather than source locations.

use oxc_ast::AstKind;
use oxc_ast::ast::{BindingPattern, FunctionType, Program, PropertyKey};
use oxc_ast_visit::Visit;
use rustc_hash::FxHashMap;

use crate::compiler::internal::statics::key_literal;
use crate::internal::identity;

/// Collects readable declaration paths for calls in constants and namespaces, by call start.
///
/// A path joins enclosing namespace, `const`, property, and function names. Calls outside any
/// named declaration are named `style`.
pub fn collect(program: &Program<'_>) -> FxHashMap<u32, String> {
    let mut collector = Collector {
        names: FxHashMap::default(),
        parts: Vec::new(),
        pushed: Vec::new(),
    };

    collector.visit_program(program);
    collector.names
}

struct Collector {
    names: FxHashMap<u32, String>,
    /// Name parts of the enclosing declarations.
    parts: Vec<String>,
    /// Whether each entered node pushed a part.
    pushed: Vec<bool>,
}

fn part(kind: &AstKind<'_>) -> Option<String> {
    let key = |key: &PropertyKey<'_>, computed: bool| -> Option<String> {
        if computed {
            return None;
        }

        match key {
            PropertyKey::StaticIdentifier(identifier) => Some(identifier.name.to_string()),
            key => key_literal(key),
        }
    };

    match kind {
        AstKind::TSNamespaceDeclaration(namespace) => Some(namespace.id.name.to_string()),
        AstKind::TSGlobalDeclaration(_) => Some("global".to_owned()),
        AstKind::VariableDeclarator(declarator) => match &declarator.id {
            BindingPattern::BindingIdentifier(identifier) => Some(identifier.name.to_string()),
            _ => None,
        },
        AstKind::ObjectProperty(property) => key(&property.key, property.computed),
        AstKind::BindingProperty(property) => key(&property.key, property.computed),
        AstKind::AssignmentTargetPropertyProperty(property) => {
            key(&property.name, property.computed)
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

impl<'a> Visit<'a> for Collector {
    fn enter_node(&mut self, kind: AstKind<'a>) {
        if let AstKind::CallExpression(call) = kind {
            let name = if self.parts.is_empty() {
                "style".to_owned()
            } else {
                self.parts
                    .iter()
                    .map(|part| identity::name(part))
                    .collect::<Vec<_>>()
                    .join("-")
            };

            self.names.insert(call.span.start, name);
        }

        let part = part(&kind);

        self.pushed.push(part.is_some());

        if let Some(part) = part {
            self.parts.push(part);
        }
    }

    fn leave_node(&mut self, _: AstKind<'a>) {
        if self.pushed.pop() == Some(true) {
            self.parts.pop();
        }
    }
}
