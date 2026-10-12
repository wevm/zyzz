//! Derives emitted names from authored bindings rather than source locations.

use std::borrow::Cow;

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
        path: String::new(),
        segments: 0,
    };

    collector.visit_program(program);

    collector.names
}

struct Collector<'a> {
    /// Entered nodes, each with the path length before it and whether it added a segment.
    ancestors: Vec<(AstKind<'a>, usize, bool)>,
    names: FxHashMap<u32, String>,
    /// Encoded segments of the entered declarations, joined with `-`.
    path: String,
    /// Segments in `path`, which can be empty.
    segments: usize,
}

impl<'a> Visit<'a> for Collector<'a> {
    fn enter_node(&mut self, kind: AstKind<'a>) {
        if let AstKind::CallExpression(call) = kind {
            self.names.insert(
                call.span.start,
                if self.segments == 0 {
                    "style".to_owned()
                } else {
                    self.path.clone()
                },
            );
        }

        let length = self.path.len();
        let part = part(kind, self.ancestors.last().map(|(parent, ..)| *parent));

        if let Some(part) = &part {
            if self.segments > 0 {
                self.path.push('-');
            }

            identity::write_name(&mut self.path, part);
            self.segments += 1;
        }

        self.ancestors.push((kind, length, part.is_some()));
    }

    fn leave_node(&mut self, _: AstKind<'a>) {
        if let Some((_, length, segment)) = self.ancestors.pop() {
            self.path.truncate(length);
            self.segments -= usize::from(segment);
        }
    }
}

/// The name segment an ancestor contributes, as ESTree reports its declaration.
fn part<'a>(ancestor: AstKind<'a>, parent: Option<AstKind<'a>>) -> Option<Cow<'a, str>> {
    match ancestor {
        // A dotted namespace is one ESTree declaration with a qualified name.
        AstKind::TSNamespaceDeclaration(namespace) => {
            let dotted = matches!(
                namespace.body,
                TSNamespaceDeclarationBody::TSNamespaceDeclaration(_)
            ) || matches!(parent, Some(AstKind::TSNamespaceDeclaration(_)));

            (!dotted).then(|| Cow::Borrowed(namespace.id.name.as_str()))
        }
        AstKind::TSGlobalDeclaration(_) => Some(Cow::Borrowed("global")),
        AstKind::VariableDeclarator(declarator) => match &declarator.id {
            BindingPattern::BindingIdentifier(id) => Some(Cow::Borrowed(id.name.as_str())),
            _ => None,
        },
        AstKind::ObjectProperty(property) if !property.computed => key(&property.key),
        AstKind::BindingProperty(property) if !property.computed => key(&property.key),
        AstKind::AssignmentTargetPropertyProperty(property) if !property.computed => {
            key(&property.name)
        }
        AstKind::AssignmentTargetPropertyIdentifier(property) => {
            Some(Cow::Borrowed(property.binding.name.as_str()))
        }
        AstKind::Function(function) if function.r#type == FunctionType::FunctionDeclaration => {
            function
                .id
                .as_ref()
                .map(|id| Cow::Borrowed(id.name.as_str()))
        }
        _ => None,
    }
}

/// An identifier key's name or a literal key's `String(value)` spelling.
fn key<'a>(key: &PropertyKey<'a>) -> Option<Cow<'a, str>> {
    match key {
        PropertyKey::StaticIdentifier(identifier) => Some(Cow::Borrowed(identifier.name.as_str())),
        key => statics::key_literal(key),
    }
}
